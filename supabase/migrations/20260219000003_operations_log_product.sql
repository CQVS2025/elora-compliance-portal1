-- Add optional product reference to operations log entries (for dropdown in New Entry)
-- Migration: 20260219000003_operations_log_product

ALTER TABLE operations_log_entries
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id);

CREATE INDEX IF NOT EXISTS idx_operations_log_entries_product ON operations_log_entries(product_id);
