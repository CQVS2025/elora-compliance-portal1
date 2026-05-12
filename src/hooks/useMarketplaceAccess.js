/**
 * useMarketplaceAccess
 *
 * Single hook returning the marketplace gates for the logged-in user. Used
 * by NavMain (tab visibility), route guards, and individual pages.
 *
 * Returns:
 *   {
 *     canSee:           boolean,  // can navigate to /marketplace pages
 *     canShop:          boolean,  // can add to cart (only company-enabled buyers)
 *     canAdminister:    boolean,  // can manage products, pricing, warehouses
 *     sellerCompanyId:  uuid | null,  // designated Elora seller company
 *     isLoading:        boolean,
 *     userProfile:      <profile>,
 *   }
 *
 * Reads from AuthContext for the user profile, and from
 * marketplaceSettingsOptions() for the seller company id (which is needed to
 * decide whether an `admin` role user is a marketplace admin or just an
 * admin of a buyer company).
 *
 * marketplace_settings is RLS-readable by every authenticated user
 * (singleton config row), so this fetch is universally safe.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { marketplaceSettingsOptions } from '@/query/options/marketplace';
import {
  canSeeMarketplace,
  canShopMarketplace,
  canAdministerMarketplace,
} from '@/lib/marketplacePermissions';

export function useMarketplaceAccess() {
  const { userProfile, isLoadingAuth } = useAuth();
  const { data: settings, isLoading: isLoadingSettings } = useQuery({
    ...marketplaceSettingsOptions(),
    // Settings is needed by every page that touches the marketplace nav. We
    // keep it cached for 5 minutes (already set in the option), but enable
    // only when there's a profile — there's no need to fetch settings before
    // the user is loaded.
    enabled: !!userProfile || !isLoadingAuth,
  });

  const sellerCompanyId = settings?.seller_company_id ?? null;

  // user_permissions row (granular flags) — AuthContext doesn't hydrate this
  // in M1; falling back to null is safe because the helper handles it.
  const userPermissions = userProfile?.permissions ?? null;

  return useMemo(() => ({
    canSee: canSeeMarketplace(userProfile, sellerCompanyId, userPermissions),
    canShop: canShopMarketplace(userProfile),
    canAdminister: canAdministerMarketplace(userProfile, sellerCompanyId, userPermissions),
    sellerCompanyId,
    isLoading: isLoadingAuth || isLoadingSettings,
    userProfile,
  }), [userProfile, sellerCompanyId, userPermissions, isLoadingAuth, isLoadingSettings]);
}

export default useMarketplaceAccess;
