-- ============================================================================
-- Elora Marketplace — Demo Product Seed (SQL version)
--
-- Paste this whole file into the Supabase SQL editor and click Run.
-- The SQL editor runs as the `postgres` role, which bypasses RLS, so no
-- service-role key dance is needed.
--
-- Inserts (idempotent):
--   - 3 demo products: Green Acid, Concrete Release Agent, Concrete Plant Wash
--   - 7 packaging-price rows across the existing marketplace_packaging_sizes
--     seeded by 20260509000001_marketplace_foundation.sql
--
-- Re-running this file is safe: products are upserted by slug, and existing
-- packaging prices for these three products are wiped and re-inserted from
-- the canonical list below.
--
-- Pre-requisites:
--   - Both marketplace migrations have been applied
--     (foundation + catalog).
--   - Packaging sizes "20L Pail", "200L Drum", "1000L IBC", "Bulk Tanker"
--     exist (seeded by migration 1).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Upsert the three demo products by slug
-- ---------------------------------------------------------------------------
INSERT INTO marketplace_products
  (slug, name, short_description, long_description, manufacturer,
   classification, hazard_class, un_number, packing_group, cas_number,
   safety_info, delivery_info, badge, display_order, is_active)
VALUES
  (
    'green-acid',
    'Green Acid',
    'Industrial-grade green acid for concrete cleaning and metal preparation.',
    'Effective on concrete spillage and rust. Always wear PPE; do not mix with bases. Compatible with stainless steel.',
    'Elora Chemicals',
    'DG Class 8',
    '8',
    '1789',
    'II',
    '7647-01-0',
    'Corrosive. Avoid skin contact. Use ventilated area. Refer to SDS.',
    'Tanker access required for Bulk orders. Weekday deliveries only.',
    'Bestseller',
    10,
    true
  ),
  (
    'concrete-release',
    'Concrete Release Agent',
    'Bio-degradable form release for concrete moulds.',
    'Plant-based, low-VOC release agent. Suitable for steel and timber forms. Ready to use.',
    'Elora Chemicals',
    'Non-DG',
    NULL, NULL, NULL, NULL,
    'Use in ventilated area. Avoid prolonged skin contact.',
    NULL,
    NULL,
    20,
    true
  ),
  (
    'plant-wash',
    'Concrete Plant Wash',
    'Heavy-duty alkaline wash for concrete batching plants and mixer trucks.',
    'Removes set concrete and oil deposits. Concentrated; dilute per SDS instructions.',
    'Elora Chemicals',
    'DG Class 8',
    '8',
    '1814',
    'II',
    NULL,
    'Strongly alkaline. Wear gloves and eye protection.',
    NULL,
    NULL,
    30,
    true
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  long_description = EXCLUDED.long_description,
  manufacturer = EXCLUDED.manufacturer,
  classification = EXCLUDED.classification,
  hazard_class = EXCLUDED.hazard_class,
  un_number = EXCLUDED.un_number,
  packing_group = EXCLUDED.packing_group,
  cas_number = EXCLUDED.cas_number,
  safety_info = EXCLUDED.safety_info,
  delivery_info = EXCLUDED.delivery_info,
  badge = EXCLUDED.badge,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 2. Wipe any existing packaging prices for these three products
--    (so the script is idempotent — re-running gives a clean canonical state)
-- ---------------------------------------------------------------------------
DELETE FROM marketplace_product_packaging_prices
WHERE product_id IN (
  SELECT id FROM marketplace_products
  WHERE slug IN ('green-acid', 'concrete-release', 'plant-wash')
);

-- ---------------------------------------------------------------------------
-- 3. Insert the canonical packaging prices
--    Source-of-truth list: (product_slug, size_name, price_type, $/L, fixed, MOQ)
-- ---------------------------------------------------------------------------
WITH price_data (product_slug, size_name, price_type, price_per_litre, fixed_price, moq) AS (
  VALUES
    -- Green Acid: per-litre pricing across all three packaged sizes
    ('green-acid',       '20L Pail',  'per_litre', 4.20::numeric, NULL::numeric, 1),
    ('green-acid',       '200L Drum', 'per_litre', 4.00,          NULL,          1),
    ('green-acid',       '1000L IBC', 'per_litre', 3.65,          NULL,          1),
    -- Concrete Release Agent: drum + IBC
    ('concrete-release', '200L Drum', 'per_litre', 5.50,          NULL,          1),
    ('concrete-release', '1000L IBC', 'per_litre', 4.90,          NULL,          1),
    -- Concrete Plant Wash: pail + drum
    ('plant-wash',       '20L Pail',  'per_litre', 6.80,          NULL,          1),
    ('plant-wash',       '200L Drum', 'per_litre', 6.20,          NULL,          1)
)
INSERT INTO marketplace_product_packaging_prices
  (product_id, packaging_size_id, price_type, price_per_litre, fixed_price, minimum_order_quantity, is_available)
SELECT
  p.id,
  s.id,
  pd.price_type,
  pd.price_per_litre,
  pd.fixed_price,
  pd.moq,
  true
FROM price_data pd
JOIN marketplace_products p ON p.slug = pd.product_slug
JOIN marketplace_packaging_sizes s ON s.name = pd.size_name;

-- ---------------------------------------------------------------------------
-- 4. Sanity check — return the seeded products with their variant counts
--    (the editor will show this as the result panel)
-- ---------------------------------------------------------------------------
SELECT
  p.slug,
  p.name,
  p.classification,
  p.is_active,
  COUNT(pp.id) AS variant_count,
  STRING_AGG(s.name || ' (' ||
    CASE
      WHEN pp.price_type = 'per_litre' THEN '$' || pp.price_per_litre || '/L'
      ELSE '$' || pp.fixed_price || ' fixed'
    END
    || ')', ', ' ORDER BY s.sort_order) AS variants
FROM marketplace_products p
LEFT JOIN marketplace_product_packaging_prices pp ON pp.product_id = p.id
LEFT JOIN marketplace_packaging_sizes s ON s.id = pp.packaging_size_id
WHERE p.slug IN ('green-acid', 'concrete-release', 'plant-wash')
GROUP BY p.id, p.slug, p.name, p.classification, p.is_active, p.display_order
ORDER BY p.display_order;
