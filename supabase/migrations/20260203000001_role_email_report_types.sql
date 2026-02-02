-- Add visible_email_report_types to role_tab_settings
-- Super Admin can configure which email report types (Compliance Summary, Cost Analysis) each role can include

ALTER TABLE role_tab_settings
ADD COLUMN IF NOT EXISTS visible_email_report_types TEXT[] DEFAULT NULL;

COMMENT ON COLUMN role_tab_settings.visible_email_report_types IS 'Report type IDs (compliance, costs) that this role can include in email reports. NULL = use role default.';
