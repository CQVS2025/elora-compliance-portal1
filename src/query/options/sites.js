import { queryOptions } from '@tanstack/react-query';
import { callEdgeFunction } from '@/lib/supabase';
import { queryKeys } from '../keys';

/**
 * Site Query Options
 * 
 * Provides site-related queries with tenant isolation.
 */

/**
 * Fetch all sites with optional filters
 */
export const sitesOptions = (companyId, filters = {}) =>
  queryOptions({
    queryKey: queryKeys.tenant.sites(companyId, filters),
    queryFn: async ({ signal }) => {
      const response = await callEdgeFunction('elora_sites', filters);
      const data = response?.data ?? response ?? [];
      
      // Transform to consistent format
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
      const sites = response?.data ?? response ?? [];
      return sites.find((s) => s.ref === siteId);
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!companyId && !!siteId,
  });
