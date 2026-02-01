-- Run this in Supabase SQL Editor
-- Creates user_permissions table if it doesn't exist

CREATE TABLE IF NOT EXISTS user_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email TEXT,
    scope TEXT NOT NULL DEFAULT 'user' CHECK (scope IN ('user', 'domain')),
    email_domain TEXT,
    restricted_customer TEXT,
    lock_customer_filter BOOLEAN DEFAULT false,
    show_all_data BOOLEAN DEFAULT true,
    default_site TEXT DEFAULT 'all',
    visible_tabs TEXT[],
    hidden_tabs TEXT[],
    hide_cost_forecast BOOLEAN DEFAULT false,
    hide_leaderboard BOOLEAN DEFAULT false,
    hide_usage_costs BOOLEAN DEFAULT false,
    can_view_compliance BOOLEAN DEFAULT true,
    can_view_reports BOOLEAN DEFAULT true,
    can_manage_sites BOOLEAN DEFAULT true,
    can_manage_users BOOLEAN DEFAULT false,
    can_export_data BOOLEAN DEFAULT true,
    can_view_costs BOOLEAN DEFAULT true,
    can_generate_ai_reports BOOLEAN DEFAULT true,
    can_edit_vehicles BOOLEAN DEFAULT true,
    can_edit_sites BOOLEAN DEFAULT true,
    can_delete_records BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_scope CHECK (
        (scope = 'user' AND (user_id IS NOT NULL OR user_email IS NOT NULL)) OR
        (scope = 'domain' AND email_domain IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_company ON user_permissions(company_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_email ON user_permissions(user_email);
CREATE INDEX IF NOT EXISTS idx_user_permissions_domain ON user_permissions(email_domain);
CREATE INDEX IF NOT EXISTS idx_user_permissions_scope ON user_permissions(scope);

ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own permissions" ON user_permissions;
DROP POLICY IF EXISTS "Admins can manage company permissions" ON user_permissions;
DROP POLICY IF EXISTS "Super admins can manage all permissions" ON user_permissions;

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

DROP TRIGGER IF EXISTS update_user_permissions_updated_at ON user_permissions;
CREATE TRIGGER update_user_permissions_updated_at 
    BEFORE UPDATE ON user_permissions
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
