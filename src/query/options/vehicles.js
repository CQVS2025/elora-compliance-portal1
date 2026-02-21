import { queryOptions } from '@tanstack/react-query';
import { callEdgeFunction } from '@/lib/supabase';
import { getEloraTenantContext } from '@/lib/eloraTenantContext';
import { queryKeys } from '../keys';

/**
 * Vehicle Query Options
 * 
 * Provides all vehicle-related queries with proper caching and tenant isolation.
 * API supports customer/site query params.
 */

/**
 * Fetch all vehicles with optional filters
 */
export const vehiclesOptions = (companyId, filters = {}) =>
  queryOptions({
    queryKey: queryKeys.tenant.vehicles(companyId, filters),
    queryFn: async ({ signal }) => {
      const { companyEloraCustomerRef, isSuperAdmin } = getEloraTenantContext();
      const customerRef =
        filters.customerId && filters.customerId !== 'all'
          ? filters.customerId
          : !isSuperAdmin && companyEloraCustomerRef
            ? companyEloraCustomerRef
            : filters.customerId;
      const siteRef = filters.siteId && filters.siteId !== 'all' ? filters.siteId : undefined;
      const params = { export: true };
      if (customerRef) {
        params.customer = customerRef;
        params.customer_id = customerRef;
        params.customerRef = customerRef;
      }
      if (siteRef) {
        params.site = siteRef;
        params.site_id = siteRef;
        params.siteRef = siteRef;
      }

      const response = await callEdgeFunction('elora_vehicles', params);
      return response?.data ?? response ?? [];
    },
    staleTime: 60000, // 1 minute - vehicles don't change often
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled: !!companyId,
  });

/**
 * Fetch single vehicle by ID
 */
export const vehicleOptions = (companyId, vehicleId) =>
  queryOptions({
    queryKey: queryKeys.tenant.vehicle(companyId, vehicleId),
    queryFn: async ({ signal }) => {
      // Assuming you have a single vehicle endpoint, otherwise fetch list and filter
      const response = await callEdgeFunction('elora_vehicles', {
        vehicle_id: vehicleId,
        export: true,
      });
      const vehicles = response?.data ?? response ?? [];
      return vehicles.find((v) => v.vehicleRef === vehicleId || v.internalVehicleId === vehicleId);
    },
    staleTime: 60000,
    enabled: !!companyId && !!vehicleId,
  });
