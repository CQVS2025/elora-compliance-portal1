-- ============================================================================
-- Marketplace · Per-user saved delivery addresses (address book)
--
-- Buyers can save the delivery address they enter during checkout and pick
-- from previously-saved addresses on subsequent orders. This is independent
-- of the per-company default (companies.marketplace_default_address) and
-- per-user — different employees of the same buyer company can keep their
-- own list of sites.
--
-- Schema
-- ------
-- user_profiles.marketplace_saved_addresses JSONB DEFAULT '[]'::jsonb
--
-- Each element looks like:
--   {
--     "id":            "<uuid>",           -- stable handle for delete
--     "label":         "Warehouse",        -- optional, defaults to suburb
--     "line1":         "12 King St",
--     "line2":         "Unit 3",
--     "suburb":        "Sydney",
--     "state":         "NSW",
--     "postcode":      "2000",
--     "contact_name":  "Jane Smith",
--     "contact_phone": "0400 000 000",
--     "created_at":    "2026-05-13T..."    -- ISO timestamp
--   }
--
-- RLS — already-existing user_profiles policies cover this. Writes are gated
-- to (a) the row owner via auth.uid() = id, and (b) admins. No new policy is
-- required for this column.
-- ============================================================================

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS marketplace_saved_addresses JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN user_profiles.marketplace_saved_addresses IS
  'Per-user marketplace delivery address book. JSONB array of address objects (see migration 20260513000002 for the shape).';

-- Optional sanity check: enforce array shape at the database level.
ALTER TABLE user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_marketplace_saved_addresses_is_array;

ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_marketplace_saved_addresses_is_array
  CHECK (jsonb_typeof(marketplace_saved_addresses) = 'array');
