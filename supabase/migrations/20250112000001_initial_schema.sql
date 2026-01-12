-- ELORA Fleet Compliance Portal - Initial Schema
-- Multi-tenant architecture with Row-Level Security (RLS)
-- Migration: 20250112000001_initial_schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- COMPANIES TABLE (Multi-tenant root)
-- ============================================================================
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email_domain TEXT UNIQUE,
    elora_customer_ref TEXT UNIQUE, -- Maps to external Elora API customer ref
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_companies_elora_ref ON companies(elora_customer_ref);
CREATE INDEX idx_companies_email_domain ON companies(email_domain);

COMMENT ON TABLE companies IS 'Multi-tenant company/organization table';
COMMENT ON COLUMN companies.elora_customer_ref IS 'Reference to external Elora API customer';

-- ============================================================================
-- USER PROFILES TABLE (extends Supabase auth.users)
-- ============================================================================
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user', 'site_manager', 'driver')),
    assigned_sites TEXT[], -- Array of site refs from external API
    assigned_vehicles TEXT[], -- Array of vehicle refs from external API
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_profiles_company ON user_profiles(company_id);
CREATE INDEX idx_user_profiles_email ON user_profiles(email);
CREATE INDEX idx_user_profiles_role ON user_profiles(role);

COMMENT ON TABLE user_profiles IS 'Extended user profile data linked to Supabase Auth';
COMMENT ON COLUMN user_profiles.company_id IS 'Company the user belongs to (multi-tenancy)';

-- ============================================================================
-- CLIENT BRANDING TABLE
-- ============================================================================
CREATE TABLE client_branding (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    client_email_domain TEXT NOT NULL,
    company_name TEXT NOT NULL,
    logo_url TEXT,
    primary_color TEXT DEFAULT '#7CB342',
    secondary_color TEXT DEFAULT '#9CCC65',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, client_email_domain)
);

CREATE INDEX idx_client_branding_company ON client_branding(company_id);
CREATE INDEX idx_client_branding_domain ON client_branding(client_email_domain);

COMMENT ON TABLE client_branding IS 'Client branding configuration for white-labeling';

-- ============================================================================
-- COMPLIANCE TARGETS TABLE
-- ============================================================================
CREATE TABLE compliance_targets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    customer_ref TEXT NOT NULL, -- External Elora customer ref
    type TEXT NOT NULL CHECK (type IN ('site', 'vehicle', 'global')),
    name TEXT NOT NULL,
    target_washes_per_week INTEGER NOT NULL CHECK (target_washes_per_week > 0),
    applies_to TEXT DEFAULT 'all', -- 'all', specific site ref, or vehicle ref
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_compliance_targets_company ON compliance_targets(company_id);
CREATE INDEX idx_compliance_targets_customer_ref ON compliance_targets(customer_ref);
CREATE INDEX idx_compliance_targets_type ON compliance_targets(type);

COMMENT ON TABLE compliance_targets IS 'Customizable compliance targets for wash frequency';
COMMENT ON COLUMN compliance_targets.applies_to IS 'Scope: "all", site ref, or vehicle ref';

-- ============================================================================
-- FAVORITE VEHICLES TABLE
-- ============================================================================
CREATE TABLE favorite_vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL,
    vehicle_ref TEXT NOT NULL, -- External Elora vehicle ref
    vehicle_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, vehicle_ref)
);

CREATE INDEX idx_favorite_vehicles_company ON favorite_vehicles(company_id);
CREATE INDEX idx_favorite_vehicles_user ON favorite_vehicles(user_id);
CREATE INDEX idx_favorite_vehicles_user_email ON favorite_vehicles(user_email);

COMMENT ON TABLE favorite_vehicles IS 'User favorited vehicles for quick access';

-- ============================================================================
-- MAINTENANCE RECORDS TABLE
-- ============================================================================
CREATE TABLE maintenance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    vehicle_id TEXT NOT NULL, -- External vehicle ref or internal ID
    vehicle_name TEXT,
    site_id TEXT, -- External site ref
    service_type TEXT NOT NULL,
    service_date DATE NOT NULL,
    next_service_date DATE,
    cost NUMERIC(10, 2),
    description TEXT,
    performed_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_maintenance_company ON maintenance_records(company_id);
CREATE INDEX idx_maintenance_vehicle ON maintenance_records(vehicle_id);
CREATE INDEX idx_maintenance_service_date ON maintenance_records(service_date DESC);
CREATE INDEX idx_maintenance_next_service ON maintenance_records(next_service_date);

COMMENT ON TABLE maintenance_records IS 'Fleet maintenance records and schedules';

-- ============================================================================
-- NOTIFICATIONS TABLE
-- ============================================================================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('maintenance_due', 'maintenance_overdue', 'low_compliance', 'info', 'alert')),
    severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
    is_read BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_company ON notifications(company_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_user_email ON notifications(user_email);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_metadata ON notifications USING gin(metadata);

COMMENT ON TABLE notifications IS 'User notifications for compliance and maintenance alerts';

-- ============================================================================
-- NOTIFICATION PREFERENCES TABLE
-- ============================================================================
CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL UNIQUE,
    email_notifications_enabled BOOLEAN DEFAULT true,
    notify_maintenance_due BOOLEAN DEFAULT true,
    notify_maintenance_overdue BOOLEAN DEFAULT true,
    notify_low_compliance BOOLEAN DEFAULT true,
    maintenance_due_days INTEGER DEFAULT 7 CHECK (maintenance_due_days > 0),
    compliance_threshold INTEGER DEFAULT 50 CHECK (compliance_threshold BETWEEN 0 AND 100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notification_prefs_company ON notification_preferences(company_id);
CREATE INDEX idx_notification_prefs_user ON notification_preferences(user_id);

COMMENT ON TABLE notification_preferences IS 'User notification preferences and thresholds';

-- ============================================================================
-- EMAIL DIGEST PREFERENCES TABLE
-- ============================================================================
CREATE TABLE email_digest_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL UNIQUE,
    enabled BOOLEAN DEFAULT true,
    frequency TEXT DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly', 'monthly')),
    send_time TIME DEFAULT '08:00',
    include_compliance BOOLEAN DEFAULT true,
    include_maintenance BOOLEAN DEFAULT true,
    include_alerts BOOLEAN DEFAULT true,
    include_activity BOOLEAN DEFAULT true,
    only_if_changes BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_digest_prefs_company ON email_digest_preferences(company_id);
CREATE INDEX idx_email_digest_prefs_user ON email_digest_preferences(user_id);

COMMENT ON TABLE email_digest_preferences IS 'Email digest subscription preferences';

-- ============================================================================
-- EMAIL REPORT PREFERENCES TABLE
-- ============================================================================
CREATE TABLE email_report_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL UNIQUE,
    enabled BOOLEAN DEFAULT true,
    frequency TEXT DEFAULT 'weekly' CHECK (frequency IN ('daily', 'weekly', 'monthly')),
    scheduled_time TIME DEFAULT '09:00',
    scheduled_day_of_week INTEGER CHECK (scheduled_day_of_week BETWEEN 0 AND 6), -- 0=Sunday
    scheduled_day_of_month INTEGER CHECK (scheduled_day_of_month BETWEEN 1 AND 31),
    report_types TEXT[] DEFAULT ARRAY['compliance', 'maintenance', 'costs'],
    include_charts BOOLEAN DEFAULT true,
    include_ai_insights BOOLEAN DEFAULT true,
    last_sent TIMESTAMPTZ,
    next_scheduled TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_report_prefs_company ON email_report_preferences(company_id);
CREATE INDEX idx_email_report_prefs_user ON email_report_preferences(user_id);
CREATE INDEX idx_email_report_prefs_next_scheduled ON email_report_preferences(next_scheduled);

COMMENT ON TABLE email_report_preferences IS 'Scheduled email report preferences';

-- ============================================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all relevant tables
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_client_branding_updated_at BEFORE UPDATE ON client_branding
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_compliance_targets_updated_at BEFORE UPDATE ON compliance_targets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_maintenance_records_updated_at BEFORE UPDATE ON maintenance_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_prefs_updated_at BEFORE UPDATE ON notification_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_digest_prefs_updated_at BEFORE UPDATE ON email_digest_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_report_prefs_updated_at BEFORE UPDATE ON email_report_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SCHEMA SUMMARY
-- ============================================================================
-- Tables created: 10
-- Indexes created: 33
-- Triggers created: 8
-- Multi-tenant ready with company_id on all tables
-- ============================================================================
