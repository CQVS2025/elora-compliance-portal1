-- Stock & Orders: Parts catalog (master parts list)
-- Migration: 20260228000001_parts_catalog
-- Used by admin Parts Catalog management and (later) Agent/Manager Stock & Orders views.

-- ============================================================================
-- PARTS TABLE
-- ============================================================================
CREATE TABLE parts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    display_order INT NOT NULL DEFAULT 0,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT 'Each' CHECK (unit IN ('Each', 'Metre')),
    unit_price_cents INT CHECK (unit_price_cents >= 0),
    supplier_name TEXT,
    supplier_sku TEXT,
    supplier_stock_status TEXT,
    product_url TEXT,
    image_path TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_parts_is_active ON parts(is_active);
CREATE INDEX idx_parts_category ON parts(category);
CREATE INDEX idx_parts_display_order ON parts(display_order);

COMMENT ON TABLE parts IS 'Master parts catalog for Stock & Orders; managed in admin Parts Catalog.';
COMMENT ON COLUMN parts.image_path IS 'Storage path in part-images bucket, or external URL.';

-- ============================================================================
-- RLS: parts (read authenticated; write super_admin)
-- ============================================================================
ALTER TABLE parts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read parts"
    ON parts FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Super admin can manage parts"
    ON parts FOR ALL
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- ============================================================================
-- STORAGE: part-images bucket for part images
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'part-images',
  'part-images',
  true,
  2097152,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Part images upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'part-images');

CREATE POLICY "Part images read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'part-images');

CREATE POLICY "Part images public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'part-images');

CREATE POLICY "Part images delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'part-images');
