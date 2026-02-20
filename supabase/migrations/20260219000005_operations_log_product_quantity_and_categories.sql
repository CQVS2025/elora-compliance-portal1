-- Add product_quantity to operations_log_entries; seed more categories
-- Migration: 20260219000005_operations_log_product_quantity_and_categories

ALTER TABLE operations_log_entries
ADD COLUMN IF NOT EXISTS product_quantity INT;

COMMENT ON COLUMN operations_log_entries.product_quantity IS 'Optional quantity when product_id is set';

-- Seed additional categories for operations log (skip if name exists)
INSERT INTO operations_log_categories (name, sort_order)
SELECT 'Safety', 5 WHERE NOT EXISTS (SELECT 1 FROM operations_log_categories WHERE name = 'Safety');
INSERT INTO operations_log_categories (name, sort_order)
SELECT 'Maintenance', 6 WHERE NOT EXISTS (SELECT 1 FROM operations_log_categories WHERE name = 'Maintenance');
INSERT INTO operations_log_categories (name, sort_order)
SELECT 'Delivery', 7 WHERE NOT EXISTS (SELECT 1 FROM operations_log_categories WHERE name = 'Delivery');
INSERT INTO operations_log_categories (name, sort_order)
SELECT 'Audit', 8 WHERE NOT EXISTS (SELECT 1 FROM operations_log_categories WHERE name = 'Audit');
INSERT INTO operations_log_categories (name, sort_order)
SELECT 'Training', 9 WHERE NOT EXISTS (SELECT 1 FROM operations_log_categories WHERE name = 'Training');
INSERT INTO operations_log_categories (name, sort_order)
SELECT 'Environmental', 10 WHERE NOT EXISTS (SELECT 1 FROM operations_log_categories WHERE name = 'Environmental');
INSERT INTO operations_log_categories (name, sort_order)
SELECT 'Other', 99 WHERE NOT EXISTS (SELECT 1 FROM operations_log_categories WHERE name = 'Other');
