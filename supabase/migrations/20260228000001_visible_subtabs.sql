-- Sub-tab visibility for Usage Costs and Email Reports (role, company, user).
-- NULL or empty = no restriction (all sub-tabs visible when parent tab is visible).
-- When set, only listed sub-tab ids are visible. Intersection applies: Role → Company → User.

-- Role tab settings: which sub-tabs are visible per role (Super Admin config).
ALTER TABLE role_tab_settings
  ADD COLUMN IF NOT EXISTS visible_cost_subtabs TEXT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS visible_email_report_subtabs TEXT[] DEFAULT NULL;

COMMENT ON COLUMN role_tab_settings.visible_cost_subtabs IS 'Sub-tabs for Usage Costs page: overview, per-truck, per-site, site-comparison, pricing-calculator, scenario-builder, budget-tracker. NULL = all visible.';
COMMENT ON COLUMN role_tab_settings.visible_email_report_subtabs IS 'Sub-tabs for Email Reports page: email-reports, client-usage-cost-report. NULL = all visible.';

-- Company: optional further restriction on sub-tabs.
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS visible_cost_subtabs TEXT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS visible_email_report_subtabs TEXT[] DEFAULT NULL;

COMMENT ON COLUMN companies.visible_cost_subtabs IS 'Optional: restrict Usage Costs sub-tabs for this company. NULL = no restriction.';
COMMENT ON COLUMN companies.visible_email_report_subtabs IS 'Optional: restrict Email Reports sub-tabs for this company. NULL = no restriction.';

-- User: optional further restriction on sub-tabs.
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS visible_cost_subtabs TEXT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS visible_email_report_subtabs TEXT[] DEFAULT NULL;

COMMENT ON COLUMN user_profiles.visible_cost_subtabs IS 'Override Usage Costs sub-tabs for this user. NULL = use role/company.';
COMMENT ON COLUMN user_profiles.visible_email_report_subtabs IS 'Override Email Reports sub-tabs for this user. NULL = use role/company.';
