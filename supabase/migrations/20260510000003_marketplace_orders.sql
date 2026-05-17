-- ============================================================================
-- Elora Marketplace M2 — Orders
-- Migration: 20260510000003_marketplace_orders
--
-- The order pipeline. Snapshotted line items, status state machine, atomic
-- order numbering, status audit trail, Stripe checkout-session tracking,
-- warehouse fulfilment fields, and Xero metadata.
--
--   marketplace_orders                 (order header)
--   marketplace_order_items            (line items, snapshotted)
--   marketplace_order_status_history   (audit trail)
--   marketplace_checkout_sessions      (Stripe Checkout session tracking)
--   marketplace_order_number_sequences (per-year counter)
--
-- Atomic RPC: marketplace_next_order_number()  → 'EL-2026-00001'
--
-- Storage:
--   marketplace-po-uploads (private, buyer write own, admin read; 10 MB; PDF)
-- ============================================================================

-- ============================================================================
-- 1. marketplace_order_number_sequences + atomic RPC
-- ============================================================================
CREATE TABLE IF NOT EXISTS marketplace_order_number_sequences (
  year INT PRIMARY KEY,
  last_num INT NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION marketplace_next_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  y INT;
  n INT;
BEGIN
  y := EXTRACT(YEAR FROM now())::INT;

  -- Atomic upsert returning the new last_num
  INSERT INTO marketplace_order_number_sequences (year, last_num)
    VALUES (y, 1)
  ON CONFLICT (year) DO UPDATE
    SET last_num = marketplace_order_number_sequences.last_num + 1
  RETURNING last_num INTO n;

  RETURN 'EL-' || y::TEXT || '-' || LPAD(n::TEXT, 5, '0');
END;
$$;

COMMENT ON FUNCTION marketplace_next_order_number IS 'Atomically returns the next order number in the EL-YYYY-NNNNN format. Sequence resets per calendar year. Safe under concurrent calls.';

GRANT EXECUTE ON FUNCTION marketplace_next_order_number() TO authenticated;

-- ============================================================================
-- 2. marketplace_orders
-- ============================================================================
CREATE TABLE IF NOT EXISTS marketplace_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,

  -- Buyer
  buyer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  buyer_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,

  -- Warehouse (multi-warehouse-ready; resolved from default at create-order time)
  warehouse_id UUID REFERENCES marketplace_warehouses(id) ON DELETE RESTRICT,

  -- Status state machine
  status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN (
    'pending_approval',
    'approved',
    'rejected',
    'paid',
    'dispatched',
    'delivered',
    'cancelled'
  )),

  -- Payment
  payment_method TEXT NOT NULL CHECK (payment_method IN ('purchase_order', 'stripe')),

  -- PO upload (purchase_order method)
  po_pdf_path TEXT,
  po_uploaded_at TIMESTAMPTZ,
  terms_accepted_at TIMESTAMPTZ,

  -- Stripe (stripe method)
  stripe_session_id TEXT,
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_paid_at TIMESTAMPTZ,

  -- Delivery (snapshotted at submit)
  delivery_address JSONB NOT NULL,
  delivery_postcode TEXT NOT NULL,
  delivery_contact_name TEXT,
  delivery_contact_phone TEXT,
  delivery_notes TEXT,

  -- Site-access answers (keyed by question_id)
  site_access_answers JSONB,

  -- Totals (all ex-GST values; GST stored separately; total_amount is grand total)
  subtotal_ex_gst NUMERIC(12, 2) NOT NULL DEFAULT 0,
  freight_ex_gst NUMERIC(12, 2) NOT NULL DEFAULT 0,
  gst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'AUD',

  -- Freight quote breakdown (for transparency / audit)
  freight_quote JSONB,

  -- Approval / rejection (admin)
  approved_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejected_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Warehouse fulfilment
  supplier_dispatch_date DATE,
  supplier_eta_date DATE,
  supplier_tracking_url TEXT,
  supplier_tracking_carrier TEXT,
  supplier_notes TEXT,
  supplier_freight_cost NUMERIC(12, 2),

  -- Xero links
  xero_invoice_id TEXT,
  xero_invoice_status TEXT,
  xero_invoice_number TEXT,
  xero_po_id TEXT,
  xero_po_status TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_orders_buyer_company ON marketplace_orders(buyer_company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_status ON marketplace_orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_warehouse ON marketplace_orders(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_buyer_user ON marketplace_orders(buyer_user_id);

COMMENT ON TABLE marketplace_orders IS 'Order header. Snapshotted totals (ex-GST + GST + total). Stripe PI is UNIQUE for webhook idempotency.';

-- ============================================================================
-- 3. marketplace_order_items
--    Snapshotted at order create time so admin product edits don't rewrite
--    historical orders.
-- ============================================================================
CREATE TABLE IF NOT EXISTS marketplace_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES marketplace_orders(id) ON DELETE CASCADE,

  -- Product snapshot
  product_id UUID REFERENCES marketplace_products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_slug TEXT,
  product_manufacturer TEXT,
  product_classification TEXT,

  -- Packaging snapshot
  packaging_size_id UUID REFERENCES marketplace_packaging_sizes(id) ON DELETE SET NULL,
  packaging_size_name TEXT NOT NULL,
  packaging_volume_litres NUMERIC(10, 3),

  -- Price snapshot
  price_type TEXT NOT NULL CHECK (price_type IN ('per_litre', 'fixed')),
  price_per_litre NUMERIC(12, 4),
  fixed_price NUMERIC(12, 2),
  unit_price_ex_gst NUMERIC(12, 2) NOT NULL CHECK (unit_price_ex_gst >= 0),

  -- Quantity (in pack-size units)
  quantity INT NOT NULL CHECK (quantity > 0),
  line_subtotal_ex_gst NUMERIC(12, 2) NOT NULL CHECK (line_subtotal_ex_gst >= 0),

  -- Per-line freight (when multi-product orders end up using different sheets)
  freight_rate_sheet_id UUID REFERENCES marketplace_rate_sheets(id) ON DELETE SET NULL,
  freight_ex_gst NUMERIC(12, 2),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_order_items_order ON marketplace_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_order_items_product ON marketplace_order_items(product_id);

-- ============================================================================
-- 4. marketplace_order_status_history (audit trail)
-- ============================================================================
CREATE TABLE IF NOT EXISTS marketplace_order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES marketplace_orders(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_order_status_history_order
  ON marketplace_order_status_history(order_id, created_at DESC);

-- Convenience: emit a history row whenever orders.status changes
CREATE OR REPLACE FUNCTION marketplace_orders_record_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO marketplace_order_status_history (order_id, from_status, to_status, changed_by_user_id, reason)
    VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      COALESCE(NEW.approved_by_user_id, NEW.rejected_by_user_id, auth.uid()),
      NEW.rejection_reason
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_marketplace_orders_status_history ON marketplace_orders;
CREATE TRIGGER trg_marketplace_orders_status_history
  AFTER UPDATE OF status ON marketplace_orders
  FOR EACH ROW EXECUTE FUNCTION marketplace_orders_record_status_change();

-- ============================================================================
-- 5. marketplace_checkout_sessions (Stripe session bookkeeping)
-- ============================================================================
CREATE TABLE IF NOT EXISTS marketplace_checkout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES marketplace_orders(id) ON DELETE CASCADE,
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'completed', 'expired', 'canceled')),
  amount_total NUMERIC(12, 2),
  currency TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_checkout_sessions_order ON marketplace_checkout_sessions(order_id);

-- ============================================================================
-- 6. Triggers (updated_at)
-- ============================================================================
DROP TRIGGER IF EXISTS trg_marketplace_orders_updated_at ON marketplace_orders;
CREATE TRIGGER trg_marketplace_orders_updated_at
  BEFORE UPDATE ON marketplace_orders
  FOR EACH ROW EXECUTE FUNCTION marketplace_touch_updated_at();

DROP TRIGGER IF EXISTS trg_marketplace_checkout_sessions_updated_at ON marketplace_checkout_sessions;
CREATE TRIGGER trg_marketplace_checkout_sessions_updated_at
  BEFORE UPDATE ON marketplace_checkout_sessions
  FOR EACH ROW EXECUTE FUNCTION marketplace_touch_updated_at();

-- ============================================================================
-- 7. RLS — orders, items, history, sessions
-- ============================================================================
ALTER TABLE marketplace_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_checkout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_order_number_sequences ENABLE ROW LEVEL SECURITY;

-- Orders: admins all; buyer sees their company; warehouse user sees their warehouse.
CREATE POLICY "Orders readable by admin, buyer company, or warehouse"
  ON marketplace_orders FOR SELECT TO authenticated
  USING (
    public.is_marketplace_admin()
    OR buyer_company_id = public.marketplace_user_company_id()
    OR (warehouse_id IS NOT NULL AND public.is_warehouse_user(warehouse_id))
  );

-- Insert: only the buyer themselves, only into their own company, only for an enabled company.
CREATE POLICY "Orders insertable by buyer in own enabled company"
  ON marketplace_orders FOR INSERT TO authenticated
  WITH CHECK (
    buyer_user_id = auth.uid()
    AND buyer_company_id = public.marketplace_user_company_id()
    AND public.user_marketplace_enabled()
  );

-- Update: admins do everything (approve/reject/cancel/fulfilment-set);
-- warehouse users can update fulfilment fields on their warehouse's orders
-- (column-level enforcement happens via a SECURITY DEFINER RPC; broad UPDATE
-- access is gated here).
CREATE POLICY "Orders updatable by admins or assigned warehouse user"
  ON marketplace_orders FOR UPDATE TO authenticated
  USING (
    public.is_marketplace_admin()
    OR (warehouse_id IS NOT NULL AND public.is_warehouse_user(warehouse_id))
  )
  WITH CHECK (
    public.is_marketplace_admin()
    OR (warehouse_id IS NOT NULL AND public.is_warehouse_user(warehouse_id))
  );

-- Delete: admins only.
CREATE POLICY "Orders deletable by admins"
  ON marketplace_orders FOR DELETE TO authenticated
  USING (public.is_marketplace_admin());

-- Order items: visibility inherits from the parent order.
CREATE POLICY "Order items readable by admin, buyer company, or warehouse"
  ON marketplace_order_items FOR SELECT TO authenticated
  USING (
    public.is_marketplace_admin()
    OR EXISTS (
      SELECT 1 FROM marketplace_orders o
      WHERE o.id = marketplace_order_items.order_id
        AND (
          o.buyer_company_id = public.marketplace_user_company_id()
          OR (o.warehouse_id IS NOT NULL AND public.is_warehouse_user(o.warehouse_id))
        )
    )
  );

CREATE POLICY "Order items insertable by buyer creating own order"
  ON marketplace_order_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM marketplace_orders o
      WHERE o.id = marketplace_order_items.order_id
        AND o.buyer_user_id = auth.uid()
        AND o.buyer_company_id = public.marketplace_user_company_id()
    )
  );

CREATE POLICY "Order items managed by admins"
  ON marketplace_order_items FOR UPDATE TO authenticated
  USING (public.is_marketplace_admin())
  WITH CHECK (public.is_marketplace_admin());

-- Status history: read by order viewers; write by trigger only.
CREATE POLICY "Status history readable by order viewers"
  ON marketplace_order_status_history FOR SELECT TO authenticated
  USING (
    public.is_marketplace_admin()
    OR EXISTS (
      SELECT 1 FROM marketplace_orders o
      WHERE o.id = marketplace_order_status_history.order_id
        AND (
          o.buyer_company_id = public.marketplace_user_company_id()
          OR (o.warehouse_id IS NOT NULL AND public.is_warehouse_user(o.warehouse_id))
        )
    )
  );

-- (No INSERT policy: the SECURITY DEFINER trigger bypasses RLS.)

-- Checkout sessions: buyer reads own; admin reads all; writes via Edge Functions.
CREATE POLICY "Checkout sessions readable by buyer or admin"
  ON marketplace_checkout_sessions FOR SELECT TO authenticated
  USING (
    public.is_marketplace_admin()
    OR EXISTS (
      SELECT 1 FROM marketplace_orders o
      WHERE o.id = marketplace_checkout_sessions.order_id
        AND o.buyer_user_id = auth.uid()
    )
  );

CREATE POLICY "Checkout sessions managed by admins"
  ON marketplace_checkout_sessions FOR ALL TO authenticated
  USING (public.is_marketplace_admin())
  WITH CHECK (public.is_marketplace_admin());

-- Order number sequences: admin only.
CREATE POLICY "Order number sequences managed by admins"
  ON marketplace_order_number_sequences FOR ALL TO authenticated
  USING (public.is_marketplace_admin())
  WITH CHECK (public.is_marketplace_admin());

-- ============================================================================
-- 8. Storage: marketplace-po-uploads (PO PDFs)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'marketplace-po-uploads',
  'marketplace-po-uploads',
  false,
  10485760,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Buyer writes their own PO; admin reads all; nobody else.
-- Path convention: <buyer_company_id>/<order_id>/<uuid>.pdf
CREATE POLICY "marketplace-po-uploads: buyer write own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'marketplace-po-uploads'
    AND public.user_marketplace_enabled()
    -- First path segment must match the user's company_id
    AND (storage.foldername(name))[1] = public.marketplace_user_company_id()::text
  );

CREATE POLICY "marketplace-po-uploads: buyer or admin read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'marketplace-po-uploads'
    AND (
      public.is_marketplace_admin()
      OR (storage.foldername(name))[1] = public.marketplace_user_company_id()::text
    )
  );

CREATE POLICY "marketplace-po-uploads: admin delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'marketplace-po-uploads' AND public.is_marketplace_admin()
  );
