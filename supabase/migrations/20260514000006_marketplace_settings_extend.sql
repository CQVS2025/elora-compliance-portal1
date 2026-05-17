-- ============================================================================
-- Marketplace · Extend settings singleton with platform/business fields
--
-- Background
-- ----------
-- marketplace_settings already holds seller_company_id, default_warehouse_id,
-- currency (default 'AUD'), gst_rate (default 0.10), and
-- gst_inclusive_pricing. But the backend / frontend ignored those columns and
-- hardcoded `0.10` for GST in three places. This migration adds a handful
-- of additional config fields so an admin can run the marketplace without
-- code changes — same shape as Chem Connect's Business Settings page.
--
-- New columns
-- -----------
-- platform_name         TEXT      (display name shown on emails / receipts)
-- support_email         TEXT      (admin contact email; falls back to seller_company contact)
-- support_phone         TEXT      (admin contact phone)
-- min_order_amount      NUMERIC   (optional MOQ in dollars ex-GST; 0 = no minimum)
-- default_payment_terms_days INT  (days, used as Xero invoice DueDate offset)
-- early_access_capacity INT       (number of customers eligible for early-access offers; 0 = disabled)
--
-- Existing columns we leave alone: currency, gst_rate, gst_inclusive_pricing.
-- ============================================================================

ALTER TABLE marketplace_settings
  ADD COLUMN IF NOT EXISTS platform_name TEXT NOT NULL DEFAULT 'Elora Marketplace',
  ADD COLUMN IF NOT EXISTS support_email TEXT,
  ADD COLUMN IF NOT EXISTS support_phone TEXT,
  ADD COLUMN IF NOT EXISTS min_order_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS default_payment_terms_days INT NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS early_access_capacity INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN marketplace_settings.platform_name IS
  'Display name used in transactional emails, receipts, and the buyer header. Defaults to "Elora Marketplace".';
COMMENT ON COLUMN marketplace_settings.support_email IS
  'Admin contact email shown in buyer-facing footers and used as the reply-to on transactional emails.';
COMMENT ON COLUMN marketplace_settings.support_phone IS
  'Admin contact phone shown in buyer-facing footers.';
COMMENT ON COLUMN marketplace_settings.min_order_amount IS
  'Minimum order subtotal (ex-GST) required to check out. 0 = no minimum.';
COMMENT ON COLUMN marketplace_settings.default_payment_terms_days IS
  'Days from invoice date until due (Xero invoice DueDate offset). Default 30.';
COMMENT ON COLUMN marketplace_settings.early_access_capacity IS
  'Optional: cap on customers eligible for early-access rewards on new product launches. 0 = feature disabled.';
