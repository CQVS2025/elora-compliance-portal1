-- ============================================================================
-- Marketplace · Per-warehouse Xero supplier contact linkage
--
-- Same pattern as companies.xero_contact_id / xero_contact_details, but for
-- the supplier side: when a warehouse is third-party supplier-managed and
-- Elora needs to fire a Xero Purchase Order to that supplier, we need the
-- real Xero ContactID so the PO lands against the right supplier record
-- (with ABN, address, primary person all populated).
--
-- Before this migration, marketplaceXero.ts createPurchaseOrderForOrder()
-- created an ad-hoc Xero contact from { Name, EmailAddress } on every PO,
-- duplicating contacts whenever the warehouse name changed and missing
-- every "rich" field Xero exposes (ABN, addresses, phone, contact persons).
--
-- After this:
--   - Admin registers each supplier-managed warehouse in Xero via the new
--     marketplace_xero_register_warehouse_contact Edge Function (same UX
--     as Customer Marketplace Access — full Xero contact dialog).
--   - createPurchaseOrderForOrder uses the stored xero_contact_id directly.
--   - No duplicates, full contact data on every Xero supplier record.
-- ============================================================================

ALTER TABLE marketplace_warehouses
  ADD COLUMN IF NOT EXISTS xero_contact_id TEXT,
  ADD COLUMN IF NOT EXISTS xero_contact_details JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN marketplace_warehouses.xero_contact_id IS
  'Xero ContactID (uuid) for the supplier that runs this warehouse. Only relevant when is_supplier_managed=true. Populated by marketplace_xero_register_warehouse_contact.';
COMMENT ON COLUMN marketplace_warehouses.xero_contact_details IS
  'Structured Xero contact payload — same shape as companies.xero_contact_details (ABN, phone, primary person, billing + delivery addresses, website). Read by marketplaceXero.ts upsertSupplierContact().';

CREATE INDEX IF NOT EXISTS idx_marketplace_warehouses_xero_contact_id
  ON marketplace_warehouses(xero_contact_id);
