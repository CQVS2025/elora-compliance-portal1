-- Migration: user_presence table for online/offline and last seen
-- No webhooks - updated by client heartbeat and on login
-- Online = last_seen_at > now() - interval '90 seconds'

CREATE TABLE IF NOT EXISTS user_presence (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  last_login_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_presence_company ON user_presence(company_id);
CREATE INDEX IF NOT EXISTS idx_user_presence_last_seen ON user_presence(last_seen_at DESC);

COMMENT ON TABLE user_presence IS 'User presence: last_login_at and last_seen_at. Online if last_seen_at within 90 seconds.';

-- RLS
ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;

-- Users can upsert their own presence row (for heartbeat and login)
CREATE POLICY "Users can upsert own presence"
  ON user_presence FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can read presence for same company; super admins can read all
CREATE POLICY "Admins and super admins can view presence"
  ON user_presence FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND (
        up.role = 'super_admin'
        OR (up.role = 'admin' AND up.company_id = user_presence.company_id)
      )
    )
  );
