# Elora Marketplace M2 — Deliverable Summary

End-to-end implementation of Milestone 2: checkout, freight engine, payments, order pipeline, admin approval, warehouse fulfilment, and the integration scaffolding for Stripe + Xero.

---

## 1 · What was shipped

### Database (three new migrations)

| File | Purpose |
|---|---|
| `20260510000002_marketplace_freight.sql` | Rate sheets, brackets, product→sheet mappings, AusPost postcode table, Haversine helper. Storage bucket `marketplace-freight-matrices`. |
| `20260510000003_marketplace_orders.sql` | Orders header, line-items (snapshotted), status history (audit trail), checkout sessions, atomic `marketplace_next_order_number()` RPC, PO PDF storage bucket `marketplace-po-uploads`. Status state machine + transition trigger. |
| `20260510000004_marketplace_integrations.sql` | Xero credentials singleton, Xero sync log, generic integration log with idempotency-grade UNIQUE index on `(integration, event_id)`. Admin-only RLS throughout. |

Total new tables: **10**. Every table has RLS enabled.

### Edge Functions (Supabase, Deno)

| Function | Role | Auth |
|---|---|---|
| `marketplace_freight_quote` | Live freight calculation for cart/checkout | Buyer JWT |
| `marketplace_create_order` | Atomic order create: re-resolve prices, snapshot, freight, totals, atomic order number, wipe cart | Buyer JWT |
| `marketplace_approve_order` | Admin approve / reject / cancel with audit | Admin JWT (RLS) |
| `marketplace_postcode_seed` | AusPost dataset upserter (idempotent, ~40 embedded major postcodes; accepts full dataset via POST) | Admin JWT |
| `marketplace_stripe_create_checkout` | Stripe Checkout Session creator with metadata for webhook correlation | Buyer JWT |
| `marketplace_stripe_webhook` | Idempotent Stripe webhook (signature verify, replay-safe via UNIQUE index, marks order paid+approved) | Stripe signature |

Shared logic in `_shared/marketplaceFreight.ts` — the same freight calculator that the cart preview uses is also used at order-submit time, so the buyer sees the exact freight that gets snapshotted.

### Frontend pages

| Path | Page | Audience |
|---|---|---|
| `/marketplace/checkout` | 3-step checkout (delivery → site-access questions → payment) | Buyer |
| `/marketplace/checkout/success` | Stripe return / confirmation | Buyer |
| `/marketplace/orders` | Order history (search + status filter) | Buyer |
| `/marketplace/orders/:id` | Order detail (items, totals, status history, dispatch, tracking, PO download) | Buyer |
| `/admin/marketplace/orders` | Admin queue with status tabs + counts | Admin |
| `/admin/marketplace/orders/:id` | Admin order detail (Approve / Reject / Cancel + fulfilment editor + PO preview + Xero status) | Admin |
| `/admin/marketplace/integrations` | Integration log + Xero connection status | Admin |
| `/warehouse/orders` | Warehouse fulfilment dashboard (status tabs, dispatch / ETA / tracking, status transitions) | Warehouse user |

Plus updates to:
- `MarketplaceCart`: enabled **Continue to checkout** button (routes to `/marketplace/checkout`).
- `MarketplaceAdminDashboard`: added Orders + Integrations cards.
- `NavMain`: new buyer items (My Orders), admin items (Orders, Integrations), and a separate Warehouse group that only appears for users mapped to a warehouse via `marketplace_warehouse_users`.
- `SiteHeader`: cart badge already lands here (from M1.5 work).

New shared component:
- `components/marketplace/OrderStatusBadge.jsx` — light/dark themed badge for every order status with appropriate icon.

### Query layer

Extended `query/options/marketplace.js` with:
- `buyerOrdersOptions`, `buyerOrderDetailOptions`
- `adminOrdersOptions`, `adminOrderDetailOptions` (with Xero sync log join)
- `warehouseOrdersOptions` (scoped to the user's warehouse)
- `rateSheetsOptions`
- `integrationLogOptions`, `xeroCredentialsOptions`

Extended `query/mutations/marketplace.js` with:
- `useFreightQuote` (calls Edge Function)
- `useCreateOrder` (calls Edge Function; invalidates cart + orders caches)
- `useUploadPOPdf` (direct-to-storage with size + MIME validation)
- `useApproveOrder` (admin)
- `useUpdateOrderFulfilment` (admin / warehouse user)
- `useStripeCreateCheckout`
- Rate sheet CRUD: `useUpsertRateSheet`, `useDeleteRateSheet`, `useUpsertRateSheetBracket`, `useDeleteRateSheetBracket`

### Routes wired

`pages.config.js` + `App.jsx` route registrations for all 8 new pages. Buyer routes gated by `MarketplaceBuyerRoute`; admin routes by `MarketplaceAdminRoute`.

---

## 2 · How the end-to-end flow works

```
Buyer opens cart → "Continue to checkout"
   ↓
/marketplace/checkout
   Step 1: Delivery address (postcode triggers live freight quote via Edge Function)
   Step 2: Site-access questions (dynamic from products in cart)
   Step 3: Payment method
       → Purchase Order: upload PDF (stored in marketplace-po-uploads/<company_id>/<order_id>/<uuid>.pdf),
                         accept 30-day terms, submit
       → Stripe: continue to Stripe Checkout
   ↓
marketplace_create_order Edge Function
   - re-resolves prices via v_marketplace_buyer_prices
   - recalculates freight via shared logic
   - computes subtotal_ex_gst + freight_ex_gst + GST + total
   - calls marketplace_next_order_number() → "EL-2026-NNNNN"
   - inserts marketplace_orders + marketplace_order_items (snapshotted)
   - wipes cart
   - returns order_id + order_number
   ↓
If Stripe → marketplace_stripe_create_checkout → redirect to Stripe → webhook
                                                      ↓
                                            marketplace_stripe_webhook
                                            - verify signature
                                            - dedupe by event id
                                            - mark order paid + approved
                                            - update checkout_sessions
                                            - log to integration_log
If PO → buyer lands on /marketplace/orders/<id>; order in "Pending Approval"
   ↓
Admin opens /admin/marketplace/orders → tabs by status; counts shown.
Admin opens /admin/marketplace/orders/<id> → reviews PO PDF, line items, totals, customer.
   "Approve" → marketplace_approve_order Edge Function
       - status: pending_approval → approved
       - audit trail row written by trigger
       - integration_log "order_approved" entry
   "Reject" → modal asks for reason → status: pending_approval → rejected; reason stored.
   ↓
Warehouse user opens /warehouse/orders → sees only their warehouse's orders.
   - records supplier_dispatch_date, supplier_eta_date, tracking carrier/URL, notes
   - clicks "Mark dispatched" / "Mark delivered" → status transitions
   ↓
Buyer sees status updates on /marketplace/orders/<id> automatically (status history,
dispatch row, tracking link, warehouse notes).
```

All money values round to 2 decimal places per line and reconcile to the cent.

---

## 3 · Deployment steps

### 3.1 Apply the migrations

In Supabase SQL editor (in order, top-to-bottom):

1. `supabase/migrations/20260510000002_marketplace_freight.sql`
2. `supabase/migrations/20260510000003_marketplace_orders.sql`
3. `supabase/migrations/20260510000004_marketplace_integrations.sql`

Or via CLI:

```bash
supabase db push
```

Verify:

```sql
SELECT COUNT(*) FROM marketplace_orders;                  -- expect 0
SELECT marketplace_next_order_number();                   -- expect 'EL-2026-00001'
SELECT * FROM marketplace_xero_credentials;               -- one row, mostly null
SELECT id, name FROM storage.buckets WHERE id LIKE 'marketplace-%';
-- expect: marketplace-product-images, marketplace-product-sds,
--         marketplace-po-uploads, marketplace-freight-matrices
```

### 3.2 Deploy the Edge Functions

```bash
supabase functions deploy marketplace_freight_quote
supabase functions deploy marketplace_create_order
supabase functions deploy marketplace_approve_order
supabase functions deploy marketplace_postcode_seed
supabase functions deploy marketplace_stripe_create_checkout
supabase functions deploy marketplace_stripe_webhook --no-verify-jwt
```

The Stripe webhook **must** be deployed with `--no-verify-jwt` because Stripe doesn't send a Supabase JWT; signature verification is done in-function via `STRIPE_WEBHOOK_SECRET`.

### 3.3 Supabase project secrets

Set these via dashboard → Project Settings → Edge Functions:

```
STRIPE_SECRET_KEY            # reuse Chem Connect's secret key
STRIPE_WEBHOOK_SECRET        # see step 3.4
```

(The Xero env vars will be set when the Xero OAuth flow is wired — see "Known limitations" below.)

### 3.4 Stripe webhook URL

In the Stripe dashboard (same account as Chem Connect):

1. Add a new webhook endpoint: `https://<project>.supabase.co/functions/v1/marketplace_stripe_webhook`
2. Listen for: `checkout.session.completed`, `payment_intent.succeeded`, `checkout.session.expired`, `checkout.session.async_payment_failed`
3. Copy the signing secret → set as `STRIPE_WEBHOOK_SECRET` in Supabase project secrets.

### 3.5 Seed postcodes

Call the postcode seeder once. It has ~40 embedded major postcodes (capital cities + major regional) so the marketplace works for common delivery destinations out of the box:

```bash
curl -X POST 'https://<project>.supabase.co/functions/v1/marketplace_postcode_seed' \
  -H 'Authorization: Bearer <super_admin_jwt>' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

To load the full AusPost dataset later, POST `{ "rows": [...] }` with up to several thousand rows at a time (function chunks to 500 per upsert internally).

### 3.6 Create a rate sheet

Run via SQL editor or build the admin UI:

```sql
-- Example: a per-litre freight matrix
INSERT INTO marketplace_rate_sheets (warehouse_id, name, unit_type, min_charge, out_of_range_behavior)
SELECT id, 'AU Per-Litre', 'per_litre', 50, 'use_last_bracket'
FROM marketplace_warehouses
WHERE is_active = true
LIMIT 1
RETURNING id;
-- copy the returned id

INSERT INTO marketplace_rate_sheet_brackets (rate_sheet_id, distance_from_km, distance_to_km, rate)
VALUES
  ('<sheet_id>', 0,    100,  0.07),
  ('<sheet_id>', 100,  500,  0.12),
  ('<sheet_id>', 500,  1500, 0.18),
  ('<sheet_id>', 1500, NULL, 0.25);  -- final open-ended bracket

-- Map products to the sheet (NULL packaging_size = default for that product across all sizes)
INSERT INTO marketplace_product_rate_sheets (product_id, packaging_size_id, rate_sheet_id)
SELECT p.id, NULL, '<sheet_id>'
FROM marketplace_products p;
```

---

## 4 · Manual smoke test checklist

Use this as a Phase-by-Phase walk-through after deploying.

### Phase A — DB sanity (5 min)

- [ ] All three migrations applied without error.
- [ ] `SELECT marketplace_next_order_number();` returns `EL-2026-00001`.
- [ ] `SELECT COUNT(*) FROM marketplace_postcodes;` ≥ 30 (after seeding).
- [ ] `SELECT * FROM marketplace_rate_sheets;` shows your seeded sheet + brackets.
- [ ] All 4 storage buckets exist.

### Phase B — Buyer checkout (PO flow)

- [ ] Log in as a buyer in a `marketplace_enabled` company with at least one product in cart.
- [ ] Click **Continue to checkout** from the cart → land on `/marketplace/checkout`.
- [ ] Fill step 1 (address + postcode 4000) → see live freight quote update in the summary sidebar within ~500 ms.
- [ ] Step 2: answer site-access questions (if any).
- [ ] Step 3: choose Purchase Order → upload a PDF → check ✓ 30-day terms → submit.
- [ ] Land on `/marketplace/orders/<id>` showing **Pending approval** status, order number `EL-2026-NNNNN`, line items, totals, PO PDF link.

### Phase C — Admin approval

- [ ] Log in as marketplace admin. Marketplace Admin → Orders shows the new order in the "Pending approval" tab with a count badge.
- [ ] Click into the order. Click **Approve** → confirmation dialog → confirm.
- [ ] Status badge flips to **Approved**. History tab shows the transition timestamp + admin user.
- [ ] As buyer, refresh `/marketplace/orders/<id>` → status shows Approved.

### Phase D — Warehouse fulfilment

- [ ] Map a user to a warehouse: `INSERT INTO marketplace_warehouse_users (warehouse_id, user_id) VALUES (...)`.
- [ ] Log in as that user → Warehouse group appears in the sidebar.
- [ ] Open Dispatch dashboard → see the approved order.
- [ ] Fill in dispatch date + ETA + tracking carrier/URL → click **Mark dispatched**.
- [ ] As buyer, the order detail page now shows dispatch row + tracking link.

### Phase E — Stripe payment

- [ ] Add an item to cart → checkout → choose Stripe → continue.
- [ ] Stripe Checkout opens. Use test card `4242 4242 4242 4242`, any future expiry, any CVC.
- [ ] After payment, redirected to `/marketplace/checkout/success?order=<id>`.
- [ ] Order detail shows status **Approved** (Stripe orders auto-approve via webhook).
- [ ] Admin Integrations → Event log shows `stripe.checkout.session.completed` with the order id.

### Phase F — Idempotency & isolation

- [ ] In Stripe dashboard, **Resend** the `checkout.session.completed` webhook for the same event → verify Integrations log shows the replay was ignored (no duplicate order created, no second `order_marked_paid` entry).
- [ ] As a buyer from a DIFFERENT company, query `marketplace_orders` directly → should not see other companies' orders (RLS check).

### Phase G — Rejection flow

- [ ] Submit another PO order. As admin, click **Reject** → reason modal → enter "Credit hold pending" → confirm.
- [ ] As buyer, see Rejected status + reason on the order page.

---

## 5 · Security model

- **RLS on every marketplace table.** Three policy shapes consistently applied: admin (full access), buyer (own company scope), warehouse user (scoped via `is_warehouse_user(uuid)`).
- **Cart trigger** (from M1) still forces `company_id` from `user_profiles` on every cart insert.
- **Orders RLS**: buyers see their company's orders; warehouse users see only their warehouse's orders; admins see all.
- **Order line items, status history**: visibility inherits from the parent order via subquery.
- **PO upload storage** is scoped by path: a buyer can only write into `<their company_id>/...`. Admins can read all; buyers can only read their own.
- **Stripe webhook idempotency**: enforced by a UNIQUE index on `(integration, event_id)` in `marketplace_integration_log` plus `stripe_payment_intent_id` UNIQUE on `marketplace_orders`. Replays return 200 OK without re-processing.
- **Order numbering**: atomic via `INSERT ... ON CONFLICT ... DO UPDATE RETURNING` on `marketplace_order_number_sequences`. No race conditions, no gaps within a year.
- **Per-customer pricing** is still resolved server-side via `v_marketplace_buyer_prices` (security_invoker view). The Edge Function re-resolves at submit time, so client-side tampering can't cheat the price.
- **Stripe webhook** verifies signature with `STRIPE_WEBHOOK_SECRET` before any DB writes.
- **Admin auth** for `marketplace_approve_order` is enforced through RLS — non-admin callers' updates are blocked at the DB layer; the Edge Function adds a friendly 401/403.

---

## 6 · Known limitations / deferred work

| Item | Status | Why deferred |
|---|---|---|
| **Xero deep integration** (OAuth flow + invoice creation + PO creation + token refresh + email of invoice) | Scaffolding in place (DB tables, sync-log table, admin Integrations page with "not connected" state), but the four Xero Edge Functions are not yet written. Xero is wired enough for an admin to manually paste a tenant/credentials row, and the rest of the system reads from `xero_credentials`. | Xero's OAuth + tenant + invoice/PO API is a significant integration in itself; the buyer/admin/warehouse flows work end-to-end without it (PO orders flow through Approved → Dispatched → Delivered without ever needing Xero). Wiring Xero is a discrete next task. |
| **8 branded email templates + sender** | Closed in the hardening pass — see [M2_AUDIT_REPORT.md](./M2_AUDIT_REPORT.md). Implemented in `_shared/marketplaceEmail.ts` against **Mailgun** (same provider already used by `sendOrderStatusNotification`, `sendEmailReport`, etc.). All 8 templates render + send + log. | — |
| **Freight matrix CSV/XLSX bulk upload** | DB schema + storage bucket ready. Edge Function not written; admin can add brackets manually via the rate sheet API or SQL. | Most rate sheets have 5–10 brackets; manual entry is fine at launch. The CSV import is an admin productivity nicety. |
| **Admin Freight Rate Sheets UI** | Backed by query options + mutations (`rateSheetsOptions`, `useUpsertRateSheet`, etc.). UI page not built. | Admin can create rate sheets via direct SQL or the documented `INSERT` snippets in §3.6. The full UI is a v1.1 polish item. |
| **Per-kg / per-pallet / per-zone freight** | Calculated with approximations (1 L = 1 kg; 1 pallet per 1000 L) in `marketplaceFreight.ts`. | True kg / pallet pricing needs `weight_kg` or `pallet_config` columns on `marketplace_packaging_sizes`. Add when the seller actually uses these unit types. |
| **AusPost full dataset** | ~40 representative postcodes seeded out of the box; covers capitals + major regionals. | The seeder accepts the full ~16k dataset via POST. Load it once after deploy from the public AusPost open data. |
| **Order edits after submission** | Not supported. v1 flow: admin rejects → buyer re-submits. | Per the locked scope (G5 in dev plan). |
| **Refunds in-portal** | Out of scope per locked decisions. Admin processes refunds in Stripe dashboard; order can be marked Cancelled in the marketplace. | M2 spec. |

---

## 7 · Architecture decisions made

1. **Shared freight calculator.** `_shared/marketplaceFreight.ts` is used by both `marketplace_freight_quote` (cart preview) and `marketplace_create_order` (order submit). The buyer sees the exact freight that gets persisted — no drift between display and reality.

2. **Snapshotted line items.** `marketplace_order_items` denormalises product name, manufacturer, classification, packaging name, volume, price type, and unit price at order time. Admin product edits never rewrite historical orders. (Same pattern Chem Connect uses.)

3. **Status state machine via trigger.** `marketplace_orders_record_status_change()` AFTER-UPDATE trigger writes to `marketplace_order_status_history` whenever `status` changes. Audit trail is automatic — no application code needs to remember to log.

4. **Idempotency via UNIQUE index.** `marketplace_integration_log` has a partial UNIQUE on `(integration, event_id) WHERE event_id IS NOT NULL`. The Stripe webhook tries to insert the event id first; a 23505 unique-violation tells it the event was already processed and it returns 200 without further work.

5. **Atomic order numbering.** `INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING` is the cleanest concurrency-safe Postgres pattern. Sequence resets per calendar year via the year column being the PK.

6. **Per-warehouse RLS for fulfilment.** `is_warehouse_user(uuid)` from M1 already does the lookup against `marketplace_warehouse_users`. Orders RLS checks: `(warehouse_id IS NOT NULL AND public.is_warehouse_user(warehouse_id))`. Warehouse users never see prices because the warehouse-side queries don't select price columns — defence in depth.

7. **PO upload path convention** is enforced by RLS. The first folder segment of the storage path must equal the user's `company_id`, preventing a buyer from writing into another company's folder.

8. **Stripe webhook deploys with `--no-verify-jwt`.** Stripe doesn't send a Supabase JWT; we verify the Stripe signature in-function.

---

## 8 · Production-readiness review

| Concern | Status |
|---|---|
| Cross-company order isolation | ✅ Enforced by RLS on orders + items + history + checkout_sessions |
| Concurrent order-number collisions | ✅ Atomic via `marketplace_next_order_number()` |
| Duplicate Stripe webhooks | ✅ UNIQUE index + dedup in webhook handler |
| Buyer can't tamper with prices via body | ✅ Edge Function re-resolves via `v_marketplace_buyer_prices` |
| Buyer can't tamper with `company_id` | ✅ Edge Function reads `company_id` from `user_profiles`, not body; cart trigger from M1 also enforces |
| Buyer can't write to another company's PO storage path | ✅ Storage RLS keys on first folder segment |
| Buyer can't approve their own order | ✅ Admin RLS on UPDATE; Edge Function additionally rejects non-admin callers |
| Warehouse user can see prices | ✅ Their queries select only fulfilment-relevant columns; their RLS scope is warehouse, not company |
| GST reconciliation to the cent | ✅ All money rounds to 2dp at the line, sums to 2dp at the total |
| Order line items survive product deactivation/edit | ✅ Fully snapshotted at create time |
| Status transitions auditable | ✅ Trigger writes to `marketplace_order_status_history` |
| Marketplace tables don't collide with Elora compliance tables | ✅ All prefixed `marketplace_*` |
| RLS coverage | ✅ Every marketplace table has RLS enabled |
| Function grants for SECURITY DEFINER | ✅ All helper functions `GRANT EXECUTE TO authenticated` |
| Stripe signature verification | ✅ In `marketplace_stripe_webhook` |

---

## 9 · Manual testing checklist (condensed)

Run this on a clean staging environment:

- [ ] Apply M1 migrations + M2 migrations + 20260510000001 fix-up.
- [ ] Set seller_company_id (via admin UI or SQL).
- [ ] Deploy all 6 Edge Functions.
- [ ] Set Supabase secrets: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- [ ] Register Stripe webhook URL in Stripe dashboard.
- [ ] Seed postcodes (`marketplace_postcode_seed`).
- [ ] Create one rate sheet + brackets + map at least one product.
- [ ] Enable marketplace for at least one buyer company.
- [ ] Set per-customer override on at least one product (optional, validates pricing pipeline).
- [ ] **PO flow**: buyer cart → checkout → upload PO → submit → admin approves → buyer sees approved.
- [ ] **Stripe flow**: buyer cart → checkout → Stripe → test card → webhook → buyer sees paid+approved.
- [ ] **Reject flow**: PO order → admin rejects with reason → buyer sees rejection + reason.
- [ ] **Warehouse flow**: assign warehouse user → fulfil approved order → buyer sees dispatch + tracking.
- [ ] **Resilience**: replay Stripe webhook → no duplicate order.
- [ ] **Isolation**: log in as Buyer B, attempt to read Buyer A's `marketplace_orders` directly → empty.

---

## 10 · What to ship next (immediate follow-ups)

1. **Xero Edge Functions** (`marketplace_xero_oauth_start`, `_callback`, `_create_invoice`, `_create_po`, `_refresh_token`). When wired, the Approve action on admin orders will automatically create the Xero invoice (PO orders) and Xero PO (all orders). The hooks are already in `marketplace_approve_order` — just call them.
2. **Email sender + 8 templates**. Implemented in the hardening pass using **Mailgun** (the provider already used elsewhere in this portal). Templates: order placed, order approved, order rejected, Stripe receipt, dispatch confirmed, ETA updated, tracking added, admin alert (new PO awaiting approval). Order state changes still write to `marketplace_integration_log`; every send is recorded against the originating `order_id` for end-to-end audit.
3. **Admin Freight Rate Sheets UI**. The query layer + mutations are already in place. Build a simple page that lists sheets, allows brackets to be edited inline, and exposes a CSV upload that posts to `marketplace_freight_matrix_upload` (also unwritten).
4. **Postcode dataset full load**. Source the AusPost open data CSV, post it to `marketplace_postcode_seed` in batches of 5000.

---

## Files added/modified by this milestone

**New SQL migrations (3):**
- `supabase/migrations/20260510000002_marketplace_freight.sql`
- `supabase/migrations/20260510000003_marketplace_orders.sql`
- `supabase/migrations/20260510000004_marketplace_integrations.sql`

**New Edge Functions (6):**
- `supabase/functions/marketplace_freight_quote/index.ts`
- `supabase/functions/marketplace_create_order/index.ts`
- `supabase/functions/marketplace_approve_order/index.ts`
- `supabase/functions/marketplace_postcode_seed/index.ts`
- `supabase/functions/marketplace_stripe_create_checkout/index.ts`
- `supabase/functions/marketplace_stripe_webhook/index.ts`

**New shared module:**
- `supabase/functions/_shared/marketplaceFreight.ts`

**New React pages (8):**
- `src/pages/marketplace/MarketplaceCheckout.jsx`
- `src/pages/marketplace/MarketplaceCheckoutSuccess.jsx`
- `src/pages/marketplace/MarketplaceOrders.jsx`
- `src/pages/marketplace/MarketplaceOrderDetail.jsx`
- `src/pages/admin/marketplace/MarketplaceAdminOrders.jsx`
- `src/pages/admin/marketplace/MarketplaceAdminOrderDetail.jsx`
- `src/pages/admin/marketplace/MarketplaceIntegrations.jsx`
- `src/pages/warehouse/WarehouseOrders.jsx`

**New shared component:**
- `src/components/marketplace/OrderStatusBadge.jsx`

**Modified:**
- `src/query/keys.js` — added 12 new query key factories
- `src/query/options/marketplace.js` — added 8 new query options
- `src/query/mutations/marketplace.js` — added 8 new mutations
- `src/pages/marketplace/MarketplaceCart.jsx` — wired Continue-to-checkout
- `src/pages/admin/marketplace/MarketplaceAdminDashboard.jsx` — added Orders + Integrations cards
- `src/components/NavMain.jsx` — added Orders / Integrations / Warehouse group
- `src/pages.config.js` — registered 8 new pages
- `src/App.jsx` — registered 8 new routes
