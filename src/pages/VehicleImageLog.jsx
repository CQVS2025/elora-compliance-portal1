import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import moment from 'moment';
import {
  customersOptions,
  companiesOptions,
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ImageIcon, Search, Loader2, LayoutGrid, List, Building2, Truck, ChevronRight, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const navigate = useNavigate();
  const permissions = usePermissions();
  const companyId = permissions.userProfile?.company_id;

  const [viewMode, setViewMode] = useState('gallery'); // 'list' | 'gallery'
  const [galleryCompanyRef, setGalleryCompanyRef] = useState(null); // when in gallery, selected company (customer ref) for showing vehicles
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
  const { data: companiesRaw = [] } = useQuery({
    ...companiesOptions(companyId ?? 'all'),
    enabled: !!companyId || permissions.isSuperAdmin,
  });
  const customerRefToCompany = useMemo(() => {
    const m = {};
    (companiesRaw || []).forEach((c) => {
      const ref = c.elora_customer_ref;
      if (ref != null && ref !== '') m[String(ref)] = c;
    });
    return m;
  }, [companiesRaw]);
  const { data: rawSites = [] } = useQuery(
    sitesOptions(companyId, { customerId: selectedCustomer !== 'all' ? selectedCustomer : undefined })
  );
  const selectedDriverKey = selectedDriverIds?.length ? selectedDriverIds.slice().sort().join(',') : undefined;
  // In gallery mode fetch all vehicles (no customer/site filter) so we can show by company; in list mode use filters
  const effectiveCustomerForQuery =
    viewMode === 'gallery' ? undefined : selectedCustomer !== 'all' ? selectedCustomer : undefined;
  const effectiveSiteForQuery =
    viewMode === 'gallery' ? undefined : selectedSite !== 'all' ? selectedSite : undefined;
  const effectiveDriverKey = viewMode === 'gallery' ? undefined : selectedDriverKey;

  const { data: allVehicles = [], isLoading: vehiclesLoading, isFetching: vehiclesFetching, dataUpdatedAt: vehiclesUpdatedAt } = useQuery({
    ...vehiclesOptions(companyId, {
      customerId: effectiveCustomerForQuery,
      siteId: effectiveSiteForQuery,
      selectedDriverIds: effectiveDriverKey,
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

  // In gallery view, vehicles for the selected company only
  const galleryVehiclesForCompany = useMemo(() => {
    if (viewMode !== 'gallery' || !galleryCompanyRef) return [];
    return (permissionFilteredVehicles || []).filter(
      (v) => String(v.customer_ref ?? '') === String(galleryCompanyRef)
    );
  }, [viewMode, galleryCompanyRef, permissionFilteredVehicles]);

  const galleryCompanyName = useMemo(() => {
    if (!galleryCompanyRef) return null;
    const c = (filteredCustomers || []).find(
      (x) => String(x.id ?? x.ref ?? '') === String(galleryCompanyRef)
    );
    return c?.name ?? galleryCompanyRef;
  }, [galleryCompanyRef, filteredCustomers]);

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
      {viewMode === 'list' && (
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
      )}

      <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between mt-4">
        <div className="min-w-0">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-1 flex-wrap">
            {viewMode === 'gallery' && galleryCompanyRef && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setGalleryCompanyRef(null)}
                className="shrink-0 gap-1.5 -ml-1"
              >
                <ArrowLeft className="size-4" />
                Back
              </Button>
            )}
            <button
              type="button"
              onClick={() => setGalleryCompanyRef(null)}
              className="hover:text-foreground transition-colors shrink-0"
            >
              Vehicle Image Log
            </button>
            {viewMode === 'gallery' && galleryCompanyName && (
              <>
                <ChevronRight className="size-4 shrink-0" />
                <span className="text-foreground font-medium truncate max-w-[200px] sm:max-w-[280px]">
                  {galleryCompanyName}
                </span>
              </>
            )}
          </nav>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight truncate">Vehicle Image Log</h1>
          <p className="text-sm text-muted-foreground">
            {viewMode === 'list'
              ? 'Upload and view vehicle images. Use filters or switch to gallery to browse by company.'
              : 'Select a company to see its vehicles, then open a vehicle to upload or view images.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(v) => {
              if (v) setViewMode(v);
              if (v === 'list') setGalleryCompanyRef(null);
            }}
            className="border rounded-md inline-flex"
          >
            <ToggleGroupItem value="list" aria-label="List view" className="px-3 gap-1.5">
              <List className="size-4" />
              List
            </ToggleGroupItem>
            <ToggleGroupItem value="gallery" aria-label="Gallery view" className="px-3 gap-1.5">
              <LayoutGrid className="size-4" />
              Gallery
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {/* List view: table */}
      {viewMode === 'list' && (
        <Card className="flex-1 min-h-0 flex flex-col mt-4">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Vehicles
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
                          <Button variant="ghost" size="sm" asChild>
                            <Link
                              to={`/vehicle-image-log/vehicle/${v.vehicleRef ?? v.id}`}
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
      )}

      {/* Gallery view: companies */}
      {viewMode === 'gallery' && !galleryCompanyRef && (
        <div className="space-y-4 mt-4">
          {vehiclesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredCustomers.map((c) => {
                const company = customerRefToCompany[String(c.id ?? c.ref)];
                const logoUrl = company?.logo_url;
                const displayName = company?.name ?? c.name ?? c.id ?? '—';
                return (
                  <button
                    key={c.id ?? c.ref}
                    type="button"
                    onClick={() => setGalleryCompanyRef(String(c.id ?? c.ref))}
                    className={cn(
                      'rounded-xl border border-border bg-card p-5 text-left shadow-sm transition-all',
                      'hover:border-primary/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2'
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className="size-14 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
                        {logoUrl ? (
                          <img src={logoUrl} alt="" className="size-full object-contain" />
                        ) : (
                          <Building2 className="size-7 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground truncate">{displayName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">View vehicles & images</p>
                      </div>
                      <ChevronRight className="size-5 text-muted-foreground shrink-0" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {!vehiclesLoading && filteredCustomers.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">No companies available.</p>
          )}
        </div>
      )}

      {/* Gallery view: vehicles of selected company */}
      {viewMode === 'gallery' && galleryCompanyRef && (
        <div className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground">
            Select a vehicle to upload or view its images.
          </p>
          {vehiclesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {galleryVehiclesForCompany.map((v) => (
                <button
                  key={v.id ?? v.vehicleRef}
                  type="button"
                  onClick={() => navigate(`/vehicle-image-log/vehicle/${v.vehicleRef ?? v.id}`)}
                  className={cn(
                    'rounded-xl border border-border bg-card p-5 text-left shadow-sm transition-all',
                    'hover:border-primary/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2'
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className="size-14 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Truck className="size-7 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground truncate">{v.name ?? v.vehicleRef ?? '—'}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{v.site_name ?? '—'}</p>
                    </div>
                    <ChevronRight className="size-5 text-muted-foreground shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          )}
          {!vehiclesLoading && galleryVehiclesForCompany.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No vehicles for this company.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
