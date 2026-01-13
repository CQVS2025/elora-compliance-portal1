-- ELORA Fleet Compliance Portal - Heidelberg Materials Complete Setup
-- Migration: 20250116000001_heidelberg_complete_setup
-- Creates Heidelberg Materials company with full branding, permissions, and sample data
-- NOTE: This uses a VALID UUID format

-- ============================================================================
-- HEIDELBERG MATERIALS COMPANY UUID
-- ============================================================================
-- Using valid UUID: a1b2c3d4-e5f6-4a8b-9c3d-e2f1a5b6c7d8

-- ============================================================================
-- STEP 1: CREATE OR UPDATE HEIDELBERG MATERIALS COMPANY
-- ============================================================================
INSERT INTO companies (id, name, email_domain, elora_customer_ref, is_active)
VALUES (
    'a1b2c3d4-e5f6-4a8b-9c3d-e2f1a5b6c7d8'::uuid,
    'Heidelberg Materials',
    'heidelberg.com.au',
    'HM-001',
    true
)
ON CONFLICT (email_domain) DO UPDATE SET
    name = 'Heidelberg Materials',
    elora_customer_ref = 'HM-001',
    is_active = true,
    updated_at = NOW();

-- Add additional company columns if they exist
DO $$
BEGIN
    -- Add logo_url if column exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'logo_url') THEN
        UPDATE companies SET
            logo_url = 'https://www.heidelbergmaterials.com/themes/custom/theme_heidelbergmaterials/logo.svg'
        WHERE email_domain = 'heidelberg.com.au';
    END IF;

    -- Add primary_color if column exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'primary_color') THEN
        UPDATE companies SET
            primary_color = '#003DA5'
        WHERE email_domain = 'heidelberg.com.au';
    END IF;

    -- Add secondary_color if column exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'secondary_color') THEN
        UPDATE companies SET
            secondary_color = '#00A3E0'
        WHERE email_domain = 'heidelberg.com.au';
    END IF;

    -- Add settings if column exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'settings') THEN
        UPDATE companies SET
            settings = jsonb_build_object(
                'industry', 'Construction Materials',
                'country', 'Australia',
                'timezone', 'Australia/Melbourne',
                'fleet_size', 'enterprise',
                'features', jsonb_build_array('compliance', 'reports', 'email-reports', 'ai-reports'),
                'contact', jsonb_build_object(
                    'name', 'Fleet Operations',
                    'email', 'fleet@heidelberg.com.au',
                    'phone', '+61 3 9000 0000'
                )
            )
        WHERE email_domain = 'heidelberg.com.au';
    END IF;
END $$;

-- ============================================================================
-- STEP 2: CREATE OR UPDATE CLIENT BRANDING
-- ============================================================================
INSERT INTO client_branding (
    company_id,
    client_email_domain,
    company_name,
    logo_url,
    primary_color,
    secondary_color
) VALUES (
    (SELECT id FROM companies WHERE email_domain = 'heidelberg.com.au'),
    'heidelberg.com.au',
    'Heidelberg Materials',
    'https://www.heidelbergmaterials.com/themes/custom/theme_heidelbergmaterials/logo.svg',
    '#003DA5',
    '#00A3E0'
)
ON CONFLICT (company_id, client_email_domain) DO UPDATE SET
    company_name = 'Heidelberg Materials',
    logo_url = 'https://www.heidelbergmaterials.com/themes/custom/theme_heidelbergmaterials/logo.svg',
    primary_color = '#003DA5',
    secondary_color = '#00A3E0',
    updated_at = NOW();

-- Update extended branding fields if they exist
DO $$
DECLARE
    v_company_id uuid;
BEGIN
    SELECT id INTO v_company_id FROM companies WHERE email_domain = 'heidelberg.com.au';

    -- Update login branding
    UPDATE client_branding SET
        login_background_color = '#f0f4f8',
        login_tagline = 'Building Tomorrow''s Infrastructure Today',
        login_logo_position = 'center',
        login_custom_css = '
            .login-container {
                background: linear-gradient(135deg, #003DA5 0%, #00A3E0 100%);
            }
            .login-card {
                backdrop-filter: blur(10px);
                background: rgba(255, 255, 255, 0.95);
            }
        '
    WHERE company_id = v_company_id
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_branding' AND column_name = 'login_tagline');

    -- Update email branding
    UPDATE client_branding SET
        email_accent_color = '#003DA5',
        email_font_family = 'Arial, Helvetica, sans-serif',
        email_from_name = 'Heidelberg Materials Fleet Portal',
        email_reply_to = 'fleet@heidelberg.com.au',
        email_header_html = '<div style="background: linear-gradient(135deg, #003DA5 0%, #00A3E0 100%); padding: 20px; text-align: center;"><img src="https://www.heidelbergmaterials.com/themes/custom/theme_heidelbergmaterials/logo.svg" alt="Heidelberg Materials" style="height: 40px; filter: brightness(0) invert(1);"/></div>',
        email_footer_html = '<div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666;"><p>Heidelberg Materials Australia</p><p>Building a Sustainable Future</p><p style="margin-top: 10px;"><a href="https://www.heidelbergmaterials.com.au" style="color: #003DA5;">www.heidelbergmaterials.com.au</a></p></div>'
    WHERE company_id = v_company_id
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_branding' AND column_name = 'email_accent_color');

    -- Update PDF branding
    UPDATE client_branding SET
        pdf_logo_url = 'https://www.heidelbergmaterials.com/themes/custom/theme_heidelbergmaterials/logo.svg',
        pdf_accent_color = '#003DA5',
        pdf_include_cover_page = true,
        pdf_header_html = '<div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 20px; border-bottom: 3px solid #003DA5;"><img src="https://www.heidelbergmaterials.com/themes/custom/theme_heidelbergmaterials/logo.svg" alt="Logo" style="height: 30px;"/><span style="color: #003DA5; font-weight: bold;">Fleet Compliance Report</span></div>',
        pdf_footer_html = '<div style="text-align: center; padding: 10px; font-size: 10px; color: #666; border-top: 1px solid #ddd;">Heidelberg Materials Australia - Fleet Compliance Portal | Page {{page}} of {{pages}}</div>',
        pdf_cover_page_html = '<div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; background: linear-gradient(135deg, #003DA5 0%, #00A3E0 100%); color: white;"><img src="https://www.heidelbergmaterials.com/themes/custom/theme_heidelbergmaterials/logo.svg" alt="Logo" style="height: 80px; filter: brightness(0) invert(1); margin-bottom: 40px;"/><h1 style="font-size: 36px; margin: 0;">Fleet Compliance Report</h1><p style="font-size: 18px; margin-top: 20px;">{{report_date}}</p><p style="margin-top: 40px; font-size: 14px; opacity: 0.8;">Building Tomorrow''s Infrastructure Today</p></div>'
    WHERE company_id = v_company_id
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_branding' AND column_name = 'pdf_logo_url');

    -- Update additional branding
    UPDATE client_branding SET
        favicon_url = 'https://www.heidelbergmaterials.com/favicon.ico',
        app_name = 'Heidelberg Materials Fleet Portal',
        support_email = 'fleet.support@heidelberg.com.au',
        support_phone = '+61 3 9000 0000',
        terms_url = 'https://www.heidelbergmaterials.com.au/terms',
        privacy_url = 'https://www.heidelbergmaterials.com.au/privacy'
    WHERE company_id = v_company_id
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_branding' AND column_name = 'app_name');

END $$;

-- ============================================================================
-- STEP 3: CREATE DEFAULT EMAIL TEMPLATES (if function exists)
-- ============================================================================
DO $$
DECLARE
    v_company_id uuid;
BEGIN
    SELECT id INTO v_company_id FROM companies WHERE email_domain = 'heidelberg.com.au';

    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_default_email_templates') THEN
        PERFORM create_default_email_templates(v_company_id);
    END IF;
END $$;

-- ============================================================================
-- STEP 4: USER PERMISSIONS
-- ============================================================================

-- Domain-level permissions for @heidelberg.com.au users
INSERT INTO user_permissions (
    company_id,
    scope,
    email_domain,
    restricted_customer,
    lock_customer_filter,
    show_all_data,
    default_site,
    can_view_compliance,
    can_view_reports,
    can_manage_sites,
    can_manage_users,
    can_export_data,
    can_view_costs,
    can_generate_ai_reports,
    can_edit_vehicles,
    can_edit_sites,
    can_delete_records,
    hide_cost_forecast,
    hide_leaderboard,
    hide_usage_costs,
    is_active
)
SELECT
    id,
    'domain',
    'heidelberg.com.au',
    NULL,
    false,
    true,
    'all',
    true,
    true,
    true,
    false,
    true,
    true,
    true,
    true,
    true,
    false,
    false,
    false,
    false,
    true
FROM companies WHERE email_domain = 'heidelberg.com.au'
ON CONFLICT (email_domain) DO UPDATE SET
    show_all_data = true,
    can_view_compliance = true,
    can_view_reports = true,
    can_generate_ai_reports = true,
    updated_at = NOW();

-- User-specific permissions for demo user (jonny.harper01@gmail.com)
INSERT INTO user_permissions (
    company_id,
    scope,
    user_email,
    restricted_customer,
    lock_customer_filter,
    show_all_data,
    default_site,
    can_view_compliance,
    can_view_reports,
    can_manage_sites,
    can_manage_users,
    can_export_data,
    can_view_costs,
    can_generate_ai_reports,
    can_edit_vehicles,
    can_edit_sites,
    can_delete_records,
    hide_cost_forecast,
    hide_leaderboard,
    hide_usage_costs,
    is_active
)
SELECT
    id,
    'user',
    'jonny.harper01@gmail.com',
    NULL,
    false,
    true,
    'all',
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    false,
    false,
    false,
    true
FROM companies WHERE email_domain = 'heidelberg.com.au'
ON CONFLICT (user_email) DO UPDATE SET
    can_manage_users = true,
    can_delete_records = true,
    show_all_data = true,
    updated_at = NOW();

-- ============================================================================
-- STEP 5: SAMPLE COMPLIANCE TARGETS
-- ============================================================================
INSERT INTO compliance_targets (
    company_id,
    customer_ref,
    type,
    name,
    target_washes_per_week,
    applies_to
)
SELECT id, 'HM-001', 'global', 'Standard Fleet Compliance', 2, 'all'
FROM companies WHERE email_domain = 'heidelberg.com.au'
ON CONFLICT DO NOTHING;

INSERT INTO compliance_targets (
    company_id,
    customer_ref,
    type,
    name,
    target_washes_per_week,
    applies_to
)
SELECT id, 'HM-001', 'site', 'High Traffic Site Target', 3, 'site-melb-001'
FROM companies WHERE email_domain = 'heidelberg.com.au'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- This migration creates:
-- 1. Heidelberg Materials company with valid UUID
-- 2. Full white-label branding (login, email, PDF)
-- 3. User permissions for @heidelberg.com.au domain
-- 4. User permissions for jonny.harper01@gmail.com
-- 5. Default email templates
-- 6. Sample compliance targets
--
-- To create the user, run in Supabase Dashboard -> SQL Editor:
--
-- 1. First create auth user in Authentication -> Users -> Add user:
--    Email: jonny.harper01@gmail.com
--    Password: jonnyharper5
--    Check "Auto Confirm User"
--
-- 2. Then run this SQL to create profile:
--    INSERT INTO user_profiles (id, company_id, email, full_name, phone, job_title, role, company_name, is_active)
--    SELECT
--        au.id,
--        c.id,
--        'jonny.harper01@gmail.com',
--        'Jonny Harper',
--        '+61 400 000 000',
--        'Fleet Manager',
--        'admin',
--        'Heidelberg Materials',
--        true
--    FROM auth.users au, companies c
--    WHERE au.email = 'jonny.harper01@gmail.com'
--    AND c.email_domain = 'heidelberg.com.au'
--    ON CONFLICT (email) DO UPDATE SET
--        full_name = 'Jonny Harper',
--        role = 'admin',
--        company_name = 'Heidelberg Materials',
--        updated_at = NOW();
-- ============================================================================
