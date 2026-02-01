import { queryOptions } from '@tanstack/react-query';
import { callEdgeFunction } from '@/lib/supabase';
import { queryKeys } from '../keys';

/**
 * Devices Query Options
 * 
 * Provides device health and status queries with tenant isolation.
 */

/**
 * Fetch devices with optional filters
 */
export const devicesOptions = (companyId, filters = {}) =>
  queryOptions({
    queryKey: queryKeys.tenant.devices(companyId, filters),
    queryFn: async ({ signal }) => {
      const params = {};
      
      if (filters.status) {
        params.status = filters.status;
      }
      if (filters.customerId && filters.customerId !== 'all') {
        params.customer_id = filters.customerId;
      }
      if (filters.siteId && filters.siteId !== 'all') {
        params.site_id = filters.siteId;
      }
      
      const response = await callEdgeFunction('elora_devices', params);
      return response?.data ?? response ?? [];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes - device status changes
    gcTime: 10 * 60 * 1000,
    enabled: !!companyId,
  });

/**
 * Fetch single device
 */
export const deviceOptions = (companyId, deviceId) =>
  queryOptions({
    queryKey: queryKeys.tenant.device(companyId, deviceId),
    queryFn: async ({ signal }) => {
      const response = await callEdgeFunction('elora_devices', { device_id: deviceId });
      const devices = response?.data ?? response ?? [];
      return devices.find((d) => d.id === deviceId || d.ref === deviceId);
    },
    staleTime: 2 * 60 * 1000,
    enabled: !!companyId && !!deviceId,
  });
