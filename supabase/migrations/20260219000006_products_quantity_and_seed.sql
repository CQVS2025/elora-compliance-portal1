-- Add quantity to products; seed products from old system (quantity 1, superadmin can edit later)
-- Migration: 20260219000006_products_quantity_and_seed

ALTER TABLE products
ADD COLUMN IF NOT EXISTS quantity INT NOT NULL DEFAULT 1;

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_quantity_check;
ALTER TABLE products ADD CONSTRAINT products_quantity_check CHECK (quantity >= 0);

COMMENT ON COLUMN products.quantity IS 'Stock/quantity; default 1 for seeded rows; superadmin can edit in Admin → Products';

-- Seed products from old system (idempotent: skip if name already exists)
INSERT INTO products (name, price_cents, status, quantity)
SELECT v.name, v.price_cents, v.status, v.quantity
FROM (VALUES
  ('WAND', 3000, 'active', 1),
  ('TRUCK WASH BLUE POLYPROPYLENE BALL VALVE', 4000, 'active', 1),
  ('STAINLESS NOZZLE', 6500, 'active', 1),
  ('SERVICE CALL OUT', 0, 'active', 1),
  ('Installation Fee', 144000, 'active', 1),
  ('IBC Deposit', 20000, 'active', 1),
  ('HCL - HB WA', 250, 'active', 1),
  ('GAR - HB WA', 365, 'active', 1),
  ('FREIGHT RECOVERED', 0, 'active', 1),
  ('FOAMING APPLICATION SYSTEM', 0, 'active', 1),
  ('FLOJET - G573', 53500, 'active', 1),
  ('ELORA-GAR-HOLCIM', 385, 'active', 1),
  ('ELORA-GAR-HB', 385, 'active', 1),
  ('ELORA-GAR-BORAL', 365, 'active', 1),
  ('ELORA-GAR - GUNLAKE', 395, 'active', 1),
  ('ELORA TRUCK WASH - ETW', 195, 'active', 1),
  ('ELORA TRCUK WASH CONCENTRATE - ETWC', 385, 'active', 1),
  ('ELORA SLOWRELEASE GEL', 385, 'active', 1),
  ('ELORA SCAN CARD', 1350, 'active', 1),
  ('ELORA FYT CONCRETE REMOVER - EFYT', 295, 'active', 1),
  ('ELORA CONCRETE SAFE REMOVER - ECSR - BORAL', 365, 'active', 1),
  ('ELORA CONCRETE SAFE REMOVER - ECSR', 385, 'active', 1),
  ('ELORA AGI BLAST GEL', 365, 'active', 1),
  ('CONCENTRATE APPLICATION SYSTEM', 0, 'active', 1),
  ('ACID YELLOW BANJO POLYPROPYLENE BALL VALVE', 13000, 'active', 1),
  ('3/4 Yellow Poly Fan Nozzle', 6500, 'active', 1),
  ('2000 Litre Spill Bund-2550 L x 1350 W x 580mm', 229000, 'active', 1),
  ('2000 Litre Spill Bund PVC Cover & Galv Frame', 150000, 'active', 1),
  ('1000 Litre Spill Bund-1760 x 1350 x 800mm', 220000, 'active', 1),
  ('1000 Litre Spill Bund PVC Cover & Galv Frame', 140000, 'active', 1),
  ('1/2 POLY TRIGGER GUN', 19500, 'active', 1)
) AS v(name, price_cents, status, quantity)
WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.name = v.name);
