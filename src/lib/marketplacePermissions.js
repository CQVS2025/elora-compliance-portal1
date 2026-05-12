/**
 * Marketplace Permissions
 *
 * Centralised access-control helpers for the marketplace module.
 *
 * Three distinct gates:
 *
 *   canSee         — can navigate to /marketplace pages.
 *                    True for marketplace admins (so they can preview the
 *                    buyer experience) AND any user whose company has
 *                    marketplace_enabled = true.
 *
 *   canShop        — can add to cart and (in M2) place orders.
 *                    Strictly tied to companies.marketplace_enabled.
 *                    Admins do not "shop" — they administer.
 *
 *   canAdminister  — can manage products, pricing, warehouses, customer
 *                    access. Resolution mirrors the SQL function
 *                    `public.is_marketplace_admin()`:
 *                      (a) super_admin role, OR
 *                      (b) 'admin' role AND user.company_id ===
 *                          marketplace_settings.seller_company_id, OR
 *                      (c) explicit user_permissions.marketplace_admin grant.
 *                    Admins of buyer companies are NOT marketplace admins.
 *
 * The server-side source of truth is the SECURITY DEFINER functions in
 * migration 1. These JS helpers gate UI only — RLS is the real defence.
 */

import { isAdmin, isSuperAdmin } from './permissions';

/**
 * Whether the user is a marketplace admin.
 * Mirrors public.is_marketplace_admin() in SQL.
 *
 * @param userProfile      auth user's profile (must include company_id and role)
 * @param sellerCompanyId  marketplace_settings.seller_company_id, or null
 * @param userPermissions  optional user_permissions row (granular grants);
 *                         M1 doesn't yet hydrate this on userProfile, so the
 *                         third branch is unused unless explicitly passed.
 */
export function isMarketplaceAdmin(userProfile, sellerCompanyId = null, userPermissions = null) {
  if (!userProfile) return false;

  // (a) super_admin — platform-wide
  if (isSuperAdmin(userProfile)) return true;

  // (b) 'admin' role, but ONLY for the seller company
  if (
    isAdmin(userProfile)
    && sellerCompanyId
    && userProfile.company_id
    && userProfile.company_id === sellerCompanyId
  ) {
    return true;
  }

  // (c) explicit user_permissions grant
  if (userPermissions?.marketplace_admin === true) return true;

  return false;
}

/**
 * Whether the user's company has the marketplace enabled.
 * Mirrors public.user_marketplace_enabled() in SQL.
 *
 * Reads from userProfile.marketplace_enabled, which AuthContext flattens
 * onto the profile when loading the company row.
 */
export function isCompanyMarketplaceEnabled(userProfile) {
  if (!userProfile) return false;
  if (userProfile.marketplace_enabled === true) return true;
  if (userProfile.company?.marketplace_enabled === true) return true;
  return false;
}

/**
 * Whether the user can navigate the buyer-facing /marketplace pages.
 * Admins can always see (preview); buyers need their company enabled.
 */
export function canSeeMarketplace(userProfile, sellerCompanyId = null, userPermissions = null) {
  if (!userProfile) return false;
  if (isMarketplaceAdmin(userProfile, sellerCompanyId, userPermissions)) return true;
  return isCompanyMarketplaceEnabled(userProfile);
}

/**
 * Whether the user can shop (add to cart, M2: place orders).
 * Strictly company-enabled — admins do not shop.
 */
export function canShopMarketplace(userProfile) {
  if (!userProfile) return false;
  return isCompanyMarketplaceEnabled(userProfile);
}

/**
 * Whether the user can administer marketplace data.
 */
export function canAdministerMarketplace(userProfile, sellerCompanyId = null, userPermissions = null) {
  return isMarketplaceAdmin(userProfile, sellerCompanyId, userPermissions);
}

export default {
  isMarketplaceAdmin,
  isCompanyMarketplaceEnabled,
  canSeeMarketplace,
  canShopMarketplace,
  canAdministerMarketplace,
};
