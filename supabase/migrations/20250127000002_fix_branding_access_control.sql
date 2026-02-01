-- ============================================================================
-- Fix Branding Access Control for Super Admins and Admins
-- ============================================================================
-- This migration fixes the branding management access control to ensure:
-- 1. Super Admins can manage branding for ALL companies
-- 2. Admins can ONLY manage branding for THEIR OWN company
-- 3. Both roles have appropriate access through RLS policies
-- ============================================================================

-- ============================================================================
-- STEP 1: Update Helper Functions
-- ============================================================================

-- Create or replace user_company_id() function in public schema
CREATE OR REPLACE FUNCTION public.user_company_id()
RETURNS UUID AS $$
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER;

COMMENT ON FUNCTION public.user_company_id IS 'Returns the company_id for the currently authenticated user';

-- Update is_admin() to include super_admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
    SELECT role IN ('admin', 'super_admin') FROM user_profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER;

COMMENT ON FUNCTION public.is_admin IS 'Returns true if the current user has admin or super_admin role';

-- Create new function to check if user is super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
    SELECT role = 'super_admin' FROM user_profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER;

COMMENT ON FUNCTION public.is_super_admin IS 'Returns true if the current user has super_admin role';

-- ============================================================================
-- STEP 2: Drop and Recreate Client Branding RLS Policies
-- ============================================================================

-- Drop existing policies (drop all possible variations)
DROP POLICY IF EXISTS "Users can view their company branding" ON client_branding;
DROP POLICY IF EXISTS "Admins can manage branding" ON client_branding;
DROP POLICY IF EXISTS "Super admins can manage all branding" ON client_branding;
DROP POLICY IF EXISTS "Admins can manage their company branding" ON client_branding;

-- Create new policies with proper access control

-- Policy 1: Users can view their company's branding
CREATE POLICY "Users can view their company branding"
    ON client_branding FOR SELECT
    USING (
        company_id = public.user_company_id() OR 
        public.is_super_admin()
    );

-- Policy 2: Super admins can manage ALL company branding
CREATE POLICY "Super admins can manage all branding"
    ON client_branding FOR ALL
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- Policy 3: Company admins can ONLY manage THEIR company's branding
CREATE POLICY "Admins can manage their company branding"
    ON client_branding FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND role = 'admin' 
            AND company_id = client_branding.company_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND role = 'admin' 
            AND company_id = client_branding.company_id
        )
    );

-- ============================================================================
-- STEP 3: Update Companies Table RLS Policies
-- ============================================================================

-- Drop existing policies (drop all possible variations)
DROP POLICY IF EXISTS "Users can view their own company" ON companies;
DROP POLICY IF EXISTS "Admins can insert companies" ON companies;
DROP POLICY IF EXISTS "Super admins can insert companies" ON companies;
DROP POLICY IF EXISTS "Admins can update companies" ON companies;
DROP POLICY IF EXISTS "Super admins can update companies" ON companies;

-- Recreate with proper access control

-- Policy 1: Users can view their company, super admins can view all
CREATE POLICY "Users can view their own company"
    ON companies FOR SELECT
    USING (
        id = public.user_company_id() OR 
        public.is_super_admin()
    );

-- Policy 2: Only super admins can insert companies
CREATE POLICY "Super admins can insert companies"
    ON companies FOR INSERT
    WITH CHECK (public.is_super_admin());

-- Policy 3: Super admins can update all, admins can update their own
CREATE POLICY "Admins can update companies"
    ON companies FOR UPDATE
    USING (
        public.is_super_admin() OR 
        (
            EXISTS (
                SELECT 1 FROM user_profiles 
                WHERE user_profiles.id = auth.uid() 
                AND user_profiles.role = 'admin' 
                AND companies.id = user_profiles.company_id
            )
        )
    );

-- ============================================================================
-- VERIFICATION QUERIES (commented out - for manual testing)
-- ============================================================================

-- Test as super_admin:
-- SELECT * FROM client_branding; -- Should see all
-- UPDATE client_branding SET logo_url = 'test' WHERE company_id = 'any-company-id'; -- Should work

-- Test as admin:
-- SELECT * FROM client_branding WHERE company_id = public.user_company_id(); -- Should see own company
-- UPDATE client_branding SET logo_url = 'test' WHERE company_id = public.user_company_id(); -- Should work
-- UPDATE client_branding SET logo_url = 'test' WHERE company_id != public.user_company_id(); -- Should FAIL

-- ============================================================================
-- NOTES
-- ============================================================================
-- This migration ensures:
-- 1. Super Admins have full access to all company branding
-- 2. Admins can only access and modify their own company's branding
-- 3. Regular users can view their company's branding (read-only via app logic)
-- ============================================================================
