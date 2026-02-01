import { queryOptions } from '@tanstack/react-query';
import { callEdgeFunction } from '@/lib/supabase';
import { queryKeys } from '../keys';

/**
 * Dashboard Query Options
 * 
 * Provides dashboard statistics and aggregated data with tenant isolation.
 */

/**
 * Fetch dashboard data (aggregated stats, charts, etc.)
 */
export const dashboardOptions = (companyId, filters = {}) =>
  queryOptions({
    queryKey: queryKeys.tenant.dashboard(companyId, filters),
    queryFn: async ({ signal }) => {
      const params = {};
      
      if (filters.customerId && filters.customerId !== 'all') {
        params.customer_id = filters.customerId;
      }
      if (filters.siteId && filters.siteId !== 'all') {
        params.site_id = filters.siteId;
      }
      if (filters.startDate) {
        params.start_date = filters.startDate;
      }
      if (filters.endDate) {
        params.end_date = filters.endDate;
      }
      
      const response = await callEdgeFunction('elora_dashboard', params);
      return response?.data ?? response;
    },
    staleTime: 30000, // 30 seconds - dashboard updates frequently
    gcTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!companyId,
  });

/**
 * Fetch recent activity
 */
export const recentActivityOptions = (companyId, filters = {}) =>
  queryOptions({
    queryKey: queryKeys.tenant.recentActivity(companyId, filters),
    queryFn: async ({ signal }) => {
      const response = await callEdgeFunction('elora_recent_activity', filters);
      return response?.data ?? response ?? [];
    },
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000,
    enabled: !!companyId,
  });
