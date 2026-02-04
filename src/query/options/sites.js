import { queryOptions } from '@tanstack/react-query';
import { callEdgeFunction } from '@/lib/supabase';
import { getEloraTenantContext } from '@/lib/eloraTenantContext';
import { queryKeys } from '../keys';

/**
 * Site Query Options
 * 
 * Provides site-related queries with tenant isolation.
 * API does not support filters; we fetch all and filter client-side for non-super-admin.
 */

/**
 * Fetch all sites with optional filters
 */
export const sitesOptions = (companyId, filters = {}) =>
  queryOptions({
    queryKey: queryKeys.tenant.sites(companyId, filters),
    queryFn: async ({ signal }) => {
      const response = await callEdgeFunction('elora_sites', filters);
      let data = response?.data ?? response ?? [];
      const { companyEloraCustomerRef, isSuperAdmin } = getEloraTenantContext();
      // Include items with null customer ref (trust backend); only exclude when ref differs.
      if (!isSuperAdmin && companyEloraCustomerRef && Array.isArray(data)) {
        data = data.filter((s) => {
          const ref = s.customerRef ?? s.customer_ref ?? s.customer ?? null;
          if (ref == null) return true;
          return ref === companyEloraCustomerRef;
        });
      }
      return data.map((s) => ({
        id: s.ref,
        name: s.siteName,
        ref: s.ref,
        customer_ref: s.customerRef,
        address: s.address,
        city: s.city,
        state: s.state,
        postcode: s.postcode,
      }));
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    enabled: !!companyId,
  });

/**
 * Fetch single site
 */
export const siteOptions = (companyId, siteId) =>
  queryOptions({
    queryKey: queryKeys.tenant.site(companyId, siteId),
    queryFn: async ({ signal }) => {
      const response = await callEdgeFunction('elora_sites', { site_id: siteId });
      let sites = response?.data ?? response ?? [];
      const { companyEloraCustomerRef, isSuperAdmin } = getEloraTenantContext();
      if (!isSuperAdmin && companyEloraCustomerRef && Array.isArray(sites)) {
        sites = sites.filter((s) => {
          const ref = s.customerRef ?? s.customer_ref ?? s.customer ?? null;
          if (ref == null) return true;
          return ref === companyEloraCustomerRef;
        });
      }
      return sites.find((s) => s.ref === siteId);
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!companyId && !!siteId,
  });
