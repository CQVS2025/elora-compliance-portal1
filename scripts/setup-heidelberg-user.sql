-- ============================================================================
-- HEIDELBERG MATERIALS USER SETUP SCRIPT
-- ============================================================================
-- Run this SQL in Supabase Dashboard -> SQL Editor AFTER creating the auth user
--
-- STEP 1: Create Auth User First (in Supabase Dashboard)
--   Go to: Authentication -> Users -> Add user -> Create new user
--   Email: jonny.harper01@gmail.com
--   Password: jonnyharper5
--   Check: "Auto Confirm User"
--   Click: "Create user"
--
-- STEP 2: Run this script to create the user profile
-- ============================================================================

-- Create user profile for Heidelberg Materials demo user
INSERT INTO user_profiles (
    id,
    company_id,
    email,
    full_name,
    phone,
    job_title,
    role,
    company_name,
    is_active
)
SELECT
    au.id,
    c.id,
    'jonny.harper01@gmail.com',
    'Jonny Harper',
    '+61 400 000 000',
    'Fleet Manager',
    'admin',
    'Heidelberg Materials',
    true
FROM auth.users au
CROSS JOIN companies c
WHERE au.email = 'jonny.harper01@gmail.com'
AND c.email_domain = 'heidelberg.com.au'
ON CONFLICT (email) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    full_name = 'Jonny Harper',
    phone = '+61 400 000 000',
    job_title = 'Fleet Manager',
    role = 'admin',
    company_name = 'Heidelberg Materials',
    is_active = true,
    updated_at = NOW();

-- Verify the setup
SELECT
    up.email,
    up.full_name,
    up.role,
    up.company_name,
    c.name as company_from_db,
    cb.primary_color,
    cb.login_tagline
FROM user_profiles up
JOIN companies c ON up.company_id = c.id
LEFT JOIN client_branding cb ON c.id = cb.company_id
WHERE up.email = 'jonny.harper01@gmail.com';

-- ============================================================================
-- LOGIN CREDENTIALS
-- ============================================================================
-- Email: jonny.harper01@gmail.com
-- Password: jonnyharper5
--
-- BRANDING:
-- Company: Heidelberg Materials
-- Primary Color: #003DA5 (Heidelberg Blue)
-- Secondary Color: #00A3E0 (Light Blue)
-- Tagline: "Building Tomorrow's Infrastructure Today"
-- ============================================================================
