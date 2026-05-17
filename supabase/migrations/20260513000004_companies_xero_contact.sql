-- ============================================================================
-- Marketplace · Per-customer Xero contact linkage
--
-- Adds the two columns the Xero invoice/PO flow already references but that
-- never existed in any migration:
--   - companies.xero_contact_id          → linked Xero ContactID (uuid string)
--   - companies.xero_invoicing_enabled   → admin opt-in; true means this
--                                          buyer company is registered in
--                                          Xero and approving a PO order for
--                                          them will fire createInvoice
--
-- Why
-- ---
-- Jonny owns the Xero org. Buyers placing PO orders are not automatically
-- contacts in Xero — they have to be created/registered first. Without
-- xero_contact_id, marketplace_xero_create_invoice silently creates a new
-- "ad-hoc" contact each time (bad — dups in Xero). With this column we can:
--   1. Show the registration state per company in the admin UI
--   2. Let the super_admin click "Register in Xero" to create the contact
--      proactively (rather than at first-PO-approval time)
--   3. Gate invoice generation on xero_invoicing_enabled so PO orders from
--      not-yet-Xero customers don't trigger a half-broken invoice
-- ============================================================================

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS xero_contact_id TEXT,
  ADD COLUMN IF NOT EXISTS xero_invoicing_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN companies.xero_contact_id IS
  'Xero ContactID for this buyer company (uuid). Populated when an admin registers the company in Xero via the marketplace_xero_register_contact Edge Function (or implicitly on first invoice generation).';
COMMENT ON COLUMN companies.xero_invoicing_enabled IS
  'Admin opt-in. When true, approving a PO order for this company triggers marketplace_xero_create_invoice. Default false so PO approvals do not silently leak data into Xero.';

CREATE INDEX IF NOT EXISTS idx_companies_xero_contact_id ON companies(xero_contact_id);
