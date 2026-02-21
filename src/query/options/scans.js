import { queryOptions } from '@tanstack/react-query';
import { callEdgeFunction } from '@/lib/supabase';
import { getEloraTenantContext } from '@/lib/eloraTenantContext';
import { queryKeys } from '../keys';

/**
 * Scans Query Options
 *
 * Aligned with GET /api/scans:
 * - fromDate, toDate (date range)
 * - customerId/customer, siteId/site, vehicleId/vehicle, deviceId/device (filters)
 * - status (CSV: 1,2,4 or success,exceeded,auto,refills)
 * - page (1-based), pageSize (max 1000), export (1|true|all to disable pagination)
 * Response: { total, page, pageSize, pageCount, data[] }
 */

/**
 * Build request params per API spec. Sends both API names and legacy snake_case for backend compatibility.
 */
function buildScansParams(filters, tenantContext) {
  const { companyEloraCustomerRef, isSuperAdmin } = tenantContext;
  const params = {};

  // Date range – API: fromDate, toDate (dd/mm/yyyy or yyyy-mm-dd)
  const fromDate = filters.fromDate ?? filters.startDate ?? filters.start_date;
  const toDate = filters.toDate ?? filters.endDate ?? filters.end_date;
  if (fromDate) {
    params.fromDate = fromDate;
    params.start_date = fromDate;
  }
  if (toDate) {
    params.toDate = toDate;
    params.end_date = toDate;
  }

  // Customer – API: customerId or customer (customers_ref)
  const customerRef = filters.customerId != null && filters.customerId !== 'all'
    ? filters.customerId
    : !isSuperAdmin && companyEloraCustomerRef
      ? companyEloraCustomerRef
      : filters.customer;
  if (customerRef) {
    params.customerId = customerRef;
    params.customer = customerRef;
    params.customer_id = customerRef;
  }

  // Site – API: siteId or site
  if (filters.siteId != null && filters.siteId !== 'all') {
    params.siteId = filters.siteId;
    params.site = filters.siteId;
    params.site_id = filters.siteId;
  }

  // Vehicle – API: vehicleId or vehicle (contacts_ref)
  if (filters.vehicleId != null && filters.vehicleId !== 'all') {
    params.vehicleId = filters.vehicleId;
    params.vehicle = filters.vehicleId;
  }

  // Device – API: deviceId or device (devices_ref)
  if (filters.deviceId != null && filters.deviceId !== 'all') {
    params.deviceId = filters.deviceId;
    params.device = filters.deviceId;
  }

  // Status – API: CSV of IDs or names (1,2,4 or success,exceeded,auto,refills)
  if (filters.status != null) params.status = filters.status;

  // Export – API: 1, true or all to disable pagination and return all rows.
  // Use 'true' so ACATC returns full result set (some backends expect true rather than 'all').
  const useExportAll = filters.export != null ? filters.export : true;
  params.export = useExportAll;

  // Pagination – only when explicitly requesting a page (otherwise export=all is used)
  if (filters.page != null) params.page = filters.page;
  if (filters.pageSize != null) params.pageSize = Math.min(Number(filters.pageSize) || 100, 1000);

  return params;
}

/**
 * Filter scans array by tenant customerRef when API populates it.
 * When customerRef is null we trust backend filtering (customer_id was sent).
 */
function filterScansByTenant(data, companyEloraCustomerRef) {
  if (!Array.isArray(data) || !companyEloraCustomerRef) return data;
  return data.filter((item) => {
    const ref = item.customerRef ?? item.customer_ref ?? null;
    if (ref == null) return true; // trust backend filter
    return ref === companyEloraCustomerRef;
  });
}

/**
 * Fetch scans with optional filters.
 * When filters include page/pageSize and API returns paginated shape, returns
 * { data, total, page, pageCount, pageSize } so UI can show page controls.
 * Otherwise returns the data array only.
 */
export const scansOptions = (companyId, filters = {}) =>
  queryOptions({
    queryKey: queryKeys.tenant.scans(companyId, filters),
    queryFn: async ({ signal }) => {
      const tenantContext = getEloraTenantContext();
      const params = buildScansParams(filters, tenantContext);
      const response = await callEdgeFunction('elora_scans', params);

      const dataArray = response?.data ?? response ?? [];
      const list = Array.isArray(dataArray) ? dataArray : [];
      const filteredList = tenantContext.isSuperAdmin
        ? list
        : tenantContext.companyEloraCustomerRef
          ? filterScansByTenant(list, tenantContext.companyEloraCustomerRef)
          : [];

      const requestedPage = filters.page != null;
      const hasPagination =
        requestedPage &&
        response != null &&
        typeof response === 'object' &&
        'total' in response &&
        typeof response.total === 'number';

      if (hasPagination) {
        return {
          data: filteredList,
          total: response.total,
          page: response.page ?? filters.page ?? 1,
          pageCount: response.pageCount ?? 1,
          pageSize: response.pageSize ?? filters.pageSize ?? 100,
        };
      }

      return filteredList;
    },
    staleTime: 30000, // 30 seconds - scans are real-time data
    gcTime: 5 * 60 * 1000,
    enabled: !!companyId,
  });
