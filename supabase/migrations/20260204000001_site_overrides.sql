-- ELORA Fleet Compliance Portal - Site overrides/extended data
-- Migration: 20260204000001_site_overrides
-- Stores super_admin edits for sites (logo, address, contact, etc.) since Elora API has no POST.
-- Sites are fetched from Elora API; this table provides overrides/merges for display.

CREATE TABLE IF NOT EXISTS site_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_ref text NOT NULL UNIQUE,
  customer_ref text,
  customer_name text,
  name text,
  street_address text,
  city text,
  state text,
  postal_code text,
  country text DEFAULT 'Australia',
  contact_person text,
  contact_phone text,
  contact_email text,
  logo_url text,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_overrides_site_ref ON site_overrides(site_ref);

ALTER TABLE site_overrides ENABLE ROW LEVEL SECURITY;

-- Only super_admin can manage site overrides (enforced at app layer; RLS allows authenticated)
CREATE POLICY "Authenticated can read site overrides"
ON site_overrides FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert site overrides"
ON site_overrides FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated can update site overrides"
ON site_overrides FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated can delete site overrides"
ON site_overrides FOR DELETE
TO authenticated
USING (true);

COMMENT ON TABLE site_overrides IS 'Extended/override data for Elora sites. Super admins can edit; merged with API data for display.';
