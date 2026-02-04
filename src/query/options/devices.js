import { queryOptions } from '@tanstack/react-query';
import { callEdgeFunction } from '@/lib/supabase';
import { getEloraTenantContext } from '@/lib/eloraTenantContext';
import { queryKeys } from '../keys';

/**
 * Devices Query Options
 * 
 * Provides device health and status queries with tenant isolation.
 * APIs: Devices++ (devices2) supports customer_ref; if backend does not, we filter client-side.
 */

/**
 * Fetch devices with optional filters
 */
export const devicesOptions = (companyId, filters = {}) =>
  queryOptions({
    queryKey: queryKeys.tenant.devices(companyId, filters),
    queryFn: async ({ signal }) => {
      const { companyEloraCustomerRef, isSuperAdmin } = getEloraTenantContext();
      const params = {};

      if (filters.status) {
        params.status = filters.status;
      }
      if (filters.customerId && filters.customerId !== 'all') {
        params.customer_id = filters.customerId;
      } else if (!isSuperAdmin && companyEloraCustomerRef) {
        params.customer_id = companyEloraCustomerRef;
      }
      if (filters.siteId && filters.siteId !== 'all') {
        params.site_id = filters.siteId;
      }

      const response = await callEdgeFunction('elora_devices', params);
      // API returns { total, data: [...] }; edge returns that as-is. Use .data so we never treat wrapper as list.
      let data = Array.isArray(response) ? response : (response?.data ?? []);
      // Client-side tenant filter if API does not support customer filter (e.g. GET /api/devices).
      // Include items with null customerRef (trust backend); only exclude when ref differs.
      if (!isSuperAdmin && companyEloraCustomerRef && Array.isArray(data)) {
        data = data.filter((d) => {
          const ref = d.customerRef ?? d.customer_ref ?? null;
          if (ref == null) return true;
          return ref === companyEloraCustomerRef;
        });
      }
      return data;
    },
    staleTime: 30 * 1000, // 30s - lastScanAt changes frequently; match old platform behaviour
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
