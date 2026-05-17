-- ============================================================================
-- Marketplace · One-time cleanup of stale Xero contact ids after tenant switch
--
-- switchActiveTenant() previously only wiped per-order xero_invoice_id /
-- xero_po_id when an admin switched Xero orgs. It missed:
--   - companies.xero_contact_id           (buyer contacts in the old org)
--   - marketplace_warehouses.xero_contact_id (supplier contacts in the old org)
--
-- The stored ids look fine but point at records that exist in a DIFFERENT
-- Xero org than the currently-active one. Every invoice / PO posted to
-- the active org with `Contact: { ContactID: <stale> }` is rejected as a
-- validation error (HasErrors=true → all-zeros UUID response).
--
-- This migration:
--   1. Wipes xero_contact_id on every company / warehouse so the next call
--      lazily re-creates the contact in the active org.
--   2. PRESERVES xero_contact_details + xero_invoicing_enabled so the rich
--      contact data (ABN, addresses, primary person) flows back into the
--      new org's contact automatically when admin clicks Register again.
--   3. Also nulls invoice_number / invoice_status / po_number / po_status
--      on orders that already had their ids cleared by the previous
--      migration (so the UI doesn't show stale partial info).
--
-- After running this, every buyer + supplier needs to be re-Registered
-- from Customer Marketplace Access / Warehouses. The dialog still has
-- the saved details so it's a one-click action per row.
-- ============================================================================

UPDATE companies
SET xero_contact_id = NULL
WHERE xero_contact_id IS NOT NULL;

UPDATE marketplace_warehouses
SET xero_contact_id = NULL
WHERE xero_contact_id IS NOT NULL;

-- Clear lingering xero_invoice_number / status etc. that were set when the
-- ids were created (the ids themselves were already nulled in
-- 20260514000004_xero_clear_zero_uuid_invoices.sql).
UPDATE marketplace_orders
SET xero_invoice_number = NULL,
    xero_invoice_status = NULL
WHERE xero_invoice_id IS NULL
  AND (xero_invoice_number IS NOT NULL OR xero_invoice_status IS NOT NULL);

UPDATE marketplace_orders
SET xero_po_number = NULL,
    xero_po_status = NULL
WHERE xero_po_id IS NULL
  AND (xero_po_number IS NOT NULL OR xero_po_status IS NOT NULL);
