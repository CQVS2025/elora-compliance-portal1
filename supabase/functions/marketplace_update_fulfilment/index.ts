// deno-lint-ignore-file no-explicit-any
import { handleCors, corsHeaders } from '../_shared/cors.ts';
import { createSupabaseClient, createSupabaseAdminClient } from '../_shared/supabase.ts';
import { sendEmail, type EmailTemplate } from '../_shared/marketplaceEmail.ts';

/**
 * POST { order_id, patch: { supplier_dispatch_date?, supplier_eta_date?,
 *        supplier_tracking_url?, supplier_tracking_carrier?, supplier_notes?,
 *        supplier_freight_cost?, status? } }
 *
 * Used by admins and warehouse users to update fulfilment fields on an
 * approved/paid/dispatched order. Centralised here so we can fire the
 * correct notification email based on which fields changed:
 *
 *   - dispatch_date set or status -> dispatched   ⇒ "dispatch_confirmed"
 *   - eta_date changed                            ⇒ "eta_updated"
 *   - tracking_url newly set                      ⇒ "tracking_added"
 *
 * Authorisation: RLS on marketplace_orders allows admins OR the assigned
 * warehouse user to UPDATE. The Edge Function uses the caller's JWT so
 * those checks are enforced at the DB layer.
 */
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const body = await req.json();
    const { order_id, patch } = body ?? {};
    if (!order_id) return json({ error: 'order_id is required' }, 400);
    if (!patch || typeof patch !== 'object') return json({ error: 'patch is required' }, 400);

    const supabase = createSupabaseClient(req);

    // Read the order before update so we can compare what changed
    const { data: before, error: beforeErr } = await supabase
      .from('marketplace_orders')
      .select('id, status, supplier_dispatch_date, supplier_eta_date, supplier_tracking_url, supplier_tracking_carrier, buyer_user_id')
      .eq('id', order_id)
      .maybeSingle();
    if (beforeErr) throw beforeErr;
    if (!before) return json({ error: 'Order not found or no access' }, 404);

    // Whitelist allowed fields
    const allowed = ['supplier_dispatch_date', 'supplier_eta_date', 'supplier_tracking_url',
      'supplier_tracking_carrier', 'supplier_notes', 'supplier_freight_cost', 'status'];
    const updates: any = {};
    for (const k of allowed) {
      if (patch[k] !== undefined) updates[k] = patch[k];
    }
    if (Object.keys(updates).length === 0) {
      return json({ error: 'No allowed fields in patch' }, 400);
    }
    // Validate status transitions (warehouse may only set dispatched / delivered)
    if (updates.status && !['dispatched', 'delivered'].includes(updates.status)) {
      return json({ error: `Cannot set status to "${updates.status}" via fulfilment` }, 400);
    }

    const { data: updated, error: updErr } = await supabase
      .from('marketplace_orders')
      .update(updates)
      .eq('id', order_id)
      .select(`*, buyer_company:companies!buyer_company_id ( name, marketplace_invoice_email )`)
      .single();
    if (updErr) throw updErr;

    // Determine which (if any) notification to send.
    // We send at most ONE email per fulfilment update, prioritised:
    //   dispatch_confirmed > tracking_added > eta_updated
    const admin = createSupabaseAdminClient();
    const { data: items } = await admin
      .from('marketplace_order_items')
      .select('*')
      .eq('order_id', order_id);

    const { data: buyer } = await admin
      .from('user_profiles')
      .select('email')
      .eq('id', updated.buyer_user_id)
      .maybeSingle();
    const buyerEmail = buyer?.email ?? updated.buyer_company?.marketplace_invoice_email ?? null;

    let template: EmailTemplate | null = null;
    const becameDispatched =
      updates.status === 'dispatched' ||
      (updates.supplier_dispatch_date && !before.supplier_dispatch_date);
    const trackingNewlySet =
      updates.supplier_tracking_url && !before.supplier_tracking_url;
    const etaChanged =
      updates.supplier_eta_date &&
      String(updates.supplier_eta_date) !== String(before.supplier_eta_date);

    if (becameDispatched) template = 'dispatch_confirmed';
    else if (trackingNewlySet) template = 'tracking_added';
    else if (etaChanged) template = 'eta_updated';

    if (template && buyerEmail) {
      try {
        await sendEmail({
          to: buyerEmail,
          template,
          data: { order: updated, items: items ?? [], portal_base_url: Deno.env.get('MARKETPLACE_PORTAL_URL') ?? '' },
          supabaseAdmin: admin,
          order_id,
        });
      } catch (e: any) {
        console.warn('Fulfilment email failed:', e?.message ?? e);
      }
    }

    return json({ ok: true, order: updated, email_sent: template }, 200);
  } catch (err: any) {
    console.error('marketplace_update_fulfilment error', err);
    return json({ error: err?.message ?? 'Internal error' }, 500);
  }
});

function json(body: any, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
