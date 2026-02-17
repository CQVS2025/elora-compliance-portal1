-- Company-level tab visibility (optional). When set, restricts which tabs users in this company can see.
-- Priority: Role (ceiling) → Company (restrict) → User (restrict).
-- NULL = no company restriction (users see whatever their role allows, then user override if set).

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS visible_tabs TEXT[];

COMMENT ON COLUMN companies.visible_tabs IS 'Optional: tabs allowed for this company. NULL = no restriction. Intersected with role tabs; user override can further restrict.';
