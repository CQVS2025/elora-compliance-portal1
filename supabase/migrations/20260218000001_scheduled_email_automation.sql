-- Scheduled Email Automation
-- Adds Australia timezone support, filters, and company-level enable/disable

-- Companies: super_admin can disable scheduled emails per organization
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS scheduled_email_reports_enabled BOOLEAN DEFAULT true;

COMMENT ON COLUMN companies.scheduled_email_reports_enabled IS 'When false, no scheduled email reports are sent for this organization. Super admin can disable per org.';

-- Email report preferences: timezone and filters for automation
ALTER TABLE email_report_preferences
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Australia/Sydney';

ALTER TABLE email_report_preferences
ADD COLUMN IF NOT EXISTS filters_json JSONB DEFAULT '{}';

ALTER TABLE email_report_preferences
ADD COLUMN IF NOT EXISTS recipients TEXT[] DEFAULT '{}';

COMMENT ON COLUMN email_report_preferences.timezone IS 'IANA timezone (e.g. Australia/Sydney) for schedule. User selects their Australian timezone.';
COMMENT ON COLUMN email_report_preferences.filters_json IS 'Stored filters for automation: selectedCustomer, selectedSite, selectedDriverIds.';
COMMENT ON COLUMN email_report_preferences.recipients IS 'Additional recipient emails. Primary is user_email.';
