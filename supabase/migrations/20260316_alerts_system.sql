-- ============================================================
-- Elora Alerts System – Database Schema
-- ============================================================

-- 1. Alert configurations (what triggers are enabled + channels)
CREATE TABLE IF NOT EXISTS alert_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  portal_enabled BOOLEAN NOT NULL DEFAULT true,
  email_enabled BOOLEAN NOT NULL DEFAULT false,
  sms_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Alerts (live feed records)
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  entity_id TEXT,
  entity_name TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  delivery_channels TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- 3. Alert delivery settings (Super Admin notification preferences)
CREATE TABLE IF NOT EXISTS alert_delivery_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  sms_number TEXT NOT NULL DEFAULT '',
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_alerts_category ON alerts(category);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_configurations_type ON alert_configurations(alert_type);

-- ============================================================
-- Seed default alert configurations
-- ============================================================
INSERT INTO alert_configurations (alert_type, category, enabled, portal_enabled, email_enabled, sms_enabled) VALUES
  -- Operations
  ('NEW_ENTRY_CREATED', 'operations', true, true, true, false),
  ('ENTRY_OPEN_5_DAYS', 'operations', true, false, true, false),
  ('ENTRY_RESOLVED', 'operations', true, true, false, false),
  ('ENTRY_NO_ASSIGNEE', 'operations', true, true, true, false),
  ('ENTRY_NO_DUE_DATE', 'operations', true, true, false, false),
  -- Orders
  ('ORDER_REQUEST_HIGH_PRIORITY', 'orders', true, true, true, true),
  ('ORDER_REQUEST_ANY', 'orders', true, true, true, false),
  ('ORDER_PENDING_APPROVAL', 'orders', true, true, true, false),
  ('ORDER_STATUS_CHANGED', 'orders', true, true, false, false),
  ('STOCK_TAKE_SUBMITTED', 'orders', true, true, false, false),
  ('AGENT_PARTS_NO_REQUEST', 'orders', true, true, true, false),
  -- Delivery
  ('DELIVERY_SCHEDULED_TODAY', 'delivery', true, false, true, true),
  ('SITE_NO_DELIVERY', 'delivery', true, false, true, false),
  ('SITE_APPROACHING_REFILL', 'delivery', true, true, true, false),
  ('SITE_OVERDUE_REFILL', 'delivery', true, true, true, true),
  ('UNUSUAL_CONSUMPTION', 'delivery', true, true, false, false),
  -- Devices
  ('DEVICE_OFFLINE', 'devices', true, true, true, true),
  ('DEVICE_BACK_ONLINE', 'devices', true, true, false, false),
  ('DEVICE_OFFLINE_EXTENDED', 'devices', true, true, true, true),
  -- Chemicals
  ('LOW_CHEMICAL_LEVEL', 'chemicals', true, true, true, false),
  -- Security
  ('FAILED_LOGIN_ATTEMPTS', 'security', true, true, true, false),
  ('NEW_USER_FIRST_LOGIN', 'security', true, true, false, false),
  ('MANAGER_NOT_LOGGED_IN_7_DAYS', 'security', true, false, true, false),
  ('ENTRY_ASSIGNED_INACTIVE_USER', 'security', true, true, true, false),
  -- Report Scheduling
  ('REPORT_DUE_TODAY', 'report_scheduling', true, true, true, true),
  ('REPORT_DUE_IN_X_DAYS', 'report_scheduling', true, true, true, false),
  ('REPORT_OVERDUE', 'report_scheduling', true, true, true, true),
  ('REPORT_SENT', 'report_scheduling', true, true, false, false),
  ('NEW_REPORT_SCHEDULE', 'report_scheduling', true, true, false, false),
  ('REPORT_SCHEDULE_MODIFIED', 'report_scheduling', true, true, false, false),
  ('CONTACT_ADDED_TO_SCHEDULE', 'report_scheduling', true, true, false, false),
  ('CONTACT_REMOVED_FROM_SCHEDULE', 'report_scheduling', true, true, true, false),
  ('COMPANY_NO_REPORT_SCHEDULE', 'report_scheduling', true, true, false, false),
  ('SCHEDULE_NO_REPORTS', 'report_scheduling', true, true, false, false),
  ('WEEKLY_REPORT_DIGEST', 'report_scheduling', true, false, true, false)
ON CONFLICT (alert_type) DO NOTHING;

-- Enable RLS
ALTER TABLE alert_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_delivery_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies – Super Admin only
CREATE POLICY "Super admins can manage alert_configurations"
  ON alert_configurations FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Super admins can manage alerts"
  ON alerts FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Super admins can manage alert_delivery_settings"
  ON alert_delivery_settings FOR ALL
  USING (true)
  WITH CHECK (true);
