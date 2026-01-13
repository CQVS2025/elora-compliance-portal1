-- ELORA Fleet Compliance Portal - Permissions, Branding & Remove Maintenance
-- Migration: 20250114000001_permissions_branding_no_maintenance

-- ============================================================================
-- USER PERMISSIONS TABLE (Database-driven permissions)
-- ============================================================================
CREATE TABLE user_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email TEXT, -- Can set permissions by email before user exists

    -- Scope: 'user' for specific user, 'domain' for email domain defaults
    scope TEXT NOT NULL DEFAULT 'user' CHECK (scope IN ('user', 'domain')),
    email_domain TEXT, -- For domain-scoped permissions

    -- Customer/Data Restrictions
    restricted_customer TEXT, -- Customer name to restrict to (NULL = all)
    lock_customer_filter BOOLEAN DEFAULT false,
    show_all_data BOOLEAN DEFAULT true,
    default_site TEXT DEFAULT 'all',

    -- Tab Visibility (NULL = show all, otherwise JSON array of visible tab values)
    visible_tabs TEXT[], -- e.g., ['compliance', 'reports', 'email-reports']
    hidden_tabs TEXT[], -- e.g., ['costs', 'refills', 'devices']

    -- Feature Flags
    hide_cost_forecast BOOLEAN DEFAULT false,
    hide_leaderboard BOOLEAN DEFAULT false,
    hide_usage_costs BOOLEAN DEFAULT false,

    -- Module Permissions
    can_view_compliance BOOLEAN DEFAULT true,
    can_view_reports BOOLEAN DEFAULT true,
    can_manage_sites BOOLEAN DEFAULT true,
    can_manage_users BOOLEAN DEFAULT false,
    can_export_data BOOLEAN DEFAULT true,
    can_view_costs BOOLEAN DEFAULT true,
    can_generate_ai_reports BOOLEAN DEFAULT true,

    -- Data Edit Permissions
    can_edit_vehicles BOOLEAN DEFAULT true,
    can_edit_sites BOOLEAN DEFAULT true,
    can_delete_records BOOLEAN DEFAULT false,

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure either user_id/user_email OR email_domain is set based on scope
    CONSTRAINT valid_scope CHECK (
        (scope = 'user' AND (user_id IS NOT NULL OR user_email IS NOT NULL)) OR
        (scope = 'domain' AND email_domain IS NOT NULL)
    ),
    UNIQUE(user_email),
    UNIQUE(email_domain)
);

CREATE INDEX idx_user_permissions_company ON user_permissions(company_id);
CREATE INDEX idx_user_permissions_user ON user_permissions(user_id);
CREATE INDEX idx_user_permissions_email ON user_permissions(user_email);
CREATE INDEX idx_user_permissions_domain ON user_permissions(email_domain);
CREATE INDEX idx_user_permissions_scope ON user_permissions(scope);

COMMENT ON TABLE user_permissions IS 'Database-driven user permissions and access control';
COMMENT ON COLUMN user_permissions.scope IS 'user = specific user, domain = all users with email domain';
COMMENT ON COLUMN user_permissions.visible_tabs IS 'Array of tab values to show (takes precedence over hidden_tabs)';

-- Trigger for updated_at
CREATE TRIGGER update_user_permissions_updated_at BEFORE UPDATE ON user_permissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- EXPAND CLIENT BRANDING TABLE
-- ============================================================================
ALTER TABLE client_branding
    -- Login Page Branding
    ADD COLUMN IF NOT EXISTS login_background_url TEXT,
    ADD COLUMN IF NOT EXISTS login_background_color TEXT DEFAULT '#f8fafc',
    ADD COLUMN IF NOT EXISTS login_tagline TEXT,
    ADD COLUMN IF NOT EXISTS login_custom_css TEXT,
    ADD COLUMN IF NOT EXISTS login_logo_position TEXT DEFAULT 'center' CHECK (login_logo_position IN ('left', 'center', 'right')),

    -- Email Template Customization
    ADD COLUMN IF NOT EXISTS email_header_html TEXT,
    ADD COLUMN IF NOT EXISTS email_footer_html TEXT,
    ADD COLUMN IF NOT EXISTS email_accent_color TEXT DEFAULT '#7CB342',
    ADD COLUMN IF NOT EXISTS email_font_family TEXT DEFAULT 'Arial, sans-serif',
    ADD COLUMN IF NOT EXISTS email_from_name TEXT,
    ADD COLUMN IF NOT EXISTS email_reply_to TEXT,

    -- Custom Domain (CNAME) Support
    ADD COLUMN IF NOT EXISTS custom_domain TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS custom_domain_verified BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS custom_domain_verification_token TEXT,
    ADD COLUMN IF NOT EXISTS custom_domain_ssl_status TEXT DEFAULT 'pending' CHECK (custom_domain_ssl_status IN ('pending', 'active', 'failed')),

    -- PDF Report Branding
    ADD COLUMN IF NOT EXISTS pdf_logo_url TEXT,
    ADD COLUMN IF NOT EXISTS pdf_header_html TEXT,
    ADD COLUMN IF NOT EXISTS pdf_footer_html TEXT,
    ADD COLUMN IF NOT EXISTS pdf_accent_color TEXT DEFAULT '#7CB342',
    ADD COLUMN IF NOT EXISTS pdf_include_cover_page BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS pdf_cover_page_html TEXT,

    -- Additional Branding Options
    ADD COLUMN IF NOT EXISTS favicon_url TEXT,
    ADD COLUMN IF NOT EXISTS app_name TEXT,
    ADD COLUMN IF NOT EXISTS support_email TEXT,
    ADD COLUMN IF NOT EXISTS support_phone TEXT,
    ADD COLUMN IF NOT EXISTS terms_url TEXT,
    ADD COLUMN IF NOT EXISTS privacy_url TEXT;

CREATE INDEX IF NOT EXISTS idx_client_branding_custom_domain ON client_branding(custom_domain);

COMMENT ON COLUMN client_branding.custom_domain IS 'Custom domain for white-label portal (e.g., fleet.customer.com)';
COMMENT ON COLUMN client_branding.custom_domain_verification_token IS 'DNS TXT record token for domain verification';

-- ============================================================================
-- EMAIL TEMPLATES TABLE (For customizable email templates)
-- ============================================================================
CREATE TABLE email_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

    -- Template identification
    template_type TEXT NOT NULL CHECK (template_type IN (
        'welcome',
        'password_reset',
        'compliance_alert',
        'compliance_digest_daily',
        'compliance_digest_weekly',
        'compliance_digest_monthly',
        'report_ready',
        'custom'
    )),
    template_name TEXT NOT NULL,

    -- Template content
    subject_template TEXT NOT NULL,
    body_html_template TEXT NOT NULL,
    body_text_template TEXT,

    -- Template variables (JSON schema of available variables)
    available_variables JSONB DEFAULT '{}',

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(company_id, template_type)
);

CREATE INDEX idx_email_templates_company ON email_templates(company_id);
CREATE INDEX idx_email_templates_type ON email_templates(template_type);

COMMENT ON TABLE email_templates IS 'Customizable email templates per company';

CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON email_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- REMOVE MAINTENANCE SYSTEM
-- ============================================================================

-- Drop maintenance-related triggers first
DROP TRIGGER IF EXISTS update_maintenance_records_updated_at ON maintenance_records;

-- Drop maintenance_records table
DROP TABLE IF EXISTS maintenance_records CASCADE;

-- Update notifications table to remove maintenance types
-- We'll keep the notifications table but remove maintenance-specific types from future inserts
-- Existing data can remain for historical purposes

-- Update email_digest_preferences to remove maintenance column
ALTER TABLE email_digest_preferences
    DROP COLUMN IF EXISTS include_maintenance;

-- Update email_report_preferences to remove maintenance from default report_types
-- (Can't easily modify array default, so we'll handle this in application code)

-- Update notification_preferences to remove maintenance columns
ALTER TABLE notification_preferences
    DROP COLUMN IF EXISTS notify_maintenance_due,
    DROP COLUMN IF EXISTS notify_maintenance_overdue,
    DROP COLUMN IF EXISTS maintenance_due_days;

-- ============================================================================
-- RLS POLICIES FOR NEW TABLES
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- User Permissions policies
CREATE POLICY "Users can view their own permissions"
    ON user_permissions FOR SELECT
    USING (
        user_id = auth.uid() OR
        user_email = (SELECT email FROM auth.users WHERE id = auth.uid()) OR
        email_domain = split_part((SELECT email FROM auth.users WHERE id = auth.uid()), '@', 2)
    );

CREATE POLICY "Admins can manage company permissions"
    ON user_permissions FOR ALL
    USING (
        company_id IN (
            SELECT company_id FROM user_profiles
            WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "Super admins can manage all permissions"
    ON user_permissions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- Email Templates policies
CREATE POLICY "Users can view company email templates"
    ON email_templates FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM user_profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage company email templates"
    ON email_templates FOR ALL
    USING (
        company_id IN (
            SELECT company_id FROM user_profiles
            WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
        )
    );

-- ============================================================================
-- INSERT DEFAULT EMAIL TEMPLATES
-- ============================================================================
-- These will be created per-company when needed, but we can set up a function

CREATE OR REPLACE FUNCTION create_default_email_templates(p_company_id UUID)
RETURNS void AS $$
BEGIN
    -- Welcome email
    INSERT INTO email_templates (company_id, template_type, template_name, subject_template, body_html_template, available_variables)
    VALUES (
        p_company_id,
        'welcome',
        'Welcome Email',
        'Welcome to {{company_name}} Fleet Portal',
        '<h1>Welcome, {{user_name}}!</h1><p>Your account has been created for the {{company_name}} Fleet Compliance Portal.</p><p>Login at: {{login_url}}</p>',
        '{"user_name": "User full name", "company_name": "Company name", "login_url": "Portal login URL"}'::jsonb
    ) ON CONFLICT (company_id, template_type) DO NOTHING;

    -- Compliance Alert
    INSERT INTO email_templates (company_id, template_type, template_name, subject_template, body_html_template, available_variables)
    VALUES (
        p_company_id,
        'compliance_alert',
        'Compliance Alert',
        'Compliance Alert: {{vehicle_name}} - {{alert_type}}',
        '<h2>Compliance Alert</h2><p>Vehicle <strong>{{vehicle_name}}</strong> has a compliance issue:</p><p>{{alert_message}}</p><p>Current compliance: {{compliance_rate}}%</p>',
        '{"vehicle_name": "Vehicle name", "alert_type": "Type of alert", "alert_message": "Alert details", "compliance_rate": "Current compliance percentage"}'::jsonb
    ) ON CONFLICT (company_id, template_type) DO NOTHING;

    -- Daily Digest
    INSERT INTO email_templates (company_id, template_type, template_name, subject_template, body_html_template, available_variables)
    VALUES (
        p_company_id,
        'compliance_digest_daily',
        'Daily Compliance Digest',
        '{{company_name}} Daily Fleet Report - {{date}}',
        '<h1>Daily Fleet Compliance Report</h1><p>Date: {{date}}</p><h2>Summary</h2><ul><li>Total Vehicles: {{total_vehicles}}</li><li>Compliant: {{compliant_count}}</li><li>Non-Compliant: {{non_compliant_count}}</li><li>Compliance Rate: {{compliance_rate}}%</li></ul>{{vehicle_details}}',
        '{"company_name": "Company name", "date": "Report date", "total_vehicles": "Total vehicle count", "compliant_count": "Compliant vehicles", "non_compliant_count": "Non-compliant vehicles", "compliance_rate": "Overall rate", "vehicle_details": "Detailed vehicle list HTML"}'::jsonb
    ) ON CONFLICT (company_id, template_type) DO NOTHING;

    -- Weekly Digest
    INSERT INTO email_templates (company_id, template_type, template_name, subject_template, body_html_template, available_variables)
    VALUES (
        p_company_id,
        'compliance_digest_weekly',
        'Weekly Compliance Digest',
        '{{company_name}} Weekly Fleet Report - Week of {{week_start}}',
        '<h1>Weekly Fleet Compliance Report</h1><p>Week: {{week_start}} - {{week_end}}</p><h2>Summary</h2><ul><li>Total Vehicles: {{total_vehicles}}</li><li>Average Compliance: {{compliance_rate}}%</li><li>Total Washes: {{total_washes}}</li></ul>{{charts_html}}{{vehicle_details}}',
        '{"company_name": "Company name", "week_start": "Week start date", "week_end": "Week end date", "total_vehicles": "Vehicle count", "compliance_rate": "Average rate", "total_washes": "Wash count", "charts_html": "Charts HTML", "vehicle_details": "Details HTML"}'::jsonb
    ) ON CONFLICT (company_id, template_type) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SCHEMA SUMMARY
-- ============================================================================
-- New Tables: user_permissions, email_templates
-- Modified Tables: client_branding (expanded), notification_preferences, email_digest_preferences
-- Removed Tables: maintenance_records
-- New Functions: create_default_email_templates
-- ============================================================================
