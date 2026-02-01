import { queryOptions } from '@tanstack/react-query';
import { callEdgeFunction } from '@/lib/supabase';
import { queryKeys } from '../keys';

/**
 * Vehicle Query Options
 * 
 * Provides all vehicle-related queries with proper caching and tenant isolation.
 */

/**
 * Fetch all vehicles with optional filters
 */
export const vehiclesOptions = (companyId, filters = {}) =>
  queryOptions({
    queryKey: queryKeys.tenant.vehicles(companyId, filters),
    queryFn: async ({ signal }) => {
      const params = {
        customer_id: filters.customerId,
        site_id: filters.siteId,
      };
      
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
      });
      const vehicles = response?.data ?? response ?? [];
      return vehicles.find((v) => v.vehicleRef === vehicleId || v.internalVehicleId === vehicleId);
    },
    staleTime: 60000,
    enabled: !!companyId && !!vehicleId,
  });
