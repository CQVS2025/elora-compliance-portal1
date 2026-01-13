-- Migration: Add phone and job_title columns to user_profiles
-- This migration adds additional profile fields for user information

-- Add phone column to user_profiles
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS phone TEXT;

-- Add job_title column to user_profiles
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS job_title TEXT;

-- Add company_name column for display purposes (denormalized for performance)
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS company_name TEXT;

-- Create a function to automatically populate company_name from companies table
CREATE OR REPLACE FUNCTION populate_user_profile_company_name()
RETURNS TRIGGER AS $$
BEGIN
    SELECT name INTO NEW.company_name
    FROM public.companies
    WHERE id = NEW.company_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-populate company_name on insert
DROP TRIGGER IF EXISTS set_company_name_on_insert ON public.user_profiles;
CREATE TRIGGER set_company_name_on_insert
    BEFORE INSERT ON public.user_profiles
    FOR EACH ROW
    WHEN (NEW.company_name IS NULL)
    EXECUTE FUNCTION populate_user_profile_company_name();

-- Update existing profiles with company_name
UPDATE public.user_profiles up
SET company_name = c.name
FROM public.companies c
WHERE up.company_id = c.id
AND up.company_name IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.user_profiles.phone IS 'User phone number';
COMMENT ON COLUMN public.user_profiles.job_title IS 'User job title/position';
COMMENT ON COLUMN public.user_profiles.company_name IS 'Denormalized company name for display';
