-- AI Insights: pattern summary for Patterns tab (heatmap, peak hour, best site/driver, positive/concern patterns)
-- Migration: 20260205000004_ai_pattern_summary

CREATE TABLE IF NOT EXISTS ai_pattern_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    -- Heatmap: 7 rows (Mon-Sun), 13 cols (5am-5pm). Each cell = wash count for that day/hour.
    heatmap_json JSONB NOT NULL DEFAULT '[]',
    peak_hour TEXT,
    peak_hour_count INTEGER,
    lowest_day TEXT,
    lowest_day_pct_below_avg DECIMAL(5,2),
    best_site_name TEXT,
    best_site_compliance DECIMAL(5,2),
    top_driver_name TEXT,
    -- Arrays of { "text": "...", "confidence": 85 }
    positive_patterns JSONB NOT NULL DEFAULT '[]',
    concern_patterns JSONB NOT NULL DEFAULT '[]',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id)
);

CREATE INDEX idx_ai_pattern_summary_company ON ai_pattern_summary(company_id);

ALTER TABLE ai_pattern_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ai_pattern_summary for their company"
    ON ai_pattern_summary FOR SELECT
    USING (
        company_id IS NULL OR
        company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid())
    );

CREATE POLICY "Super admins full access ai_pattern_summary"
    ON ai_pattern_summary FOR ALL
    USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin')
    );
