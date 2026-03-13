-- Report Schedules: client-managed list of who receives reports and when
-- Migration: 20260312000001_report_schedules

-- ============================================================================
-- REPORT SCHEDULES TABLE
-- ============================================================================
CREATE TABLE report_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    contact_name TEXT NOT NULL,
    contact_company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    email TEXT NOT NULL,
    role_title TEXT,
    report_types TEXT[] DEFAULT '{}',
    frequency TEXT NOT NULL DEFAULT 'weekly' CHECK (frequency IN ('daily', 'weekly', 'fortnightly', 'monthly', 'quarterly')),
    send_day INTEGER DEFAULT 5 CHECK (send_day >= 0 AND send_day <= 31),
    starting_from DATE NOT NULL DEFAULT CURRENT_DATE,
    last_sent TIMESTAMPTZ,
    active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_report_schedules_company ON report_schedules(company_id);
CREATE INDEX idx_report_schedules_contact_company ON report_schedules(contact_company_id);
CREATE INDEX idx_report_schedules_active ON report_schedules(active);
CREATE INDEX idx_report_schedules_last_sent ON report_schedules(last_sent);

COMMENT ON TABLE report_schedules IS 'Client-managed list of contacts to receive scheduled reports — who gets what, and when';
COMMENT ON COLUMN report_schedules.company_id IS 'Tenant: the organization that owns this schedule';
COMMENT ON COLUMN report_schedules.contact_company_id IS 'The company/customer this contact belongs to (e.g. Holcim, Heidelberg)';
COMMENT ON COLUMN report_schedules.send_day IS 'Day of week (0-6) for weekly/fortnightly, or day of month (1-28) for monthly/quarterly';
COMMENT ON COLUMN report_schedules.report_types IS 'Array of report type IDs to include (compliance_rate, total_washes, etc.)';

CREATE TRIGGER update_report_schedules_updated_at
    BEFORE UPDATE ON report_schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- RLS: report_schedules (company-scoped; super_admin sees all)
-- ============================================================================
ALTER TABLE report_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read schedules in their company or super_admin all"
    ON report_schedules FOR SELECT
    TO authenticated
    USING (
        public.is_super_admin()
        OR company_id = public.user_company_id()
    );

CREATE POLICY "Users can insert schedules for their company"
    ON report_schedules FOR INSERT
    TO authenticated
    WITH CHECK (
        company_id = public.user_company_id()
    );

CREATE POLICY "Users can update schedules in their company"
    ON report_schedules FOR UPDATE
    TO authenticated
    USING (
        public.is_super_admin()
        OR company_id = public.user_company_id()
    )
    WITH CHECK (
        public.is_super_admin()
        OR company_id = public.user_company_id()
    );

CREATE POLICY "Users can delete schedules in their company"
    ON report_schedules FOR DELETE
    TO authenticated
    USING (
        public.is_super_admin()
        OR company_id = public.user_company_id()
    );
