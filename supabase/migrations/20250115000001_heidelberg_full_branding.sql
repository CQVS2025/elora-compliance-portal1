-- ELORA Fleet Compliance Portal - Heidelberg Materials Full Branding
-- Migration: 20250115000001_heidelberg_full_branding
-- Creates comprehensive branding and user setup for Heidelberg Materials

-- ============================================================================
-- UPDATE HEIDELBERG MATERIALS BRANDING WITH FULL DETAILS
-- ============================================================================
UPDATE client_branding
SET
    -- Company Identity
    company_name = 'Heidelberg Materials',
    logo_url = 'https://www.heidelbergmaterials.com/themes/custom/theme_heidelbergmaterials/logo.svg',

    -- Brand Colors
    primary_color = '#003DA5',      -- Heidelberg Blue (official brand color)
    secondary_color = '#00A3E0',    -- Heidelberg Light Blue

    -- Login Page Customization
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
    ',

    -- Email Branding
    email_accent_color = '#003DA5',
    email_font_family = 'Arial, Helvetica, sans-serif',
    email_from_name = 'Heidelberg Materials Fleet Portal',
    email_reply_to = 'fleet@heidelberg.com.au',
    email_header_html = '<div style="background: linear-gradient(135deg, #003DA5 0%, #00A3E0 100%); padding: 20px; text-align: center;"><img src="https://www.heidelbergmaterials.com/themes/custom/theme_heidelbergmaterials/logo.svg" alt="Heidelberg Materials" style="height: 40px; filter: brightness(0) invert(1);"/></div>',
    email_footer_html = '<div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666;"><p>Heidelberg Materials Australia</p><p>Building a Sustainable Future</p><p style="margin-top: 10px;"><a href="https://www.heidelbergmaterials.com.au" style="color: #003DA5;">www.heidelbergmaterials.com.au</a></p></div>',

    -- PDF Report Branding
    pdf_logo_url = 'https://www.heidelbergmaterials.com/themes/custom/theme_heidelbergmaterials/logo.svg',
    pdf_accent_color = '#003DA5',
    pdf_include_cover_page = true,
    pdf_header_html = '<div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 20px; border-bottom: 3px solid #003DA5;"><img src="https://www.heidelbergmaterials.com/themes/custom/theme_heidelbergmaterials/logo.svg" alt="Logo" style="height: 30px;"/><span style="color: #003DA5; font-weight: bold;">Fleet Compliance Report</span></div>',
    pdf_footer_html = '<div style="text-align: center; padding: 10px; font-size: 10px; color: #666; border-top: 1px solid #ddd;">Heidelberg Materials Australia - Fleet Compliance Portal | Page {{page}} of {{pages}}</div>',
    pdf_cover_page_html = '<div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; background: linear-gradient(135deg, #003DA5 0%, #00A3E0 100%); color: white;"><img src="https://www.heidelbergmaterials.com/themes/custom/theme_heidelbergmaterials/logo.svg" alt="Logo" style="height: 80px; filter: brightness(0) invert(1); margin-bottom: 40px;"/><h1 style="font-size: 36px; margin: 0;">Fleet Compliance Report</h1><p style="font-size: 18px; margin-top: 20px;">{{report_date}}</p><p style="margin-top: 40px; font-size: 14px; opacity: 0.8;">Building Tomorrow''s Infrastructure Today</p></div>',

    -- Additional Branding
    favicon_url = 'https://www.heidelbergmaterials.com/favicon.ico',
    app_name = 'Heidelberg Materials Fleet Portal',
    support_email = 'fleet.support@heidelberg.com.au',
    support_phone = '+61 3 9000 0000',
    terms_url = 'https://www.heidelbergmaterials.com.au/terms',
    privacy_url = 'https://www.heidelbergmaterials.com.au/privacy',

    updated_at = NOW()
WHERE company_id = 'hm-001-uuid-4a8b-9c3d-e2f1a5b6c7d8'::uuid;

-- ============================================================================
-- UPDATE COMPANY DETAILS
-- ============================================================================
UPDATE companies
SET
    logo_url = 'https://www.heidelbergmaterials.com/themes/custom/theme_heidelbergmaterials/logo.svg',
    primary_color = '#003DA5',
    secondary_color = '#00A3E0',
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
    ),
    updated_at = NOW()
WHERE id = 'hm-001-uuid-4a8b-9c3d-e2f1a5b6c7d8'::uuid;

-- ============================================================================
-- CREATE DEFAULT EMAIL TEMPLATES FOR HEIDELBERG
-- ============================================================================
SELECT create_default_email_templates('hm-001-uuid-4a8b-9c3d-e2f1a5b6c7d8'::uuid);

-- ============================================================================
-- USER PERMISSIONS FOR HEIDELBERG DOMAIN
-- ============================================================================
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
) VALUES (
    'hm-001-uuid-4a8b-9c3d-e2f1a5b6c7d8'::uuid,
    'domain',
    'heidelberg.com.au',
    NULL,  -- No customer restriction
    false,
    true,
    'all',
    true,  -- can_view_compliance
    true,  -- can_view_reports
    true,  -- can_manage_sites
    false, -- can_manage_users (only admins)
    true,  -- can_export_data
    true,  -- can_view_costs
    true,  -- can_generate_ai_reports
    true,  -- can_edit_vehicles
    true,  -- can_edit_sites
    false, -- can_delete_records
    false, -- hide_cost_forecast
    false, -- hide_leaderboard
    false, -- hide_usage_costs
    true
) ON CONFLICT (email_domain) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    updated_at = NOW();

-- ============================================================================
-- GMAIL DOMAIN PERMISSIONS (for external users like jonny.harper01@gmail.com)
-- ============================================================================
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
) VALUES (
    'hm-001-uuid-4a8b-9c3d-e2f1a5b6c7d8'::uuid,
    'user',
    'jonny.harper01@gmail.com',
    NULL,  -- No customer restriction (full access to Heidelberg data)
    false,
    true,
    'all',
    true,  -- can_view_compliance
    true,  -- can_view_reports
    true,  -- can_manage_sites
    true,  -- can_manage_users (admin access)
    true,  -- can_export_data
    true,  -- can_view_costs
    true,  -- can_generate_ai_reports
    true,  -- can_edit_vehicles
    true,  -- can_edit_sites
    true,  -- can_delete_records (admin access)
    false, -- hide_cost_forecast
    false, -- hide_leaderboard
    false, -- hide_usage_costs
    true
) ON CONFLICT (user_email) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    can_manage_users = true,
    can_delete_records = true,
    updated_at = NOW();

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- This migration:
-- 1. Updates Heidelberg Materials client_branding with full white-label customization
-- 2. Updates company settings with comprehensive configuration
-- 3. Creates default email templates for the company
-- 4. Sets up domain-level permissions for heidelberg.com.au users
-- 5. Sets up specific permissions for jonny.harper01@gmail.com
--
-- The auth user must be created via the createHeidelbergUser edge function
-- which uses the Supabase Admin API to create users with passwords
-- ============================================================================
