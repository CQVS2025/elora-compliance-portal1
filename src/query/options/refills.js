import { queryOptions } from '@tanstack/react-query';
import { callEdgeFunction } from '@/lib/supabase';
import { getEloraTenantContext } from '@/lib/eloraTenantContext';
import { queryKeys } from '../keys';

/**
 * Refills Query Options
 *
 * Provides refill-related queries with tenant isolation.
 * Sends customerRef for non-super-admin; filters response by customerRef when API returns it.
 */

/**
 * Build request params: backend expects customerRef, siteRef, startDate/fromDate, endDate/toDate
 */
function buildRefillsParams(filters, tenantContext) {
  const { companyEloraCustomerRef, isSuperAdmin } = tenantContext;
  const params = { export: true };

  if (filters.customerRef && filters.customerRef !== 'all') {
    params.customerRef = filters.customerRef;
  } else if (!isSuperAdmin && companyEloraCustomerRef) {
    params.customerRef = companyEloraCustomerRef;
  }
  if (filters.siteRef && filters.siteRef !== 'all') {
    params.siteRef = filters.siteRef;
  }
  const startDate = filters.startDate ?? filters.fromDate;
  const endDate = filters.endDate ?? filters.toDate;
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;
  if (filters.fromDate != null) params.fromDate = filters.fromDate;
  if (filters.toDate != null) params.toDate = filters.toDate;
  if (filters.status != null) params.status = filters.status;

  return params;
}

/**
 * Filter refills array by tenant customerRef when API populates it.
 * When customerRef is null we trust backend filtering (customerRef was sent).
 */
function filterRefillsByTenant(data, companyEloraCustomerRef) {
  if (!Array.isArray(data) || !companyEloraCustomerRef) return data;
  return data.filter((item) => {
    const ref = item.customerRef ?? item.customer_ref ?? null;
    if (ref == null) return true; // trust backend filter
    return ref === companyEloraCustomerRef;
  });
}

/**
 * Fetch refills with optional filters
 */
export const refillsOptions = (companyId, filters = {}) =>
  queryOptions({
    queryKey: queryKeys.tenant.refills(companyId, filters),
    queryFn: async ({ signal }) => {
      const tenantContext = getEloraTenantContext();
      const params = buildRefillsParams(filters, tenantContext);
      const response = await callEdgeFunction('elora_refills', params);

      const dataArray = response?.data ?? response ?? [];
      const list = Array.isArray(dataArray) ? dataArray : [];

      if (tenantContext.isSuperAdmin) {
        return list;
      }

      const { companyEloraCustomerRef } = tenantContext;
      if (!companyEloraCustomerRef) {
        return [];
      }

      return filterRefillsByTenant(list, companyEloraCustomerRef);
    },
    staleTime: 60000, // 1 minute
    gcTime: 10 * 60 * 1000,
    enabled: !!companyId,
  });
