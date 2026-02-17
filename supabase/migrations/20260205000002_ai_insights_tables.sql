-- AI Insights Phase 1: storage for predictions, recommendations, and model setting
-- Migration: 20260205000002_ai_insights_tables
-- Vehicles/wash data come from Elora API; we store vehicle_ref (TEXT) for linking.

-- ============================================================================
-- AI SETTINGS (Super Admin: default model Haiku 4.5 / Sonnet / Opus)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

-- Only one row: default_ai_model = 'claude-haiku-4-5-20251001' | 'claude-sonnet-4-20250514' | 'claude-opus-4-20250514'
INSERT INTO ai_settings (key, value) VALUES ('default_ai_model', 'claude-haiku-4-5-20251001')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read (needed for Edge Functions and UI display)
CREATE POLICY "Authenticated users can read ai_settings"
    ON ai_settings FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Only super_admin can update
CREATE POLICY "Super admins can update ai_settings"
    ON ai_settings FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- ============================================================================
-- AI PREDICTIONS (vehicle risk level, score, reasoning, expiry)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    vehicle_ref TEXT NOT NULL,
    vehicle_name TEXT,
    site_ref TEXT,
    site_name TEXT,
    driver_name TEXT,
    prediction_date DATE NOT NULL,
    risk_level TEXT CHECK (risk_level IN ('critical', 'high', 'medium', 'low')),
    risk_score INTEGER CHECK (risk_score BETWEEN 0 AND 100),
    predicted_compliance_rate DECIMAL(5,2),
    hours_until_risk INTEGER,
    confidence_score DECIMAL(5,2),
    reasoning TEXT,
    recommended_action TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

CREATE INDEX idx_ai_predictions_company ON ai_predictions(company_id);
CREATE INDEX idx_ai_predictions_vehicle ON ai_predictions(vehicle_ref);
CREATE INDEX idx_ai_predictions_date ON ai_predictions(prediction_date);
CREATE INDEX idx_ai_predictions_risk ON ai_predictions(risk_level);
CREATE INDEX idx_ai_predictions_expires ON ai_predictions(expires_at);

ALTER TABLE ai_predictions ENABLE ROW LEVEL SECURITY;

-- Users see predictions for their company only (tenant isolation)
CREATE POLICY "Users can view ai_predictions for their company"
    ON ai_predictions FOR SELECT
    USING (
        company_id IS NULL OR
        company_id IN (
            SELECT company_id FROM user_profiles WHERE id = auth.uid()
        )
    );

-- Super admin can do anything; service role used by Edge Functions bypasses RLS
CREATE POLICY "Super admins full access ai_predictions"
    ON ai_predictions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- ============================================================================
-- AI RECOMMENDATIONS (priority, title, description, suggested action, status)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    vehicle_ref TEXT,
    vehicle_name TEXT,
    driver_name TEXT,
    site_ref TEXT,
    site_name TEXT,
    recommendation_type TEXT CHECK (recommendation_type IN (
        'wash_schedule', 'frequency_increase', 'reminder_timing',
        'pattern_alert', 'site_optimization'
    )),
    priority TEXT CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    suggested_action TEXT,
    suggested_time TIME,
    confidence_score DECIMAL(5,2),
    potential_compliance_gain DECIMAL(5,2),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'dismissed', 'completed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    actioned_at TIMESTAMPTZ,
    actioned_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_ai_recommendations_company ON ai_recommendations(company_id);
CREATE INDEX idx_ai_recommendations_vehicle ON ai_recommendations(vehicle_ref);
CREATE INDEX idx_ai_recommendations_status ON ai_recommendations(status);
CREATE INDEX idx_ai_recommendations_priority ON ai_recommendations(priority);

ALTER TABLE ai_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ai_recommendations for their company"
    ON ai_recommendations FOR SELECT
    USING (
        company_id IS NULL OR
        company_id IN (
            SELECT company_id FROM user_profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Super admins full access ai_recommendations"
    ON ai_recommendations FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- ============================================================================
-- AI WASH WINDOWS (optional Phase 1: optimal wash window cards)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_wash_windows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    site_ref TEXT,
    window_start TIME NOT NULL,
    window_end TIME NOT NULL,
    window_type TEXT CHECK (window_type IN ('optimal', 'available', 'busy')),
    utilization_rate DECIMAL(5,2),
    recommended_vehicle_refs JSONB,
    day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_wash_windows_company ON ai_wash_windows(company_id);
CREATE INDEX idx_ai_wash_windows_site ON ai_wash_windows(site_ref);

ALTER TABLE ai_wash_windows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ai_wash_windows for their company"
    ON ai_wash_windows FOR SELECT
    USING (
        company_id IS NULL OR
        company_id IN (
            SELECT company_id FROM user_profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Super admins full access ai_wash_windows"
    ON ai_wash_windows FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );
