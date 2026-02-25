-- Add delivery_manager role and delivery driver assignment columns
-- Role delivery_manager: access to Delivery Calendar with only assigned driver tabs (no "All").

-- Allow delivery_manager in role check (keep existing roles)
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('super_admin', 'admin', 'manager', 'user', 'site_manager', 'batcher', 'driver', 'viewer', 'delivery_manager'));

-- Assigned delivery drivers (UUIDs from delivery_drivers.id) - which calendar views this user can see when role is delivery_manager
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS assigned_delivery_drivers UUID[] DEFAULT NULL;
COMMENT ON COLUMN user_profiles.assigned_delivery_drivers IS 'For role delivery_manager: which delivery_drivers (calendar tabs) this user can see. NULL = not applicable.';

-- Optional restriction: subset of assigned_delivery_drivers visible (set via Tab visibility). NULL = show all assigned.
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS visible_delivery_driver_ids UUID[] DEFAULT NULL;
COMMENT ON COLUMN user_profiles.visible_delivery_driver_ids IS 'For delivery_manager: restrict which of assigned_delivery_drivers are visible. NULL = show all assigned.';
