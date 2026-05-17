-- ============================================================================
-- Marketplace · Clear bogus all-zeros Xero ids from orders
--
-- Before postToXero learned to detect HasErrors=true responses, every Xero
-- record-validation failure was persisted as an all-zeros UUID (the value
-- Xero returns on a failed record when summarizeErrors=false). Those ids
-- look real but resolve to a 404 in Xero's UI ("Invoice not found").
--
-- Wipe them so the admin order detail stops rendering dead "Open in Xero"
-- links. The Edge Function with the new validation gate will re-create
-- the records cleanly when admin retries the operation.
-- ============================================================================

UPDATE marketplace_orders
SET xero_invoice_id = NULL,
    xero_invoice_number = NULL,
    xero_invoice_status = NULL
WHERE xero_invoice_id = '00000000-0000-0000-0000-000000000000';

UPDATE marketplace_orders
SET xero_po_id = NULL,
    xero_po_number = NULL,
    xero_po_status = NULL
WHERE xero_po_id = '00000000-0000-0000-0000-000000000000';

-- Re-classify any sync-log entries that were stored as "success" but
-- carry the zero-uuid in xero_object_id — they were validation failures.
UPDATE marketplace_xero_sync_log
SET status = 'failed',
    error_message = COALESCE(error_message, '') ||
      ' (auto-reclassified: Xero returned HasErrors=true with a zero-uuid ID — original create did NOT succeed)'
WHERE xero_object_id = '00000000-0000-0000-0000-000000000000'
  AND status = 'success';
