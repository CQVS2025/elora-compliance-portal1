-- Operations log attachments storage (use existing bucket with path prefix)
-- Migration: 20260219000002_storage_operations_log
-- Path format: operations-log/{company_id}/{entry_id}/{uuid}-{filename}

-- Create bucket (skip if already exists via dashboard)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'operations-log',
  'operations-log',
  false,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Operations log upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'operations-log'
);

CREATE POLICY "Operations log read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'operations-log');

CREATE POLICY "Operations log delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'operations-log');
