import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { tankLevelsOptions, sitesWithoutDevicesOptions } from '@/query/options/tankLevels';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Droplet,
  Search,
  Download,
  RefreshCw,
  LayoutGrid,
  LayoutList,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import TankLevelCard from '@/components/tankLevels/TankLevelCard';
import TankLevelCardSkeleton from '@/components/tankLevels/TankLevelCardSkeleton';
import TankLevelDetailSheet from '@/components/tankLevels/TankLevelDetailSheet';
import TankMetrics from '@/components/tankLevels/TankMetrics';
import TankLevelBar from '@/components/tankLevels/TankLevelBar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import moment from 'moment';

function productDisplay(productType) {
  if (productType === 'TW') return 'TW';
  if (productType === 'GEL') return 'GEL';
  return 'ECSR';
}

export default function TankLevels() {
  const { userProfile } = useAuth();
  const companyId = userProfile?.company_id;

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'table'
  // Pagination: default 20 per page
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSite, setSelectedSite] = useState(null);

  // Fetch tank levels — keep previous data when filters change so the page doesn't go blank
  const {
    data: tankData,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    ...tankLevelsOptions(companyId, {
      status: statusFilter,
      customer: customerFilter,
      state: stateFilter,
      search: searchQuery,
    }),
    placeholderData: (previousData) => previousData,
  });

  // Fetch sites without devices
  const { data: sitesWithoutDevices = [] } = useQuery(
    sitesWithoutDevicesOptions(companyId)
  );

  // Extract unique customers and states for filters
  const uniqueCustomers = useMemo(() => {
    if (!tankData?.allSites) return [];
    const customers = new Set(tankData.allSites.map(s => s.customer).filter(Boolean));
    return Array.from(customers).sort();
  }, [tankData?.allSites]);

  const uniqueStates = useMemo(() => {
    if (!tankData?.allSites) return [];
    const states = new Set(tankData.allSites.map(s => s.state).filter(Boolean));
    return Array.from(states).sort();
  }, [tankData?.allSites]);

  // Combine monitored sites with sites without devices
  const allSitesForDisplay = useMemo(() => {
    const monitored = tankData?.sites || [];
    const noDevice = sitesWithoutDevices.map(site => ({
      ...site,
      overallStatus: 'NO_DEVICE',
      tanks: [],
      deviceCount: 0,
    }));
    
    // Apply filters to no-device sites
    let filteredNoDevice = noDevice;
    if (statusFilter === 'NO_DEVICE') {
      filteredNoDevice = noDevice;
    } else if (statusFilter !== 'all') {
      filteredNoDevice = [];
    }
    
    if (customerFilter !== 'all') {
      filteredNoDevice = filteredNoDevice.filter(s => s.customer === customerFilter);
    }
    
    if (stateFilter !== 'all') {
      filteredNoDevice = filteredNoDevice.filter(s => s.state === stateFilter);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredNoDevice = filteredNoDevice.filter(s =>
        s.siteName?.toLowerCase().includes(query) ||
        s.customer?.toLowerCase().includes(query) ||
        s.location?.toLowerCase().includes(query)
      );
    }
    
    return [...monitored, ...filteredNoDevice];
  }, [tankData?.sites, sitesWithoutDevices, statusFilter, customerFilter, stateFilter, searchQuery]);

  // Table rows: one row per tank (flatten sites)
  const tableRows = useMemo(() => {
    return allSitesForDisplay.flatMap((site, siteIdx) => {
      if (site.tanks.length === 0) {
        return [{ type: 'no-device', site, siteIdx }];
      }
      return site.tanks.map((tank, tankIdx) => ({ type: 'tank', site, tank, siteIdx, tankIdx }));
    });
  }, [allSitesForDisplay]);

  // Pagination: for cards we paginate by site, for table by row
  const totalCards = allSitesForDisplay.length;
  const totalTableRows = tableRows.length;
  const totalItems = viewMode === 'cards' ? totalCards : totalTableRows;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Clamp current page when data or pageSize changes
  const safePage = Math.min(currentPage, totalPages);
  const startItem = (safePage - 1) * pageSize;
  const endItem = Math.min(safePage * pageSize, totalItems);

  const paginatedSites = useMemo(
    () => allSitesForDisplay.slice(startItem, startItem + pageSize),
    [allSitesForDisplay, startItem, pageSize]
  );
  const paginatedTableRows = useMemo(
    () => tableRows.slice(startItem, startItem + pageSize),
    [tableRows, startItem, pageSize]
  );

  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const resetFilters = () => {
    setStatusFilter('all');
    setCustomerFilter('all');
    setStateFilter('all');
    setSearchQuery('');
    setCurrentPage(1);
  };

  const hasActiveFilters =
    statusFilter !== 'all' ||
    customerFilter !== 'all' ||
    stateFilter !== 'all' ||
    searchQuery.trim() !== '';

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, customerFilter, stateFilter, searchQuery]);

  // Export to CSV
  const exportToCSV = () => {
    const headers = [
      'Site',
      'Customer',
      'Location',
      'Status',
      'Tank #',
      'Product',
      'Current (L)',
      'Capacity (L)',
      'Percentage',
      'Days Remaining',
      'Last Refill',
      'Devices',
      'Vehicles',
    ];

    const rows = allSitesForDisplay.flatMap(site => {
      if (site.tanks.length === 0) {
        return [[
          site.siteName,
          site.customer,
          site.location,
          site.overallStatus,
          '-',
          '-',
          '-',
          '-',
          '-',
          '-',
          '-',
          site.deviceCount || 0,
          site.vehicleCount || 0,
        ]];
      }
      
      return site.tanks.map(tank => [
        site.siteName,
        site.customer,
        site.location,
        tank.status,
        tank.tank_number,
        tank.product_type,
        tank.currentLitres || '-',
        tank.max_capacity_litres,
        tank.percentage ? `${tank.percentage}%` : '-',
        tank.daysRemaining ? `${tank.daysRemaining}d` : '-',
        tank.lastRefill?.date ? moment(tank.lastRefill.date).format('DD/MM/YYYY') : '-',
        site.deviceCount,
        site.vehicleCount,
      ]);
    });

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tank_levels_${moment().format('YYYY-MM-DD_HHmm')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Full-page loader only on true initial load (no data yet). When filtering, we keep showing data and use inline spinner.
  const isInitialLoad = isLoading && !tankData;
  if (isInitialLoad) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Droplet className="w-12 h-12 text-primary animate-bounce" />
          <p className="text-sm text-muted-foreground">Loading tank levels...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <AlertCircle className="w-12 h-12 text-destructive" />
              <h3 className="text-lg font-semibold">Error Loading Tank Levels</h3>
              <p className="text-sm text-muted-foreground">{error.message}</p>
              <Button onClick={() => refetch()} variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header Section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Droplet className="w-6 h-6 text-primary" />
              Tank Levels
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Real-time chemical inventory across {tankData?.metrics.totalSites || 0} sites •{' '}
              {tankData?.metrics.totalTanks || 0} monitored tanks
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">
              <span className="w-2 h-2 rounded-full bg-green-500 mr-1.5 animate-pulse" />
              Live Monitoring
            </Badge>
            <span className="text-xs text-muted-foreground">
              {tankData?.metrics.monitoredSites || 0} connected •{' '}
              {tankData?.metrics.pendingSites || 0} pending
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-1.5"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
              {isFetching ? 'Updating…' : 'Refresh'}
            </Button>
          </div>
        </div>

        {/* Last Updated + stale indicator */}
        {tankData?.lastUpdated && (() => {
          const mins = moment().diff(moment(tankData.lastUpdated), 'minutes');
          const isStale = mins >= 60;
          const isAmber = mins >= 15 && mins < 60;
          return (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">
                Last updated: {moment(tankData.lastUpdated).fromNow()}
              </span>
              {isAmber && (
                <span className="text-xs text-amber-600 font-medium">Data may be outdated</span>
              )}
              {isStale && (
                <span className="text-xs text-destructive font-medium">Stale data — refresh recommended</span>
              )}
            </div>
          );
        })()}
      </div>

      {/* Metrics KPI Strip */}
      <TankMetrics metrics={tankData?.metrics} />

      {/* Filters & Actions */}
      <Card>
        <CardContent className="pt-6">
          {isFetching && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4 py-1">
              <RefreshCw className="w-4 h-4 animate-spin shrink-0" aria-hidden />
              <span>Updating results…</span>
            </div>
          )}
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Filter sites..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full lg:w-[180px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="CRITICAL">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    Critical
                  </span>
                </SelectItem>
                <SelectItem value="WARNING">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-500" />
                    Warning
                  </span>
                </SelectItem>
                <SelectItem value="OK">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    OK
                  </span>
                </SelectItem>
                <SelectItem value="NO_DEVICE">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                    No Device
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Customer Filter */}
            <Select value={customerFilter} onValueChange={setCustomerFilter}>
              <SelectTrigger className="w-full lg:w-[200px]">
                <SelectValue placeholder="All Customers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Customers</SelectItem>
                {uniqueCustomers.map(customer => (
                  <SelectItem key={customer} value={customer}>
                    {customer}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* State Filter */}
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger className="w-full lg:w-[140px]">
                <SelectValue placeholder="All States" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                {uniqueStates.map(state => (
                  <SelectItem key={state} value={state}>
                    {state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Reset Filters */}
            <Button
              variant="outline"
              size="sm"
              onClick={resetFilters}
              disabled={!hasActiveFilters}
              className="gap-1.5 shrink-0"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </Button>

            {/* View Mode Toggle */}
            <div className="flex gap-1 border rounded-md p-1">
              <Button
                variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('cards')}
                className="px-3"
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('table')}
                className="px-3"
              >
                <LayoutList className="w-4 h-4" />
              </Button>
            </div>

            {/* Export Button */}
            <Button variant="outline" onClick={exportToCSV} className="gap-2">
              <Download className="w-4 h-4" />
              Export CSV
            </Button>

            {/* Refresh Button */}
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results count + Pagination controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {viewMode === 'cards'
            ? `Showing ${totalCards > 0 ? startItem + 1 : 0}–${endItem} of ${totalCards} sites`
            : `Showing ${totalTableRows > 0 ? startItem + 1 : 0}–${endItem} of ${totalTableRows} rows`}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Per page</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                setPageSize(Number(v));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[72px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={safePage <= 1}
              onClick={() => goToPage(safePage - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground px-2 min-w-[80px] text-center">
              Page {safePage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={safePage >= totalPages}
              onClick={() => goToPage(safePage + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Sites Grid/List — show skeletons when filtering/refetching */}
      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {isFetching ? (
            Array.from({ length: pageSize }, (_, idx) => (
              <TankLevelCardSkeleton key={`skeleton-card-${idx}`} />
            ))
          ) : (
            paginatedSites.map((site, idx) => (
              <TankLevelCard
                key={`${site.siteRef}-${startItem + idx}`}
                site={site}
                onClick={() => setSelectedSite(site)}
              />
            ))
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/60 dark:bg-muted/40 border-b border-border">
                  <tr>
                    <th className="text-left p-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Site</th>
                    <th className="text-left p-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer</th>
                    <th className="text-left p-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">State</th>
                    <th className="text-left p-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Product</th>
                    <th className="text-left p-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tank</th>
                    <th className="text-left p-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Level</th>
                    <th className="text-right p-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Daily use</th>
                    <th className="text-right p-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Days left</th>
                    <th className="text-center p-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Devices</th>
                    <th className="text-center p-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isFetching ? (
                    Array.from({ length: pageSize }, (_, idx) => (
                      <tr key={`skeleton-row-${idx}`} className="animate-pulse">
                        <td className="p-3"><Skeleton className="h-4 w-24" /></td>
                        <td className="p-3"><Skeleton className="h-4 w-28" /></td>
                        <td className="p-3"><Skeleton className="h-4 w-10" /></td>
                        <td className="p-3"><Skeleton className="h-4 w-12" /></td>
                        <td className="p-3"><Skeleton className="h-4 w-8" /></td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-12 w-8 rounded-b" />
                            <Skeleton className="h-4 w-16" />
                          </div>
                        </td>
                        <td className="p-3 text-right"><Skeleton className="h-4 w-12 ml-auto" /></td>
                        <td className="p-3 text-right"><Skeleton className="h-4 w-10 ml-auto" /></td>
                        <td className="p-3 text-center"><Skeleton className="h-4 w-6 mx-auto" /></td>
                        <td className="p-3 text-center"><Skeleton className="h-6 w-16 rounded mx-auto" /></td>
                      </tr>
                    ))
                  ) : (
                    paginatedTableRows.map((row, idx) => {
                    if (row.type === 'no-device') {
                      const { site, siteIdx } = row;
                      return (
                        <tr
                        key={`${site.siteRef}-${siteIdx}-nodevice`}
                        className="hover:bg-muted/20 cursor-pointer"
                        onClick={() => setSelectedSite(site)}
                      >
                          <td className="p-3 text-sm font-medium text-primary">{site.siteName}</td>
                          <td className="p-3 text-sm">{site.customer}</td>
                          <td className="p-3 text-sm text-muted-foreground">{site.state || '—'}</td>
                          <td className="p-3 text-sm">—</td>
                          <td className="p-3 text-sm">—</td>
                          <td className="p-3">—</td>
                          <td className="p-3 text-right text-sm">—</td>
                          <td className="p-3 text-right text-sm">—</td>
                          <td className="p-3 text-center text-sm">{site.deviceCount || 0}</td>
                          <td className="p-3 text-center">
                            <Badge variant="secondary" className="text-xs">NO DEVICE</Badge>
                          </td>
                        </tr>
                      );
                    }
                    const { site, tank, siteIdx, tankIdx } = row;
                    const daysLow = tank.status === 'CRITICAL' || tank.status === 'WARNING';
                    return (
                      <tr
                        key={`${site.siteRef}-${siteIdx}-${tankIdx}`}
                        className="hover:bg-muted/20 cursor-pointer"
                        onClick={() => setSelectedSite(site)}
                      >
                        <td className="p-3 text-sm font-medium text-primary">{site.siteName}</td>
                        <td className="p-3 text-sm">{site.customer}</td>
                        <td className="p-3 text-sm text-muted-foreground">{site.state || '—'}</td>
                        <td className="p-3 text-sm">{productDisplay(tank.product_type)}</td>
                        <td className="p-3 text-sm">T{tank.tank_number}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <TankLevelBar percentage={tank.percentage} status={tank.status} size="sm" />
                            <span
                              className={cn(
                                'text-sm font-medium',
                                tank.status === 'CRITICAL' && 'text-red-500 dark:text-red-400',
                                tank.status === 'WARNING' && 'text-orange-500 dark:text-orange-400',
                                tank.status === 'OK' && 'text-foreground'
                              )}
                            >
                              {tank.percentage != null ? `${tank.percentage}%` : '—'}
                              {tank.currentLitres != null && ` (${tank.currentLitres}L)`}
                            </span>
                          </div>
                        </td>
                        <td className="p-3 text-right text-sm">
                          {tank.consumption?.avgDailyLitres != null
                            ? `${tank.consumption.avgDailyLitres} L/d`
                            : '—'}
                        </td>
                        <td className="p-3 text-right">
                          <span
                            className={cn(
                              'text-sm',
                              daysLow ? 'text-red-500 dark:text-red-400 font-medium' : 'text-muted-foreground'
                            )}
                          >
                            {tank.daysRemaining != null ? `${tank.daysRemaining}d` : '—'}
                          </span>
                        </td>
                        <td className="p-3 text-center text-sm">{site.deviceCount ?? 0}</td>
                        <td className="p-3 text-center">
                          <Badge
                            className={cn(
                              'text-xs font-semibold uppercase',
                              tank.status === 'CRITICAL' && 'bg-red-600 text-white border-0',
                              tank.status === 'WARNING' && 'bg-orange-500 text-white border-0',
                              tank.status === 'OK' && 'bg-green-600 text-white border-0',
                              (tank.status === 'NO_DEVICE' || tank.status === 'NO_DATA') && 'bg-muted text-muted-foreground'
                            )}
                          >
                            {tank.status}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagination repeated at bottom when there are multiple pages */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
          <div className="text-sm text-muted-foreground">
            {viewMode === 'cards'
              ? `Showing ${startItem + 1}–${endItem} of ${totalCards} sites`
              : `Showing ${startItem + 1}–${endItem} of ${totalTableRows} rows`}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={safePage <= 1}
              onClick={() => goToPage(safePage - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground px-2 min-w-[80px] text-center">
              Page {safePage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={safePage >= totalPages}
              onClick={() => goToPage(safePage + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {allSitesForDisplay.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-3 text-center">
              <Droplet className="w-12 h-12 text-muted-foreground" />
              <h3 className="text-lg font-semibold">No sites found</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                No sites match your current filters. Try adjusting your search criteria.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setStatusFilter('all');
                  setCustomerFilter('all');
                  setStateFilter('all');
                  setSearchQuery('');
                }}
              >
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <TankLevelDetailSheet
        site={selectedSite}
        open={!!selectedSite}
        onOpenChange={(open) => !open && setSelectedSite(null)}
      />
    </div>
  );
}
