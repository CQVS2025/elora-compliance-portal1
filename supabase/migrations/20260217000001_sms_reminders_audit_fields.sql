-- SMS Alerts audit: batch_id, sent_by, customer/site for filtering and per-org recording
-- Migration: 20260217000001_sms_reminders_audit_fields

ALTER TABLE sms_reminders
  ADD COLUMN IF NOT EXISTS batch_id UUID,
  ADD COLUMN IF NOT EXISTS sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS site_ref TEXT,
  ADD COLUMN IF NOT EXISTS site_name TEXT,
  ADD COLUMN IF NOT EXISTS customer_ref TEXT,
  ADD COLUMN IF NOT EXISTS customer_name TEXT;

CREATE INDEX IF NOT EXISTS idx_sms_reminders_batch ON sms_reminders(batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sms_reminders_sent_by ON sms_reminders(sent_by);
CREATE INDEX IF NOT EXISTS idx_sms_reminders_customer ON sms_reminders(customer_ref) WHERE customer_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sms_reminders_site ON sms_reminders(site_ref) WHERE site_ref IS NOT NULL;

COMMENT ON COLUMN sms_reminders.batch_id IS 'Same UUID for all rows in a batch send; null for single send';
COMMENT ON COLUMN sms_reminders.sent_by IS 'User (auth.uid) who triggered the send';
COMMENT ON COLUMN sms_reminders.customer_ref IS 'Customer/organization ref the vehicle belongs to';
COMMENT ON COLUMN sms_reminders.customer_name IS 'Customer display name';
COMMENT ON COLUMN sms_reminders.site_ref IS 'Site ref the vehicle belongs to';
COMMENT ON COLUMN sms_reminders.site_name IS 'Site display name';
