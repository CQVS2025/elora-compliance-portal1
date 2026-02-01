-- Migration: Allow user_profiles.company_id to be NULL (unassigned users)
-- Super admins can have no company; users can be "unassigned" (removed from company).

ALTER TABLE user_profiles
  ALTER COLUMN company_id DROP NOT NULL;

COMMENT ON COLUMN user_profiles.company_id IS 'Company the user belongs to (multi-tenancy). NULL = unassigned.';
