-- ============================================================================
-- Elora Marketplace M2 — Freight engine
-- Migration: 20260510000002_marketplace_freight
--
-- Builds the supplier-managed freight model from Chem Connect, scoped to a
-- single seller (Elora) and ready to support multiple warehouses later.
--
--   marketplace_rate_sheets         (named freight tariffs per warehouse)
--   marketplace_rate_sheet_brackets (distance bands within a sheet)
--   marketplace_product_rate_sheets (which sheet to use per product/size)
--   marketplace_postcodes           (AusPost lat/lon, seeded post-deploy)
--
-- Helpers:
--   marketplace_haversine_km(lat1, lon1, lat2, lon2)         — pure maths
--   marketplace_postcode_distance_km(origin, dest)           — lookup helper
--
-- Storage:
--   marketplace-freight-matrices   (admin upload bucket; 5 MB; CSV/XLSX)
-- ============================================================================

-- ============================================================================
-- 1. marketplace_rate_sheets
-- ============================================================================
CREATE TABLE IF NOT EXISTS marketplace_rate_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES marketplace_warehouses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  unit_type TEXT NOT NULL CHECK (unit_type IN ('per_litre', 'flat_per_consignment', 'per_kg', 'per_pallet', 'per_zone')),
  origin_postcode TEXT,
  min_charge NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (min_charge >= 0),
  out_of_range_behavior TEXT NOT NULL DEFAULT 'use_last_bracket'
    CHECK (out_of_range_behavior IN ('use_last_bracket', 'block_order', 'quote_on_application')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_rate_sheets_warehouse ON marketplace_rate_sheets(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_rate_sheets_active ON marketplace_rate_sheets(is_active);

COMMENT ON TABLE marketplace_rate_sheets IS 'Named freight tariffs (one per fulfilment profile). Distance brackets live in marketplace_rate_sheet_brackets.';
COMMENT ON COLUMN marketplace_rate_sheets.origin_postcode IS 'Override origin postcode for this sheet; falls back to warehouse postcode when null.';
COMMENT ON COLUMN marketplace_rate_sheets.unit_type IS 'Pricing model. per_litre multiplies by litres in cart; flat_per_consignment is a flat charge; per_kg, per_pallet are line-item-based; per_zone uses zone_name on brackets.';

-- ============================================================================
-- 2. marketplace_rate_sheet_brackets
-- ============================================================================
CREATE TABLE IF NOT EXISTS marketplace_rate_sheet_brackets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_sheet_id UUID NOT NULL REFERENCES marketplace_rate_sheets(id) ON DELETE CASCADE,
  distance_from_km NUMERIC(8, 2) NOT NULL DEFAULT 0 CHECK (distance_from_km >= 0),
  distance_to_km NUMERIC(8, 2),  -- NULL = open-ended upper bound (final bracket)
  rate NUMERIC(12, 4) NOT NULL CHECK (rate >= 0),
  zone_name TEXT,  -- per_zone only
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (distance_to_km IS NULL OR distance_to_km > distance_from_km)
);

CREATE INDEX IF NOT EXISTS idx_marketplace_rate_sheet_brackets_sheet
  ON marketplace_rate_sheet_brackets(rate_sheet_id, distance_from_km);

COMMENT ON TABLE marketplace_rate_sheet_brackets IS 'Distance bands within a rate sheet. distance_to_km NULL = the final open-ended bracket.';

-- ============================================================================
-- 3. marketplace_product_rate_sheets (product/size -> sheet mapping)
--    A row with packaging_size_id NULL is the product default;
--    a row with packaging_size_id set overrides the default for that size.
-- ============================================================================
CREATE TABLE IF NOT EXISTS marketplace_product_rate_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES marketplace_products(id) ON DELETE CASCADE,
  packaging_size_id UUID REFERENCES marketplace_packaging_sizes(id) ON DELETE CASCADE,
  rate_sheet_id UUID NOT NULL REFERENCES marketplace_rate_sheets(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_marketplace_product_rate_sheets_specific
  ON marketplace_product_rate_sheets(product_id, packaging_size_id)
  WHERE packaging_size_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_marketplace_product_rate_sheets_default
  ON marketplace_product_rate_sheets(product_id)
  WHERE packaging_size_id IS NULL;

COMMENT ON TABLE marketplace_product_rate_sheets IS 'Maps a product (optionally per packaging size) to a rate sheet. Resolution: size-specific row wins over product-default.';

-- ============================================================================
-- 4. marketplace_postcodes (seeded by marketplace_postcode_seed Edge Function)
-- ============================================================================
CREATE TABLE IF NOT EXISTS marketplace_postcodes (
  postcode TEXT PRIMARY KEY,
  locality TEXT,
  state TEXT,
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_marketplace_postcodes_state ON marketplace_postcodes(state);

COMMENT ON TABLE marketplace_postcodes IS 'AusPost postcode lat/lon seed data. Populated by marketplace_postcode_seed Edge Function after migration.';

-- ============================================================================
-- 5. Distance helpers
-- ============================================================================
CREATE OR REPLACE FUNCTION marketplace_haversine_km(lat1 NUMERIC, lon1 NUMERIC, lat2 NUMERIC, lon2 NUMERIC)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 6371 * 2 * ASIN(SQRT(
    POWER(SIN(RADIANS((lat2 - lat1) / 2)), 2) +
    COS(RADIANS(lat1)) * COS(RADIANS(lat2)) *
    POWER(SIN(RADIANS((lon2 - lon1) / 2)), 2)
  ));
$$;

COMMENT ON FUNCTION marketplace_haversine_km IS 'Great-circle distance in km between two lat/lon points.';

CREATE OR REPLACE FUNCTION marketplace_postcode_distance_km(origin TEXT, dest TEXT)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT marketplace_haversine_km(o.latitude, o.longitude, d.latitude, d.longitude)
  FROM marketplace_postcodes o, marketplace_postcodes d
  WHERE o.postcode = origin AND d.postcode = dest
  LIMIT 1;
$$;

COMMENT ON FUNCTION marketplace_postcode_distance_km IS 'Returns great-circle km between two AusPost postcodes. NULL when either postcode is unknown.';

GRANT EXECUTE ON FUNCTION marketplace_haversine_km(NUMERIC, NUMERIC, NUMERIC, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION marketplace_postcode_distance_km(TEXT, TEXT) TO authenticated;

-- ============================================================================
-- 6. Triggers
-- ============================================================================
DROP TRIGGER IF EXISTS trg_marketplace_rate_sheets_updated_at ON marketplace_rate_sheets;
CREATE TRIGGER trg_marketplace_rate_sheets_updated_at
  BEFORE UPDATE ON marketplace_rate_sheets
  FOR EACH ROW EXECUTE FUNCTION marketplace_touch_updated_at();

-- ============================================================================
-- 7. RLS — admins manage; enabled buyers can read (for freight quote)
-- ============================================================================
ALTER TABLE marketplace_rate_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_rate_sheet_brackets ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_product_rate_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_postcodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rate sheets readable by enabled buyers or admins"
  ON marketplace_rate_sheets FOR SELECT TO authenticated
  USING (public.is_marketplace_admin() OR public.user_marketplace_enabled());

CREATE POLICY "Rate sheets managed by admins"
  ON marketplace_rate_sheets FOR ALL TO authenticated
  USING (public.is_marketplace_admin())
  WITH CHECK (public.is_marketplace_admin());

CREATE POLICY "Brackets readable by enabled buyers or admins"
  ON marketplace_rate_sheet_brackets FOR SELECT TO authenticated
  USING (public.is_marketplace_admin() OR public.user_marketplace_enabled());

CREATE POLICY "Brackets managed by admins"
  ON marketplace_rate_sheet_brackets FOR ALL TO authenticated
  USING (public.is_marketplace_admin())
  WITH CHECK (public.is_marketplace_admin());

CREATE POLICY "Product rate sheets readable by enabled buyers or admins"
  ON marketplace_product_rate_sheets FOR SELECT TO authenticated
  USING (public.is_marketplace_admin() OR public.user_marketplace_enabled());

CREATE POLICY "Product rate sheets managed by admins"
  ON marketplace_product_rate_sheets FOR ALL TO authenticated
  USING (public.is_marketplace_admin())
  WITH CHECK (public.is_marketplace_admin());

CREATE POLICY "Postcodes readable by authenticated"
  ON marketplace_postcodes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Postcodes managed by admins"
  ON marketplace_postcodes FOR ALL TO authenticated
  USING (public.is_marketplace_admin())
  WITH CHECK (public.is_marketplace_admin());

-- ============================================================================
-- 8. Storage bucket: marketplace-freight-matrices
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'marketplace-freight-matrices',
  'marketplace-freight-matrices',
  false,
  5242880,
  ARRAY[
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "marketplace-freight-matrices: admin read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'marketplace-freight-matrices' AND public.is_marketplace_admin());

CREATE POLICY "marketplace-freight-matrices: admin write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'marketplace-freight-matrices' AND public.is_marketplace_admin());

CREATE POLICY "marketplace-freight-matrices: admin update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'marketplace-freight-matrices' AND public.is_marketplace_admin());

CREATE POLICY "marketplace-freight-matrices: admin delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'marketplace-freight-matrices' AND public.is_marketplace_admin());
