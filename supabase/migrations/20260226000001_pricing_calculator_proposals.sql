-- Pricing Calculator Proposals: store proposed scan card parameters and notify via email
-- Migration: 20260226000001_pricing_calculator_proposals

CREATE TABLE IF NOT EXISTS pricing_calculator_proposals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_ref TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  site_ref TEXT NOT NULL,
  site_name TEXT NOT NULL,
  current_wash_time_sec INTEGER NOT NULL,
  current_washes_per_day INTEGER NOT NULL,
  current_washes_per_week INTEGER NOT NULL,
  proposed_wash_time_sec INTEGER NOT NULL,
  proposed_washes_per_day INTEGER NOT NULL,
  proposed_washes_per_week INTEGER NOT NULL,
  submitted_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_by_email TEXT NOT NULL,
  dispensing_rate_l_per_60s NUMERIC(10,2) DEFAULT 5,
  price_per_litre NUMERIC(10,2) NOT NULL,
  truck_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pricing_calculator_proposals_company ON pricing_calculator_proposals(company_id);
CREATE INDEX idx_pricing_calculator_proposals_created ON pricing_calculator_proposals(created_at DESC);

ALTER TABLE pricing_calculator_proposals ENABLE ROW LEVEL SECURITY;

-- Users can insert proposals for their own company
CREATE POLICY pricing_calculator_proposals_insert_own_company ON pricing_calculator_proposals
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Users can select proposals for their own company
CREATE POLICY pricing_calculator_proposals_select_own_company ON pricing_calculator_proposals
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

COMMENT ON TABLE pricing_calculator_proposals IS 'Proposed scan card parameters from Usage Costs Pricing Calculator; notification email sent to PRICING_PROPOSAL_NOTIFY_EMAIL';
