-- Persist admin user's column visibility for the User Management table.
-- When set, only these columns are shown; NULL or empty = show all columns.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS admin_users_table_visible_columns TEXT[];

COMMENT ON COLUMN user_profiles.admin_users_table_visible_columns IS 'Column ids to show on Admin > User Management table. NULL or empty = show all. E.g. {user, presence, role, company, status}.';
