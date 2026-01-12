-- ELORA Fleet Compliance Portal - Row-Level Security (RLS) Policies
-- Multi-tenant data isolation using company_id
-- Migration: 20250112000002_rls_policies

-- ============================================================================
-- HELPER FUNCTION: Get user's company_id from user_profiles
-- ============================================================================
CREATE OR REPLACE FUNCTION auth.user_company_id()
RETURNS UUID AS $$
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER;

COMMENT ON FUNCTION auth.user_company_id IS 'Returns the company_id for the currently authenticated user';

-- ============================================================================
-- HELPER FUNCTION: Check if user is admin
-- ============================================================================
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS BOOLEAN AS $$
    SELECT role = 'admin' FROM user_profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER;

COMMENT ON FUNCTION auth.is_admin IS 'Returns true if the current user has admin role';

-- ============================================================================
-- COMPANIES TABLE RLS
-- ============================================================================
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Admins can see all companies, regular users can only see their own
CREATE POLICY "Users can view their own company"
    ON companies FOR SELECT
    USING (
        id = auth.user_company_id() OR auth.is_admin()
    );

-- Only admins can insert companies
CREATE POLICY "Admins can insert companies"
    ON companies FOR INSERT
    WITH CHECK (auth.is_admin());

-- Only admins can update companies
CREATE POLICY "Admins can update companies"
    ON companies FOR UPDATE
    USING (auth.is_admin());

-- ============================================================================
-- USER PROFILES TABLE RLS
-- ============================================================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can view profiles in their company
CREATE POLICY "Users can view profiles in their company"
    ON user_profiles FOR SELECT
    USING (
        company_id = auth.user_company_id() OR auth.is_admin()
    );

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
    ON user_profiles FOR UPDATE
    USING (id = auth.uid());

-- Admins can insert user profiles
CREATE POLICY "Admins can insert user profiles"
    ON user_profiles FOR INSERT
    WITH CHECK (
        auth.is_admin() OR
        company_id = auth.user_company_id()
    );

-- ============================================================================
-- CLIENT BRANDING TABLE RLS
-- ============================================================================
ALTER TABLE client_branding ENABLE ROW LEVEL SECURITY;

-- Users can view their company's branding
CREATE POLICY "Users can view their company branding"
    ON client_branding FOR SELECT
    USING (company_id = auth.user_company_id());

-- Only admins can manage branding
CREATE POLICY "Admins can manage branding"
    ON client_branding FOR ALL
    USING (auth.is_admin())
    WITH CHECK (auth.is_admin());

-- ============================================================================
-- COMPLIANCE TARGETS TABLE RLS
-- ============================================================================
ALTER TABLE compliance_targets ENABLE ROW LEVEL SECURITY;

-- Users can view their company's compliance targets
CREATE POLICY "Users can view their company compliance targets"
    ON compliance_targets FOR SELECT
    USING (company_id = auth.user_company_id());

-- Users can insert compliance targets for their company
CREATE POLICY "Users can insert compliance targets"
    ON compliance_targets FOR INSERT
    WITH CHECK (company_id = auth.user_company_id());

-- Users can update their company's compliance targets
CREATE POLICY "Users can update compliance targets"
    ON compliance_targets FOR UPDATE
    USING (company_id = auth.user_company_id());

-- Users can delete their company's compliance targets
CREATE POLICY "Users can delete compliance targets"
    ON compliance_targets FOR DELETE
    USING (company_id = auth.user_company_id());

-- ============================================================================
-- FAVORITE VEHICLES TABLE RLS
-- ============================================================================
ALTER TABLE favorite_vehicles ENABLE ROW LEVEL SECURITY;

-- Users can view their own favorites
CREATE POLICY "Users can view their own favorites"
    ON favorite_vehicles FOR SELECT
    USING (user_id = auth.uid());

-- Users can insert their own favorites
CREATE POLICY "Users can insert their own favorites"
    ON favorite_vehicles FOR INSERT
    WITH CHECK (
        user_id = auth.uid() AND
        company_id = auth.user_company_id()
    );

-- Users can delete their own favorites
CREATE POLICY "Users can delete their own favorites"
    ON favorite_vehicles FOR DELETE
    USING (user_id = auth.uid());

-- ============================================================================
-- MAINTENANCE RECORDS TABLE RLS
-- ============================================================================
ALTER TABLE maintenance_records ENABLE ROW LEVEL SECURITY;

-- Users can view their company's maintenance records
CREATE POLICY "Users can view their company maintenance records"
    ON maintenance_records FOR SELECT
    USING (company_id = auth.user_company_id());

-- Users can insert maintenance records for their company
CREATE POLICY "Users can insert maintenance records"
    ON maintenance_records FOR INSERT
    WITH CHECK (company_id = auth.user_company_id());

-- Users can update their company's maintenance records
CREATE POLICY "Users can update maintenance records"
    ON maintenance_records FOR UPDATE
    USING (company_id = auth.user_company_id());

-- Users can delete their company's maintenance records
CREATE POLICY "Users can delete maintenance records"
    ON maintenance_records FOR DELETE
    USING (company_id = auth.user_company_id());

-- ============================================================================
-- NOTIFICATIONS TABLE RLS
-- ============================================================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view their own notifications"
    ON notifications FOR SELECT
    USING (user_id = auth.uid());

-- System can insert notifications for users in the company
CREATE POLICY "System can insert notifications"
    ON notifications FOR INSERT
    WITH CHECK (company_id = auth.user_company_id());

-- Users can update (mark as read) their own notifications
CREATE POLICY "Users can update their own notifications"
    ON notifications FOR UPDATE
    USING (user_id = auth.uid());

-- Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications"
    ON notifications FOR DELETE
    USING (user_id = auth.uid());

-- ============================================================================
-- NOTIFICATION PREFERENCES TABLE RLS
-- ============================================================================
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can view their own preferences
CREATE POLICY "Users can view their own notification preferences"
    ON notification_preferences FOR SELECT
    USING (user_id = auth.uid());

-- Users can insert their own preferences
CREATE POLICY "Users can insert their own notification preferences"
    ON notification_preferences FOR INSERT
    WITH CHECK (
        user_id = auth.uid() AND
        company_id = auth.user_company_id()
    );

-- Users can update their own preferences
CREATE POLICY "Users can update their own notification preferences"
    ON notification_preferences FOR UPDATE
    USING (user_id = auth.uid());

-- ============================================================================
-- EMAIL DIGEST PREFERENCES TABLE RLS
-- ============================================================================
ALTER TABLE email_digest_preferences ENABLE ROW LEVEL SECURITY;

-- Users can view their own digest preferences
CREATE POLICY "Users can view their own digest preferences"
    ON email_digest_preferences FOR SELECT
    USING (user_id = auth.uid());

-- Users can insert their own digest preferences
CREATE POLICY "Users can insert their own digest preferences"
    ON email_digest_preferences FOR INSERT
    WITH CHECK (
        user_id = auth.uid() AND
        company_id = auth.user_company_id()
    );

-- Users can update their own digest preferences
CREATE POLICY "Users can update their own digest preferences"
    ON email_digest_preferences FOR UPDATE
    USING (user_id = auth.uid());

-- ============================================================================
-- EMAIL REPORT PREFERENCES TABLE RLS
-- ============================================================================
ALTER TABLE email_report_preferences ENABLE ROW LEVEL SECURITY;

-- Users can view their own report preferences
CREATE POLICY "Users can view their own report preferences"
    ON email_report_preferences FOR SELECT
    USING (user_id = auth.uid());

-- Users can insert their own report preferences
CREATE POLICY "Users can insert their own report preferences"
    ON email_report_preferences FOR INSERT
    WITH CHECK (
        user_id = auth.uid() AND
        company_id = auth.user_company_id()
    );

-- Users can update their own report preferences
CREATE POLICY "Users can update their own report preferences"
    ON email_report_preferences FOR UPDATE
    USING (user_id = auth.uid());

-- ============================================================================
-- SERVICE ROLE BYPASS
-- ============================================================================
-- Service role (used by Edge Functions) can bypass all RLS policies
-- This is automatically handled by Supabase when using the service role key

-- ============================================================================
-- RLS POLICIES SUMMARY
-- ============================================================================
-- Total policies created: 31
-- All tables have RLS enabled
-- Multi-tenant isolation enforced via company_id
-- Users can only access data within their company
-- Service role can bypass RLS for system operations
-- ============================================================================
