-- Vehicle Likelihood Overrides
-- Managers can set manual Green/Orange/Red likelihood for vehicles per company
-- Migration: 20260212000001_vehicle_likelihood_overrides

CREATE TABLE vehicle_likelihood_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    vehicle_ref TEXT NOT NULL,
    likelihood TEXT NOT NULL CHECK (likelihood IN ('green', 'orange', 'red')),
    updated_by TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, vehicle_ref)
);

CREATE INDEX idx_vehicle_likelihood_company ON vehicle_likelihood_overrides(company_id);
CREATE INDEX idx_vehicle_likelihood_vehicle ON vehicle_likelihood_overrides(vehicle_ref);

COMMENT ON TABLE vehicle_likelihood_overrides IS 'Manager overrides for vehicle compliance likelihood (On Track / Off Track)';
COMMENT ON COLUMN vehicle_likelihood_overrides.likelihood IS 'green = On Track, orange = At Risk, red = Critical';

-- RLS
ALTER TABLE vehicle_likelihood_overrides ENABLE ROW LEVEL SECURITY;

-- Users can read overrides for their company
CREATE POLICY vehicle_likelihood_select
    ON vehicle_likelihood_overrides FOR SELECT
    USING (
        company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid())
        OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin')
    );

-- Users with manager+ roles can insert/update/delete for their company
CREATE POLICY vehicle_likelihood_insert
    ON vehicle_likelihood_overrides FOR INSERT
    WITH CHECK (
        company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid())
        OR (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin') AND company_id IS NOT NULL)
    );

CREATE POLICY vehicle_likelihood_update
    ON vehicle_likelihood_overrides FOR UPDATE
    USING (
        company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid())
        OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin')
    );

CREATE POLICY vehicle_likelihood_delete
    ON vehicle_likelihood_overrides FOR DELETE
    USING (
        company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid())
        OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin')
    );
