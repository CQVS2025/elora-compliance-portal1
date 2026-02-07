-- AI Insights: driver patterns and site intelligence (Phase 1)
-- Migration: 20260205000003_ai_driver_site_insights

-- Optional label for wash window cards (e.g. "Before first deliveries")
ALTER TABLE ai_wash_windows ADD COLUMN IF NOT EXISTS window_label TEXT;

-- ============================================================================
-- AI DRIVER PATTERNS (behavioral patterns per driver)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_driver_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    driver_name TEXT NOT NULL,
    pattern_type TEXT CHECK (pattern_type IN (
        'best_wash_time', 'skip_day', 'response_to_reminders',
        'consistency', 'improvement_trend', 'decline_trend'
    )),
    pattern_description TEXT NOT NULL,
    pattern_data JSONB DEFAULT '{}',
    confidence_score DECIMAL(5,2),
    is_positive BOOLEAN DEFAULT true,
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    valid_until TIMESTAMPTZ
);

CREATE INDEX idx_ai_driver_patterns_company ON ai_driver_patterns(company_id);
CREATE INDEX idx_ai_driver_patterns_driver ON ai_driver_patterns(driver_name);

ALTER TABLE ai_driver_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ai_driver_patterns for their company"
    ON ai_driver_patterns FOR SELECT
    USING (
        company_id IS NULL OR
        company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid())
    );

CREATE POLICY "Super admins full access ai_driver_patterns"
    ON ai_driver_patterns FOR ALL
    USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin')
    );

-- ============================================================================
-- AI SITE INSIGHTS (location-based compliance and recommendations)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_site_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    site_ref TEXT,
    site_name TEXT NOT NULL,
    insight_date DATE NOT NULL DEFAULT CURRENT_DATE,
    compliance_rate DECIMAL(5,2),
    trend TEXT CHECK (trend IN ('improving', 'stable', 'declining')),
    trend_percentage DECIMAL(5,2),
    recommendation TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_site_insights_company ON ai_site_insights(company_id);
CREATE INDEX idx_ai_site_insights_site ON ai_site_insights(site_ref);
CREATE INDEX idx_ai_site_insights_date ON ai_site_insights(insight_date);

ALTER TABLE ai_site_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ai_site_insights for their company"
    ON ai_site_insights FOR SELECT
    USING (
        company_id IS NULL OR
        company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid())
    );

CREATE POLICY "Super admins full access ai_site_insights"
    ON ai_site_insights FOR ALL
    USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin')
    );
