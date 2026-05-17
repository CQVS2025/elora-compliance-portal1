// deno-lint-ignore-file no-explicit-any
import { handleCors, corsHeaders } from '../_shared/cors.ts';
import { createSupabaseAdminClient } from '../_shared/supabase.ts';
import { createPurchaseOrderForOrder } from '../_shared/marketplaceXero.ts';

/**
 * POST { order_id }
 *
 * Creates a Xero Purchase Order pointing at the warehouse contact (for the
 * warehouse to fulfil). Called by marketplace_approve_order on approval AND
 * by marketplace_stripe_webhook on Stripe payment. Idempotent: existing
 * xero_po_id short-circuits.
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
        warehouse:marketplace_warehouses ( id, name, contact_email )
      `)
      .eq('id', order_id)
      .maybeSingle();
    if (error) throw error;
    if (!order) return json({ error: 'Order not found' }, 404);

    if (order.xero_po_id) {
      return json({ ok: true, po_id: order.xero_po_id, existing: true }, 200);
    }

    const { data: items } = await admin
      .from('marketplace_order_items')
      .select('*')
      .eq('order_id', order_id)
      .order('created_at', { ascending: true });

    const result = await createPurchaseOrderForOrder(admin, order, items ?? [], order.warehouse ?? null);
    return json({ ok: true, ...result }, 200);
  } catch (err: any) {
    console.error('marketplace_xero_create_po error', err);
    return json({ error: err?.message ?? 'Internal error' }, 500);
  }
});

function json(body: any, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
