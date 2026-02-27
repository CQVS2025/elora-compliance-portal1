import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DollarSign, Calculator, Droplet, MapPin, Download, Search, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import moment from 'moment';
import { motion } from 'framer-motion';
import DataPagination from '@/components/ui/DataPagination';
import { usePermissions } from '@/components/auth/PermissionGuard';
import { scansOptions, vehiclesOptions, pricingConfigOptions } from '@/query/options';
import { OverviewGlassySkeleton } from './UsageCostsSkeletons';
import { calculateScanCostFromScan, isBillableScan, round2, buildVehicleWashTimeMaps, buildSitePricingMaps } from './usageCostUtils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ListFilter } from 'lucide-react';

const SCANS_PAGE_SIZE = 100;

export default function UsageCostsOverview({ selectedCustomer, selectedSite, dateRange }) {
  const permissions = usePermissions();
  const companyId = permissions.userProfile?.company_id ?? 'portal';
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCustomers, setExpandedCustomers] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [apiPage, setApiPage] = useState(1);
  const [showExcludedScansModal, setShowExcludedScansModal] = useState(false);
  const itemsPerPage = 20;
  const autoSkippedPagesRef = useRef(new Set());

  const { data: scansResult, isLoading, isFetching } = useQuery(
    scansOptions(companyId, {
      customerId: selectedCustomer,
      siteId: selectedSite,
      startDate: dateRange.start,
      endDate: dateRange.end,
      page: apiPage,
      pageSize: SCANS_PAGE_SIZE,
      status: 'success,exceeded',
    })
  );

  const { data: vehiclesData } = useQuery(
    vehiclesOptions(companyId, {
      customerId: selectedCustomer && selectedCustomer !== 'all' ? selectedCustomer : undefined,
      siteId: selectedSite && selectedSite !== 'all' ? selectedSite : undefined,
    })
  );

  const { data: pricingConfig } = useQuery(pricingConfigOptions());

  const entitlementMaps = useMemo(() => {
    const list = vehiclesData?.data ?? (Array.isArray(vehiclesData) ? vehiclesData : []);
    return buildVehicleWashTimeMaps(list);
  }, [vehiclesData]);

  const sitePricingMaps = useMemo(() => {
    return buildSitePricingMaps(
      pricingConfig?.tankConfigs ?? [],
      pricingConfig?.products ?? [],
    );
  }, [pricingConfig]);

  const isPaginated = scansResult != null && typeof scansResult === 'object' && 'data' in scansResult;
  const scans = isPaginated ? scansResult.data ?? [] : (Array.isArray(scansResult) ? scansResult : []);
  const pageCount = isPaginated ? scansResult.pageCount ?? 1 : 1;
  const currentApiPage = isPaginated ? scansResult.page ?? apiPage : 1;

  const filteredScansForCost = useMemo(() => {
    return scans.filter((scan) => isBillableScan(scan));
  }, [scans]);

  useEffect(() => {
    setApiPage(1);
    setCurrentPage(1);
    autoSkippedPagesRef.current.clear();
  }, [selectedCustomer, selectedSite, dateRange.start, dateRange.end]);

  const costData = useMemo(() => {
    if (!filteredScansForCost.length) return { vehicles: [], summary: {}, customerSummary: [], dailyCosts: [], topSites: [], scansExcludedConfigMissing: 0, excludedScanRows: [] };
    const hasMaps = entitlementMaps && (Object.keys(entitlementMaps.byRef || {}).length > 0 || Object.keys(entitlementMaps.byRfid || {}).length > 0);
    const maps = hasMaps ? entitlementMaps : null;
    const pMaps = sitePricingMaps?.byDeviceSerial != null ? sitePricingMaps : null;
    const hasVehicleContext = (s) => s.customerRef != null && s.siteRef != null && s.vehicleRef != null;
    const vehicleGroups = {};
    let scansExcludedConfigMissing = 0;
    const excludedScanRows = [];
    const pricingCache = new Map();
    
    filteredScansForCost.forEach(scan => {
      const scanKey = `${scan.customerRef}_${scan.siteRef}_${scan.vehicleRef}_${scan.rfid}`;
      let pricing = pricingCache.get(scanKey);
      if (!pricing) {
        pricing = calculateScanCostFromScan(scan, maps, pMaps);
        pricingCache.set(scanKey, pricing);
      }

      if (pricing.configMissing) {
        scansExcludedConfigMissing += 1;
        excludedScanRows.push(scan);
      }
      const key = hasVehicleContext(scan)
        ? `${scan.customerRef}_${scan.siteRef}_${scan.vehicleRef}`
        : `device_${scan.deviceRef ?? scan.internalScanId ?? scan.scanRef}`;
      if (!vehicleGroups[key]) {
        const deviceOnly = !hasVehicleContext(scan);
        vehicleGroups[key] = {
          customerName: scan.customerName ?? '—',
          customerRef: scan.customerRef ?? key,
          siteName: scan.siteName ?? (deviceOnly ? (scan.deviceName ?? '—') : '—'),
          siteRef: scan.siteRef ?? (deviceOnly ? (scan.deviceRef ?? key) : key),
          vehicleName: scan.vehicleName ?? scan.deviceName ?? '—',
          vehicleRef: scan.vehicleRef ?? scan.deviceRef ?? key,
          vehicleRfid: scan.vehicleRfid ?? scan.rfid ?? '—',
          scans: [],
          state: pricing.state,
          pricePerLitre: pricing.pricePerLitre,
          totalCost: 0,
          totalLitres: 0,
          lastScanTimestamp: 0,
        };
      }
      vehicleGroups[key].scans.push(scan);
      vehicleGroups[key].totalCost += pricing.cost;
      vehicleGroups[key].totalLitres += pricing.litresUsed;
      
      const scanTimestamp = new Date(scan.createdAt ?? scan.timestamp ?? 0).getTime();
      if (scanTimestamp > vehicleGroups[key].lastScanTimestamp) {
        vehicleGroups[key].lastScanTimestamp = scanTimestamp;
        vehicleGroups[key].lastScanDate = scan.createdAt ?? scan.timestamp;
      }
    });

    const vehicles = Object.values(vehicleGroups).map(group => {
      const totalScans = group.scans.length;
      const avgCostPerScan = totalScans > 0 ? group.totalCost / totalScans : 0;
      const avgLitresPerScan = totalScans > 0 ? group.totalLitres / totalScans : 0;
      return {
        ...group,
        totalScans,
        litresPerScan: round2(avgLitresPerScan),
        pricePerLitre: group.pricePerLitre,
        costPerScan: round2(avgCostPerScan),
        totalCost: round2(group.totalCost),
        lastScan: group.lastScanDate,
      };
    });

    const totalCost = round2(vehicles.reduce((sum, v) => sum + v.totalCost, 0));
    const totalScans = vehicles.reduce((sum, v) => sum + v.totalScans, 0);
    const avgCostPerScan = totalScans > 0 ? round2(totalCost / totalScans) : 0;
    const mostExpensiveSite = vehicles.reduce((max, v) => {
      const siteCost = vehicles.filter(x => x.siteRef === v.siteRef).reduce((sum, x) => sum + x.totalCost, 0);
      return siteCost > (max.cost || 0) ? { name: v.siteName, cost: round2(siteCost) } : max;
    }, {});

    const customerGroups = {};
    vehicles.forEach(v => {
      const isDeviceOnly = v.customerName === '—';
      const custKey = isDeviceOnly ? '__devices__' : v.customerRef;
      const custName = isDeviceOnly ? 'Devices (this page)' : v.customerName;
      if (!customerGroups[custKey]) {
        customerGroups[custKey] = { customerName: custName, customerRef: custKey, totalScans: 0, totalCost: 0, sites: {} };
      }
      customerGroups[custKey].totalScans += v.totalScans;
      customerGroups[custKey].totalCost += v.totalCost;
      if (!customerGroups[custKey].sites[v.siteRef]) {
        customerGroups[custKey].sites[v.siteRef] = { siteName: v.siteName, state: v.state, totalScans: 0, totalCost: 0 };
      }
      customerGroups[custKey].sites[v.siteRef].totalScans += v.totalScans;
      customerGroups[custKey].sites[v.siteRef].totalCost += v.totalCost;
    });
    Object.keys(customerGroups).forEach(custKey => {
      Object.keys(customerGroups[custKey].sites).forEach(siteRef => {
        const site = customerGroups[custKey].sites[siteRef];
        site.costPerScan = site.totalScans > 0 ? round2(site.totalCost / site.totalScans) : 0;
        site.totalCost = round2(site.totalCost);
      });
    });

    const dailyGroups = {};
    filteredScansForCost.forEach(scan => {
      const date = moment(scan.createdAt ?? scan.timestamp).format('MMM D');
      const scanKey = `${scan.customerRef}_${scan.siteRef}_${scan.vehicleRef}_${scan.rfid}`;
      let pricing = pricingCache.get(scanKey);
      if (!pricing) {
        pricing = calculateScanCostFromScan(scan, maps, pMaps);
        pricingCache.set(scanKey, pricing);
      }
      dailyGroups[date] = (dailyGroups[date] || 0) + pricing.cost;
    });
    const dailyCosts = Object.entries(dailyGroups).map(([date, cost]) => ({ date, cost }));

    const siteGroups = {};
    vehicles.forEach(v => {
      if (!siteGroups[v.siteRef]) siteGroups[v.siteRef] = { siteName: v.siteName, state: v.state, totalCost: 0, totalScans: 0 };
      siteGroups[v.siteRef].totalCost += v.totalCost;
      siteGroups[v.siteRef].totalScans += v.totalScans;
    });
    const topSites = Object.values(siteGroups)
      .map(s => ({ ...s, totalCost: round2(s.totalCost) }))
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 10);

    return {
      vehicles: vehicles.sort((a, b) => b.totalCost - a.totalCost),
      summary: { totalCost, totalScans, avgCostPerScan, mostExpensiveSite },
      customerSummary: Object.values(customerGroups),
      dailyCosts,
      topSites,
      scansExcludedConfigMissing,
      excludedScanRows,
    };
  }, [filteredScansForCost, entitlementMaps, sitePricingMaps]);

  useEffect(() => {
    if (isPaginated && scans.length > 0 && filteredScansForCost.length === 0 && currentApiPage < pageCount && !autoSkippedPagesRef.current.has(currentApiPage)) {
      autoSkippedPagesRef.current.add(currentApiPage);
      setApiPage((prev) => Math.min(pageCount, prev + 1));
    }
  }, [filteredScansForCost, isPaginated, scans.length, currentApiPage, pageCount]);

  const filteredVehicles = useMemo(() => {
    return costData.vehicles.filter(v =>
      (v.customerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.siteName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.vehicleName || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [costData.vehicles, searchQuery]);

  const totalPages = Math.ceil(filteredVehicles.length / itemsPerPage);
  const paginatedVehicles = useMemo(() => {
    return filteredVehicles.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredVehicles, currentPage, itemsPerPage]);

  useEffect(() => { setCurrentPage(1); }, [searchQuery]);

  const exportToCSV = () => {
    const headers = ['Customer', 'Site', 'State', 'Vehicle', 'RFID', 'Total Scans', 'Litres/Scan', 'Price/Litre', 'Cost/Scan', 'Total Cost', 'Date Range'];
    const rows = costData.vehicles.map(v => [v.customerName, v.siteName, v.state, v.vehicleName, v.vehicleRfid, v.totalScans, v.litresPerScan, `$${v.pricePerLitre.toFixed(2)}`, `$${v.costPerScan.toFixed(2)}`, `$${v.totalCost.toFixed(2)}`, `${dateRange.start} to ${dateRange.end}`]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `elora-usage-costs-${dateRange.start}-${dateRange.end}.csv`;
    a.click();
  };

  const toggleCustomer = (customerRef) => {
    const newSet = new Set(expandedCustomers);
    if (newSet.has(customerRef)) newSet.delete(customerRef);
    else newSet.add(customerRef);
    setExpandedCustomers(newSet);
  };

  if (isLoading) {
    return <OverviewGlassySkeleton />;
  }

  if (!filteredScansForCost.length) {
    return (
      <div className="flex items-center justify-center py-12 rounded-xl border border-border bg-card">
        <div className="text-center">
          <Droplet className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground text-lg">No wash data for selected period</p>
          <p className="text-sm text-muted-foreground mt-1">Adjust the date range to see cost data</p>
        </div>
      </div>
    );
  }

  const { summary, scansExcludedConfigMissing, excludedScanRows } = costData;

  return (
    <div className="space-y-6 relative">
      <Dialog open={showExcludedScansModal} onOpenChange={setShowExcludedScansModal}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Excluded scans (no configured wash duration)</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            These scans were excluded from cost totals because no configured wash duration was found for the vehicle. A wash duration (e.g. 30s, 60s) must be set on the vehicle to calculate cost.
          </p>
          <div className="overflow-auto flex-1 min-h-0 border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Date / time</th>
                  <th className="px-3 py-2 text-left font-medium">Customer</th>
                  <th className="px-3 py-2 text-left font-medium">Site</th>
                  <th className="px-3 py-2 text-left font-medium">Vehicle</th>
                  <th className="px-3 py-2 text-left font-medium">RFID</th>
                  <th className="px-3 py-2 text-left font-medium">Device</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {(excludedScanRows || []).map((scan, idx) => (
                  <tr key={scan.internalScanId ?? scan.scanRef ?? idx} className="border-t border-border">
                    <td className="px-3 py-2 text-muted-foreground">{moment(scan.createdAt ?? scan.timestamp).format('DD/MM/YYYY HH:mm')}</td>
                    <td className="px-3 py-2">{scan.customerName ?? scan.customer_name ?? '—'}</td>
                    <td className="px-3 py-2">{scan.siteName ?? scan.site_name ?? '—'}</td>
                    <td className="px-3 py-2">{scan.vehicleName ?? scan.vehicle_name ?? scan.vehicleRef ?? scan.vehicle_ref ?? '—'}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{scan.rfid ?? scan.vehicleRfid ?? '—'}</td>
                    <td className="px-3 py-2">{scan.deviceName ?? scan.device_ref ?? '—'}</td>
                    <td className="px-3 py-2">{scan.statusLabel ?? scan.status ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
      {isFetching && (
        <div className="absolute inset-0 bg-background/60 backdrop-blur-sm z-10 flex items-center justify-center rounded-2xl">
          <div className="flex items-center gap-3 bg-card px-6 py-3 rounded-xl shadow-lg border border-border">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
            <span className="text-sm font-medium text-foreground">Updating costs...</span>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold text-primary">Total Usage Cost</CardTitle>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">${summary.totalCost.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <p className="text-xs text-muted-foreground mt-1">{isPaginated && pageCount > 1 ? 'Cost for scans on this page' : 'Total wash costs (selected period)'}</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold text-primary">Average Cost Per Scan</CardTitle>
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Calculator className="w-5 h-5 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">${summary.avgCostPerScan.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">Average cost per wash</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold text-primary">Total Scans</CardTitle>
              <div className="w-10 h-10 rounded-lg bg-cyan-100 flex items-center justify-center">
                <Droplet className="w-5 h-5 text-cyan-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{filteredScansForCost.length.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">{isPaginated && pageCount > 1 ? `Success scans on page ${currentApiPage} (${filteredScansForCost.length} on this page)` : 'Success scans (selected period)'}</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold text-primary">Most Expensive Site</CardTitle>
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-foreground">{summary.mostExpensiveSite.name || 'N/A'}</div>
              <p className="text-sm text-primary font-semibold mt-1">${(summary.mostExpensiveSite.cost ?? 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {isPaginated && pageCount > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Scans page <span className="font-semibold text-foreground">{currentApiPage}</span> of <span className="font-semibold text-foreground">{pageCount.toLocaleString()}</span>
            {' '}({filteredScansForCost.length.toLocaleString()} success scans on this page)
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setApiPage((p) => Math.max(1, p - 1))} disabled={currentApiPage <= 1 || isFetching}>Previous</Button>
            <span className="text-sm text-muted-foreground min-w-[6rem] text-center">{currentApiPage} / {pageCount.toLocaleString()}</span>
            <Button variant="outline" size="sm" onClick={() => setApiPage((p) => Math.min(pageCount, p + 1))} disabled={currentApiPage >= pageCount || isFetching}>Next</Button>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle>Cost Breakdown by Vehicle</CardTitle>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search by customer, site, or vehicle..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 w-72" />
              </div>
              {/* {scansExcludedConfigMissing > 0 && (
                <Button variant="outline" size="sm" className="border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900/50" onClick={() => setShowExcludedScansModal(true)}>
                  <ListFilter className="w-4 h-4 mr-2" />
                  View excluded scans
                </Button>
              )} */}
              <Button onClick={exportToCSV} variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                <Download className="w-4 h-4 mr-2" /> Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-primary text-primary-foreground">
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase">Site</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase">Vehicle</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase">RFID</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase">Total Scans</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help underline decoration-dotted">Litres/Scan</span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          Calculated from configured wash duration (seconds). Example: 30s × (4L / 60s) = 2.0L
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase">Price/Litre</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help underline decoration-dotted">Cost/Scan</span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          Cost is based on wash duration × litres per 60 seconds × price per litre.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase">Total Cost</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase">Last Scan</th>
                </tr>
              </thead>
              <tbody>
                {paginatedVehicles.map((vehicle, index) => (
                  <tr key={index} className={`border-b ${index % 2 === 0 ? 'bg-card' : 'bg-muted/30'} hover:bg-primary/5`}>
                    <td className="px-4 py-3 text-sm text-foreground">{vehicle.customerName}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-foreground">{vehicle.siteName}</span>
                        <Badge className={`text-xs ${vehicle.state === 'QLD' ? 'bg-orange-100 text-orange-800' : vehicle.state === 'VIC' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>{vehicle.state}</Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-foreground">{vehicle.vehicleName}</td>
                    <td className="px-4 py-3 text-sm font-mono text-muted-foreground">{vehicle.vehicleRfid}</td>
                    <td className="px-4 py-3 text-sm text-right text-foreground">{vehicle.totalScans}</td>
                    <td className="px-4 py-3 text-sm text-right text-muted-foreground">{typeof vehicle.litresPerScan === 'number' ? vehicle.litresPerScan.toFixed(2) : '0.00'}L</td>
                    <td className="px-4 py-3 text-sm text-right text-muted-foreground">${vehicle.pricePerLitre.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-right text-foreground">${vehicle.costPerScan.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-primary">${vehicle.totalCost.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{moment(vehicle.lastScan).format('MMM D, YYYY')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <DataPagination currentPage={currentPage} totalPages={totalPages} totalItems={filteredVehicles.length} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} />
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Cost Over Time</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={costData.dailyCosts}>
                <defs>
                  <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <RechartsTooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} formatter={(value) => [`$${value.toFixed(2)}`, 'Cost']} />
                <Line type="monotone" dataKey="cost" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#costGradient)" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Top 10 Sites by Cost</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={costData.topSites} layout="vertical">
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.5}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis dataKey="siteName" type="category" width={100} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <RechartsTooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} formatter={(value, name, props) => [`$${value.toFixed(2)}`, `${props.payload.totalScans} scans`]} />
                <Bar dataKey="totalCost" fill="url(#barGradient)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Cost Summary by Customer</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {costData.customerSummary.map((customer) => (
              <div key={customer.customerRef} className="border border-border rounded-lg overflow-hidden">
                <button onClick={() => toggleCustomer(customer.customerRef)} className="w-full px-4 py-3 flex items-center justify-between bg-muted/50 hover:bg-muted transition-colors">
                  <div className="flex items-center gap-4">
                    {expandedCustomers.has(customer.customerRef) ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    <div className="text-left">
                      <p className="font-semibold text-foreground">{customer.customerName}</p>
                      <p className="text-sm text-muted-foreground">{customer.totalScans} scans</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-primary">${customer.totalCost.toFixed(2)}</p>
                  </div>
                </button>
                {expandedCustomers.has(customer.customerRef) && (
                  <div className="p-4 bg-card">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground">Site</th>
                          <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground">State</th>
                          <th className="px-2 py-2 text-right text-xs font-semibold text-muted-foreground">Scans</th>
                          <th className="px-2 py-2 text-right text-xs font-semibold text-muted-foreground">Cost/Scan</th>
                          <th className="px-2 py-2 text-right text-xs font-semibold text-muted-foreground">Total Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.values(customer.sites).map((site, idx) => (
                          <tr key={idx} className="border-b last:border-0">
                            <td className="px-2 py-2 text-sm text-foreground">{site.siteName}</td>
                            <td className="px-2 py-2">
                              <Badge className={`text-xs ${site.state === 'QLD' ? 'bg-orange-100 text-orange-800' : site.state === 'VIC' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>{site.state}</Badge>
                            </td>
                            <td className="px-2 py-2 text-sm text-right text-foreground">{site.totalScans}</td>
                            <td className="px-2 py-2 text-sm text-right text-muted-foreground">${site.costPerScan.toFixed(2)}</td>
                            <td className="px-2 py-2 text-sm text-right font-semibold text-primary">${site.totalCost.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
