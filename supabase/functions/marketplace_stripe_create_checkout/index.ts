// deno-lint-ignore-file no-explicit-any
import Stripe from 'https://esm.sh/stripe@14?target=denonext';
import { handleCors, corsHeaders } from '../_shared/cors.ts';
import { createSupabaseClient, createSupabaseAdminClient } from '../_shared/supabase.ts';

/**
 * POST { checkout_session_id, success_url, cancel_url }
 *
 * Creates a Stripe Checkout Session for a previously-created
 * marketplace_checkout_sessions row (deferred-order-creation pattern).
 * Stores the stripe_session_id back on the same row and returns the
 * Stripe redirect url.
 *
 * The Stripe session's metadata carries `checkout_session_id` so the
 * webhook can replay the saved intent_payload into marketplace_orders
 * after payment succeeds.
 *
 * Backward-compat: if the body contains `order_id` instead (legacy /
 * PO-late-pay path), we look the order up directly and skip the
 * intent_payload materialisation — the webhook will just flip status
 * the way it always has.
 */
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const body = await req.json();
    const { checkout_session_id, order_id, success_url, cancel_url } = body ?? {};

    const supabase = createSupabaseClient(req);
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return json({ error: 'Authentication required' }, 401);
    const userId = userData.user.id;

    // ----- New (preferred) path: deferred-creation session id -----
    if (checkout_session_id) {
      const admin = createSupabaseAdminClient();
      const { data: row, error: rowErr } = await admin
        .from('marketplace_checkout_sessions')
        .select('id, user_id, status, order_id, amount_total, currency, intent_payload')
        .eq('id', checkout_session_id)
        .maybeSingle();
      if (rowErr) throw rowErr;
      if (!row) return json({ error: 'Checkout session not found' }, 404);
      if (row.user_id !== userId) return json({ error: 'Forbidden — checkout session belongs to another user' }, 403);
      if (row.status === 'completed') return json({ error: 'Checkout session already completed' }, 409);

      const amountCents = Math.round(Number(row.amount_total) * 100);
      const currency = (row.currency ?? 'AUD').toLowerCase();
      const label = 'Elora Marketplace purchase';

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{
          price_data: { currency, product_data: { name: label }, unit_amount: amountCents },
          quantity: 1,
        }],
        success_url: success_url ?? `${new URL(req.url).origin}/marketplace/checkout/success?session=${row.id}`,
        cancel_url: cancel_url ?? `${new URL(req.url).origin}/marketplace/cart`,
        // checkout_session_id lets the webhook replay the saved intent.
        metadata: { checkout_session_id: row.id, buyer_user_id: userId },
      });

      await admin
        .from('marketplace_checkout_sessions')
        .update({ stripe_session_id: session.id })
        .eq('id', row.id);

      return json({
        url: session.url,
        session_id: session.id,
        checkout_session_id: row.id,
      }, 200);
    }

    // ----- Legacy path: order_id (kept for backward-compat) -----
    if (!order_id) return json({ error: 'checkout_session_id (or order_id) is required' }, 400);

    const { data: order, error: orderErr } = await supabase
      .from('marketplace_orders')
      .select('id, order_number, total_amount, currency, payment_method, status, buyer_user_id')
      .eq('id', order_id)
      .maybeSingle();
    if (orderErr) throw orderErr;
    if (!order) return json({ error: 'Order not found' }, 404);
    if (order.payment_method !== 'stripe') {
      return json({ error: 'Order is not configured for Stripe payment' }, 400);
    }
    if (order.status !== 'pending_approval') {
      return json({ error: `Cannot create Stripe Checkout for status "${order.status}"` }, 409);
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: (order.currency ?? 'AUD').toLowerCase(),
          product_data: { name: `Elora Marketplace Order ${order.order_number}` },
          unit_amount: Math.round(Number(order.total_amount) * 100),
        },
        quantity: 1,
      }],
      success_url: success_url ?? `${new URL(req.url).origin}/marketplace/checkout/success?order=${order.id}`,
      cancel_url: cancel_url ?? `${new URL(req.url).origin}/marketplace/cart`,
      metadata: { order_id: order.id, order_number: order.order_number },
    });

    const admin = createSupabaseAdminClient();
    await admin.from('marketplace_checkout_sessions').insert({
      order_id: order.id,
      user_id: userId,
      stripe_session_id: session.id,
      status: 'created',
      amount_total: Number(order.total_amount),
      currency: order.currency,
    });
    await admin.from('marketplace_orders').update({ stripe_session_id: session.id }).eq('id', order.id);

    return json({ url: session.url, session_id: session.id }, 200);
  } catch (err: any) {
    console.error('marketplace_stripe_create_checkout error', err);
    return json({ error: err?.message ?? 'Internal error' }, 500);
  }
});

function json(body: any, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
