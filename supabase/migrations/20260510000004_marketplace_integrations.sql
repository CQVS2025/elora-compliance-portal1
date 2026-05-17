-- ============================================================================
-- Elora Marketplace M2 — Integrations
-- Migration: 20260510000004_marketplace_integrations
--
-- Tables for the third-party integrations layer:
--
--   marketplace_xero_credentials  (singleton OAuth state)
--   marketplace_xero_sync_log     (every Xero call: payload + response)
--   marketplace_integration_log   (generic — Stripe, Xero, email events)
--
-- All admin-only via RLS. The logs are append-only in practice (Edge
-- Functions are the only writers via the service-role key).
-- ============================================================================

-- ============================================================================
-- 1. Xero credentials (singleton)
-- ============================================================================
CREATE TABLE IF NOT EXISTS marketplace_xero_credentials (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  tenant_id TEXT,
  tenant_name TEXT,
  -- Chart-of-accounts mapping (set during admin connect flow)
  revenue_account_code TEXT,
  freight_account_code TEXT,
  gst_tax_type TEXT DEFAULT 'OUTPUT',
  branding_theme_id TEXT,
  po_sender_email TEXT,
  -- Lifecycle
  connected_at TIMESTAMPTZ,
  last_refreshed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE marketplace_xero_credentials IS 'Singleton holding Elora''s Xero OAuth state + account-code mapping. Refresh-token rotation handled by marketplace_xero_refresh_token Edge Function.';

-- Seed an empty row so settings UI has something to update.
INSERT INTO marketplace_xero_credentials (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. Xero sync log
-- ============================================================================
CREATE TABLE IF NOT EXISTS marketplace_xero_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES marketplace_orders(id) ON DELETE SET NULL,
  operation TEXT NOT NULL,           -- 'create_invoice', 'create_po', 'refresh_token', 'attach_pdf'
  status TEXT NOT NULL,              -- 'success' | 'failed' | 'pending'
  http_status INT,
  xero_object_id TEXT,               -- the resource id Xero returned
  request_payload JSONB,
  response_payload JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_xero_sync_log_order
  ON marketplace_xero_sync_log(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_xero_sync_log_recent
  ON marketplace_xero_sync_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_xero_sync_log_status
  ON marketplace_xero_sync_log(status);

-- ============================================================================
-- 3. Generic integration log (Stripe webhooks, email, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS marketplace_integration_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES marketplace_orders(id) ON DELETE SET NULL,
  integration TEXT NOT NULL,         -- 'stripe' | 'xero' | 'email'
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,              -- 'success' | 'failed' | 'received' | 'replayed'
  event_id TEXT,                     -- Stripe event id (idempotency), email message-id, etc.
  payload JSONB,
  response JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_integration_log_recent
  ON marketplace_integration_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_integration_log_integration
  ON marketplace_integration_log(integration, created_at DESC);

-- Used to make Stripe webhook calls idempotent: we check this index before
-- processing an event id.
CREATE UNIQUE INDEX IF NOT EXISTS uq_marketplace_integration_log_event
  ON marketplace_integration_log(integration, event_id)
  WHERE event_id IS NOT NULL;

-- ============================================================================
-- 4. updated_at trigger on Xero credentials
-- ============================================================================
DROP TRIGGER IF EXISTS trg_marketplace_xero_credentials_updated_at ON marketplace_xero_credentials;
CREATE TRIGGER trg_marketplace_xero_credentials_updated_at
  BEFORE UPDATE ON marketplace_xero_credentials
  FOR EACH ROW EXECUTE FUNCTION marketplace_touch_updated_at();

-- ============================================================================
-- 5. RLS — strictly admin-only on all three tables
-- ============================================================================
ALTER TABLE marketplace_xero_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_xero_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_integration_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Xero credentials managed by admin only"
  ON marketplace_xero_credentials FOR ALL TO authenticated
  USING (public.is_marketplace_admin())
  WITH CHECK (public.is_marketplace_admin());

CREATE POLICY "Xero sync log readable by admin only"
  ON marketplace_xero_sync_log FOR SELECT TO authenticated
  USING (public.is_marketplace_admin());

CREATE POLICY "Xero sync log inserted by admin only"
  ON marketplace_xero_sync_log FOR INSERT TO authenticated
  WITH CHECK (public.is_marketplace_admin());

CREATE POLICY "Integration log readable by admin only"
  ON marketplace_integration_log FOR SELECT TO authenticated
  USING (public.is_marketplace_admin());

CREATE POLICY "Integration log inserted by admin only"
  ON marketplace_integration_log FOR INSERT TO authenticated
  WITH CHECK (public.is_marketplace_admin());
