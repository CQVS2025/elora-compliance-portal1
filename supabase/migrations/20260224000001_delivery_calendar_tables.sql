-- Delivery Calendar: Notion-synced deliveries and drivers
-- Migration: 20260224000001_delivery_calendar_tables

-- ============================================================================
-- DELIVERY DRIVERS (managers/drivers who appear in Notion "Driver" property)
-- ============================================================================
CREATE TABLE delivery_drivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    color TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_delivery_drivers_slug ON delivery_drivers(slug);
CREATE INDEX idx_delivery_drivers_user_id ON delivery_drivers(user_id);

COMMENT ON TABLE delivery_drivers IS 'Delivery drivers/managers from Notion; slug used for filtering. user_id links to Supabase Auth for driver-only view.';

-- ============================================================================
-- DELIVERY DELIVERIES (cached from Notion database)
-- ============================================================================
CREATE TABLE delivery_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notion_page_id TEXT NOT NULL UNIQUE,
    title TEXT,
    customer TEXT,
    site TEXT,
    status TEXT,
    driver_name TEXT,
    driver_id UUID REFERENCES delivery_drivers(id) ON DELETE SET NULL,
    date_start TIMESTAMPTZ NOT NULL,
    date_end TIMESTAMPTZ,
    last_edited_time TIMESTAMPTZ,
    raw_notion JSONB DEFAULT '{}',
    archived BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_delivery_deliveries_notion_page_id ON delivery_deliveries(notion_page_id);
CREATE INDEX idx_delivery_deliveries_date_start ON delivery_deliveries(date_start);
CREATE INDEX idx_delivery_deliveries_driver_name ON delivery_deliveries(driver_name);
CREATE INDEX idx_delivery_deliveries_driver_date ON delivery_deliveries(driver_name, date_start);
CREATE INDEX idx_delivery_deliveries_archived ON delivery_deliveries(archived) WHERE archived = false;

COMMENT ON TABLE delivery_deliveries IS 'Cached delivery jobs from Notion; synced by sync-notion-deliveries edge function.';

-- ============================================================================
-- SYNC STATE (for incremental Notion sync)
-- ============================================================================
CREATE TABLE delivery_sync_state (
    id TEXT PRIMARY KEY DEFAULT 'default',
    last_sync_time TIMESTAMPTZ,
    last_cursor TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE delivery_sync_state IS 'Tracks last Notion sync for incremental updates.';

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================
CREATE TRIGGER update_delivery_drivers_updated_at BEFORE UPDATE ON delivery_drivers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_delivery_deliveries_updated_at BEFORE UPDATE ON delivery_deliveries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_delivery_sync_state_updated_at BEFORE UPDATE ON delivery_sync_state
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- RLS: authenticated users can read (sync runs with service role and bypasses RLS)
-- ============================================================================
ALTER TABLE delivery_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read delivery_drivers"
    ON delivery_drivers FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated read delivery_deliveries"
    ON delivery_deliveries FOR SELECT
    TO authenticated
    USING (archived = false);

CREATE POLICY "Authenticated read delivery_sync_state"
    ON delivery_sync_state FOR SELECT
    TO authenticated
    USING (true);
