-- Operations Log and Products tables
-- Migration: 20260219000001_operations_log_and_products

-- ============================================================================
-- OPERATIONS LOG CATEGORIES
-- ============================================================================
CREATE TABLE operations_log_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_operations_log_categories_active ON operations_log_categories(is_active);

-- Seed default categories
INSERT INTO operations_log_categories (name, sort_order) VALUES
    ('Equipment Fixes', 1),
    ('Compliance', 2),
    ('Chemical / Tank', 3),
    ('Site Observations', 4);

-- ============================================================================
-- PRODUCTS (for dropdown + Super Admin management)
-- ============================================================================
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    price_cents INT NOT NULL CHECK (price_cents >= 0),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_products_status ON products(status);

-- ============================================================================
-- OPERATIONS LOG ENTRIES
-- ============================================================================
CREATE TABLE operations_log_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    customer_ref TEXT NOT NULL,
    site_ref TEXT NOT NULL,
    title TEXT NOT NULL,
    brief TEXT,
    description TEXT NOT NULL,
    category_id UUID NOT NULL REFERENCES operations_log_categories(id),
    priority TEXT NOT NULL CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
    assigned_to TEXT,
    due_date DATE,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_operations_log_entries_company ON operations_log_entries(company_id);
CREATE INDEX idx_operations_log_entries_customer_site ON operations_log_entries(customer_ref, site_ref);
CREATE INDEX idx_operations_log_entries_status ON operations_log_entries(status);
CREATE INDEX idx_operations_log_entries_due_date ON operations_log_entries(due_date);
CREATE INDEX idx_operations_log_entries_created_at ON operations_log_entries(created_at);

-- ============================================================================
-- OPERATIONS LOG VEHICLE LINKS
-- ============================================================================
CREATE TABLE operations_log_vehicle_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entry_id UUID NOT NULL REFERENCES operations_log_entries(id) ON DELETE CASCADE,
    vehicle_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_operations_log_vehicle_links_entry ON operations_log_vehicle_links(entry_id);

-- ============================================================================
-- OPERATIONS LOG ATTACHMENTS
-- ============================================================================
CREATE TABLE operations_log_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entry_id UUID NOT NULL REFERENCES operations_log_entries(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT,
    file_size INT,
    uploaded_by UUID NOT NULL REFERENCES auth.users(id),
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_operations_log_attachments_entry ON operations_log_attachments(entry_id);

-- ============================================================================
-- OPERATIONS LOG PERMISSIONS (optional: toggle who can create)
-- ============================================================================
CREATE TABLE operations_log_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    can_create BOOLEAN DEFAULT true,
    can_edit BOOLEAN DEFAULT true,
    can_resolve BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX idx_operations_log_permissions_user ON operations_log_permissions(user_id);

-- ============================================================================
-- RLS: operations_log_categories (read all authenticated; write super_admin)
-- ============================================================================
ALTER TABLE operations_log_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read categories"
    ON operations_log_categories FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Super admin can manage categories"
    ON operations_log_categories FOR ALL
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- ============================================================================
-- RLS: products (read active for all; manage super_admin)
-- ============================================================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read products"
    ON products FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Super admin can manage products"
    ON products FOR ALL
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- ============================================================================
-- RLS: operations_log_entries (company-scoped; super_admin sees all)
-- ============================================================================
ALTER TABLE operations_log_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read entries in their company or super_admin all"
    ON operations_log_entries FOR SELECT
    TO authenticated
    USING (
        public.is_super_admin()
        OR company_id = public.user_company_id()
    );

CREATE POLICY "Users can insert entries for their company"
    ON operations_log_entries FOR INSERT
    TO authenticated
    WITH CHECK (
        company_id = public.user_company_id()
        AND created_by = auth.uid()
    );

CREATE POLICY "Users can update entries in their company"
    ON operations_log_entries FOR UPDATE
    TO authenticated
    USING (
        public.is_super_admin()
        OR company_id = public.user_company_id()
    )
    WITH CHECK (
        public.is_super_admin()
        OR company_id = public.user_company_id()
    );

CREATE POLICY "Super admin can delete any entry"
    ON operations_log_entries FOR DELETE
    TO authenticated
    USING (public.is_super_admin());

CREATE POLICY "Company users can delete own company entries"
    ON operations_log_entries FOR DELETE
    TO authenticated
    USING (company_id = public.user_company_id());

-- ============================================================================
-- RLS: operations_log_vehicle_links (same as entries)
-- ============================================================================
ALTER TABLE operations_log_vehicle_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read vehicle links for visible entries"
    ON operations_log_vehicle_links FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM operations_log_entries e
            WHERE e.id = entry_id
            AND (public.is_super_admin() OR e.company_id = public.user_company_id())
        )
    );

CREATE POLICY "Insert vehicle links for entries in their company"
    ON operations_log_vehicle_links FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM operations_log_entries e
            WHERE e.id = entry_id
            AND e.company_id = public.user_company_id()
        )
    );

CREATE POLICY "Delete vehicle links for entries in their company"
    ON operations_log_vehicle_links FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM operations_log_entries e
            WHERE e.id = entry_id
            AND (public.is_super_admin() OR e.company_id = public.user_company_id())
        )
    );

-- ============================================================================
-- RLS: operations_log_attachments
-- ============================================================================
ALTER TABLE operations_log_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read attachments for visible entries"
    ON operations_log_attachments FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM operations_log_entries e
            WHERE e.id = entry_id
            AND (public.is_super_admin() OR e.company_id = public.user_company_id())
        )
    );

CREATE POLICY "Insert attachments for entries in their company"
    ON operations_log_attachments FOR INSERT
    TO authenticated
    WITH CHECK (
        uploaded_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM operations_log_entries e
            WHERE e.id = entry_id
            AND e.company_id = public.user_company_id()
        )
    );

CREATE POLICY "Delete attachments for entries in their company"
    ON operations_log_attachments FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM operations_log_entries e
            WHERE e.id = entry_id
            AND (public.is_super_admin() OR e.company_id = public.user_company_id())
        )
    );

-- ============================================================================
-- RLS: operations_log_permissions (users read own; super_admin manage)
-- ============================================================================
ALTER TABLE operations_log_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own operations log permission"
    ON operations_log_permissions FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR public.is_super_admin());

CREATE POLICY "Super admin can manage operations log permissions"
    ON operations_log_permissions FOR ALL
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());
