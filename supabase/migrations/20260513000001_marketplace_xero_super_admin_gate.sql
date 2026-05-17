-- ============================================================================
-- Marketplace · Xero credentials super_admin gate
--
-- Background
-- ----------
-- marketplace_xero_credentials is a singleton row holding the org-wide
-- Xero OAuth tokens. Previously its RLS policy used is_marketplace_admin(),
-- which lets any seller-company admin connect/disconnect Xero. Because the
-- connection is a one-time, org-wide credential (and a bad value blocks
-- every downstream PO/invoice for every order), we restrict WRITES to
-- super_admin only.
--
-- READS stay at marketplace_admin so the admin Integrations page can show
-- the "Connected · <tenant>" status without escalating.
--
-- The Edge Functions that mutate credentials (marketplace_xero_oauth_start,
-- marketplace_xero_oauth_callback, marketplace_xero_refresh_token) get a
-- matching application-level check using the new is_marketplace_super_admin()
-- RPC.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_marketplace_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
      AND role = 'super_admin'
      AND COALESCE(is_active, true) = true
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_marketplace_super_admin() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_marketplace_super_admin() TO authenticated;

COMMENT ON FUNCTION public.is_marketplace_super_admin() IS
  'TRUE iff the calling user is an active super_admin. Used to gate org-wide credential writes (Xero OAuth).';

-- ----------------------------------------------------------------------------
-- Replace the credentials FOR ALL policy with split read/write policies.
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Xero credentials managed by admin only" ON marketplace_xero_credentials;

CREATE POLICY "Xero credentials readable by marketplace admin"
  ON marketplace_xero_credentials FOR SELECT TO authenticated
  USING (public.is_marketplace_admin());

CREATE POLICY "Xero credentials writable by super_admin only"
  ON marketplace_xero_credentials FOR INSERT TO authenticated
  WITH CHECK (public.is_marketplace_super_admin());

CREATE POLICY "Xero credentials updatable by super_admin only"
  ON marketplace_xero_credentials FOR UPDATE TO authenticated
  USING (public.is_marketplace_super_admin())
  WITH CHECK (public.is_marketplace_super_admin());

CREATE POLICY "Xero credentials deletable by super_admin only"
  ON marketplace_xero_credentials FOR DELETE TO authenticated
  USING (public.is_marketplace_super_admin());
