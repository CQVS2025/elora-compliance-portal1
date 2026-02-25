import { queryOptions } from '@tanstack/react-query';
import { callEdgeFunction } from '@/lib/supabase';
import { getEloraTenantContext } from '@/lib/eloraTenantContext';
import { queryKeys } from '../keys';

/**
 * Customer Query Options
 * 
 * Provides customer-related queries with tenant isolation.
 * API does not support customer filter; we fetch all and filter client-side for non-super-admin.
 */

/**
 * Fetch all customers
 * @param {string} companyId
 * @param {{ allTenants?: boolean }} opts - when allTenants is true, skip tenant filter (e.g. ELORA System ops log create form)
 */
export const customersOptions = (companyId, opts = {}) =>
  queryOptions({
    queryKey: [...queryKeys.tenant.customers(companyId), opts.allTenants ? 'allTenants' : null].filter(Boolean),
    queryFn: async ({ signal }) => {
      const response = await callEdgeFunction('elora_customers', {});
      let data = response?.data ?? response ?? [];
      const { companyEloraCustomerRef, isSuperAdmin } = getEloraTenantContext();
      const skipTenantFilter = opts.allTenants || isSuperAdmin;
      if (!skipTenantFilter && companyEloraCustomerRef && Array.isArray(data)) {
        data = data.filter((c) => {
          const ref = c.ref ?? c.id ?? null;
          if (ref == null) return true;
          return ref === companyEloraCustomerRef;
        });
      }
      return data.map((c) => ({
        id: c.ref,
        name: c.name,
        ref: c.ref,
      }));
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - customers rarely change
    gcTime: 30 * 60 * 1000, // 30 minutes
    enabled: !!companyId,
  });

/**
 * Fetch single customer
 */
export const customerOptions = (companyId, customerId) =>
  queryOptions({
    queryKey: queryKeys.tenant.customer(companyId, customerId),
    queryFn: async ({ signal }) => {
      const response = await callEdgeFunction('elora_customers', {});
      let customers = response?.data ?? response ?? [];
      const { companyEloraCustomerRef, isSuperAdmin } = getEloraTenantContext();
      if (!isSuperAdmin && companyEloraCustomerRef && Array.isArray(customers)) {
        customers = customers.filter((c) => {
          const ref = c.ref ?? c.id ?? null;
          if (ref == null) return true;
          return ref === companyEloraCustomerRef;
        });
      }
      return customers.find((c) => c.ref === customerId);
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!companyId && !!customerId,
  });
