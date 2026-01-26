-- ELORA Fleet Compliance Portal - Storage Bucket Policies
-- Migration: 20250117000001_storage_policies
-- Enables RLS and creates policies for EloraBucket storage

-- ============================================================================
-- STORAGE BUCKET POLICIES FOR EloraBucket
-- ============================================================================

-- Enable RLS on storage.objects (if not already enabled)
-- Note: RLS is typically enabled by default on storage.objects

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can upload their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can read avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public can read avatars" ON storage.objects;

-- ============================================================================
-- POLICY: Authenticated users can upload avatars to their own folder
-- ============================================================================
-- Path format: avatars/{user_id}/{filename}
CREATE POLICY "Users can upload their own avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'EloraBucket' AND
  name LIKE 'avatars/' || auth.uid()::text || '/%'
);

-- ============================================================================
-- POLICY: Authenticated users can read avatars (public access)
-- ============================================================================
CREATE POLICY "Users can read avatars"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'EloraBucket' AND
  name LIKE 'avatars/%'
);

-- ============================================================================
-- POLICY: Authenticated users can update their own avatars
-- ============================================================================
CREATE POLICY "Users can update their own avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'EloraBucket' AND
  name LIKE 'avatars/' || auth.uid()::text || '/%'
)
WITH CHECK (
  bucket_id = 'EloraBucket' AND
  name LIKE 'avatars/' || auth.uid()::text || '/%'
);

-- ============================================================================
-- POLICY: Authenticated users can delete their own avatars
-- ============================================================================
CREATE POLICY "Users can delete their own avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'EloraBucket' AND
  name LIKE 'avatars/' || auth.uid()::text || '/%'
);

-- ============================================================================
-- POLICY: Public read access for avatars (if bucket is public)
-- ============================================================================
-- This allows unauthenticated users to view avatars if the bucket is public
CREATE POLICY "Public can read avatars"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id = 'EloraBucket' AND
  name LIKE 'avatars/%'
);

-- ============================================================================
-- STORAGE POLICIES SUMMARY
-- ============================================================================
-- Total policies created: 5
-- - Authenticated users can upload to avatars/{user_id}/
-- - Authenticated users can read all avatars
-- - Authenticated users can update their own avatars
-- - Authenticated users can delete their own avatars
-- - Public can read avatars (for public bucket)
-- ============================================================================

