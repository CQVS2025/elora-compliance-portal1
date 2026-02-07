-- Add customer_ref columns to AI tables for multi-tenant filtering
-- Migration: 20260207000001_add_customer_ref_to_ai_tables

-- Add customer_ref to ai_predictions
ALTER TABLE ai_predictions ADD COLUMN IF NOT EXISTS customer_ref TEXT;
CREATE INDEX IF NOT EXISTS idx_ai_predictions_customer ON ai_predictions(customer_ref);

-- Add customer_ref to ai_recommendations
ALTER TABLE ai_recommendations ADD COLUMN IF NOT EXISTS customer_ref TEXT;
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_customer ON ai_recommendations(customer_ref);

-- Add customer_ref to ai_wash_windows
ALTER TABLE ai_wash_windows ADD COLUMN IF NOT EXISTS customer_ref TEXT;
CREATE INDEX IF NOT EXISTS idx_ai_wash_windows_customer ON ai_wash_windows(customer_ref);

-- Add customer_ref and site_ref to ai_driver_patterns (from 20260205000003)
ALTER TABLE ai_driver_patterns ADD COLUMN IF NOT EXISTS customer_ref TEXT;
ALTER TABLE ai_driver_patterns ADD COLUMN IF NOT EXISTS site_ref TEXT;
CREATE INDEX IF NOT EXISTS idx_ai_driver_patterns_customer ON ai_driver_patterns(customer_ref);
CREATE INDEX IF NOT EXISTS idx_ai_driver_patterns_site ON ai_driver_patterns(site_ref);

-- Add customer_ref and site_ref to ai_site_insights (from 20260205000003)
ALTER TABLE ai_site_insights ADD COLUMN IF NOT EXISTS customer_ref TEXT;
CREATE INDEX IF NOT EXISTS idx_ai_site_insights_customer ON ai_site_insights(customer_ref);

-- Add customer_ref and site_ref to ai_pattern_summary (from 20260205000004)
ALTER TABLE ai_pattern_summary ADD COLUMN IF NOT EXISTS customer_ref TEXT;
ALTER TABLE ai_pattern_summary ADD COLUMN IF NOT EXISTS site_ref TEXT;
CREATE INDEX IF NOT EXISTS idx_ai_pattern_summary_customer ON ai_pattern_summary(customer_ref);
CREATE INDEX IF NOT EXISTS idx_ai_pattern_summary_site ON ai_pattern_summary(site_ref);

-- Add window_label column to ai_wash_windows if missing (for better UI display)
ALTER TABLE ai_wash_windows ADD COLUMN IF NOT EXISTS window_label TEXT;
