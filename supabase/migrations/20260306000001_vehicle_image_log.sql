-- Vehicle Image Log: table + storage for per-vehicle image uploads
-- Migration: 20260306000001_vehicle_image_log
-- Used by Vehicle Image Log tab and vehicle detail page

-- ============================================================================
-- TABLE: vehicle_image_log
-- ============================================================================
CREATE TABLE IF NOT EXISTS vehicle_image_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_ref TEXT NOT NULL,
    file_path TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_vehicle_image_log_vehicle_ref ON vehicle_image_log(vehicle_ref);
CREATE INDEX IF NOT EXISTS idx_vehicle_image_log_uploaded_at ON vehicle_image_log(uploaded_at DESC);

-- RLS: allow authenticated users to read; insert/delete allowed for authenticated
ALTER TABLE vehicle_image_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vehicle_image_log select"
ON vehicle_image_log FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "vehicle_image_log insert"
ON vehicle_image_log FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "vehicle_image_log delete"
ON vehicle_image_log FOR DELETE
TO authenticated
USING (true);

-- ============================================================================
-- STORAGE: vehicle-images bucket (path: {vehicle_ref}/{uuid}.{ext})
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vehicle-images',
  'vehicle-images',
  true,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "vehicle-images upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'vehicle-images');

CREATE POLICY "vehicle-images read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'vehicle-images');

CREATE POLICY "vehicle-images delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'vehicle-images');
