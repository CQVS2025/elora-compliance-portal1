-- ============================================================================
-- Marketplace · Store Xero Purchase Order number on orders
--
-- We already store xero_po_id (the GUID) and xero_po_status. The PO number
-- is the human-readable identifier Xero displays in its UI (PO-0007 etc.)
-- and is much more useful to show in the admin order detail than the GUID.
-- This migration adds the column; createPurchaseOrderForOrder fills it on
-- every PO success.
-- ============================================================================

ALTER TABLE marketplace_orders
  ADD COLUMN IF NOT EXISTS xero_po_number TEXT;

COMMENT ON COLUMN marketplace_orders.xero_po_number IS
  'Human-readable Xero Purchase Order number (e.g. PO-0042). Populated by marketplaceXero.ts createPurchaseOrderForOrder() on success.';
