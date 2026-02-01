import { queryOptions } from '@tanstack/react-query';
import { callEdgeFunction } from '@/lib/supabase';
import { queryKeys } from '../keys';

/**
 * Branding Query Options
 * 
 * White-label branding configuration.
 */

/**
 * Fetch branding for a company
 */
export const brandingOptions = (companyId) =>
  queryOptions({
    queryKey: queryKeys.tenant.branding(companyId),
    queryFn: async ({ signal }) => {
      const response = await callEdgeFunction('elora_get_branding', {
        company_id: companyId,
      });
      return response?.branding ?? response?.data ?? response;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes - branding rarely changes
    gcTime: 60 * 60 * 1000, // 1 hour
    enabled: !!companyId,
  });

/**
 * Fetch branding by email domain (for login page)
 */
export const brandingByDomainOptions = (domain) =>
  queryOptions({
    queryKey: queryKeys.tenant.brandingByDomain(domain),
    queryFn: async ({ signal }) => {
      if (!domain) return null;
      
      const response = await callEdgeFunction('elora_get_branding', {
        email_domain: domain,
      });
      return response?.branding ?? response?.data ?? response;
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    enabled: !!domain,
  });

/**
 * Fetch branding by custom domain (for white-label domains)
 */
export const brandingByCustomDomainOptions = (domain) =>
  queryOptions({
    queryKey: queryKeys.global.brandingByCustomDomain(domain),
    queryFn: async ({ signal }) => {
      if (!domain) return null;
      
      const response = await callEdgeFunction('elora_get_branding', {
        custom_domain: domain,
      });
      return response?.branding ?? response?.data ?? response;
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    enabled: !!domain,
  });
