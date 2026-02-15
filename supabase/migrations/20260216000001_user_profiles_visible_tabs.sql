-- Per-user tab visibility override (User Management > Actions > Tab visibility)
-- When set, this overrides role-based tab visibility for this user only.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS visible_tabs TEXT[];

COMMENT ON COLUMN user_profiles.visible_tabs IS 'Override which nav tabs this user can see. NULL = use role default + role tab settings.';
