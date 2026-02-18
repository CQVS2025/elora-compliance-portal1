import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDashboardFilters } from './useDashboardFilters';
import { usePermissions } from '@/components/auth/PermissionGuard';
import { customersOptions } from '@/query/options/customers';
import { sitesOptions } from '@/query/options/sites';
import { vehiclesOptions } from '@/query/options/vehicles';
import { BORAL_QLD_VEHICLES } from '@/data/washout-dummy-data';

/**
 * Returns true if the customer is BORAL QLD (demo data is for this customer only).
 * @param {{ name?: string, ref?: string }} customer
 */
export function isBoralQldCustomer(customer) {
  if (!customer) return false;
  const name = (customer.name || '').toUpperCase();
  return name.includes('BORAL') && name.includes('QLD');
}

/**
 * Normalize vehicles API response to a list of { vehicleRef, vehicleName, siteName, lastScan }.
 * Same source as Compliance page — ensures same vehicle count (e.g. 238 for BORAL-QLD).
 */
function getRealVehiclesFromVehiclesAPI(apiVehicles) {
  if (!Array.isArray(apiVehicles) || apiVehicles.length === 0) return [];
  return apiVehicles.map((v) => ({
    vehicleRef: v.vehicleRef ?? v.vehicle_ref ?? String(v.internalVehicleId ?? ''),
    vehicleName: v.vehicleName ?? v.vehicle_name ?? v.vehicleRef ?? '—',
    siteName: v.siteName ?? v.site_name ?? '',
    lastScan: v.lastScanAt ?? v.last_scan ?? v.lastScan ?? null,
  }));
}

/**
 * Merge real vehicle/site names from vehicles API with dummy washout metrics (WES, RPM, NTU, risk, etc.).
 * Uses vehicleName as vehicleId so the UI shows the same name as Compliance (e.g. "40146"), not vehicleRef.
 */
function mergeRealVehiclesWithDummyWashout(realVehicles, dummyPool, selectedSiteId, sites) {
  if (!realVehicles.length) return dummyPool;
  const pool = dummyPool.length ? dummyPool : BORAL_QLD_VEHICLES;
  let filtered = realVehicles;
  if (selectedSiteId && selectedSiteId !== 'all' && sites?.length) {
    const siteObj = sites.find((s) => s.id === selectedSiteId || s.ref === selectedSiteId);
    const siteName = siteObj?.name;
    if (siteName) {
      filtered = realVehicles.filter(
        (v) =>
          v.siteName === siteName ||
          (siteName && (siteName.includes(v.siteName) || (v.siteName && v.siteName.includes(siteName))))
      );
    }
  }
  return filtered.map((real, index) => {
    const dummy = pool[index % pool.length];
    let lastWashout = dummy.lastWashout;
    if (real.lastScan) {
      if (typeof real.lastScan === 'string') lastWashout = real.lastScan.slice(0, 19).replace('Z', '');
      else try { lastWashout = new Date(real.lastScan).toISOString().slice(0, 19).replace('Z', ''); } catch { /* keep dummy */ }
    }
    return {
      ...dummy,
      vehicleId: real.vehicleName,
      vehicleRef: real.vehicleRef,
      vehicleReference: real.vehicleRef,
      site: real.siteName || dummy.site,
      lastWashout,
      driver: dummy.driver,
    };
  });
}

/**
 * Hook for Washout Compliance pages: resolves dashboard filters (customer/site) and returns
 * BORAL QLD data only when the selected customer is BORAL QLD. When real dashboard/API data
 * is available for that customer, vehicle and site names are from the API; washout-specific
 * metrics (WES, RPM, NTU, risk) remain from dummy data until the washout API exists.
 */
export function useWashoutFilteredData() {
  const { selectedCustomer, selectedSite, dateRange: storedDateRange } = useDashboardFilters();
  const permissions = usePermissions();
  const companyId = permissions?.userProfile?.company_id;

  const dateRange = useMemo(() => {
    const start = storedDateRange?.start;
    const end = storedDateRange?.end;
    if (start && end) return { start, end };
    const now = new Date();
    const fallbackStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const fallbackEnd = now.toISOString().slice(0, 10);
    return { start: fallbackStart, end: fallbackEnd };
  }, [storedDateRange?.start, storedDateRange?.end]);

  const { data: customers = [], isLoading: customersLoading } = useQuery(
    customersOptions(companyId)
  );
  const { data: sites = [], isLoading: sitesLoading } = useQuery(
    sitesOptions(companyId, { customerId: selectedCustomer !== 'all' ? selectedCustomer : undefined })
  );
  const { data: allVehiclesFromAPI = [], isLoading: vehiclesLoading } = useQuery({
    ...vehiclesOptions(companyId, {
      customerId: selectedCustomer !== 'all' ? selectedCustomer : undefined,
      siteId: selectedSite !== 'all' ? selectedSite : undefined,
    }),
    enabled: !!companyId && !!selectedCustomer && selectedCustomer !== 'all',
  });

  return useMemo(() => {
    const noCustomerSelected = !selectedCustomer || selectedCustomer === 'all';
    const selectedCustomerObj = customers.find((c) => (c.ref || c.id) === selectedCustomer);
    const isBoralQld = selectedCustomerObj && isBoralQldCustomer(selectedCustomerObj);

    if (customersLoading || sitesLoading || vehiclesLoading) {
      return {
        isBoralQld: false,
        vehicles: [],
        vehiclesBySite: [],
        customerName: null,
        selectedSiteName: null,
        showEmptyState: false,
        isLoading: true,
        emptyMessage: null,
      };
    }

    if (noCustomerSelected) {
      return {
        isBoralQld: false,
        vehicles: [],
        vehiclesBySite: [],
        customerName: null,
        selectedSiteName: null,
        showEmptyState: true,
        isLoading: false,
        emptyMessage: 'Select a customer on the Compliance dashboard to view Washout Compliance data.',
      };
    }

    if (!isBoralQld) {
      const name = selectedCustomerObj?.name || selectedCustomer;
      return {
        isBoralQld: false,
        vehicles: [],
        vehiclesBySite: [],
        customerName: name,
        selectedSiteName: null,
        showEmptyState: true,
        isLoading: false,
        emptyMessage: `Washout Compliance is only available for BORAL — QLD. You have "${name}" selected. Go to Compliance and select BORAL — QLD to view this demo.`,
      };
    }

    // BORAL QLD selected: use vehicles API (same as Compliance) so count matches e.g. 238 vehicles
    const realVehicles = getRealVehiclesFromVehiclesAPI(allVehiclesFromAPI);
    let vehicles;
    let selectedSiteName = null;
    if (selectedSite && selectedSite !== 'all') {
      const siteObj = sites.find((s) => s.id === selectedSite || s.ref === selectedSite);
      if (siteObj?.name) selectedSiteName = siteObj.name;
    }
    if (realVehicles.length > 0) {
      vehicles = mergeRealVehiclesWithDummyWashout(realVehicles, BORAL_QLD_VEHICLES, selectedSite, sites);
    } else {
      vehicles = BORAL_QLD_VEHICLES;
      if (selectedSite && selectedSite !== 'all') {
        const siteObj = sites.find((s) => s.id === selectedSite || s.ref === selectedSite);
        if (siteObj?.name) {
          selectedSiteName = siteObj.name;
          vehicles = BORAL_QLD_VEHICLES.filter(
            (v) =>
              v.site === siteObj.name ||
              (siteObj.name && (siteObj.name.includes(v.site) || v.site.includes(siteObj.name)))
          );
        }
      }
    }

    const vehiclesBySite = vehicles;

    return {
      isBoralQld: true,
      vehicles,
      vehiclesBySite,
      customerName: selectedCustomerObj?.name || 'BORAL — QLD',
      selectedSiteName,
      showEmptyState: false,
      isLoading: false,
      emptyMessage: null,
    };
  }, [selectedCustomer, selectedSite, customers, sites, customersLoading, sitesLoading, vehiclesLoading, allVehiclesFromAPI]);
}
