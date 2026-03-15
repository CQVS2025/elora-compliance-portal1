-- Add visible_email_report_types to user_profiles for individual user-level control
-- of which email report types (compliance, costs) the user can include.
-- NULL = use role default; array = specific override.

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS visible_email_report_types TEXT[] DEFAULT NULL;

COMMENT ON COLUMN user_profiles.visible_email_report_types IS 'Email report type IDs (compliance, costs) this user can include. NULL = use role default.';
