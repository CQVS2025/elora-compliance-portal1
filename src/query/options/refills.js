import { queryOptions } from '@tanstack/react-query';
import { callEdgeFunction } from '@/lib/supabase';
import { queryKeys } from '../keys';

/**
 * Refills Query Options
 * 
 * Provides refill-related queries with tenant isolation.
 */

/**
 * Fetch refills with optional filters
 */
export const refillsOptions = (companyId, filters = {}) =>
  queryOptions({
    queryKey: queryKeys.tenant.refills(companyId, filters),
    queryFn: async ({ signal }) => {
      const params = {};
      
      if (filters.customerRef && filters.customerRef !== 'all') {
        params.customerRef = filters.customerRef;
      }
      if (filters.siteRef && filters.siteRef !== 'all') {
        params.siteRef = filters.siteRef;
      }
      if (filters.startDate) {
        params.startDate = filters.startDate;
      }
      if (filters.endDate) {
        params.endDate = filters.endDate;
      }
      
      const response = await callEdgeFunction('elora_refills', params);
      return response?.data ?? response ?? [];
    },
    staleTime: 60000, // 1 minute
    gcTime: 10 * 60 * 1000,
    enabled: !!companyId,
  });
