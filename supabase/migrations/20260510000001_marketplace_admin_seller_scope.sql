-- ============================================================================
-- Elora Marketplace — Scope marketplace admin to the seller company
-- Migration: 20260510000001_marketplace_admin_seller_scope
--
-- BUG FIX: the original is_marketplace_admin() in migration
-- 20260509000001_marketplace_foundation treated ANY user with role = 'admin'
-- as a marketplace admin, regardless of which company they admin. That meant
-- admins of buyer companies (created automatically when adding a new
-- company in Elora) were getting the Marketplace Admin tab and could manage
-- products, pricing and warehouses for the whole marketplace.
--
-- Correct semantics:
--   (a) super_admin role        — platform-wide; always a marketplace admin.
--   (b) 'admin' role AND user's company_id matches
--       marketplace_settings.seller_company_id — i.e. an admin of the
--       Elora-the-seller company. Buyer-company admins are NOT marketplace
--       admins.
--   (c) Explicit grant via user_permissions.marketplace_admin = true
--       — manual override (e.g. a contractor or non-admin Elora staff
--       member who needs the role).
--
-- BOOTSTRAP: when marketplace_settings.seller_company_id is NULL (right after
-- the foundation migration runs), branch (b) is inert. Only super_admins and
-- explicitly-granted users have admin rights until a seller company is
-- designated via the admin UI panel on /admin/marketplace.
--
-- This migration is forward-only and idempotent: it CREATE OR REPLACE-s the
-- existing function. EXECUTE grants persist across replacement, but we
-- re-grant defensively.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_marketplace_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    -- (a) super_admin — platform-wide; always a marketplace admin
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role = 'super_admin'
        AND COALESCE(is_active, true) = true
    )
    OR
    -- (b) 'admin' role, but only when the user is in the seller company
    EXISTS (
      SELECT 1
      FROM user_profiles up
      JOIN marketplace_settings ms ON ms.id = 1
      WHERE up.id = auth.uid()
        AND up.role = 'admin'
        AND COALESCE(up.is_active, true) = true
        AND ms.seller_company_id IS NOT NULL
        AND up.company_id = ms.seller_company_id
    )
    OR
    -- (c) explicit grant via user_permissions.marketplace_admin
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_id = auth.uid()
        AND COALESCE(marketplace_admin, false) = true
        AND COALESCE(is_active, true) = true
    );
$$;

COMMENT ON FUNCTION public.is_marketplace_admin IS
  'True if caller can administer the marketplace. Resolution: super_admin role, OR admin role within marketplace_settings.seller_company_id, OR explicit user_permissions.marketplace_admin grant.';

GRANT EXECUTE ON FUNCTION public.is_marketplace_admin() TO authenticated;
