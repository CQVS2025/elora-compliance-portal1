-- ELORA Fleet Compliance Portal - Company logos storage policies
-- Migration: 20260202000001_storage_company_logos
-- Allows authenticated users to upload/read/update/delete company logos in EloraBucket.
-- Path format: company-logos/{company_id|temp}/{filename}
-- Access to these actions in the app is restricted to super_admin and company admins.

-- ============================================================================
-- COMPANY LOGOS: INSERT (authenticated only; app restricts to admins)
-- ============================================================================
DROP POLICY IF EXISTS "Users can upload company logos" ON storage.objects;
CREATE POLICY "Users can upload company logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'EloraBucket' AND
  name LIKE 'company-logos/%'
);

-- ============================================================================
-- COMPANY LOGOS: SELECT (authenticated + public so logos display everywhere)
-- ============================================================================
DROP POLICY IF EXISTS "Users can read company logos" ON storage.objects;
CREATE POLICY "Users can read company logos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'EloraBucket' AND
  name LIKE 'company-logos/%'
);

DROP POLICY IF EXISTS "Public can read company logos" ON storage.objects;
CREATE POLICY "Public can read company logos"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id = 'EloraBucket' AND
  name LIKE 'company-logos/%'
);

-- ============================================================================
-- COMPANY LOGOS: UPDATE (authenticated; app restricts to admins)
-- ============================================================================
DROP POLICY IF EXISTS "Users can update company logos" ON storage.objects;
CREATE POLICY "Users can update company logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'EloraBucket' AND
  name LIKE 'company-logos/%'
)
WITH CHECK (
  bucket_id = 'EloraBucket' AND
  name LIKE 'company-logos/%'
);

-- ============================================================================
-- COMPANY LOGOS: DELETE (authenticated; app restricts to admins)
-- ============================================================================
DROP POLICY IF EXISTS "Users can delete company logos" ON storage.objects;
CREATE POLICY "Users can delete company logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'EloraBucket' AND
  name LIKE 'company-logos/%'
);
