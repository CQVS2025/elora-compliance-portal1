# Elora Marketplace — Milestone 1 Deliverable

**Status:** Complete · ready for review and migration deploy.
**Scope:** Foundation, catalogue management, per-customer pricing, buyer browsing, persistent cart, security pass.
**Out of scope (M2):** checkout, freight quoting, Stripe, Xero, emails, warehouse dispatch, order lifecycle.

---

## 1 · Summary of completed work

The marketplace module is built natively into the existing Elora portal — same auth, same UI primitives, same data-fetching patterns, same migration conventions, same RLS philosophy. Nothing was bolted on; the marketplace tab feels like every other tab in the system.

What's now live in the codebase:

- **Two new database migrations** (foundation + catalog) creating 11 marketplace tables, extending `companies` and `user_permissions`, and adding 4 SECURITY DEFINER helper functions.
- **Two storage buckets** with explicit RLS — `marketplace-product-images` (public read, admin write) and `marketplace-product-sds` (authed read for enabled buyers, admin write).
- **One Postgres view** (`v_marketplace_buyer_prices`) with `security_invoker = true` that resolves the effective per-buyer price for every (product, packaging_size) on the fly.
- **Marketplace permission layer** sitting on top of Elora's existing role hierarchy. No existing role flag was touched.
- **6 admin pages** — dashboard, customer access, warehouses, products, product editor, customer pricing.
- **3 buyer pages** — catalogue, product detail, cart.
- **5 reusable marketplace components** — image, hazard badge, price tag, packaging selector, empty state.
- **Marketplace nav group** added to `NavMain` with conditional visibility.
- **Production-ready query layer** — `query/options/marketplace.js`, `query/mutations/marketplace.js`, query keys extended.
- **Demo seed script** (`scripts/seed-marketplace-demo.mjs`).

---

## 2 · Architecture decisions

### 2.1 Why a parallel permission flag, not a new role

Elora's existing role enum (`super_admin`, `admin`, `manager`, `user`, `batcher`, `driver`, `delivery_manager`, `viewer`) governs compliance features. Adding marketplace concerns into that hierarchy would conflate two unrelated axes (compliance ↔ marketplace). Instead, I added three additive flags on `user_permissions` (`marketplace_admin`, `marketplace_buyer`, `marketplace_warehouse_id`) and a per-company toggle on `companies` (`marketplace_enabled`). The existing role table is untouched.

The mental model:
- **Marketplace admin** = `super_admin` OR `admin` OR `user_permissions.marketplace_admin = true`
- **Marketplace buyer** = active user whose company has `marketplace_enabled = true`
- **Warehouse user** = user with a row in `marketplace_warehouse_users` (M1 just registers the role concept; M2 builds the dispatch screen)

### 2.2 Why `marketplace_*`-prefixed tables

All marketplace tables share a prefix so they're easy to spot in any SQL listing, easy to migrate in bulk, and don't risk colliding with existing names like `cart_items` or `products` (Elora already has a `products` table for compliance-reporting cost calculations — distinct purpose).

### 2.3 Why per-company pricing is a Postgres view, not client-side merging

The single highest-stakes bug class in this module is one company seeing another's negotiated prices. To eliminate it structurally:

1. RLS on `marketplace_company_pricing` filters reads to the calling user's own `company_id`.
2. The view `v_marketplace_buyer_prices` is created `WITH (security_invoker = true)` so the RLS above applies whenever a buyer queries it.
3. Buyer pages and the cart query the view — never the underlying override table directly. There is no client-side join that could leak data.
4. Admin pages query the underlying override table directly; admin RLS lets that through.

Three layers of defence; no single line of code is the trust boundary.

### 2.4 Why the cart doesn't snapshot prices

Cart items intentionally have no `unit_price` column. Prices re-resolve every read via the view. This means:
- An admin lowering a price for a customer applies immediately to anything already in their cart.
- An admin raising a price doesn't lock buyers into a stale lower price either.
- Snapshotting will happen at order-time in M2 via `order_items` (already planned in the implementation plan).

### 2.5 Why a `BEFORE INSERT/UPDATE` trigger on cart

`marketplace_cart_items` requires a `company_id` for clean RLS / future multi-tenant joins, but we don't want to trust the client to send the correct one. A `SECURITY DEFINER` trigger overwrites `company_id` with the value from `user_profiles` on every write. The client cannot inject a foreign company_id even with a tampered request.

### 2.6 Why a `security_invoker` view for buyer prices, not an Edge Function

Initially I considered an Edge Function `marketplace_get_buyer_catalog` to compute per-buyer pricing server-side. The view approach won because:
- Buyer pages need detail-page level filtering (one product at a time) that's easier with SQL than RPC plumbing.
- The view + RLS combination is auditable: a security review reads two policies.
- React Query caches the view results identically to any other supabase query.
- No new Edge Function to deploy / monitor in M1.

The Edge Function pattern is reserved for M2 where order creation needs a snapshot and atomic cart→order conversion.

---

## 3 · Database / schema changes

### 3.1 New tables (11)

| Table | Purpose |
|---|---|
| `marketplace_settings` | Singleton: seller company id, currency, GST rate. |
| `marketplace_warehouses` | Fulfilment warehouses (single row at launch). |
| `marketplace_warehouse_users` | Maps users to warehouses (M2 dispatch). |
| `marketplace_packaging_sizes` | Lookup: 20L pail, 200L drum, 1000L IBC, Bulk. |
| `marketplace_products` | Catalogue: name, slug, descriptions, hazard fields. |
| `marketplace_product_packaging_prices` | Default per-(product, size) price. |
| `marketplace_company_pricing` | **NEW for Elora** — per-customer override per (product, size). |
| `marketplace_product_images` | Gallery — `storage_path` into `marketplace-product-images`. |
| `marketplace_product_documents` | SDS PDFs — `storage_path` into `marketplace-product-sds`. |
| `marketplace_product_checkout_questions` | Site-access questions per product/size (admin-managed in M1; rendered M2). |
| `marketplace_cart_items` | Persistent buyer cart, RLS-scoped to owner. |

### 3.2 Extensions to existing tables

```sql
ALTER TABLE companies
  ADD COLUMN marketplace_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN marketplace_invoice_email TEXT,
  ADD COLUMN marketplace_default_address JSONB;

ALTER TABLE user_permissions
  ADD COLUMN marketplace_admin BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN marketplace_buyer BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN marketplace_warehouse_id UUID REFERENCES marketplace_warehouses(id) ON DELETE SET NULL;
```

Defaults preserve current behaviour: until an admin opts a customer in, the marketplace tab does not appear.

### 3.3 Helper functions

- `public.is_marketplace_admin()` — used in RLS policies and reflected by JS helper.
- `public.user_marketplace_enabled()` — used in RLS to gate buyer reads.
- `public.current_user_company_id()` — used in the buyer-prices view JOIN.
- `public.is_warehouse_user(uuid)` — used by warehouse-user policies in M2.

### 3.4 View

`v_marketplace_buyer_prices` resolves: for every (product, packaging_size) the calling user is allowed to see, return either the per-customer override row (if any active for their company) or the default row. `security_invoker = true` so RLS on the underlying tables applies.

### 3.5 Storage buckets

| Bucket | Public | Max size | MIME types |
|---|---|---|---|
| `marketplace-product-images` | yes (read) | 5 MB | png, jpg, jpeg, webp |
| `marketplace-product-sds` | no | 10 MB | application/pdf |

Both have RLS policies on `storage.objects` that match the table-level pattern: anyone (or any auth'd, enabled buyer) can read; only `is_marketplace_admin()` can write/update/delete.

### 3.6 Migration files

```
supabase/migrations/20260509000001_marketplace_foundation.sql
supabase/migrations/20260509000002_marketplace_catalog.sql
```

Both follow Elora's existing migration conventions (timestamped name, `gen_random_uuid()`, `IF NOT EXISTS`, `now()`, `RLS enabled in same migration`, RLS policies right after table definition).

---

## 4 · New routes / pages / components

### 4.1 Routes (added to `App.jsx`)

| Path | Audience | Page |
|---|---|---|
| `/marketplace` | Buyer | `MarketplaceCatalog` |
| `/marketplace/products/:slug` | Buyer | `MarketplaceProductDetail` |
| `/marketplace/cart` | Buyer | `MarketplaceCart` |
| `/admin/marketplace` | Marketplace admin | `MarketplaceAdminDashboard` |
| `/admin/marketplace/companies` | Marketplace admin | `MarketplaceCompanies` |
| `/admin/marketplace/warehouses` | Marketplace admin | `MarketplaceWarehouses` |
| `/admin/marketplace/products` | Marketplace admin | `MarketplaceProducts` |
| `/admin/marketplace/products/:id` | Marketplace admin | `MarketplaceProductEditor` (uses `:id = "new"` for create) |
| `/admin/marketplace/pricing` | Marketplace admin | `MarketplaceCompanyPricing` |

All buyer routes wrap in `<MarketplaceBuyerRoute>`; all admin routes wrap in `<MarketplaceAdminRoute>` (both defined in `src/components/auth/MarketplaceRoute.jsx`).

### 4.2 Pages

```
src/pages/marketplace/MarketplaceCatalog.jsx
src/pages/marketplace/MarketplaceProductDetail.jsx
src/pages/marketplace/MarketplaceCart.jsx

src/pages/admin/marketplace/MarketplaceAdminDashboard.jsx
src/pages/admin/marketplace/MarketplaceCompanies.jsx
src/pages/admin/marketplace/MarketplaceWarehouses.jsx
src/pages/admin/marketplace/MarketplaceProducts.jsx
src/pages/admin/marketplace/MarketplaceProductEditor.jsx
src/pages/admin/marketplace/MarketplaceCompanyPricing.jsx
```

### 4.3 Reusable components

```
src/components/marketplace/MarketplaceImage.jsx
src/components/marketplace/HazardBadge.jsx
src/components/marketplace/PriceTag.jsx
src/components/marketplace/PackagingSelector.jsx
src/components/marketplace/MarketplaceEmpty.jsx
```

### 4.4 Permission / route layer

```
src/lib/marketplacePermissions.js
src/hooks/useMarketplaceAccess.js
src/components/auth/MarketplaceRoute.jsx   (+ MarketplaceAdminRoute, MarketplaceBuyerRoute)
src/lib/marketplaceFormat.js                (currency, line-subtotal calc, slugify)
```

### 4.5 Query layer

```
src/query/options/marketplace.js
src/query/mutations/marketplace.js
src/query/keys.js                           (extended with marketplace keys)
```

### 4.6 NavMain integration

Added a Marketplace sidebar group in `src/components/NavMain.jsx`, conditionally rendered via `useMarketplaceAccess()`. Group contains:
- Marketplace (catalog) — for buyers
- My Cart — for buyers
- Marketplace Admin — for admins (with "New" badge)

### 4.7 AuthContext changes

`src/lib/AuthContext.jsx` now selects three additional columns from the company on profile hydration: `marketplace_enabled`, `marketplace_invoice_email`, `marketplace_default_address`. They're flattened onto the userProfile so route guards / nav read them without an extra fetch.

---

## 5 · Backend functions / services

No new Edge Functions in M1. All buyer & admin reads use the Supabase REST API + RLS + the `v_marketplace_buyer_prices` view. Direct supabase.from() mutations are used for cart and admin writes; RLS confines them.

The marketplace migrations register four SECURITY DEFINER helper functions used inside RLS policies:

| Function | Used by |
|---|---|
| `is_marketplace_admin()` | All admin-write policies |
| `user_marketplace_enabled()` | Buyer-read policies on products / prices / images / SDS |
| `current_user_company_id()` | The `v_marketplace_buyer_prices` view JOIN |
| `is_warehouse_user(uuid)` | Reserved for M2 dispatch RLS |

The first Edge Function (`marketplace_create_order`) lands in M2.

---

## 6 · Security measures implemented

### 6.1 RLS policies (every marketplace table)

Three policy shapes consistently applied:

- **Admin policy:** `USING (public.is_marketplace_admin()) WITH CHECK (public.is_marketplace_admin())`
- **Buyer-read policy:** `USING (public.is_marketplace_admin() OR public.user_marketplace_enabled())` plus, for company-scoped data, an `AND company_id = public.current_user_company_id()` clause.
- **Cart owner policy:** `USING (user_id = auth.uid())` for read/update/delete; insert further requires `public.user_marketplace_enabled()`.

### 6.2 Cross-company pricing isolation (verified by design)

- `marketplace_company_pricing` SELECT policy filters by `company_id = current_user_company_id()` for buyers.
- `v_marketplace_buyer_prices` is `security_invoker = true` so its underlying RLS applies.
- Buyer pages always query the view, never the override table.
- Cart cannot be poisoned with a foreign company_id (trigger forces it from the user_profiles row).

### 6.3 SDS document privacy

- Bucket `marketplace-product-sds` is **private**. Reads require a signed URL (`createSignedUrl`, 10 min expiry) and only enabled buyers can request one (storage RLS).
- A buyer who shares the signed URL in a chat message will see it expire in minutes; it's not a permanent link.

### 6.4 Storage bucket policies

Storage policies match table-level intent: only `is_marketplace_admin()` can insert/update/delete in either bucket. Read on product images is public; read on SDS is gated to authenticated, marketplace-enabled users.

### 6.5 Frontend route gating

`MarketplaceRoute` checks `isAuthenticated`, then either `canSee` (buyer) or `canAdminister` (admin). Disallowed users see a polite "Marketplace not available" card with a link back to the dashboard. **This is UI-only; the real security is RLS on the server.**

### 6.6 Brand isolation

A grep for `chem`, `cqvs`, or any Chem Connect brand colour in `src/pages/marketplace/`, `src/pages/admin/marketplace/`, `src/components/marketplace/`, and the new query / lib files returns nothing. The marketplace UI uses Elora primary colour, Elora component library, Elora copy.

---

## 7 · Out of scope (deliberately excluded — M2 work)

These are **not** present and won't be in this milestone:

- Stripe checkout session creation, hosted page redirect, webhook handler, idempotency table.
- Xero OAuth, invoice creation, purchase order creation, sync log UI, refresh-token cron.
- Freight engine — postcode dataset, distance lookup, rate sheets, brackets, matrix CSV upload, live cart freight quoting.
- Order creation pipeline — `orders`, `order_items`, `order_status_history`, atomic order numbering.
- 8 transactional email templates and the `marketplace_send_order_email` function.
- Warehouse fulfilment dashboard (the dispatch screen, ETA / tracking entry, column-level RLS RPC).
- Site-access checkout questions are admin-managed in M1 (the editor is in `MarketplaceProductEditor`) but their rendering at checkout is M2.
- The "Continue to checkout" button on the cart page is intentionally disabled with a clear hint.

The schema is **multi-warehouse-ready** and **future-checkout-ready** (FK columns and helper functions are placed today so M2 doesn't require any structural changes — only additive ones).

---

## 8 · Known risks / follow-ups

| # | Item | Recommendation |
|---|---|---|
| K1 | `v_marketplace_buyer_prices` requires Postgres ≥ 15 for `security_invoker`. | Confirm Supabase project version; if older, swap the view for a SECURITY DEFINER function returning the same shape. |
| K2 | The `is_marketplace_admin()` SECURITY DEFINER function trusts the `user_profiles.role` column. | If `user_profiles.role` is ever directly self-edited by users, that's a wider system bug — but unlikely given existing admin paths. |
| K3 | Image upload happens client-side direct to Storage. A non-admin user with a tampered client cannot upload because of the storage RLS policy, but they could attempt large files. | Storage bucket has a 5 MB file_size_limit at the engine level. |
| K4 | The cart page reads pricing via `buyerCatalogOptions`; if a packaging variant is removed from a product after items were added, the cart will show "Price unavailable". | Acceptable for M1; M2 checkout will enforce a re-quote and surface this. |
| K5 | I introduced the `marketplace_buyer` flag on `user_permissions` but don't use it for gating in M1 (anyone in an enabled company can buy). It's reserved as a future tightening lever. | Leave as default `false`; document for M2. |
| K6 | The `MarketplaceRoute` checks happen client-side after an unauthenticated render flash. The page-level guard never exposes data — only the empty card — but the hydration order is something to verify. | Test as part of UAT; if the flash is jarring, hoist the gate up to the route element wrapper. |

---

## 9 · Step-by-step testing instructions

### 9.1 Apply migrations

```bash
# from the project root
supabase migration up   # or however your team applies migrations
```

This will create all marketplace tables, helpers, view, and storage buckets.

### 9.2 (Optional) Seed demo data

```bash
npm run seed:marketplace:demo:dry   # see what would happen
npm run seed:marketplace:demo       # actually seed 3 demo products
```

### 9.3 Smoke test as a marketplace admin

1. Log in as a `super_admin` or `admin`.
2. Confirm the **Marketplace Admin** entry appears in the sidebar under a new "Marketplace" group.
3. Navigate to `/admin/marketplace`. You should see the dashboard with stats cards.
4. Click **Products**. Click **New product**. Fill in name, slug, description, classification → Create.
5. After creation you'll be redirected to the product editor. Add a packaging variant (e.g. 200L Drum, $4.00 / L), save.
6. Upload a cover image. Upload an SDS PDF.
7. Go to **Customer Access**. Toggle marketplace ON for a buyer company; set an invoice email.
8. Go to **Customer Pricing**. Choose that company. Set Borrell's price for Green Acid 200L Drum to $3.65/L; click Save.
9. Go to **Warehouses**. Add a warehouse: name, suburb, state, postcode.

### 9.4 Smoke test as a buyer

1. Log out. Log in as a user from the company you just enabled.
2. Confirm the **Marketplace** entry appears in the sidebar (and **My Cart** below it).
3. Click **Marketplace**. You should see the products grid with the buyer's resolved price.
4. Click into a product. Verify:
   - Selected packaging defaults to first available.
   - Price tag shows your negotiated rate (with "Your price" tag if it's an override).
   - SDS document is downloadable (signed URL).
5. Add to cart. Visit **My Cart**. Verify the line subtotal calculates correctly.
6. Adjust quantity, then remove an item.

### 9.5 Cross-company isolation test (the critical one)

1. Open Supabase SQL editor. Log in to the API as a user from **Company B** (e.g. impersonate via a test JWT or use an actual second buyer login).
2. Run:
   ```sql
   SELECT * FROM marketplace_company_pricing
   WHERE company_id = '<Company A's id>';
   ```
   Expect: zero rows. RLS blocks the read.
3. Run:
   ```sql
   SELECT * FROM marketplace_cart_items
   WHERE user_id = '<Company A user id>';
   ```
   Expect: zero rows.
4. Visit `/marketplace/cart` while logged in as Company B. Expect: only Company B's user's own cart.
5. Try to navigate to a Company A user's cart URL — there isn't one because the cart is keyed by `auth.uid()`, but verify the URL `/marketplace/cart` always returns the caller's own cart.

### 9.6 Disabled-buyer test

1. As an admin, toggle marketplace OFF for some company.
2. Log in as a user from that company.
3. Confirm the Marketplace nav group is **invisible**.
4. Manually navigate to `/marketplace`. Expect: "Marketplace not available" card.
5. Manually navigate to `/marketplace/products/some-slug`. Expect: same card.

### 9.7 Brand check

```bash
grep -ri "chem\|cqvs" src/pages/marketplace/ src/pages/admin/marketplace/ src/components/marketplace/ src/lib/marketplace*.js src/query/options/marketplace.js src/query/mutations/marketplace.js
```

Expect: no matches.

---

## 10 · Demo flow matching the milestone goals

Walk a stakeholder through this in 5–7 minutes:

1. **Foundation.** "Here's the marketplace section, integrated as a sidebar group inside the existing Elora portal — same auth, same nav, same theme." Click between dashboard and marketplace tabs.
2. **Add a product (admin).** In `/admin/marketplace/products`, create "Green Acid": name, manufacturer, hazard class, SDS PDF, packaging sizes (20L pail at $4.20/L, 200L drum at $4.00/L, 1000L IBC at $3.65/L).
3. **Per-customer pricing.** In Customer Pricing, choose Borrell, set Green Acid 200L drum to $3.65/L. Save. Repeat for Heidelberg at $4.00/L (i.e. matches the default).
4. **Customer access toggle.** In Customer Access, enable marketplace for Borrell, leave Heidelberg disabled.
5. **Buyer view (Borrell).** Log in as a Borrell user. Marketplace tab visible. Open Green Acid → see $3.65/L for 200L drum (with "Your price" tag). Add 5 drums to cart. Visit cart — line subtotal $3,650.00 ex-GST.
6. **Heidelberg view.** Log in as a Heidelberg user. Marketplace tab **invisible**. Direct URL fetch shows the "not available" card.
7. **Persistence.** As Borrell, log out and back in — cart still has 5 drums.
8. **Security.** Open Supabase dashboard, query `marketplace_company_pricing` as Heidelberg → no rows for Borrell. As an admin, query and see all rows.

---

## 11 · File index

```
docs/marketplace/M1_DELIVERABLE.md                              ← this file

supabase/migrations/20260509000001_marketplace_foundation.sql
supabase/migrations/20260509000002_marketplace_catalog.sql

scripts/seed-marketplace-demo.mjs
package.json                                                    (added 2 npm scripts)

src/lib/AuthContext.jsx                                         (extended company select)
src/lib/marketplacePermissions.js
src/lib/marketplaceFormat.js
src/hooks/useMarketplaceAccess.js
src/components/auth/MarketplaceRoute.jsx
src/components/NavMain.jsx                                      (extended)
src/components/marketplace/MarketplaceImage.jsx
src/components/marketplace/HazardBadge.jsx
src/components/marketplace/PriceTag.jsx
src/components/marketplace/PackagingSelector.jsx
src/components/marketplace/MarketplaceEmpty.jsx

src/query/keys.js                                                (extended)
src/query/options/marketplace.js
src/query/mutations/marketplace.js

src/pages.config.js                                              (extended)
src/App.jsx                                                      (added 9 routes)

src/pages/marketplace/MarketplaceCatalog.jsx
src/pages/marketplace/MarketplaceProductDetail.jsx
src/pages/marketplace/MarketplaceCart.jsx

src/pages/admin/marketplace/MarketplaceAdminDashboard.jsx
src/pages/admin/marketplace/MarketplaceCompanies.jsx
src/pages/admin/marketplace/MarketplaceWarehouses.jsx
src/pages/admin/marketplace/MarketplaceProducts.jsx
src/pages/admin/marketplace/MarketplaceProductEditor.jsx
src/pages/admin/marketplace/MarketplaceCompanyPricing.jsx
```

That's M1.
