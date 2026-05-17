// deno-lint-ignore-file no-explicit-any
import { handleCors, corsHeaders } from '../_shared/cors.ts';
import { createSupabaseClient, createSupabaseAdminClient } from '../_shared/supabase.ts';
import { createInvoiceForOrder, createPurchaseOrderForOrder } from '../_shared/marketplaceXero.ts';
import { sendEmail } from '../_shared/marketplaceEmail.ts';

/**
 * POST { order_id: string, action: 'approve' | 'reject' | 'cancel', reason?: string }
 *
 * Admin-only (enforced via RLS + helper). On approve:
 *   1. Update status pending_approval -> approved
 *   2. For PO orders: create Xero invoice (idempotent), create Xero PO
 *   3. Email buyer (order_approved) + log
 *
 * On reject:
 *   1. Update status -> rejected with reason
 *   2. Email buyer (order_rejected)
 *
 * On cancel:
 *   1. Update status -> cancelled
 *   2. No email by default (admin can communicate manually).
 *
 * The Xero + email calls are best-effort; failures are logged to
 * marketplace_xero_sync_log / marketplace_integration_log but DO NOT block
 * the status change. Admin can retry via the Integrations page.
 */
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const body = await req.json();
    const { order_id, action, reason } = body ?? {};

    if (!order_id) return json({ error: 'order_id is required' }, 400);
    if (!['approve', 'reject', 'cancel'].includes(action)) {
      return json({ error: 'action must be "approve", "reject", or "cancel"' }, 400);
    }
    if (action === 'reject' && !reason) {
      return json({ error: 'reason is required when rejecting' }, 400);
    }

    const supabase = createSupabaseClient(req);
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return json({ error: 'Authentication required' }, 401);
    const userId = userData.user.id;

    const { data: order, error: orderErr } = await supabase
      .from('marketplace_orders')
      .select('id, status, payment_method, order_number, buyer_user_id, buyer_company_id, xero_invoice_id, xero_po_id')
      .eq('id', order_id)
      .maybeSingle();
    if (orderErr) throw orderErr;
    if (!order) return json({ error: 'Order not found or you do not have access' }, 404);

    // Validate state transitions
    if (action === 'approve' && order.status !== 'pending_approval') {
      return json({ error: `Cannot approve an order in status "${order.status}"` }, 409);
    }
    if (action === 'reject' && order.status !== 'pending_approval') {
      return json({ error: `Cannot reject an order in status "${order.status}"` }, 409);
    }
    if (action === 'cancel' && !['pending_approval', 'approved', 'paid'].includes(order.status)) {
      return json({ error: `Cannot cancel an order in status "${order.status}"` }, 409);
    }

    const nextStatus = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'cancelled';
    const updates: any = { status: nextStatus };
    const nowIso = new Date().toISOString();
    if (action === 'approve') {
      updates.approved_by_user_id = userId;
      updates.approved_at = nowIso;
    } else if (action === 'reject') {
      updates.rejected_by_user_id = userId;
      updates.rejected_at = nowIso;
      updates.rejection_reason = reason ?? null;
    }

    const { data: updated, error: updErr } = await supabase
      .from('marketplace_orders')
      .update(updates)
      .eq('id', order_id)
      .select()
      .single();
    if (updErr) throw updErr;

    // ---- Downstream actions (best-effort, errors logged not raised) ----
    const admin = createSupabaseAdminClient();

    if (action === 'approve') {
      await fireApprovalSideEffects(admin, order_id, order.payment_method);
    } else if (action === 'reject') {
      await fireRejectionSideEffects(admin, order_id);
    }

    return json({ ok: true, order: updated }, 200);
  } catch (err: any) {
    console.error('marketplace_approve_order error', err);
    return json({ error: err?.message ?? 'Internal error' }, 500);
  }
});

async function fireApprovalSideEffects(
  // deno-lint-ignore no-explicit-any
  admin: any,
  orderId: string,
  paymentMethod: string,
) {
  // Reload the full order + buyer + warehouse + items (we need the joins).
  const { data: order, error } = await admin
    .from('marketplace_orders')
    .select(`
      *,
      buyer_company:companies!buyer_company_id ( id, name, xero_contact_id, xero_invoicing_enabled, marketplace_invoice_email ),
      warehouse:marketplace_warehouses ( id, name, contact_email, is_supplier_managed, xero_contact_id, xero_contact_details )
    `)
    .eq('id', orderId)
    .maybeSingle();
  if (error || !order) return;

  const { data: items } = await admin
    .from('marketplace_order_items')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  // --- Xero invoice (PO orders only, and only for buyer companies that
  //     have been registered in Xero via Customer Marketplace Access ---
  if (paymentMethod === 'purchase_order' && !order.xero_invoice_id) {
    if (order.buyer_company?.xero_invoicing_enabled) {
      try {
        await createInvoiceForOrder(admin, order, items ?? []);
      } catch (e: any) {
        // Already logged inside createInvoiceForOrder
        console.warn('Xero invoice creation failed:', e?.message ?? e);
      }
    } else {
      // Not opted in — log so admin can register the company and retry.
      await admin.from('marketplace_xero_sync_log').insert({
        order_id: orderId,
        operation: 'invoice_create',
        status: 'skipped',
        error_message: `Buyer company "${order.buyer_company?.name ?? order.buyer_company_id}" is not registered for Xero invoicing. Enable it from Customer Marketplace Access → Register in Xero.`,
      });
    }
  }

  // --- Xero PO (both paths if not already created) ---
  if (!order.xero_po_id) {
    try {
      await createPurchaseOrderForOrder(admin, order, items ?? [], order.warehouse ?? null);
    } catch (e: any) {
      console.warn('Xero PO creation failed:', e?.message ?? e);
    }
  }

  // --- Email the buyer (order_approved) ---
  try {
    const buyerEmail = await getBuyerEmail(admin, order);
    if (buyerEmail) {
      await sendEmail({
        to: buyerEmail,
        template: 'order_approved',
        data: { order, items: items ?? [], portal_base_url: Deno.env.get('MARKETPLACE_PORTAL_URL') ?? '' },
        supabaseAdmin: admin,
        order_id: orderId,
      });
    }
  } catch (e: any) {
    console.warn('Approval email failed:', e?.message ?? e);
  }
}

async function fireRejectionSideEffects(
  // deno-lint-ignore no-explicit-any
  admin: any,
  orderId: string,
) {
  const { data: order } = await admin
    .from('marketplace_orders')
    .select(`
      *,
      buyer_company:companies!buyer_company_id ( id, name, marketplace_invoice_email )
    `)
    .eq('id', orderId)
    .maybeSingle();
  if (!order) return;

  const { data: items } = await admin
    .from('marketplace_order_items')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  try {
    const buyerEmail = await getBuyerEmail(admin, order);
    if (buyerEmail) {
      await sendEmail({
        to: buyerEmail,
        template: 'order_rejected',
        data: { order, items: items ?? [], portal_base_url: Deno.env.get('MARKETPLACE_PORTAL_URL') ?? '' },
        supabaseAdmin: admin,
        order_id: orderId,
      });
    }
  } catch (e: any) {
    console.warn('Rejection email failed:', e?.message ?? e);
  }
}

// deno-lint-ignore no-explicit-any
async function getBuyerEmail(admin: any, order: any): Promise<string | null> {
  const { data: buyer } = await admin
    .from('user_profiles')
    .select('email')
    .eq('id', order.buyer_user_id)
    .maybeSingle();
  return buyer?.email ?? order.buyer_company?.marketplace_invoice_email ?? null;
}

function json(body: any, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
