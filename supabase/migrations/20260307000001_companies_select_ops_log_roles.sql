-- Allow delivery_manager and driver to SELECT all companies (e.g. for Operations Log company logos).
-- Flow for super_admin and delivery_manager on ops log is the same: see all companies and logos.
DROP POLICY IF EXISTS "Users can view their own company" ON companies;
CREATE POLICY "Users can view their own company"
    ON companies FOR SELECT
    USING (
        id = public.user_company_id()
        OR public.is_super_admin()
        OR EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role IN ('delivery_manager', 'driver')
        )
    );
