// deno-lint-ignore-file no-explicit-any
import Stripe from 'https://esm.sh/stripe@14?target=denonext';
import { handleCors, corsHeaders } from '../_shared/cors.ts';
import { createSupabaseClient, createSupabaseAdminClient } from '../_shared/supabase.ts';
import { calculateFreightQuote } from '../_shared/marketplaceFreight.ts';
import { sendEmail } from '../_shared/marketplaceEmail.ts';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const stripeClient = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20', httpClient: Stripe.createFetchHttpClient() })
  : null;

/**
 * Atomic order create.
 *
 * POST {
 *   delivery_address: { line1, line2, suburb, state, postcode },
 *   delivery_postcode, delivery_contact_name, delivery_contact_phone, delivery_notes,
 *   site_access_answers: { [question_id]: any },
 *   payment_method: 'purchase_order' | 'stripe',
 *   po_pdf_path?: string,           // required for 'purchase_order'
 *   terms_accepted: boolean,        // required for 'purchase_order'
 * }
 *
 * Reads the caller's cart, re-resolves the per-buyer prices via
 * v_marketplace_buyer_prices (so admin can't tamper through the body),
 * calculates freight ex-GST + 10% GST + total, snapshots line items, calls
 * marketplace_next_order_number() for the ID, writes the order, wipes the
 * cart, and returns { order_id, order_number, status }.
 *
 * The buyer's auth JWT is used for all reads/writes so RLS confines
 * everything to their own company / cart.
 */
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const body = await req.json();
    const {
      delivery_address,
      delivery_postcode,
      delivery_contact_name,
      delivery_contact_phone,
      delivery_notes,
      site_access_answers,
      payment_method,
      // New (CQVS-style) checkout fields
      po_pdf_path,        // legacy single-file (still accepted)
      po_attachments,     // array of { path, name, size, type }
      po_number,          // buyer-supplied PO reference (free text)
      invoice_email,      // override of company default
      forklift_available, // boolean, captured in delivery step
      terms_accepted,
    } = body ?? {};

    // ---------- Input validation ----------
    if (!delivery_address || typeof delivery_address !== 'object') {
      return json({ error: 'delivery_address is required' }, 400);
    }
    const pcInput = String(delivery_postcode ?? '').trim();
    if (!pcInput) {
      return json({ error: 'delivery_postcode is required' }, 400);
    }
    if (!/^\d{4}$/.test(pcInput)) {
      return json({ error: `Postcode ${pcInput} is not a valid Australian postcode. Please enter a 4-digit street-address postcode.` }, 400);
    }
    // Defence-in-depth: reject the three Large Volume Receiver ranges before
    // we even build a checkout session. The freight engine blocks these too,
    // but catching them here avoids a wasted DB write and Google API call.
    const lvrMatch =
      /^1\d{3}$/.test(pcInput) ? { region: 'NSW', cbd: '2000 (Sydney CBD)' } :
      /^8\d{3}$/.test(pcInput) ? { region: 'VIC', cbd: '3000 (Melbourne CBD)' } :
      /^9\d{3}$/.test(pcInput) ? { region: 'QLD', cbd: '4000 (Brisbane CBD)' } :
      null;
    if (lvrMatch) {
      return json({
        error: `Postcode ${pcInput} is in the ${lvrMatch.region} Large Volume Receiver range (PO boxes only) and is not deliverable. Use the buyer's street-address postcode — for example, ${lvrMatch.cbd}.`,
      }, 400);
    }
    if (payment_method !== 'purchase_order' && payment_method !== 'stripe') {
      return json({ error: 'payment_method must be "purchase_order" or "stripe"' }, 400);
    }
    // Normalise multi-file attachments. Backward-compat: a legacy single
    // po_pdf_path becomes a one-element array.
    const attachments: Array<{ path: string; name?: string; size?: number; type?: string }> =
      Array.isArray(po_attachments) && po_attachments.length > 0
        ? po_attachments.filter((a: any) => a?.path)
        : po_pdf_path
          ? [{ path: po_pdf_path, name: 'purchase_order.pdf', type: 'application/pdf' }]
          : [];
    const firstAttachmentPath = attachments[0]?.path ?? null;

    if (payment_method === 'purchase_order') {
      if (attachments.length === 0) {
        return json({ error: 'At least one PO attachment is required for purchase_order' }, 400);
      }
      if (!String(po_number ?? '').trim()) {
        return json({ error: 'po_number is required for purchase_order' }, 400);
      }
      if (!terms_accepted) return json({ error: '30-day terms must be accepted' }, 400);
    }

    // ---------- Resolve caller ----------
    const supabase = createSupabaseClient(req);
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ error: 'Authentication required' }, 401);
    }
    const userId = userData.user.id;

    const { data: profile, error: profErr } = await supabase
      .from('user_profiles')
      .select('id, company_id, is_active')
      .eq('id', userId)
      .maybeSingle();
    if (profErr || !profile?.company_id) {
      return json({ error: 'User profile not found or has no company' }, 400);
    }

    const companyId = profile.company_id;

    // ---------- Read cart ----------
    const { data: cartItems, error: cartErr } = await supabase
      .from('marketplace_cart_items')
      .select('id, product_id, packaging_size_id, quantity');
    if (cartErr) throw cartErr;
    if (!cartItems || cartItems.length === 0) {
      return json({ error: 'Your cart is empty' }, 400);
    }

    // ---------- Resolve prices via the buyer-prices view ----------
    const { data: prices, error: priceErr } = await supabase
      .from('v_marketplace_buyer_prices')
      .select('product_id, packaging_size_id, price_type, price_per_litre, fixed_price, is_available')
      .in('product_id', cartItems.map((c: any) => c.product_id));
    if (priceErr) throw priceErr;

    const priceByKey = new Map<string, any>();
    (prices ?? []).forEach((p: any) => {
      priceByKey.set(`${p.product_id}::${p.packaging_size_id}`, p);
    });

    // ---------- Resolve product + packaging snapshots ----------
    const productIds = Array.from(new Set(cartItems.map((c: any) => c.product_id)));
    const sizeIds = Array.from(new Set(cartItems.map((c: any) => c.packaging_size_id)));
    const [productsRes, sizesRes] = await Promise.all([
      supabase
        .from('marketplace_products')
        .select('id, slug, name, manufacturer, classification, is_active')
        .in('id', productIds),
      supabase
        .from('marketplace_packaging_sizes')
        .select('id, name, volume_litres')
        .in('id', sizeIds),
    ]);
    if (productsRes.error) throw productsRes.error;
    if (sizesRes.error) throw sizesRes.error;
    const productById = new Map((productsRes.data ?? []).map((p: any) => [p.id, p]));
    const sizeById = new Map((sizesRes.data ?? []).map((s: any) => [s.id, s]));

    // ---------- Build line items (snapshotted) ----------
    let subtotal = 0;
    const itemRows: any[] = [];
    const inactive: string[] = [];

    for (const ci of cartItems) {
      const product = productById.get(ci.product_id);
      const size = sizeById.get(ci.packaging_size_id);
      const price = priceByKey.get(`${ci.product_id}::${ci.packaging_size_id}`);

      if (!product) { inactive.push(`Product ${ci.product_id} no longer exists.`); continue; }
      if (product.is_active === false) { inactive.push(`Product "${product.name}" is no longer active.`); continue; }
      if (!size) { inactive.push(`Packaging size ${ci.packaging_size_id} no longer exists.`); continue; }
      if (!price || price.is_available === false) {
        inactive.push(`No available price for "${product.name}" / ${size.name}.`);
        continue;
      }

      // Compute unit_price_ex_gst (per pack)
      let unitPrice = 0;
      if (price.price_type === 'per_litre') {
        const litres = size.volume_litres ? Number(size.volume_litres) : 0;
        unitPrice = round2(Number(price.price_per_litre) * litres);
      } else {
        unitPrice = round2(Number(price.fixed_price));
      }

      const lineSubtotal = round2(unitPrice * Number(ci.quantity));
      subtotal = round2(subtotal + lineSubtotal);

      itemRows.push({
        product_id: product.id,
        product_name: product.name,
        product_slug: product.slug,
        product_manufacturer: product.manufacturer ?? null,
        product_classification: product.classification ?? null,
        packaging_size_id: size.id,
        packaging_size_name: size.name,
        packaging_volume_litres: size.volume_litres ?? null,
        price_type: price.price_type,
        price_per_litre: price.price_type === 'per_litre' ? Number(price.price_per_litre) : null,
        fixed_price: price.price_type === 'fixed' ? Number(price.fixed_price) : null,
        unit_price_ex_gst: unitPrice,
        quantity: ci.quantity,
        line_subtotal_ex_gst: lineSubtotal,
      });
    }

    if (itemRows.length === 0) {
      return json({ error: 'No valid items in cart.', inactive }, 400);
    }

    // ---------- Freight quote ----------
    const freightLines = itemRows.map((r) => ({
      product_id: r.product_id,
      packaging_size_id: r.packaging_size_id,
      quantity: r.quantity,
    }));
    const freightQuote = await calculateFreightQuote(supabase, freightLines, String(delivery_postcode));

    if (freightQuote.blocked) {
      // Prefer the most specific note from the freight engine so the buyer
      // sees the actual reason (unknown postcode / out-of-range / warehouse
      // misconfig) rather than a generic message.
      const reason = freightQuote.notes?.[0] || 'Out-of-range delivery postcode or no warehouse configured.';
      return json({ error: `Cannot place order: ${reason}`, freight_quote: freightQuote }, 400);
    }

    // Stitch per-line freight back to itemRows for the snapshot
    for (const item of itemRows) {
      const fl = freightQuote.lines.find(
        (l) => l.product_id === item.product_id && l.packaging_size_id === item.packaging_size_id,
      );
      if (fl) {
        item.freight_rate_sheet_id = fl.rate_sheet_id;
        item.freight_ex_gst = fl.freight_ex_gst;
      }
    }

    const freightExGst = freightQuote.total_freight_ex_gst;

    // ---------- Resolve marketplace settings (currency, GST, MOQ, warehouse) ----------
    const { data: settings } = await supabase
      .from('marketplace_settings')
      .select('default_warehouse_id, currency, gst_rate, min_order_amount')
      .eq('id', 1)
      .maybeSingle();
    const gstRate = Number(settings?.gst_rate ?? 0.10);
    const currency = (settings?.currency ?? 'AUD').toUpperCase();
    const minOrderAmount = Number(settings?.min_order_amount ?? 0);

    // Enforce min-order subtotal (ex-GST) before we materialise the order.
    if (minOrderAmount > 0 && subtotal < minOrderAmount) {
      return json({
        error: `Order subtotal ${currency} ${subtotal.toFixed(2)} is below the marketplace minimum of ${currency} ${minOrderAmount.toFixed(2)} (ex-GST).`,
      }, 400);
    }

    const gstAmount = round2((subtotal + freightExGst) * gstRate);
    const totalAmount = round2(subtotal + freightExGst + gstAmount);

    // ---------- Resolve warehouse (default) ----------
    let warehouseId: string | null = settings?.default_warehouse_id ?? null;
    {
      if (!warehouseId) {
        const { data: wh } = await supabase
          .from('marketplace_warehouses')
          .select('id')
          .eq('is_active', true)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        warehouseId = wh?.id ?? null;
      }
    }

    // ========================================================================
    //  Stripe path — DEFERRED order creation.
    //
    //  We do NOT insert into marketplace_orders here. Instead we persist the
    //  calculated payload into marketplace_checkout_sessions and return the
    //  session id. The actual order row is materialised only when Stripe
    //  fires checkout.session.completed (or the manual finalize path). This
    //  matches Chem Connect's POST /api/orders behaviour and prevents orphan
    //  orders for abandoned / declined checkouts.
    // ========================================================================
    if (payment_method === 'stripe') {
      if (!stripeClient) {
        return json({ error: 'Stripe is not configured on the server (STRIPE_SECRET_KEY missing).' }, 500);
      }
      // Cart stays in place until payment succeeds — if the buyer abandons
      // Stripe they come back to their cart untouched.
      const admin = createSupabaseAdminClient();
      const intentPayload = {
        // Verbatim buyer input (after validation)
        delivery_address,
        delivery_postcode: String(delivery_postcode),
        delivery_contact_name: delivery_contact_name ?? null,
        delivery_contact_phone: delivery_contact_phone ?? null,
        delivery_notes: delivery_notes ?? null,
        site_access_answers: site_access_answers ?? null,
        payment_method: 'stripe',
        forklift_available: typeof forklift_available === 'boolean' ? forklift_available : null,
        invoice_email: invoice_email ?? null,
        // Authoritative server-side calc — webhook replays these exactly.
        buyer_user_id: userId,
        buyer_company_id: companyId,
        warehouse_id: warehouseId,
        currency,
        subtotal_ex_gst: subtotal,
        freight_ex_gst: freightExGst,
        gst_amount: gstAmount,
        total_amount: totalAmount,
        freight_quote: freightQuote,
        items: itemRows,
      };

      const { data: session, error: sessErr } = await admin
        .from('marketplace_checkout_sessions')
        .insert({
          order_id: null,
          user_id: userId,
          company_id: companyId,
          status: 'created',
          amount_total: totalAmount,
          currency,
          intent_payload: intentPayload,
        })
        .select('id, amount_total, currency')
        .single();
      if (sessErr) throw sessErr;

      // Create a PaymentIntent that the FE confirms inline via PaymentElement.
      // The checkout_session_id sits on the intent's metadata so the webhook
      // can materialise the order on payment_intent.succeeded.
      const amountCents = Math.round(Number(totalAmount) * 100);
      const piCurrency = String(currency ?? 'AUD').toLowerCase();
      const paymentIntent = await stripeClient.paymentIntents.create({
        amount: amountCents,
        currency: piCurrency,
        automatic_payment_methods: { enabled: true },
        metadata: {
          checkout_session_id: session.id,
          buyer_user_id: userId,
          buyer_company_id: companyId,
        },
        description: `Elora Marketplace purchase — ${cartItems.length} item${cartItems.length === 1 ? '' : 's'}`,
      });

      await admin
        .from('marketplace_checkout_sessions')
        .update({
          stripe_payment_intent_id: paymentIntent.id,
        })
        .eq('id', session.id);

      return json({
        // Deferred-creation contract: NO order_id yet.
        checkout_session_id: session.id,
        payment_intent_id: paymentIntent.id,
        client_secret: paymentIntent.client_secret,
        amount_total: session.amount_total,
        currency: session.currency,
        payment_method: 'stripe',
        deferred: true,
        inactive_warnings: inactive,
      }, 200);
    }

    // ========================================================================
    //  PO path — insert immediately (status=pending_approval).
    // ========================================================================
    // ---------- Generate order number ----------
    const { data: orderNumRow, error: numErr } = await supabase.rpc('marketplace_next_order_number');
    if (numErr) throw numErr;
    const orderNumber: string = String(orderNumRow);

    // ---------- Insert order ----------
    const initialStatus = 'pending_approval';
    const { data: insertedOrder, error: orderErr } = await supabase
      .from('marketplace_orders')
      .insert({
        order_number: orderNumber,
        buyer_user_id: userId,
        buyer_company_id: companyId,
        warehouse_id: warehouseId,
        status: initialStatus,
        payment_method,
        po_pdf_path: payment_method === 'purchase_order' ? firstAttachmentPath : null,
        po_attachments: payment_method === 'purchase_order' ? attachments : [],
        po_number: payment_method === 'purchase_order' ? String(po_number ?? '').trim() : null,
        invoice_email: invoice_email ?? null,
        forklift_available: typeof forklift_available === 'boolean' ? forklift_available : null,
        po_uploaded_at: payment_method === 'purchase_order' ? new Date().toISOString() : null,
        terms_accepted_at: payment_method === 'purchase_order' ? new Date().toISOString() : null,
        delivery_address,
        delivery_postcode: String(delivery_postcode),
        delivery_contact_name: delivery_contact_name ?? null,
        delivery_contact_phone: delivery_contact_phone ?? null,
        delivery_notes: delivery_notes ?? null,
        site_access_answers: site_access_answers ?? null,
        subtotal_ex_gst: subtotal,
        freight_ex_gst: freightExGst,
        gst_amount: gstAmount,
        total_amount: totalAmount,
        currency,
        freight_quote: freightQuote,
      })
      .select()
      .single();
    if (orderErr) throw orderErr;

    // ---------- Insert items ----------
    const rowsWithOrderId = itemRows.map((r) => ({ ...r, order_id: insertedOrder.id }));
    const { error: itemsErr } = await supabase
      .from('marketplace_order_items')
      .insert(rowsWithOrderId);
    if (itemsErr) throw itemsErr;

    // ---------- Wipe cart ----------
    await supabase.from('marketplace_cart_items').delete().eq('user_id', userId);

    // ---------- Audit log: initial status row ----------
    const admin = createSupabaseAdminClient();
    await admin.from('marketplace_order_status_history').insert({
      order_id: insertedOrder.id,
      from_status: null,
      to_status: initialStatus,
      changed_by_user_id: userId,
      reason: payment_method === 'purchase_order' ? 'Buyer submitted PO order' : 'Buyer submitted Stripe order',
    });

    // ---------- Best-effort: buyer "order placed" email + admin alert for PO ----------
    try {
      const enrichedOrder = { ...insertedOrder, buyer_company: { name: undefined, marketplace_invoice_email: undefined } };
      const { data: buyer } = await admin
        .from('user_profiles')
        .select('email')
        .eq('id', userId)
        .maybeSingle();
      const { data: company } = await admin
        .from('companies')
        .select('name, marketplace_invoice_email')
        .eq('id', companyId)
        .maybeSingle();
      if (company) enrichedOrder.buyer_company = company;
      const portalBase = Deno.env.get('MARKETPLACE_PORTAL_URL') ?? '';

      if (buyer?.email && payment_method === 'purchase_order') {
        await sendEmail({
          to: buyer.email,
          template: 'order_placed',
          data: { order: enrichedOrder, items: rowsWithOrderId, portal_base_url: portalBase },
          supabaseAdmin: admin,
          order_id: insertedOrder.id,
        });
      }

      // Admin alert (PO orders only — Stripe orders auto-approve so no manual review)
      if (payment_method === 'purchase_order') {
        const { data: settings } = await admin
          .from('marketplace_settings')
          .select('seller_company_id')
          .eq('id', 1)
          .maybeSingle();
        const sellerCompanyId = settings?.seller_company_id ?? null;
        const { data: admins } = await admin
          .from('user_profiles')
          .select('email, role, company_id, is_active')
          .in('role', ['super_admin', 'admin'])
          .eq('is_active', true);
        const adminRecipients = (admins ?? [])
          .filter((u: any) => u.role === 'super_admin' || (sellerCompanyId && u.company_id === sellerCompanyId))
          .map((u: any) => u.email)
          .filter(Boolean);
        if (adminRecipients.length > 0) {
          await sendEmail({
            to: adminRecipients,
            template: 'admin_new_po_alert',
            data: {
              order: enrichedOrder,
              items: rowsWithOrderId,
              buyer_company_name: company?.name,
              portal_base_url: portalBase,
            },
            supabaseAdmin: admin,
            order_id: insertedOrder.id,
          });
        }
      }
    } catch (e: any) {
      console.warn('Order-placed emails failed (non-fatal):', e?.message ?? e);
    }

    return json({
      order_id: insertedOrder.id,
      order_number: insertedOrder.order_number,
      status: insertedOrder.status,
      total_amount: insertedOrder.total_amount,
      currency: insertedOrder.currency,
      payment_method,
      inactive_warnings: inactive,
    }, 200);
  } catch (err: any) {
    console.error('marketplace_create_order error', err);
    return json({ error: err?.message ?? 'Internal error' }, 500);
  }
});

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function json(body: any, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
