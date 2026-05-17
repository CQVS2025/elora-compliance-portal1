// deno-lint-ignore-file no-explicit-any
import Stripe from 'https://esm.sh/stripe@14?target=denonext';
import { createSupabaseAdminClient } from '../_shared/supabase.ts';
import { createPurchaseOrderForOrder } from '../_shared/marketplaceXero.ts';
import { sendEmail } from '../_shared/marketplaceEmail.ts';

/**
 * Stripe webhook handler.
 *
 * Verifies the signature with STRIPE_WEBHOOK_SECRET, deduplicates by event
 * id (UNIQUE index on marketplace_integration_log.event_id), and flips
 * orders to 'paid'/'approved' when checkout.session.completed or
 * payment_intent.succeeded arrive.
 *
 * No CORS handling — Stripe servers POST directly.
 */

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const signature = req.headers.get('Stripe-Signature');
  const body = await req.text();
  if (!signature) return new Response('Missing signature', { status: 400 });

  let event: any;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      STRIPE_WEBHOOK_SECRET,
      undefined,
      cryptoProvider,
    );
  } catch (err: any) {
    console.error('Stripe signature verification failed', err?.message ?? err);
    return new Response(`Webhook signature failed: ${err?.message ?? 'unknown'}`, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  // Idempotency check — UNIQUE index on (integration, event_id)
  try {
    const { error: logErr } = await admin
      .from('marketplace_integration_log')
      .insert({
        integration: 'stripe',
        event_type: event.type,
        status: 'received',
        event_id: event.id,
        payload: event.data?.object ?? null,
      });
    if (logErr) {
      // Duplicate event — already processed
      if (logErr.code === '23505') {
        console.log(`Replay of Stripe event ${event.id} — ignored.`);
        return new Response('Replay ignored', { status: 200 });
      }
      throw logErr;
    }
  } catch (err: any) {
    console.error('Failed to log Stripe event', err);
    // Continue — better to attempt processing than drop the event silently
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const paymentIntentId = session.payment_intent;

        // Two paths for resolving the buyer's intent:
        //   - NEW (deferred):  session.metadata.checkout_session_id points at
        //                      a marketplace_checkout_sessions row that has
        //                      no order_id yet. We materialise the order now.
        //   - LEGACY (eager):  session.metadata.order_id points at an
        //                      already-inserted order. We just flip status.
        const checkoutSessionId = session.metadata?.checkout_session_id;
        let orderId = session.metadata?.order_id;

        if (checkoutSessionId && !orderId) {
          // ----- Deferred materialisation -----
          const { data: cs, error: csErr } = await admin
            .from('marketplace_checkout_sessions')
            .select('id, user_id, company_id, status, intent_payload, order_id')
            .eq('id', checkoutSessionId)
            .maybeSingle();
          if (csErr) throw csErr;
          if (!cs) {
            console.warn(`checkout.session.completed: session ${checkoutSessionId} not found`);
            break;
          }
          if (cs.order_id) {
            // Idempotent: a previous webhook delivery already materialised
            // the order. Just make sure status reflects the payment.
            orderId = cs.order_id;
          } else {
            const p = cs.intent_payload ?? {};
            // Generate order number now (atomic per year)
            const { data: orderNumRow, error: numErr } = await admin
              .rpc('marketplace_next_order_number');
            if (numErr) throw numErr;
            const orderNumber = String(orderNumRow);

            const { data: newOrder, error: insErr } = await admin
              .from('marketplace_orders')
              .insert({
                order_number: orderNumber,
                buyer_user_id: cs.user_id,
                buyer_company_id: cs.company_id,
                warehouse_id: p.warehouse_id ?? null,
                status: 'approved',
                payment_method: 'stripe',
                delivery_address: p.delivery_address,
                delivery_postcode: p.delivery_postcode,
                delivery_contact_name: p.delivery_contact_name,
                delivery_contact_phone: p.delivery_contact_phone,
                delivery_notes: p.delivery_notes,
                site_access_answers: p.site_access_answers,
                subtotal_ex_gst: p.subtotal_ex_gst,
                freight_ex_gst: p.freight_ex_gst,
                gst_amount: p.gst_amount,
                total_amount: p.total_amount,
                currency: p.currency ?? 'AUD',
                freight_quote: p.freight_quote,
                stripe_session_id: session.id,
                stripe_payment_intent_id: paymentIntentId,
                stripe_paid_at: new Date().toISOString(),
                approved_at: new Date().toISOString(),
              })
              .select()
              .single();
            if (insErr) throw insErr;
            orderId = newOrder.id;

            // Line items
            const items = Array.isArray(p.items) ? p.items : [];
            if (items.length > 0) {
              const itemRows = items.map((it: any) => ({ ...it, order_id: orderId }));
              const { error: itemsErr } = await admin
                .from('marketplace_order_items')
                .insert(itemRows);
              if (itemsErr) throw itemsErr;
            }

            // Status history
            await admin.from('marketplace_order_status_history').insert({
              order_id: orderId,
              from_status: null,
              to_status: 'approved',
              changed_by_user_id: cs.user_id,
              reason: 'Buyer Stripe payment succeeded — order materialised by webhook',
            });

            // Wipe the buyer's cart now that the order has materialised.
            if (cs.user_id) {
              await admin.from('marketplace_cart_items').delete().eq('user_id', cs.user_id);
            }
          }
        } else if (orderId) {
          // ----- Legacy / PO-late-pay path: order already exists -----
          const { error: ordErr } = await admin
            .from('marketplace_orders')
            .update({
              status: 'approved',
              stripe_session_id: session.id,
              stripe_payment_intent_id: paymentIntentId,
              stripe_paid_at: new Date().toISOString(),
              approved_at: new Date().toISOString(),
            })
            .eq('id', orderId);
          if (ordErr) throw ordErr;
        } else {
          console.warn('checkout.session.completed with neither checkout_session_id nor order_id metadata');
          break;
        }

        // Update the marketplace_checkout_sessions row regardless of path.
        await admin
          .from('marketplace_checkout_sessions')
          .update({
            order_id: orderId,
            status: 'completed',
            stripe_payment_intent_id: paymentIntentId,
            amount_total: session.amount_total ? session.amount_total / 100 : null,
            currency: session.currency?.toUpperCase() ?? 'AUD',
            raw_payload: session,
          })
          .or(`stripe_session_id.eq.${session.id}${checkoutSessionId ? `,id.eq.${checkoutSessionId}` : ''}`);

        await admin.from('marketplace_integration_log').insert({
          order_id: orderId,
          integration: 'stripe',
          event_type: 'order_marked_paid',
          status: 'success',
          payload: { session_id: session.id, payment_intent_id: paymentIntentId, checkout_session_id: checkoutSessionId },
        });

        // Best-effort post-payment actions: Xero PO + receipt email.
        // Failures are logged but not raised — the webhook returns 200 OK
        // so Stripe doesn't retry.
        try {
          const { data: order } = await admin
            .from('marketplace_orders')
            .select(`*, warehouse:marketplace_warehouses ( id, name, contact_email, is_supplier_managed, xero_contact_id, xero_contact_details ), buyer_company:companies!buyer_company_id ( id, name, marketplace_invoice_email )`)
            .eq('id', orderId)
            .maybeSingle();
          if (order) {
            const { data: items } = await admin
              .from('marketplace_order_items')
              .select('*')
              .eq('order_id', orderId)
              .order('created_at', { ascending: true });
            if (!order.xero_po_id) {
              try { await createPurchaseOrderForOrder(admin, order, items ?? [], order.warehouse ?? null); }
              catch (e: any) { console.warn('Xero PO from Stripe webhook failed:', e?.message ?? e); }
            }
            // Stripe receipt email (in addition to Stripe's own receipt)
            try {
              const { data: buyer } = await admin
                .from('user_profiles')
                .select('email')
                .eq('id', order.buyer_user_id)
                .maybeSingle();
              const buyerEmail = buyer?.email ?? order.buyer_company?.marketplace_invoice_email ?? null;
              if (buyerEmail) {
                await sendEmail({
                  to: buyerEmail,
                  template: 'order_stripe_receipt',
                  data: { order, items: items ?? [], portal_base_url: Deno.env.get('MARKETPLACE_PORTAL_URL') ?? '' },
                  supabaseAdmin: admin,
                  order_id: orderId,
                });
              }
            } catch (e: any) { console.warn('Stripe receipt email failed:', e?.message ?? e); }
          }
        } catch (e: any) {
          console.warn('Post-payment actions failed:', e?.message ?? e);
        }
        break;
      }
      case 'payment_intent.succeeded': {
        // Payment Element path: this is the PRIMARY event (no Checkout Session
        // was ever created). For Hosted Checkout sessions this fires AFTER
        // checkout.session.completed and is a no-op (we detect via metadata).
        const pi = event.data.object;
        const checkoutSessionId = pi.metadata?.checkout_session_id;
        if (!checkoutSessionId) {
          // Likely a stripe.checkout.sessions.create event chain — the
          // checkout.session.completed handler above already materialised it.
          break;
        }
        const paymentIntentId = pi.id;

        const { data: cs, error: csErr } = await admin
          .from('marketplace_checkout_sessions')
          .select('id, user_id, company_id, status, intent_payload, order_id')
          .eq('id', checkoutSessionId)
          .maybeSingle();
        if (csErr) throw csErr;
        if (!cs) {
          console.warn(`payment_intent.succeeded: checkout session ${checkoutSessionId} not found`);
          break;
        }

        let orderId: string | null = cs.order_id;
        if (!orderId) {
          const p = cs.intent_payload ?? {};
          const { data: orderNumRow, error: numErr } = await admin
            .rpc('marketplace_next_order_number');
          if (numErr) throw numErr;
          const orderNumber = String(orderNumRow);

          const { data: newOrder, error: insErr } = await admin
            .from('marketplace_orders')
            .insert({
              order_number: orderNumber,
              buyer_user_id: cs.user_id,
              buyer_company_id: cs.company_id,
              warehouse_id: p.warehouse_id ?? null,
              status: 'approved',
              payment_method: 'stripe',
              delivery_address: p.delivery_address,
              delivery_postcode: p.delivery_postcode,
              delivery_contact_name: p.delivery_contact_name,
              delivery_contact_phone: p.delivery_contact_phone,
              delivery_notes: p.delivery_notes,
              site_access_answers: p.site_access_answers,
              forklift_available: typeof p.forklift_available === 'boolean' ? p.forklift_available : null,
              invoice_email: p.invoice_email ?? null,
              subtotal_ex_gst: p.subtotal_ex_gst,
              freight_ex_gst: p.freight_ex_gst,
              gst_amount: p.gst_amount,
              total_amount: p.total_amount,
              currency: p.currency ?? 'AUD',
              freight_quote: p.freight_quote,
              stripe_payment_intent_id: paymentIntentId,
              stripe_paid_at: new Date().toISOString(),
              approved_at: new Date().toISOString(),
            })
            .select()
            .single();
          if (insErr) throw insErr;
          orderId = newOrder.id;

          const items = Array.isArray(p.items) ? p.items : [];
          if (items.length > 0) {
            const itemRows = items.map((it: any) => ({ ...it, order_id: orderId }));
            const { error: itemsErr } = await admin
              .from('marketplace_order_items')
              .insert(itemRows);
            if (itemsErr) throw itemsErr;
          }

          await admin.from('marketplace_order_status_history').insert({
            order_id: orderId,
            from_status: null,
            to_status: 'approved',
            changed_by_user_id: cs.user_id,
            reason: 'Buyer Stripe payment succeeded — order materialised by payment_intent.succeeded',
          });

          if (cs.user_id) {
            await admin.from('marketplace_cart_items').delete().eq('user_id', cs.user_id);
          }
        }

        await admin
          .from('marketplace_checkout_sessions')
          .update({
            order_id: orderId,
            status: 'completed',
            stripe_payment_intent_id: paymentIntentId,
            amount_total: typeof pi.amount === 'number' ? pi.amount / 100 : null,
            currency: pi.currency?.toUpperCase() ?? 'AUD',
            raw_payload: pi,
          })
          .eq('id', checkoutSessionId);

        await admin.from('marketplace_integration_log').insert({
          order_id: orderId,
          integration: 'stripe',
          event_type: 'order_marked_paid',
          status: 'success',
          payload: { payment_intent_id: paymentIntentId, checkout_session_id: checkoutSessionId },
        });

        // Best-effort post-payment actions (Xero PO + Stripe receipt email).
        try {
          const { data: order } = await admin
            .from('marketplace_orders')
            .select(`*, warehouse:marketplace_warehouses ( id, name, contact_email, is_supplier_managed, xero_contact_id, xero_contact_details ), buyer_company:companies!buyer_company_id ( id, name, marketplace_invoice_email )`)
            .eq('id', orderId)
            .maybeSingle();
          if (order) {
            const { data: items } = await admin
              .from('marketplace_order_items')
              .select('*')
              .eq('order_id', orderId)
              .order('created_at', { ascending: true });
            if (!order.xero_po_id) {
              try { await createPurchaseOrderForOrder(admin, order, items ?? [], order.warehouse ?? null); }
              catch (e: any) { console.warn('Xero PO from Stripe webhook failed:', e?.message ?? e); }
            }
            try {
              const { data: buyer } = await admin
                .from('user_profiles')
                .select('email')
                .eq('id', order.buyer_user_id)
                .maybeSingle();
              const buyerEmail = order.invoice_email ?? buyer?.email ?? order.buyer_company?.marketplace_invoice_email ?? null;
              if (buyerEmail) {
                await sendEmail({
                  to: buyerEmail,
                  template: 'order_stripe_receipt',
                  data: { order, items: items ?? [], portal_base_url: Deno.env.get('MARKETPLACE_PORTAL_URL') ?? '' },
                  supabaseAdmin: admin,
                  order_id: orderId,
                });
              }
            } catch (e: any) { console.warn('Stripe receipt email failed:', e?.message ?? e); }
          }
        } catch (e: any) {
          console.warn('Post-payment actions failed:', e?.message ?? e);
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object;
        const orderId = pi.metadata?.order_id;
        if (orderId) {
          await admin.from('marketplace_integration_log').insert({
            order_id: orderId,
            integration: 'stripe',
            event_type: 'payment_failed',
            status: 'failed',
            event_id: event.id + '_failed',
            payload: { payment_intent_id: pi.id, last_payment_error: pi.last_payment_error },
            error_message: pi.last_payment_error?.message ?? 'Stripe payment failed',
          });
        }
        break;
      }
      case 'charge.refunded':
      case 'charge.dispute.created': {
        // Recorded for admin visibility; no order state change automatic — refunds are processed manually.
        await admin.from('marketplace_integration_log').insert({
          integration: 'stripe',
          event_type: event.type,
          status: 'received',
          event_id: event.id + '_followup',
          payload: event.data?.object ?? null,
        });
        break;
      }
      case 'checkout.session.expired':
      case 'checkout.session.async_payment_failed': {
        const session = event.data.object;
        await admin
          .from('marketplace_checkout_sessions')
          .update({ status: 'expired', raw_payload: session })
          .eq('stripe_session_id', session.id);
        break;
      }
      default:
        // Unhandled — already logged via the integration_log insert above.
        break;
    }

    return new Response('ok', { status: 200 });
  } catch (err: any) {
    console.error('Stripe webhook handling error', err);
    await admin.from('marketplace_integration_log').insert({
      integration: 'stripe',
      event_type: event.type,
      status: 'failed',
      event_id: event.id + '_handler',
      payload: event.data?.object ?? null,
      error_message: err?.message ?? String(err),
    });
    return new Response('handler error', { status: 500 });
  }
});
