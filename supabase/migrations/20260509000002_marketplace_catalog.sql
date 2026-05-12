-- ============================================================================
-- Elora Marketplace — Catalog, Pricing & Cart
-- Migration: 20260509000002_marketplace_catalog
--
-- Builds on 20260509000001_marketplace_foundation.sql.
--
-- Adds:
--   - marketplace_products                  (catalog)
--   - marketplace_product_packaging_prices  (default per-size pricing)
--   - marketplace_company_pricing           (per-buyer-company override — NEW for Elora)
--   - marketplace_product_images            (gallery; first-class table, not just URL on product)
--   - marketplace_product_documents         (SDS PDFs and similar)
--   - marketplace_product_checkout_questions (site-access questions, used in M2 checkout)
--   - marketplace_cart_items                (persistent buyer cart)
--   - v_marketplace_buyer_prices            (security_invoker view; resolves
--                                            effective price per (product, size)
--                                            for the calling user)
--
-- Storage buckets:
--   - marketplace-product-images  (public read; admin write)
--   - marketplace-product-sds     (authenticated read for enabled buyers; admin write)
-- ============================================================================

-- ============================================================================
-- marketplace_products
-- ============================================================================
CREATE TABLE IF NOT EXISTS marketplace_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  short_description TEXT,
  long_description TEXT,
  manufacturer TEXT,
  -- Hazard / classification fields (mirrors AU dangerous-goods reporting)
  classification TEXT NOT NULL DEFAULT 'Non-DG',
  hazard_class TEXT,
  un_number TEXT,
  packing_group TEXT,
  cas_number TEXT,
  safety_info TEXT,
  -- Free-text delivery / handling note shown on the product detail page
  -- (e.g. "Bulk only delivered weekdays; tanker access required.")
  delivery_info TEXT,
  -- Display
  badge TEXT,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_products_active_order
  ON marketplace_products(is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_marketplace_products_slug
  ON marketplace_products(slug);

COMMENT ON TABLE marketplace_products IS 'Marketplace catalog. One row per product (e.g. "Green Acid"). Per-size pricing lives in marketplace_product_packaging_prices.';

-- ============================================================================
-- marketplace_product_packaging_prices (default prices)
-- ============================================================================
CREATE TABLE IF NOT EXISTS marketplace_product_packaging_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES marketplace_products(id) ON DELETE CASCADE,
  packaging_size_id UUID NOT NULL REFERENCES marketplace_packaging_sizes(id) ON DELETE RESTRICT,
  price_type TEXT NOT NULL CHECK (price_type IN ('per_litre', 'fixed')),
  price_per_litre NUMERIC(12, 4),
  fixed_price NUMERIC(12, 2),
  minimum_order_quantity INT NOT NULL DEFAULT 1 CHECK (minimum_order_quantity >= 1),
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, packaging_size_id),
  -- Exactly one price field is populated, matching price_type
  CHECK (
    (price_type = 'per_litre' AND price_per_litre IS NOT NULL AND fixed_price IS NULL)
    OR
    (price_type = 'fixed' AND fixed_price IS NOT NULL AND price_per_litre IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_mppp_product
  ON marketplace_product_packaging_prices(product_id);

COMMENT ON TABLE marketplace_product_packaging_prices IS 'Default price per (product, packaging_size). Overridden per-buyer in marketplace_company_pricing.';

-- ============================================================================
-- marketplace_company_pricing (per-buyer-company overrides — NEW for Elora)
-- ============================================================================
CREATE TABLE IF NOT EXISTS marketplace_company_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES marketplace_products(id) ON DELETE CASCADE,
  packaging_size_id UUID NOT NULL REFERENCES marketplace_packaging_sizes(id) ON DELETE RESTRICT,
  price_type TEXT NOT NULL CHECK (price_type IN ('per_litre', 'fixed')),
  price_per_litre NUMERIC(12, 4),
  fixed_price NUMERIC(12, 2),
  minimum_order_quantity INT,
  notes TEXT,
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (price_type = 'per_litre' AND price_per_litre IS NOT NULL AND fixed_price IS NULL)
    OR
    (price_type = 'fixed' AND fixed_price IS NOT NULL AND price_per_litre IS NULL)
  )
);

-- Only one ACTIVE override per (company, product, size). An "active" override
-- is one with valid_to IS NULL (no expiry) — historical/expired overrides
-- can coexist for audit purposes.
CREATE UNIQUE INDEX IF NOT EXISTS uq_mcp_active
  ON marketplace_company_pricing (company_id, product_id, packaging_size_id)
  WHERE valid_to IS NULL;

CREATE INDEX IF NOT EXISTS idx_mcp_company
  ON marketplace_company_pricing(company_id);
CREATE INDEX IF NOT EXISTS idx_mcp_product
  ON marketplace_company_pricing(product_id);

COMMENT ON TABLE marketplace_company_pricing IS 'Per-customer pricing overrides. Resolution at read time: if a row exists for (buyer.company_id, product_id, size_id) within the valid window, use it; otherwise fall back to default in marketplace_product_packaging_prices.';

-- ============================================================================
-- marketplace_product_images
-- ============================================================================
CREATE TABLE IF NOT EXISTS marketplace_product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES marketplace_products(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  alt_text TEXT,
  is_cover BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mpi_product_sort
  ON marketplace_product_images(product_id, sort_order);

-- One cover per product (partial unique).
CREATE UNIQUE INDEX IF NOT EXISTS uq_mpi_one_cover
  ON marketplace_product_images(product_id)
  WHERE is_cover = true;

COMMENT ON TABLE marketplace_product_images IS 'Product gallery. storage_path points into the marketplace-product-images bucket.';

-- ============================================================================
-- marketplace_product_documents (SDS PDFs and similar)
-- ============================================================================
CREATE TABLE IF NOT EXISTS marketplace_product_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES marketplace_products(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL DEFAULT 'sds' CHECK (doc_type IN ('sds', 'spec', 'coa', 'other')),
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size_bytes BIGINT,
  mime_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mpd_product
  ON marketplace_product_documents(product_id);

COMMENT ON TABLE marketplace_product_documents IS 'Product documents (SDS PDFs primarily). storage_path points into the marketplace-product-sds bucket.';

-- ============================================================================
-- marketplace_product_checkout_questions
--   (kept in M1 because the admin product editor manages these even though
--    they're rendered in the M2 checkout flow)
-- ============================================================================
CREATE TABLE IF NOT EXISTS marketplace_product_checkout_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES marketplace_products(id) ON DELETE CASCADE,
  packaging_size_id UUID REFERENCES marketplace_packaging_sizes(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('boolean', 'text', 'number', 'single_select')),
  options JSONB,
  is_required BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mpcq_product
  ON marketplace_product_checkout_questions(product_id);

COMMENT ON TABLE marketplace_product_checkout_questions IS 'Site-access questions per product (or per product+size). Rendered in M2 checkout. NULL packaging_size_id = applies to all sizes.';

-- ============================================================================
-- marketplace_cart_items (persistent buyer cart)
-- ============================================================================
CREATE TABLE IF NOT EXISTS marketplace_cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES marketplace_products(id) ON DELETE CASCADE,
  packaging_size_id UUID NOT NULL REFERENCES marketplace_packaging_sizes(id) ON DELETE RESTRICT,
  quantity INT NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id, packaging_size_id)
);

CREATE INDEX IF NOT EXISTS idx_mci_user
  ON marketplace_cart_items(user_id);

COMMENT ON TABLE marketplace_cart_items IS 'Persistent buyer cart. One row per (user, product, packaging_size). Price is NOT snapshotted here — it resolves on read via v_marketplace_buyer_prices so admin price changes propagate.';

-- ============================================================================
-- updated_at triggers
-- ============================================================================
DROP TRIGGER IF EXISTS trg_marketplace_products_updated_at ON marketplace_products;
CREATE TRIGGER trg_marketplace_products_updated_at
  BEFORE UPDATE ON marketplace_products
  FOR EACH ROW EXECUTE FUNCTION marketplace_touch_updated_at();

DROP TRIGGER IF EXISTS trg_mppp_updated_at ON marketplace_product_packaging_prices;
CREATE TRIGGER trg_mppp_updated_at
  BEFORE UPDATE ON marketplace_product_packaging_prices
  FOR EACH ROW EXECUTE FUNCTION marketplace_touch_updated_at();

DROP TRIGGER IF EXISTS trg_mcp_updated_at ON marketplace_company_pricing;
CREATE TRIGGER trg_mcp_updated_at
  BEFORE UPDATE ON marketplace_company_pricing
  FOR EACH ROW EXECUTE FUNCTION marketplace_touch_updated_at();

DROP TRIGGER IF EXISTS trg_mpcq_updated_at ON marketplace_product_checkout_questions;
CREATE TRIGGER trg_mpcq_updated_at
  BEFORE UPDATE ON marketplace_product_checkout_questions
  FOR EACH ROW EXECUTE FUNCTION marketplace_touch_updated_at();

DROP TRIGGER IF EXISTS trg_mci_updated_at ON marketplace_cart_items;
CREATE TRIGGER trg_mci_updated_at
  BEFORE UPDATE ON marketplace_cart_items
  FOR EACH ROW EXECUTE FUNCTION marketplace_touch_updated_at();

-- ============================================================================
-- Cart safety trigger: ensure company_id matches the user's profile
-- (defence-in-depth; the buyer page should already pass the right value)
-- ============================================================================
CREATE OR REPLACE FUNCTION marketplace_cart_set_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resolved_company_id UUID;
BEGIN
  SELECT company_id INTO resolved_company_id
  FROM user_profiles
  WHERE id = NEW.user_id;

  IF resolved_company_id IS NULL THEN
    RAISE EXCEPTION 'Cannot add cart item: user_id has no associated company';
  END IF;

  -- Always force company_id to match profile, regardless of what the client sent.
  NEW.company_id = resolved_company_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mci_set_company ON marketplace_cart_items;
CREATE TRIGGER trg_mci_set_company
  BEFORE INSERT OR UPDATE ON marketplace_cart_items
  FOR EACH ROW EXECUTE FUNCTION marketplace_cart_set_company_id();

-- ============================================================================
-- v_marketplace_buyer_prices
--
-- security_invoker = true so the underlying RLS on
-- marketplace_company_pricing applies (a buyer can only see their own
-- company's overrides). Returns one row per (product, packaging_size) with
-- the EFFECTIVE price for the calling user.
-- ============================================================================
DROP VIEW IF EXISTS v_marketplace_buyer_prices;

CREATE VIEW v_marketplace_buyer_prices
WITH (security_invoker = true)
AS
SELECT
  d.product_id,
  d.packaging_size_id,
  COALESCE(o.price_type, d.price_type) AS price_type,
  COALESCE(o.price_per_litre, d.price_per_litre) AS price_per_litre,
  COALESCE(o.fixed_price, d.fixed_price) AS fixed_price,
  COALESCE(o.minimum_order_quantity, d.minimum_order_quantity) AS minimum_order_quantity,
  d.is_available,
  CASE WHEN o.id IS NOT NULL THEN 'override' ELSE 'default' END AS price_source,
  d.updated_at AS default_updated_at,
  o.updated_at AS override_updated_at
FROM marketplace_product_packaging_prices d
LEFT JOIN marketplace_company_pricing o
  ON o.product_id = d.product_id
  AND o.packaging_size_id = d.packaging_size_id
  AND o.company_id = public.marketplace_user_company_id()
  AND (o.valid_from IS NULL OR o.valid_from <= now())
  AND (o.valid_to IS NULL OR o.valid_to > now());

COMMENT ON VIEW v_marketplace_buyer_prices IS 'Buyer-facing effective prices. Joins default prices with the calling user''s company-specific override (if any). security_invoker=true so RLS on marketplace_company_pricing applies.';

GRANT SELECT ON v_marketplace_buyer_prices TO authenticated;

-- ============================================================================
-- RLS — catalog tables
-- ============================================================================
ALTER TABLE marketplace_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_product_packaging_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_company_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_product_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_product_checkout_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_cart_items ENABLE ROW LEVEL SECURITY;

-- Products: readable by enabled buyers (active only) + admins; writable by admins.
CREATE POLICY "Products readable by enabled buyers (active) or admins"
  ON marketplace_products FOR SELECT
  TO authenticated
  USING (
    public.is_marketplace_admin()
    OR (public.user_marketplace_enabled() AND is_active = true)
  );

CREATE POLICY "Products managed by admins"
  ON marketplace_products FOR ALL
  TO authenticated
  USING (public.is_marketplace_admin())
  WITH CHECK (public.is_marketplace_admin());

-- Default prices: readable by enabled buyers + admins; writable by admins.
-- Buyers should generally read via v_marketplace_buyer_prices, but we allow
-- the underlying read so the admin UI can join cleanly.
CREATE POLICY "Default prices readable by enabled buyers or admins"
  ON marketplace_product_packaging_prices FOR SELECT
  TO authenticated
  USING (
    public.is_marketplace_admin()
    OR public.user_marketplace_enabled()
  );

CREATE POLICY "Default prices managed by admins"
  ON marketplace_product_packaging_prices FOR ALL
  TO authenticated
  USING (public.is_marketplace_admin())
  WITH CHECK (public.is_marketplace_admin());

-- Company pricing overrides: STRICTLY company-scoped read; admin reads/writes all.
-- This is the highest-stakes RLS in the marketplace.
CREATE POLICY "Company pricing readable by own company or admins"
  ON marketplace_company_pricing FOR SELECT
  TO authenticated
  USING (
    public.is_marketplace_admin()
    OR (
      public.user_marketplace_enabled()
      AND company_id = public.marketplace_user_company_id()
    )
  );

CREATE POLICY "Company pricing managed by admins"
  ON marketplace_company_pricing FOR ALL
  TO authenticated
  USING (public.is_marketplace_admin())
  WITH CHECK (public.is_marketplace_admin());

-- Product images: readable by enabled buyers + admins; written by admins.
CREATE POLICY "Product images readable by enabled buyers or admins"
  ON marketplace_product_images FOR SELECT
  TO authenticated
  USING (
    public.is_marketplace_admin()
    OR public.user_marketplace_enabled()
  );

CREATE POLICY "Product images managed by admins"
  ON marketplace_product_images FOR ALL
  TO authenticated
  USING (public.is_marketplace_admin())
  WITH CHECK (public.is_marketplace_admin());

-- Product documents (SDS): readable by enabled buyers + admins; written by admins.
CREATE POLICY "Product documents readable by enabled buyers or admins"
  ON marketplace_product_documents FOR SELECT
  TO authenticated
  USING (
    public.is_marketplace_admin()
    OR public.user_marketplace_enabled()
  );

CREATE POLICY "Product documents managed by admins"
  ON marketplace_product_documents FOR ALL
  TO authenticated
  USING (public.is_marketplace_admin())
  WITH CHECK (public.is_marketplace_admin());

-- Checkout questions: readable by enabled buyers + admins; written by admins.
CREATE POLICY "Checkout questions readable by enabled buyers or admins"
  ON marketplace_product_checkout_questions FOR SELECT
  TO authenticated
  USING (
    public.is_marketplace_admin()
    OR public.user_marketplace_enabled()
  );

CREATE POLICY "Checkout questions managed by admins"
  ON marketplace_product_checkout_questions FOR ALL
  TO authenticated
  USING (public.is_marketplace_admin())
  WITH CHECK (public.is_marketplace_admin());

-- Cart items: strict per-user. A user only ever sees / mutates their own cart.
-- Admins can SELECT for support, but cannot insert/update on a user's behalf.
CREATE POLICY "Cart readable by self or admin"
  ON marketplace_cart_items FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_marketplace_admin()
  );

CREATE POLICY "Cart items insertable by self only"
  ON marketplace_cart_items FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.user_marketplace_enabled()
  );

CREATE POLICY "Cart items updatable by self only"
  ON marketplace_cart_items FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Cart items deletable by self only"
  ON marketplace_cart_items FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- STORAGE — marketplace buckets + policies
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'marketplace-product-images',
  'marketplace-product-images',
  true,
  5242880, -- 5 MB
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'marketplace-product-sds',
  'marketplace-product-sds',
  false, -- private; reads gated by storage policy below
  10485760, -- 10 MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Product images: anyone authenticated can read; admins write/delete.
CREATE POLICY "marketplace-product-images: read public"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'marketplace-product-images');

CREATE POLICY "marketplace-product-images: admin write"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'marketplace-product-images'
    AND public.is_marketplace_admin()
  );

CREATE POLICY "marketplace-product-images: admin update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'marketplace-product-images'
    AND public.is_marketplace_admin()
  );

CREATE POLICY "marketplace-product-images: admin delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'marketplace-product-images'
    AND public.is_marketplace_admin()
  );

-- SDS docs: read by enabled buyers + admins; admin write/delete.
CREATE POLICY "marketplace-product-sds: read enabled buyers or admin"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'marketplace-product-sds'
    AND (public.is_marketplace_admin() OR public.user_marketplace_enabled())
  );

CREATE POLICY "marketplace-product-sds: admin write"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'marketplace-product-sds'
    AND public.is_marketplace_admin()
  );

CREATE POLICY "marketplace-product-sds: admin update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'marketplace-product-sds'
    AND public.is_marketplace_admin()
  );

CREATE POLICY "marketplace-product-sds: admin delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'marketplace-product-sds'
    AND public.is_marketplace_admin()
  );
