-- Usage Cost Budgets: store monthly budget per customer for Budget Tracker
-- Migration: 20260226000002_usage_cost_budgets

CREATE TABLE IF NOT EXISTS usage_cost_budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_ref TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  period TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, customer_ref, period)
);

CREATE INDEX idx_usage_cost_budgets_company_period ON usage_cost_budgets(company_id, period);

ALTER TABLE usage_cost_budgets ENABLE ROW LEVEL SECURITY;

-- Users can select budgets for their own company; super_admin can select all
CREATE POLICY usage_cost_budgets_select ON usage_cost_budgets
  FOR SELECT
  USING (
    company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid())
    OR public.is_super_admin()
  );

-- Users can insert budgets for their own company; super_admin can insert for any company
CREATE POLICY usage_cost_budgets_insert ON usage_cost_budgets
  FOR INSERT
  WITH CHECK (
    company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid())
    OR public.is_super_admin()
  );

-- Users can update budgets for their own company; super_admin can update any
CREATE POLICY usage_cost_budgets_update ON usage_cost_budgets
  FOR UPDATE
  USING (
    company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid())
    OR public.is_super_admin()
  );

-- Users can delete budgets for their own company; super_admin can delete any
CREATE POLICY usage_cost_budgets_delete ON usage_cost_budgets
  FOR DELETE
  USING (
    company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid())
    OR public.is_super_admin()
  );

CREATE OR REPLACE FUNCTION usage_cost_budgets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER usage_cost_budgets_set_updated_at
  BEFORE UPDATE ON usage_cost_budgets
  FOR EACH ROW EXECUTE FUNCTION usage_cost_budgets_updated_at();

COMMENT ON TABLE usage_cost_budgets IS 'Monthly budget per customer for Usage Costs Budget Tracker; admin sets for own company, super_admin for any company';
