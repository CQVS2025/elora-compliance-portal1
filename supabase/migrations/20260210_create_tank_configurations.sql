-- Create tank_configurations table for Tank Levels feature
-- This table stores capacity, calibration, and threshold data for each tank/device

CREATE TABLE IF NOT EXISTS public.tank_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_ref TEXT, -- Optional: human-readable site identifier (for reference only)
  device_ref TEXT, -- Optional: placeholder device ref from Excel (D00001, D00002, etc.)
  device_serial TEXT NOT NULL, -- PRIMARY identifier: matches computerSerialId from /api/devices
  product_type TEXT NOT NULL CHECK (product_type IN ('CONC', 'FOAM', 'TW', 'GEL')),
  tank_number INTEGER NOT NULL CHECK (tank_number IN (1, 2)),
  max_capacity_litres INTEGER NOT NULL DEFAULT 1000,
  calibration_rate_per_60s DECIMAL(4,2) NOT NULL DEFAULT 5.0,
  warning_threshold_pct INTEGER NOT NULL DEFAULT 20,
  critical_threshold_pct INTEGER NOT NULL DEFAULT 10,
  active BOOLEAN NOT NULL DEFAULT true,
  alert_contact TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique constraint: one config per device serial+tank (device_serial is the reliable key)
  CONSTRAINT unique_tank_config UNIQUE (device_serial, tank_number)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tank_config_serial ON public.tank_configurations(device_serial);
CREATE INDEX IF NOT EXISTS idx_tank_config_active ON public.tank_configurations(active) WHERE active = true;

-- Enable RLS
ALTER TABLE public.tank_configurations ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all authenticated users to read tank configurations
CREATE POLICY "Allow authenticated users to read tank configurations"
  ON public.tank_configurations
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Allow super_admin to insert/update/delete tank configurations
CREATE POLICY "Allow super_admin to manage tank configurations"
  ON public.tank_configurations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'super_admin'
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_tank_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER trigger_update_tank_config_timestamp
  BEFORE UPDATE ON public.tank_configurations
  FOR EACH ROW
  EXECUTE FUNCTION update_tank_config_updated_at();

-- No seed here: use scripts/seed-tank-config-from-excel.mjs with your Excel "Sites & Tanks" sheet.
COMMENT ON TABLE public.tank_configurations IS 'Tank configuration data for Tank Levels feature - stores capacity, calibration rates, and thresholds per tank/device. Capacity and calibration are not in ACATC API; this table is the source of truth for calculations. Seed from Excel via: node scripts/seed-tank-config-from-excel.mjs path/to/ELORA_Portal_Data_Complete.xlsx';
