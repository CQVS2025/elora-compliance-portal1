import { queryOptions } from '@tanstack/react-query';
import { callEdgeFunction } from '@/lib/supabase';
import { queryKeys } from '../keys';

/**
 * Scans Query Options
 * 
 * Provides scan/wash-related queries with tenant isolation.
 */

/**
 * Fetch scans with optional filters
 */
export const scansOptions = (companyId, filters = {}) =>
  queryOptions({
    queryKey: queryKeys.tenant.scans(companyId, filters),
    queryFn: async ({ signal }) => {
      const response = await callEdgeFunction('elora_scans', filters);
      return response?.data ?? response ?? [];
    },
    staleTime: 30000, // 30 seconds - scans are real-time data
    gcTime: 5 * 60 * 1000,
    enabled: !!companyId,
  });
