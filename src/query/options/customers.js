import { queryOptions } from '@tanstack/react-query';
import { callEdgeFunction } from '@/lib/supabase';
import { queryKeys } from '../keys';

/**
 * Customer Query Options
 * 
 * Provides customer-related queries with tenant isolation.
 */

/**
 * Fetch all customers
 */
export const customersOptions = (companyId) =>
  queryOptions({
    queryKey: queryKeys.tenant.customers(companyId),
    queryFn: async ({ signal }) => {
      const response = await callEdgeFunction('elora_customers', {});
      const data = response?.data ?? response ?? [];
      
      // Transform to consistent format
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
      const customers = response?.data ?? response ?? [];
      return customers.find((c) => c.ref === customerId);
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!companyId && !!customerId,
  });
