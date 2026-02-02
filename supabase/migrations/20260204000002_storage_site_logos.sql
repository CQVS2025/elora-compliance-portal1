-- ELORA Fleet Compliance Portal - Site logos storage policies
-- Migration: 20260204000002_storage_site_logos
-- Allows authenticated users to upload/read site logos. App restricts to super_admin only.
-- Path format: site-logos/{site_ref}/{filename}

DROP POLICY IF EXISTS "Users can upload site logos" ON storage.objects;
CREATE POLICY "Users can upload site logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'EloraBucket' AND
  name LIKE 'site-logos/%'
);

DROP POLICY IF EXISTS "Users can read site logos" ON storage.objects;
CREATE POLICY "Users can read site logos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'EloraBucket' AND
  name LIKE 'site-logos/%'
);

DROP POLICY IF EXISTS "Public can read site logos" ON storage.objects;
CREATE POLICY "Public can read site logos"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id = 'EloraBucket' AND
  name LIKE 'site-logos/%'
);

DROP POLICY IF EXISTS "Users can update site logos" ON storage.objects;
CREATE POLICY "Users can update site logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'EloraBucket' AND
  name LIKE 'site-logos/%'
)
WITH CHECK (
  bucket_id = 'EloraBucket' AND
  name LIKE 'site-logos/%'
);

DROP POLICY IF EXISTS "Users can delete site logos" ON storage.objects;
CREATE POLICY "Users can delete site logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'EloraBucket' AND
  name LIKE 'site-logos/%'
);
