import { queryOptions } from '@tanstack/react-query';
import { callEdgeFunction } from '@/lib/supabase';
import { getEloraTenantContext } from '@/lib/eloraTenantContext';
import { queryKeys } from '../keys';

/**
 * Dashboard Query Options
 * 
 * Provides dashboard statistics and aggregated data with tenant isolation.
 * API supports customer/site query params.
 */

/**
 * Fetch dashboard data (aggregated stats, charts, etc.)
 */
export const dashboardOptions = (companyId, filters = {}) =>
  queryOptions({
    queryKey: queryKeys.tenant.dashboard(companyId, filters),
    queryFn: async ({ signal }) => {
      const { companyEloraCustomerRef, isSuperAdmin } = getEloraTenantContext();
      const params = { export: true };

      if (filters.customerId && filters.customerId !== 'all') {
        params.customer_id = filters.customerId;
      } else if (!isSuperAdmin && companyEloraCustomerRef) {
        params.customer_id = companyEloraCustomerRef;
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
      const { companyEloraCustomerRef, isSuperAdmin } = getEloraTenantContext();
      const params = { ...filters };
      if (!isSuperAdmin && companyEloraCustomerRef) {
        params.customer_id = params.customer_id ?? companyEloraCustomerRef;
        params.customerRef = params.customerRef ?? companyEloraCustomerRef;
      }
      const response = await callEdgeFunction('elora_recent_activity', params);
      return response?.data ?? response ?? [];
    },
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000,
    enabled: !!companyId,
  });
