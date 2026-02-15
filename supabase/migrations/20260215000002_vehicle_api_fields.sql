-- Populate ai_predictions with full vehicle/contact info from vehicles API
-- Migration: 20260215000002_vehicle_api_fields
-- Matches old portal: Name, Phone, Mobile, Email, RFID, Wash Time, Washes/Day, Washes/Week, etc.

ALTER TABLE ai_predictions ADD COLUMN IF NOT EXISTS driver_email TEXT;
ALTER TABLE ai_predictions ADD COLUMN IF NOT EXISTS vehicle_rfid TEXT;
ALTER TABLE ai_predictions ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE ai_predictions ADD COLUMN IF NOT EXISTS wash_time_seconds INTEGER;
ALTER TABLE ai_predictions ADD COLUMN IF NOT EXISTS washes_per_day INTEGER;
ALTER TABLE ai_predictions ADD COLUMN IF NOT EXISTS washes_per_week INTEGER;
ALTER TABLE ai_predictions ADD COLUMN IF NOT EXISTS last_scan_at TIMESTAMPTZ;
ALTER TABLE ai_predictions ADD COLUMN IF NOT EXISTS current_week_washes INTEGER;
ALTER TABLE ai_predictions ADD COLUMN IF NOT EXISTS target_washes INTEGER;

COMMENT ON COLUMN ai_predictions.driver_email IS 'Contact email from vehicles API';
COMMENT ON COLUMN ai_predictions.vehicle_rfid IS 'RFID tag from vehicles API';
COMMENT ON COLUMN ai_predictions.customer_name IS 'Customer name from vehicles API';
COMMENT ON COLUMN ai_predictions.wash_time_seconds IS 'Wash duration in seconds from vehicles API';
COMMENT ON COLUMN ai_predictions.washes_per_day IS 'Required washes per day from vehicles API';
COMMENT ON COLUMN ai_predictions.washes_per_week IS 'Required washes per week from vehicles API';
COMMENT ON COLUMN ai_predictions.last_scan_at IS 'Last wash scan timestamp from vehicles API';
COMMENT ON COLUMN ai_predictions.current_week_washes IS 'Current period wash count at prediction time';
COMMENT ON COLUMN ai_predictions.target_washes IS 'Weekly target washes at prediction time';
