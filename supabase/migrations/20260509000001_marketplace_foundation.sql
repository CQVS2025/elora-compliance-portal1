-- ============================================================================
-- Elora Marketplace — Foundation
-- Migration: 20260509000001_marketplace_foundation
--
-- Adds the foundational tables for the in-portal marketplace module:
--   - marketplace_warehouses       (single row at launch; multi-warehouse-ready)
--   - marketplace_warehouse_users  (maps portal users to warehouses)
--   - marketplace_packaging_sizes  (lookup: 20L, 200L drum, 1000L IBC, Bulk)
--   - marketplace_settings         (singleton config row)
--
-- Extends the existing `companies` and `user_permissions` tables with
-- marketplace columns. No existing data is mutated; defaults preserve current
-- behaviour.
--
-- Helper SECURITY DEFINER functions are added for use in RLS policies and
-- application authorisation checks.
--
-- Order matters: SQL helper functions reference columns and tables we add
-- here, and Postgres parses LANGUAGE sql function bodies eagerly at creation
-- time. So we MUST: (1) create tables, (2) ALTER existing tables, (3) define
-- helper functions, (4) wire triggers / RLS / policies that depend on those
-- helpers. Reordering this file will reintroduce
-- "column does not exist" errors during migration.
-- ============================================================================

-- ============================================================================
-- 1. Generic touch-updated_at trigger function
--    (No dependencies — defined first so we can attach it to every table.)
-- ============================================================================
CREATE OR REPLACE FUNCTION marketplace_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 2. ALTER companies — marketplace columns
-- ============================================================================
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS marketplace_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketplace_invoice_email TEXT,
  ADD COLUMN IF NOT EXISTS marketplace_default_address JSONB;

COMMENT ON COLUMN companies.marketplace_enabled IS 'When true, users from this company can see/use the marketplace.';
COMMENT ON COLUMN companies.marketplace_invoice_email IS 'Default email address for marketplace invoicing (used in M2 checkout).';
COMMENT ON COLUMN companies.marketplace_default_address IS 'Default delivery address (JSONB: { line1, line2, suburb, state, postcode }) prefilled in checkout.';

-- ============================================================================
-- 3. marketplace_warehouses (no FK dependencies on marketplace tables)
-- ============================================================================
CREATE TABLE IF NOT EXISTS marketplace_warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  suburb TEXT,
  state TEXT,
  postcode TEXT,
  country TEXT NOT NULL DEFAULT 'AU',
  is_supplier_managed BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_warehouses_active
  ON marketplace_warehouses(is_active);

COMMENT ON TABLE marketplace_warehouses IS 'Marketplace fulfilment warehouses. Single row at launch; multi-warehouse-ready (warehouse_id is FK on every order).';

-- ============================================================================
-- 4. marketplace_warehouse_users (FK -> marketplace_warehouses)
-- ============================================================================
CREATE TABLE IF NOT EXISTS marketplace_warehouse_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES marketplace_warehouses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (warehouse_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_marketplace_warehouse_users_user
  ON marketplace_warehouse_users(user_id);

COMMENT ON TABLE marketplace_warehouse_users IS 'Maps a portal user to one (or more) warehouses. Used to scope warehouse fulfilment screens (M2).';

-- ============================================================================
-- 5. marketplace_packaging_sizes (lookup table, no FKs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS marketplace_packaging_sizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  short_code TEXT,
  volume_litres NUMERIC(10, 3),
  container_type TEXT NOT NULL CHECK (container_type IN ('drum', 'pail', 'ibc', 'bulk', 'tanker', 'bottle', 'sachet', 'other')),
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_packaging_sizes_active_sort
  ON marketplace_packaging_sizes(is_active, sort_order);

COMMENT ON TABLE marketplace_packaging_sizes IS 'Master lookup for packaging variants (e.g. 20L, 200L drum, 1000L IBC, Bulk).';

-- ============================================================================
-- 6. marketplace_settings (singleton; FK -> companies, marketplace_warehouses)
-- ============================================================================
CREATE TABLE IF NOT EXISTS marketplace_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  seller_company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  default_warehouse_id UUID REFERENCES marketplace_warehouses(id) ON DELETE SET NULL,
  currency TEXT NOT NULL DEFAULT 'AUD',
  gst_rate NUMERIC(5, 4) NOT NULL DEFAULT 0.10,
  gst_inclusive_pricing BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE marketplace_settings IS 'Singleton row holding marketplace-wide config (seller company, currency, GST rules).';

-- ============================================================================
-- 7. ALTER user_permissions — marketplace flags
--    Adds the marketplace_admin column (referenced by is_marketplace_admin()
--    below), the marketplace_buyer reservation flag, and a FK to
--    marketplace_warehouses for warehouse-fulfilment users.
--
--    Requires the user_permissions table to exist (created by the existing
--    Elora migration `*_ensure_user_permissions_table.sql`). If it does not,
--    this ALTER will fail with a clear error rather than silently skipping.
-- ============================================================================
ALTER TABLE user_permissions
  ADD COLUMN IF NOT EXISTS marketplace_admin BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketplace_buyer BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketplace_warehouse_id UUID REFERENCES marketplace_warehouses(id) ON DELETE SET NULL;

COMMENT ON COLUMN user_permissions.marketplace_admin IS 'Marketplace administrator (can manage products, pricing, warehouses, orders).';
COMMENT ON COLUMN user_permissions.marketplace_buyer IS 'Reserved for explicit buyer grants. Today: any active user in a marketplace_enabled company can buy; this column lets us narrow that later.';
COMMENT ON COLUMN user_permissions.marketplace_warehouse_id IS 'If set, user is a warehouse fulfilment user for this warehouse (M2 dispatch screen).';

-- ============================================================================
-- 8. Helper functions
--    All defined AFTER the columns and tables they reference, because
--    LANGUAGE sql functions are parsed eagerly at creation time.
-- ============================================================================

-- True if the calling user is a marketplace admin.
-- Resolution: super_admin role OR company-level admin role OR explicit grant
-- via user_permissions.marketplace_admin = true.
--
-- NOTE: a follow-up migration (20260510000001_marketplace_admin_seller_scope)
-- tightens the `admin` branch to require the user's company_id to match
-- marketplace_settings.seller_company_id, so admins of buyer companies are
-- not marketplace admins. The original definition is preserved here as a
-- historical record of what was first deployed.
CREATE OR REPLACE FUNCTION public.is_marketplace_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'admin')
        AND COALESCE(is_active, true) = true
    )
    OR EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_id = auth.uid()
        AND COALESCE(marketplace_admin, false) = true
        AND COALESCE(is_active, true) = true
    );
$$;

-- True if the calling user belongs to a company that has the marketplace
-- enabled. Used in buyer-facing RLS to gate read access.
CREATE OR REPLACE FUNCTION public.user_marketplace_enabled()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_profiles up
    JOIN companies c ON c.id = up.company_id
    WHERE up.id = auth.uid()
      AND COALESCE(up.is_active, true) = true
      AND COALESCE(c.is_active, true) = true
      AND COALESCE(c.marketplace_enabled, false) = true
  );
$$;

-- The calling user's company_id (auth.uid() -> user_profiles.company_id).
-- Namespaced under marketplace_ to avoid colliding with any future
-- platform-wide helpers (e.g. compliance auth.user_company_id()).
CREATE OR REPLACE FUNCTION public.marketplace_user_company_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT company_id FROM user_profiles WHERE id = auth.uid();
$$;

-- True if the calling user is a warehouse user mapped to the given warehouse.
CREATE OR REPLACE FUNCTION public.is_warehouse_user(target_warehouse_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM marketplace_warehouse_users
    WHERE user_id = auth.uid()
      AND warehouse_id = target_warehouse_id
  );
$$;

COMMENT ON FUNCTION public.is_marketplace_admin IS 'True if caller can administer the marketplace (manage products, pricing, warehouses, orders).';
COMMENT ON FUNCTION public.user_marketplace_enabled IS 'True if calling user''s company has the marketplace enabled.';
COMMENT ON FUNCTION public.marketplace_user_company_id IS 'Returns the calling user''s company_id from user_profiles. Used in marketplace RLS / view JOINs.';
COMMENT ON FUNCTION public.is_warehouse_user IS 'True if caller is mapped as a warehouse user for the given warehouse.';

-- Grant EXECUTE on the SECURITY DEFINER helpers so the authenticated role
-- can invoke them (without these grants, RLS policies that call them would
-- fail with "permission denied" on hosted Postgres setups).
GRANT EXECUTE ON FUNCTION public.is_marketplace_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_marketplace_enabled() TO authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_user_company_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_warehouse_user(UUID) TO authenticated;

-- ============================================================================
-- 9. Triggers: auto-update updated_at on every mutable table
-- ============================================================================
DROP TRIGGER IF EXISTS trg_marketplace_warehouses_updated_at ON marketplace_warehouses;
CREATE TRIGGER trg_marketplace_warehouses_updated_at
  BEFORE UPDATE ON marketplace_warehouses
  FOR EACH ROW EXECUTE FUNCTION marketplace_touch_updated_at();

DROP TRIGGER IF EXISTS trg_marketplace_packaging_sizes_updated_at ON marketplace_packaging_sizes;
CREATE TRIGGER trg_marketplace_packaging_sizes_updated_at
  BEFORE UPDATE ON marketplace_packaging_sizes
  FOR EACH ROW EXECUTE FUNCTION marketplace_touch_updated_at();

DROP TRIGGER IF EXISTS trg_marketplace_settings_updated_at ON marketplace_settings;
CREATE TRIGGER trg_marketplace_settings_updated_at
  BEFORE UPDATE ON marketplace_settings
  FOR EACH ROW EXECUTE FUNCTION marketplace_touch_updated_at();

-- ============================================================================
-- 10. RLS — enable + policies on foundation tables
-- ============================================================================
ALTER TABLE marketplace_warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_warehouse_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_packaging_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_settings ENABLE ROW LEVEL SECURITY;

-- Warehouses: any authenticated user (with marketplace enabled) can read; admins manage.
DROP POLICY IF EXISTS "Marketplace warehouses readable by enabled users" ON marketplace_warehouses;
CREATE POLICY "Marketplace warehouses readable by enabled users"
  ON marketplace_warehouses FOR SELECT
  TO authenticated
  USING (
    public.is_marketplace_admin()
    OR public.user_marketplace_enabled()
    OR public.is_warehouse_user(id)
  );

DROP POLICY IF EXISTS "Marketplace warehouses managed by admins" ON marketplace_warehouses;
CREATE POLICY "Marketplace warehouses managed by admins"
  ON marketplace_warehouses FOR ALL
  TO authenticated
  USING (public.is_marketplace_admin())
  WITH CHECK (public.is_marketplace_admin());

-- Warehouse users mapping: admins manage; users can read their own assignments.
DROP POLICY IF EXISTS "Warehouse user mapping readable by admin or self" ON marketplace_warehouse_users;
CREATE POLICY "Warehouse user mapping readable by admin or self"
  ON marketplace_warehouse_users FOR SELECT
  TO authenticated
  USING (
    public.is_marketplace_admin()
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Warehouse user mapping managed by admins" ON marketplace_warehouse_users;
CREATE POLICY "Warehouse user mapping managed by admins"
  ON marketplace_warehouse_users FOR ALL
  TO authenticated
  USING (public.is_marketplace_admin())
  WITH CHECK (public.is_marketplace_admin());

-- Packaging sizes: any authenticated user can read (lookup); admins manage.
DROP POLICY IF EXISTS "Packaging sizes readable by authenticated" ON marketplace_packaging_sizes;
CREATE POLICY "Packaging sizes readable by authenticated"
  ON marketplace_packaging_sizes FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Packaging sizes managed by admins" ON marketplace_packaging_sizes;
CREATE POLICY "Packaging sizes managed by admins"
  ON marketplace_packaging_sizes FOR ALL
  TO authenticated
  USING (public.is_marketplace_admin())
  WITH CHECK (public.is_marketplace_admin());

-- Settings: readable by authenticated; written by admins only.
DROP POLICY IF EXISTS "Marketplace settings readable by authenticated" ON marketplace_settings;
CREATE POLICY "Marketplace settings readable by authenticated"
  ON marketplace_settings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Marketplace settings managed by admins" ON marketplace_settings;
CREATE POLICY "Marketplace settings managed by admins"
  ON marketplace_settings FOR ALL
  TO authenticated
  USING (public.is_marketplace_admin())
  WITH CHECK (public.is_marketplace_admin());

-- ============================================================================
-- 11. Seed: default packaging sizes + settings singleton
-- ============================================================================
INSERT INTO marketplace_packaging_sizes (name, short_code, volume_litres, container_type, sort_order)
VALUES
  ('20L Pail',      '20L',    20,     'pail',  10),
  ('200L Drum',     '200L',   200,    'drum',  20),
  ('1000L IBC',     'IBC',    1000,   'ibc',   30),
  ('Bulk Tanker',   'BULK',   NULL,   'bulk',  40)
ON CONFLICT (name) DO NOTHING;

-- Singleton settings row (seller_company_id is set at first admin login via UI).
INSERT INTO marketplace_settings (id, currency, gst_rate, gst_inclusive_pricing)
VALUES (1, 'AUD', 0.10, false)
ON CONFLICT (id) DO NOTHING;
