import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import moment from 'moment';
import {
  customersOptions,
  sitesOptions,
  vehiclesOptions,
} from '@/query/options';
import { usePermissions, useFilteredData } from '@/components/auth/PermissionGuard';
import FilterSection from '@/components/dashboard/FilterSection';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import DataPagination from '@/components/ui/DataPagination';
import { ImageIcon, Search, Loader2 } from 'lucide-react';

const FILTER_STORAGE_KEY = 'elora-dashboard-filters';
const getDefaultFilters = () => ({
  selectedCustomer: 'all',
  selectedSite: 'all',
  selectedDriverIds: [],
  selectedDeviceId: 'all',
  dateRange: {
    start: moment().startOf('month').format('YYYY-MM-DD'),
    end: moment().format('YYYY-MM-DD'),
  },
  activePeriod: 'Month',
});

function getInitialFilters() {
  try {
    const raw = typeof sessionStorage !== 'undefined' && sessionStorage.getItem(FILTER_STORAGE_KEY);
    if (!raw) return getDefaultFilters();
    const parsed = JSON.parse(raw);
    const defaults = getDefaultFilters();
    return {
      selectedCustomer: parsed.selectedCustomer ?? defaults.selectedCustomer,
      selectedSite: parsed.selectedSite ?? defaults.selectedSite,
      selectedDriverIds: Array.isArray(parsed.selectedDriverIds) ? parsed.selectedDriverIds : defaults.selectedDriverIds,
      selectedDeviceId: parsed.selectedDeviceId ?? defaults.selectedDeviceId,
      dateRange: parsed.dateRange?.start && parsed.dateRange?.end
        ? { start: parsed.dateRange.start, end: parsed.dateRange.end }
        : defaults.dateRange,
      activePeriod: parsed.activePeriod ?? defaults.activePeriod,
    };
  } catch {
    return getDefaultFilters();
  }
}

export default function VehicleImageLog() {
  const permissions = usePermissions();
  const companyId = permissions.userProfile?.company_id;

  const [sharedFilters, setSharedFilters] = useState(getInitialFilters);
  const { selectedCustomer, selectedSite, selectedDriverIds = [] } = sharedFilters;
  const [searchQuery, setSearchQuery] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    try {
      sessionStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(sharedFilters));
    } catch {}
  }, [sharedFilters]);

  const updateSharedFilter = useCallback((updates) => {
    setSharedFilters((prev) => {
      const next = { ...prev, ...updates };
      if (updates.selectedCustomer != null && updates.selectedCustomer !== prev.selectedCustomer) {
        next.selectedSite = 'all';
        next.selectedDriverIds = [];
        next.selectedDeviceId = 'all';
      }
      if (updates.selectedSite != null && updates.selectedSite !== prev.selectedSite) {
        next.selectedDriverIds = [];
        next.selectedDeviceId = 'all';
      }
      return next;
    });
  }, []);

  const setSelectedCustomer = useCallback((v) => updateSharedFilter({ selectedCustomer: v }), [updateSharedFilter]);
  const setSelectedSite = useCallback((v) => updateSharedFilter({ selectedSite: v }), [updateSharedFilter]);
  const setSelectedDriverIds = useCallback((v) => updateSharedFilter({ selectedDriverIds: v }), [updateSharedFilter]);
  const handleResetFilters = useCallback(() => setSharedFilters(getDefaultFilters()), []);

  const { data: customers = [] } = useQuery(customersOptions(companyId));
  const { data: rawSites = [] } = useQuery(
    sitesOptions(companyId, { customerId: selectedCustomer !== 'all' ? selectedCustomer : undefined })
  );
  const selectedDriverKey = selectedDriverIds?.length ? selectedDriverIds.slice().sort().join(',') : undefined;
  const { data: allVehicles = [], isLoading: vehiclesLoading, isFetching: vehiclesFetching, dataUpdatedAt: vehiclesUpdatedAt } = useQuery({
    ...vehiclesOptions(companyId, {
      customerId: selectedCustomer !== 'all' ? selectedCustomer : undefined,
      siteId: selectedSite !== 'all' ? selectedSite : undefined,
      selectedDriverIds: selectedDriverKey,
    }),
    placeholderData: (p) => p,
  });

  const vehiclesForFilter = useMemo(
    () =>
      allVehicles.map((v) => ({
        id: v.vehicleRef || v.internalVehicleId,
        vehicleRef: v.vehicleRef,
        name: v.vehicleName ?? v.name,
        site_id: v.siteId,
        customer_ref: v.customerId ?? v.customerRef,
        customer_name: v.customerName,
        site_name: v.siteName,
      })),
    [allVehicles]
  );
  const { filteredVehicles: permissionFilteredVehicles, filteredSites: permissionFilteredSites } = useFilteredData(
    vehiclesForFilter,
    rawSites,
    customers
  );

  const filteredCustomers = useMemo(() => {
    if (permissionFilteredSites.length === 0 && permissionFilteredVehicles?.length > 0) {
      const refs = new Set(permissionFilteredVehicles.map((v) => v.customer_ref).filter(Boolean));
      return customers.filter((c) => refs.has(c.id));
    }
    const refs = new Set(permissionFilteredSites.map((s) => s.customer_ref).filter(Boolean));
    return customers.filter((c) => refs.has(c.id));
  }, [permissionFilteredSites, permissionFilteredVehicles, customers]);

  const allSites = useMemo(() => {
    if (selectedCustomer === 'all' || !selectedCustomer) return permissionFilteredSites;
    return permissionFilteredSites.filter((s) => s.customer_ref === selectedCustomer || s.id === selectedCustomer);
  }, [permissionFilteredSites, selectedCustomer]);

  const vehiclesAfterCustomerSite = useMemo(() => {
    let result = permissionFilteredVehicles || [];
    const sitesForFilter = allSites.length > 0 ? allSites : permissionFilteredSites;
    if (selectedCustomer && selectedCustomer !== 'all' && sitesForFilter.length > 0) {
      const siteIds = sitesForFilter.filter((s) => s.customer_ref === selectedCustomer || s.id === selectedCustomer).map((s) => s.id);
      result = result.filter((v) => siteIds.includes(v.site_id));
    }
    if (selectedSite && selectedSite !== 'all') result = result.filter((v) => v.site_id === selectedSite);
    return result;
  }, [permissionFilteredVehicles, selectedCustomer, selectedSite, permissionFilteredSites, allSites]);

  const filteredVehicles = useMemo(() => {
    let list = vehiclesAfterCustomerSite || [];
    if (selectedDriverIds?.length) {
      const idSet = new Set(selectedDriverIds.map(String));
      list = list.filter((v) => idSet.has(String(v.id ?? v.vehicleRef ?? '')));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (v) =>
          (v.name && v.name.toLowerCase().includes(q)) ||
          (v.vehicleRef && String(v.vehicleRef).toLowerCase().includes(q)) ||
          (v.customer_name && v.customer_name.toLowerCase().includes(q)) ||
          (v.site_name && v.site_name.toLowerCase().includes(q))
      );
    }
    return list;
  }, [vehiclesAfterCustomerSite, selectedDriverIds, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredVehicles.length / itemsPerPage));
  const paginatedVehicles = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredVehicles.slice(start, start + itemsPerPage);
  }, [filteredVehicles, currentPage, itemsPerPage]);

  const lockCustomerFilter = !permissions.isSuperAdmin;
  const restrictedCustomerName = !permissions.isSuperAdmin && permissions.userProfile?.company_name ? permissions.userProfile.company_name : null;
  useEffect(() => {
    const companyRef = permissions.userProfile?.company_elora_customer_ref?.trim();
    if (permissions.isSuperAdmin || !companyRef) return;
    setSharedFilters((prev) => (prev.selectedCustomer === companyRef ? prev : { ...prev, selectedCustomer: companyRef, selectedSite: prev.selectedSite || 'all' }));
  }, [permissions.isSuperAdmin, permissions.userProfile?.company_elora_customer_ref]);

  const lastSyncedAt = vehiclesUpdatedAt || null;
  const isFiltersFetching = vehiclesFetching;

  return (
    <div className="w-full min-h-0 flex flex-col p-4 sm:p-6 lg:p-8">
      <FilterSection
        customers={filteredCustomers}
        sites={allSites}
        selectedCustomer={selectedCustomer}
        setSelectedCustomer={setSelectedCustomer}
        selectedSite={selectedSite}
        setSelectedSite={setSelectedSite}
        vehiclesForDriverFilter={vehiclesAfterCustomerSite}
        selectedDriverIds={selectedDriverIds}
        setSelectedDriverIds={setSelectedDriverIds}
        companyName={permissions.userProfile?.company_name}
        companyLogoUrl={permissions.userProfile?.company_logo_url}
        lockCustomerFilter={lockCustomerFilter}
        restrictedCustomerName={restrictedCustomerName}
        isFiltering={isFiltersFetching}
        filterQueriesFetching={isFiltersFetching}
        isDataLoading={vehiclesLoading}
        lastSyncedAt={lastSyncedAt}
        hideDeviceFilter
        hideDateRange
        onResetDateRange={handleResetFilters}
      />

      <Card className="flex-1 min-h-0 flex flex-col mt-4">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Vehicle Image Log
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by vehicle or site..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 w-[220px]"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 overflow-auto">
          {vehiclesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredVehicles.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No vehicles match the current filters. Adjust customer, site, or search.
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedVehicles.map((v) => (
                    <TableRow key={v.id ?? v.vehicleRef}>
                      <TableCell>{v.customer_name ?? '—'}</TableCell>
                      <TableCell>{v.site_name ?? '—'}</TableCell>
                      <TableCell>{v.name ?? v.vehicleRef ?? '—'}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                        >
                          <Link
                            to={`/vehicle/${v.vehicleRef ?? v.id}`}
                            state={{ fromVehicleImageLog: true }}
                            className="gap-1"
                          >
                            <ImageIcon className="h-4 w-4" />
                            View / Add images
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <DataPagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredVehicles.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={(v) => { setItemsPerPage(v); setCurrentPage(1); }}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
