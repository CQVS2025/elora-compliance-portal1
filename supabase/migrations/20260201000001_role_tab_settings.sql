-- Role tab settings - Super Admin override for tab visibility per role
-- Migration: 20260201000001_role_tab_settings

CREATE TABLE IF NOT EXISTS role_tab_settings (
    role TEXT PRIMARY KEY,
    visible_tabs TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE role_tab_settings ENABLE ROW LEVEL SECURITY;

-- Only super_admin can read and write
CREATE POLICY "Super admins can manage role tab settings"
    ON role_tab_settings FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- All authenticated users can read (needed for useAvailableTabs)
CREATE POLICY "Authenticated users can read role tab settings"
    ON role_tab_settings FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_role_tab_settings_updated_at
    BEFORE UPDATE ON role_tab_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
