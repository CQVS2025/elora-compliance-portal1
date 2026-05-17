// deno-lint-ignore-file no-explicit-any
import { handleCors, corsHeaders } from '../_shared/cors.ts';
import { createSupabaseAdminClient } from '../_shared/supabase.ts';
import { createInvoiceForOrder } from '../_shared/marketplaceXero.ts';

/**
 * POST { order_id }
 *
 * Creates a Xero ACCREC invoice for the given marketplace order. Called by
 * marketplace_approve_order after a PO order is approved. Idempotent: if the
 * order already has xero_invoice_id, returns the existing one without
 * recreating.
 *
 * Service-role only (called from other Edge Functions). Admin-only when
 * called from the UI.
 */
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const body = await req.json();
    const { order_id } = body ?? {};
    if (!order_id) return json({ error: 'order_id is required' }, 400);

    const admin = createSupabaseAdminClient();
    const { data: order, error } = await admin
      .from('marketplace_orders')
      .select(`
        *,
        buyer_company:companies!buyer_company_id ( id, name, xero_contact_id, marketplace_invoice_email )
      `)
      .eq('id', order_id)
      .maybeSingle();
    if (error) throw error;
    if (!order) return json({ error: 'Order not found' }, 404);

    // Idempotent
    if (order.xero_invoice_id) {
      return json({
        ok: true,
        invoice_id: order.xero_invoice_id,
        invoice_number: order.xero_invoice_number,
        existing: true,
      }, 200);
    }

    const { data: items } = await admin
      .from('marketplace_order_items')
      .select('*')
      .eq('order_id', order_id)
      .order('created_at', { ascending: true });

    const result = await createInvoiceForOrder(admin, order, items ?? []);
    return json({ ok: true, ...result }, 200);
  } catch (err: any) {
    console.error('marketplace_xero_create_invoice error', err);
    return json({ error: err?.message ?? 'Internal error' }, 500);
  }
});

function json(body: any, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
