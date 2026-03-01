-- Stock & Orders: part requests (request/approve/reject) and stock takes
-- Migration: 20260228000002_stock_orders
-- Used by Stock & Orders tab: Agent view (Request Parts, Stock Take), Manager view (Order Requests, Stock Takes).

-- ============================================================================
-- Helpers (must exist before RLS policies that use them)
-- ============================================================================
-- user_company_match(uid, cid): true if user's profile company_id = cid
CREATE OR REPLACE FUNCTION public.user_company_match(uid UUID, cid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = uid AND up.company_id = cid);
$$;

-- is_manager_or_above(uid): true if user's role is manager, admin, or super_admin
CREATE OR REPLACE FUNCTION public.is_manager_or_above(uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = uid AND up.role IN ('manager', 'admin', 'super_admin')
  );
$$;

-- ============================================================================
-- PART_REQUESTS (agent requests a part; manager approves/rejects)
-- ============================================================================
CREATE TABLE part_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    part_id UUID NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    decided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_part_requests_part_id ON part_requests(part_id);
CREATE INDEX idx_part_requests_requested_by ON part_requests(requested_by);
CREATE INDEX idx_part_requests_company_id ON part_requests(company_id);
CREATE INDEX idx_part_requests_status ON part_requests(status);
CREATE INDEX idx_part_requests_created_at ON part_requests(created_at DESC);

COMMENT ON TABLE part_requests IS 'Parts requested by agents; managers approve or reject.';

-- ============================================================================
-- STOCK_TAKES (session header: who, when)
-- ============================================================================
CREATE TABLE stock_takes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    taken_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stock_takes_created_by ON stock_takes(created_by);
CREATE INDEX idx_stock_takes_company_id ON stock_takes(company_id);
CREATE INDEX idx_stock_takes_taken_at ON stock_takes(taken_at DESC);

COMMENT ON TABLE stock_takes IS 'Stock take session (header). Line items in stock_take_items.';

-- ============================================================================
-- STOCK_TAKE_ITEMS (per-part count in a stock take)
-- ============================================================================
CREATE TABLE stock_take_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stock_take_id UUID NOT NULL REFERENCES stock_takes(id) ON DELETE CASCADE,
    part_id UUID NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
    quantity_counted INT NOT NULL DEFAULT 0 CHECK (quantity_counted >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(stock_take_id, part_id)
);

CREATE INDEX idx_stock_take_items_stock_take_id ON stock_take_items(stock_take_id);
CREATE INDEX idx_stock_take_items_part_id ON stock_take_items(part_id);

COMMENT ON TABLE stock_take_items IS 'Per-part quantity counted in a stock take.';

-- ============================================================================
-- AGENT_STOCK (per agent per part: current stock + need to order; manager can see)
-- ============================================================================
CREATE TABLE agent_stock (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    part_id UUID NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
    current_stock_qty INT NOT NULL DEFAULT 0 CHECK (current_stock_qty >= 0),
    need_to_order INT NOT NULL DEFAULT 0 CHECK (need_to_order >= 0),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, part_id)
);

CREATE INDEX idx_agent_stock_user_id ON agent_stock(user_id);
CREATE INDEX idx_agent_stock_part_id ON agent_stock(part_id);

COMMENT ON TABLE agent_stock IS 'Per-agent per-part current stock and need-to-order; manager can view.';

-- ============================================================================
-- ORDER_REQUESTS (one request with multiple line items; priority, multi-step status)
-- ============================================================================
CREATE TABLE order_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    site_ref TEXT,
    priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH')),
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'approved', 'rejected',
        'ordered', 'in_transit', 'delivered'
    )),
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    decided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_order_requests_requested_by ON order_requests(requested_by);
CREATE INDEX idx_order_requests_company_id ON order_requests(company_id);
CREATE INDEX idx_order_requests_status ON order_requests(status);
CREATE INDEX idx_order_requests_created_at ON order_requests(created_at DESC);

COMMENT ON TABLE order_requests IS 'Order request header; multiple parts via order_request_items.';

-- ============================================================================
-- ORDER_REQUEST_ITEMS (line items with item-level status and price snapshot)
-- ============================================================================
CREATE TABLE order_request_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_request_id UUID NOT NULL REFERENCES order_requests(id) ON DELETE CASCADE,
    part_id UUID NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
    qty_requested INT NOT NULL DEFAULT 1 CHECK (qty_requested > 0),
    item_status TEXT NOT NULL DEFAULT 'pending' CHECK (item_status IN (
        'pending', 'ordered', 'backordered', 'in_transit', 'delivered'
    )),
    unit_price_cents_snapshot INT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_order_request_items_order_request_id ON order_request_items(order_request_id);
CREATE INDEX idx_order_request_items_part_id ON order_request_items(part_id);

COMMENT ON TABLE order_request_items IS 'Line items for an order request; item-level status.';

-- ============================================================================
-- RLS: part_requests
-- ============================================================================
ALTER TABLE part_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read part_requests"
    ON part_requests FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated insert part_requests (own company or super_admin)"
    ON part_requests FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = requested_by
        AND (company_id IS NULL OR public.user_company_match(auth.uid(), company_id) OR public.is_super_admin())
    );

CREATE POLICY "Manager/super_admin update part_requests (approve/reject)"
    ON part_requests FOR UPDATE
    TO authenticated
    USING (public.is_super_admin() OR public.is_manager_or_above(auth.uid()))
    WITH CHECK (true);

-- ============================================================================
-- RLS: stock_takes
-- ============================================================================
ALTER TABLE stock_takes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read stock_takes"
    ON stock_takes FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated insert stock_takes"
    ON stock_takes FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by);

-- ============================================================================
-- RLS: stock_take_items
-- ============================================================================
ALTER TABLE stock_take_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read stock_take_items"
    ON stock_take_items FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated insert stock_take_items"
    ON stock_take_items FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM stock_takes st
            WHERE st.id = stock_take_id AND st.created_by = auth.uid()
        )
    );

CREATE POLICY "Authenticated update stock_take_items (own stock take)"
    ON stock_take_items FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM stock_takes st
            WHERE st.id = stock_take_id AND st.created_by = auth.uid()
        )
    );

-- ============================================================================
-- RLS: agent_stock
-- ============================================================================
ALTER TABLE agent_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read agent_stock"
    ON agent_stock FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated insert/update own agent_stock"
    ON agent_stock FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- RLS: order_requests
-- ============================================================================
ALTER TABLE order_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read order_requests"
    ON order_requests FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated insert order_requests (own)"
    ON order_requests FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = requested_by
        AND (company_id IS NULL OR public.user_company_match(auth.uid(), company_id) OR public.is_super_admin())
    );

CREATE POLICY "Manager/super_admin update order_requests"
    ON order_requests FOR UPDATE
    TO authenticated
    USING (public.is_super_admin() OR public.is_manager_or_above(auth.uid()))
    WITH CHECK (true);

-- ============================================================================
-- RLS: order_request_items
-- ============================================================================
ALTER TABLE order_request_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read order_request_items"
    ON order_request_items FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated insert order_request_items (own order)"
    ON order_request_items FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM order_requests o
            WHERE o.id = order_request_id AND o.requested_by = auth.uid()
        )
    );

CREATE POLICY "Manager/super_admin update order_request_items"
    ON order_request_items FOR UPDATE
    TO authenticated
    USING (public.is_super_admin() OR public.is_manager_or_above(auth.uid()))
    WITH CHECK (true);
