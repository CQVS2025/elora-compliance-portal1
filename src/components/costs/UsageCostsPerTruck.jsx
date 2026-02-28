import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Download,
  Search,
  Loader2,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import moment from 'moment';
import { motion } from 'framer-motion';
import DataPagination from '@/components/ui/DataPagination';
import { usePermissions } from '@/components/auth/PermissionGuard';
import { scansOptions, vehiclesOptions, pricingConfigOptions } from '@/query/options';
import {
  getStateFromSite,
  getPricingDetails,
  calculateScanCostFromScan,
  getVsExpectedLabel,
  isBillableScan,
  buildVehicleWashTimeMaps,
  buildSitePricingMaps,
  round2,
} from './usageCostUtils';
import { CardsAndChartsGlassySkeleton, ActionLoaderOverlay } from './UsageCostsSkeletons';

const GRANULARITY_OPTIONS = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'custom', label: 'Custom' },
];

const ITEMS_PER_PAGE = 20;

/** Mini sparkline for a vehicle's daily cost trend (one value per day in period). */
const TrendSparkline = React.memo(({ data, width = 88, height = 32, idSuffix = 'default' }) => {
  const series = Array.isArray(data) && data.length > 0 ? data : [];
  const gradientId = `sparklineFill-${String(idSuffix).replace(/[^a-z0-9-]/gi, '-')}`;
  
  if (series.length === 0) {
    return (
      <div className="inline-flex items-center justify-center text-muted-foreground text-xs" style={{ width, height }}>
        —
      </div>
    );
  }
  
  return (
    <div className="inline-flex items-center justify-center" style={{ width, height }}>
      <ResponsiveContainer width={width} height={height}>
        <AreaChart
          data={series}
          margin={{ top: 2, right: 2, left: 2, bottom: 2 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="cost"
            stroke="hsl(var(--primary))"
            strokeWidth={1.5}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
          />
          <Tooltip
            contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '12px' }}
            formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Cost']}
            labelFormatter={(label) => label}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
});

function buildVehiclesFromScans(scans, maps, pMaps = null) {
  if (!scans.length) return { vehicles: [], scansExcludedConfigMissing: 0 };
  let scansExcludedConfigMissing = 0;
  const hasVehicleContext = (s) => s.customerRef != null && s.siteRef != null && s.vehicleRef != null;
  const vehicleGroups = {};
  const pricingCache = new Map();

  scans.forEach((scan) => {
    const scanKey = `${scan.customerRef}_${scan.siteRef}_${scan.vehicleRef}_${scan.rfid}_${scan.deviceSerial ?? ''}`;
    let pricing = pricingCache.get(scanKey);
    if (!pricing) {
      pricing = calculateScanCostFromScan(scan, maps, pMaps);
      pricingCache.set(scanKey, pricing);
    }

    if (pricing.configMissing) scansExcludedConfigMissing += 1;
    const key = hasVehicleContext(scan)
      ? `${scan.customerRef}_${scan.siteRef}_${scan.vehicleRef}`
      : `device_${scan.deviceRef ?? scan.internalScanId ?? scan.scanRef}`;
    if (!vehicleGroups[key]) {
      const deviceOnly = !hasVehicleContext(scan);
      vehicleGroups[key] = {
        customerName: scan.customerName ?? '—',
        customerRef: scan.customerRef ?? key,
        siteName: scan.siteName ?? (deviceOnly ? scan.deviceName ?? '—' : '—'),
        siteRef: scan.siteRef ?? (deviceOnly ? scan.deviceRef ?? key : key),
        vehicleName: scan.vehicleName ?? scan.deviceName ?? '—',
        vehicleRef: scan.vehicleRef ?? scan.deviceRef ?? key,
        vehicleRfid: scan.vehicleRfid ?? scan.rfid ?? '—',
        scans: [],
        totalCost: 0,
        totalLitres: 0,
        pricePerLitre: pricing.pricePerLitre,
        pricingSource: pricing.pricingSource,
      };
    }
    vehicleGroups[key].scans.push(scan);
    vehicleGroups[key].totalCost += pricing.cost;
    vehicleGroups[key].totalLitres += pricing.litresUsed;
    if (pricing.pricingSource === 'db') vehicleGroups[key].pricingSource = 'db';
  });

  const vehicles = Object.values(vehicleGroups).map((group) => {
    const state = getStateFromSite(group.siteName, group.customerName);
    const totalScans = group.scans.length;
    const costPerScan = totalScans > 0 ? round2(group.totalCost / totalScans) : 0;
    const litresPerScan = totalScans > 0 ? round2(group.totalLitres / totalScans) : 0;
    return {
      ...group,
      state,
      totalScans,
      litresPerScan,
      costPerScan,
      totalCost: round2(group.totalCost),
    };
  });
  return { vehicles, scansExcludedConfigMissing };
}

function getPreviousPeriod(dateRange) {
  const start = moment(dateRange.start);
  const end = moment(dateRange.end);
  const days = end.diff(start, 'days') + 1;
  const prevEnd = moment(start).subtract(1, 'day');
  const prevStart = moment(prevEnd).subtract(days - 1, 'days');
  return {
    start: prevStart.format('YYYY-MM-DD'),
    end: prevEnd.format('YYYY-MM-DD'),
    days,
  };
}

export default function UsageCostsPerTruck({ selectedCustomer, selectedSite, dateRange }) {
  const permissions = usePermissions();
  const companyId = permissions.userProfile?.company_id ?? 'portal';
  const [granularity, setGranularity] = useState('day');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [exportLoading, setExportLoading] = useState(false);

  const daysInPeriod = useMemo(() => {
    const start = moment(dateRange.start);
    const end = moment(dateRange.end);
    return Math.max(1, end.diff(start, 'days') + 1);
  }, [dateRange.start, dateRange.end]);

  const isLargeDateRange = daysInPeriod > 90;

  const prevPeriod = useMemo(() => getPreviousPeriod(dateRange), [dateRange.start, dateRange.end]);

  const { data: currentData, isLoading: currentLoading, isFetching: currentFetching } = useQuery(
    scansOptions(companyId, {
      customerId: selectedCustomer,
      siteId: selectedSite,
      startDate: dateRange.start,
      endDate: dateRange.end,
      status: 'success,exceeded',
    })
  );

  const { data: prevData } = useQuery(
    scansOptions(companyId, {
      customerId: selectedCustomer,
      siteId: selectedSite,
      startDate: prevPeriod.start,
      endDate: prevPeriod.end,
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

  const hasMaps = useMemo(
    () =>
      entitlementMaps &&
      (Object.keys(entitlementMaps.byRef || {}).length > 0 || Object.keys(entitlementMaps.byRfid || {}).length > 0),
    [entitlementMaps]
  );
  const maps = hasMaps ? entitlementMaps : null;
  const pMaps = sitePricingMaps?.byDeviceSerial != null ? sitePricingMaps : null;

  const currentScans = Array.isArray(currentData) ? currentData : currentData?.data ?? [];
  const prevScans = Array.isArray(prevData) ? prevData : prevData?.data ?? [];

  const filteredCurrentScans = useMemo(() => {
    return currentScans.filter((scan) => isBillableScan(scan));
  }, [currentScans]);

  const filteredPrevScans = useMemo(() => {
    return prevScans.filter((scan) => isBillableScan(scan));
  }, [prevScans]);

  const { vehicles: vehiclesList, scansExcludedConfigMissing } = useMemo(() => {
    const { vehicles: fromScans, scansExcludedConfigMissing: excluded } = buildVehiclesFromScans(filteredCurrentScans, maps, pMaps);
    const allVehicles = vehiclesData?.data ?? (Array.isArray(vehiclesData) ? vehiclesData : []);

    const costByRef = new Map();
    const costByRfid = new Map();
    fromScans.forEach((v) => {
      const ref = v.vehicleRef ?? '';
      const rfid = v.vehicleRfid ?? '';
      if (ref) costByRef.set(String(ref), v);
      if (rfid && rfid !== '—') costByRfid.set(String(rfid), v);
    });

    let list;
    if (allVehicles.length === 0) {
      list = fromScans;
    } else {
      const usedFromScans = new Set();
      const merged = allVehicles.map((v) => {
        const ref = v.vehicleRef ?? v.vehicle_ref ?? '';
        const rfid = v.vehicleRfid ?? v.vehicle_rfid ?? '';
        const row = (ref && costByRef.get(String(ref))) ?? (rfid && costByRfid.get(String(rfid))) ?? null;
        if (row) {
          if (row.vehicleRef) usedFromScans.add(row.vehicleRef);
          if (row.vehicleRfid && row.vehicleRfid !== '—') usedFromScans.add(row.vehicleRfid);
          return row;
        }
        const customerName = v.customerName ?? v.customer_name ?? '—';
        const siteName = v.siteName ?? v.site_name ?? '—';
        const vehicleName = v.vehicleName ?? v.vehicle_name ?? '—';
        const siteRef = v.siteId ?? v.site_ref ?? v.siteRef ?? ref ?? '';
        const state = getStateFromSite(siteName, customerName);
        const pricing = getPricingDetails(customerName, state) ?? {};
        return {
          customerName,
          customerRef: v.customerId ?? v.customer_ref ?? ref,
          siteName,
          siteRef,
          vehicleName,
          vehicleRef: ref || '—',
          vehicleRfid: rfid || '—',
          state,
          totalScans: 0,
          litresPerScan: 0,
          pricePerLitre: pricing.pricePerLitre ?? 3.85,
          costPerScan: 0,
          totalCost: 0,
          scans: [],
        };
      });
      fromScans.forEach((row) => {
        const ref = row.vehicleRef ?? '';
        const rfid = (row.vehicleRfid ?? '') !== '—' ? row.vehicleRfid : '';
        const used = (ref && usedFromScans.has(ref)) || (rfid && usedFromScans.has(rfid));
        if (!used) merged.push(row);
      });
      list = merged;
    }

    const fleetTotalCost = list.reduce((s, v) => s + v.totalCost, 0);
    const vehiclesWithScans = list.filter((v) => (v.totalScans ?? 0) > 0);
    const fleetAvgCost = vehiclesWithScans.length ? fleetTotalCost / vehiclesWithScans.length : 0;
    const start = moment(dateRange.start);
    const end = moment(dateRange.end);
    const withMeta = list.map((v) => {
      const avgPerDay = daysInPeriod > 0 ? round2((v.totalCost || 0) / daysInPeriod) : 0;
      const avgPerWeek = daysInPeriod > 0 ? round2((v.totalCost || 0) / (daysInPeriod / 7)) : 0;
      const vsExpected = (v.totalScans ?? 0) === 0 ? { label: 'No scans', variant: 'normal' } : getVsExpectedLabel(v.totalCost || 0, fleetAvgCost);
      
      let dailyTrend = [];
      if (daysInPeriod <= 90) {
        let d = moment(start);
        while (d.isSameOrBefore(end)) {
          const dateKey = d.format('YYYY-MM-DD');
          const scans = v.scans || [];
          const dayScans = scans.filter((s) => moment(s.createdAt ?? s.timestamp).format('YYYY-MM-DD') === dateKey);
          const cost = dayScans.length ? dayScans.reduce((sum, s) => sum + calculateScanCostFromScan(s, maps, pMaps).cost, 0) : 0;
          dailyTrend.push({ date: d.format('MMM D'), cost: Math.round(cost * 100) / 100 });
          d.add(1, 'day');
        }
      } else {
        const scans = v.scans || [];
        const costByDate = {};
        scans.forEach((s) => {
          const dateKey = moment(s.createdAt ?? s.timestamp).format('YYYY-MM-DD');
          const cost = calculateScanCostFromScan(s, maps, pMaps).cost;
          costByDate[dateKey] = (costByDate[dateKey] || 0) + cost;
        });
        
        const sampleInterval = Math.ceil(daysInPeriod / 30);
        let d = moment(start);
        while (d.isSameOrBefore(end)) {
          const dateKey = d.format('YYYY-MM-DD');
          const cost = costByDate[dateKey] || 0;
          dailyTrend.push({ date: d.format('MMM D'), cost: Math.round(cost * 100) / 100 });
          d.add(sampleInterval, 'days');
        }
      }
      
      return { ...v, avgPerDay, avgPerWeek, vsExpected, dailyTrend };
    });
    return { vehicles: withMeta.sort((a, b) => (b.totalCost || 0) - (a.totalCost || 0)), scansExcludedConfigMissing: excluded };
  }, [filteredCurrentScans, daysInPeriod, dateRange.start, dateRange.end, maps, pMaps, vehiclesData]);

  const vehicles = vehiclesList;

  const prevVehicles = useMemo(() => {
    const { vehicles: list } = buildVehiclesFromScans(filteredPrevScans, maps, pMaps);
    return list;
  }, [filteredPrevScans, maps, pMaps]);
  const prevDays = useMemo(() => {
    const start = moment(prevPeriod.start);
    const end = moment(prevPeriod.end);
    return Math.max(1, end.diff(start, 'days') + 1);
  }, [prevPeriod.start, prevPeriod.end]);

  const summary = useMemo(() => {
    const totalCost = vehicles.reduce((s, v) => s + (v.totalCost || 0), 0);
    const trucksWithScans = vehicles.filter((v) => (v.totalScans ?? 0) > 0);
    const truckCount = trucksWithScans.length || vehicles.length;
    const avgCostPerTruckDay = truckCount && daysInPeriod ? totalCost / truckCount / daysInPeriod : 0;
    const avgCostPerTruckWeek = truckCount && daysInPeriod ? totalCost / truckCount / (daysInPeriod / 7) : 0;
    const avgCostPerTruckMonth = truckCount && daysInPeriod ? totalCost / truckCount / (daysInPeriod / 30) : 0;

    const prevTotalCost = prevVehicles.reduce((s, v) => s + (v.totalCost || 0), 0);
    const prevTrucksWithScans = prevVehicles.filter((v) => (v.totalScans ?? 0) > 0);
    const prevTruckCount = prevTrucksWithScans.length || prevVehicles.length;
    const prevAvgDay = prevTruckCount && prevDays ? prevTotalCost / prevTruckCount / prevDays : 0;
    const prevAvgWeek = prevTruckCount && prevDays ? prevTotalCost / prevTruckCount / (prevDays / 7) : 0;
    const prevAvgMonth = prevTruckCount && prevDays ? prevTotalCost / prevTruckCount / (prevDays / 30) : 0;

    const pctDay = prevAvgDay ? ((avgCostPerTruckDay - prevAvgDay) / prevAvgDay) * 100 : 0;
    const pctWeek = prevAvgWeek ? ((avgCostPerTruckWeek - prevAvgWeek) / prevAvgWeek) * 100 : 0;
    const pctMonth = prevAvgMonth ? ((avgCostPerTruckMonth - prevAvgMonth) / prevAvgMonth) * 100 : 0;

    const highest = trucksWithScans[0] ?? vehicles[0] ?? null;

    return {
      avgCostPerTruckDay: round2(avgCostPerTruckDay),
      avgCostPerTruckWeek: round2(avgCostPerTruckWeek),
      avgCostPerTruckMonth: round2(avgCostPerTruckMonth),
      pctDay,
      pctWeek,
      pctMonth,
      highest,
    };
  }, [vehicles, prevVehicles, daysInPeriod, prevDays]);

  const trendData = useMemo(() => {
    const start = moment(dateRange.start);
    const end = moment(dateRange.end);
    const points = [];
    const costByDay = {};
    const trucksByDay = {};
    
    filteredCurrentScans.forEach((scan) => {
      const dateKey = moment(scan.createdAt ?? scan.timestamp).format('YYYY-MM-DD');
      const pricing = calculateScanCostFromScan(scan, maps, pMaps);
      const cost = pricing.cost;
      costByDay[dateKey] = (costByDay[dateKey] || 0) + cost;
      const vehicleKey = scan.customerRef != null && scan.siteRef != null && scan.vehicleRef != null
        ? `${scan.customerRef}_${scan.siteRef}_${scan.vehicleRef}`
        : `device_${scan.deviceRef ?? scan.internalScanId ?? scan.scanRef}`;
      if (!trucksByDay[dateKey]) trucksByDay[dateKey] = new Set();
      trucksByDay[dateKey].add(vehicleKey);
    });

    const sampleInterval = daysInPeriod > 90 ? Math.ceil(daysInPeriod / 60) : 1;
    
    let d = moment(start);
    while (d.isSameOrBefore(end)) {
      const dateKey = d.format('YYYY-MM-DD');
      const totalCost = costByDay[dateKey] || 0;
      const truckCount = (trucksByDay[dateKey] && trucksByDay[dateKey].size) || 0;
      const avgCostPerTruck = truckCount > 0 ? totalCost / truckCount : 0;
      points.push({
        date: d.format('MMM D'),
        dateKey,
        avgCostPerTruck: Math.round(avgCostPerTruck * 100) / 100,
        totalCost,
        truckCount,
      });
      d.add(sampleInterval, 'days');
    }
    return points;
  }, [filteredCurrentScans, dateRange.start, dateRange.end, maps, pMaps, daysInPeriod]);

  const filteredVehicles = useMemo(() => {
    const q = (searchQuery || '').toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter(
      (v) =>
        (v.customerName || '').toLowerCase().includes(q) ||
        (v.siteName || '').toLowerCase().includes(q) ||
        (v.vehicleName || '').toLowerCase().includes(q)
    );
  }, [vehicles, searchQuery]);

  const totalPages = Math.ceil(filteredVehicles.length / ITEMS_PER_PAGE);
  const paginatedVehicles = useMemo(() => {
    return filteredVehicles.slice(
      (currentPage - 1) * ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE
    );
  }, [filteredVehicles, currentPage]);

  useEffect(() => setCurrentPage(1), [searchQuery]);

  const exportToCSV = () => {
    setExportLoading(true);
    try {
      const headers = [
        'Customer',
        'Site',
        'Vehicle',
        'Total Scans',
        'L/Scan',
        'Price/L',
        'Cost/Scan',
        'Total Cost',
        'Avg/Day',
        'Avg/Week',
        'vs Expected',
      ];
      const rows = vehicles.map((v) => [
        v.customerName,
        v.siteName,
        v.vehicleName,
        v.totalScans,
        `${typeof v.litresPerScan === 'number' ? v.litresPerScan.toFixed(2) : '0.00'}L`,
        `$${v.pricePerLitre.toFixed(2)}`,
        `$${v.costPerScan.toFixed(2)}`,
        `$${v.totalCost.toFixed(2)}`,
        `$${v.avgPerDay.toFixed(2)}`,
        `$${v.avgPerWeek.toFixed(2)}`,
        v.vsExpected.label,
      ]);
      const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `elora-per-truck-costs-${dateRange.start}-${dateRange.end}.csv`;
      a.click();
    } finally {
      setExportLoading(false);
    }
  };

  if (currentLoading) {
    return <CardsAndChartsGlassySkeleton />;
  }

  const allVehiclesForEmpty = vehiclesData?.data ?? (Array.isArray(vehiclesData) ? vehiclesData : []);
  if (!filteredCurrentScans.length && allVehiclesForEmpty.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 rounded-xl border border-border bg-card">
        <div className="text-center">
          <p className="text-muted-foreground text-lg">No wash data for selected period</p>
          <p className="text-sm text-muted-foreground mt-1">Adjust the date range to see per-truck cost data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      <ActionLoaderOverlay show={exportLoading} message="Exporting CSV..." />
      {currentFetching && !currentLoading && (
        <div className="absolute inset-0 bg-background/60 backdrop-blur-sm z-10 flex items-center justify-center rounded-2xl">
          <div className="flex items-center gap-3 bg-card px-6 py-3 rounded-xl shadow-lg border border-border">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
            <span className="text-sm font-medium text-foreground">Loading cost data...</span>
          </div>
        </div>
      )}
      {isLargeDateRange && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Large date range selected ({daysInPeriod} days). Data is being sampled for better performance.
            </p>
          </div>
        </div>
      )}
      
      {/* Time granularity + Export */}
      <div className="flex flex-wrap items-center justify-end gap-4">
        {/* <div className="flex flex-wrap gap-2">
          {GRANULARITY_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={granularity === opt.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setGranularity(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div> */}
        <Button variant="outline" size="sm" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground" onClick={exportToCSV} disabled={exportLoading}>
          {exportLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
          Export CSV
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground">Avg Cost / Truck / Day</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">${summary.avgCostPerTruckDay.toFixed(2)}</div>
              <p className="text-xs mt-1 flex items-center gap-1">
                {summary.pctDay >= 0 ? (
                  <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 text-red-600" />
                )}
                {summary.pctDay >= 0 ? '↑' : '↓'} {Math.abs(summary.pctDay).toFixed(1)}% vs last period
              </p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground">Avg Cost / Truck / Week</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">${summary.avgCostPerTruckWeek.toFixed(2)}</div>
              <p className="text-xs mt-1 flex items-center gap-1">
                {summary.pctWeek >= 0 ? <TrendingUp className="w-3.5 h-3.5 text-green-600" /> : <TrendingDown className="w-3.5 h-3.5 text-red-600" />}
                {summary.pctWeek >= 0 ? '↑' : '↓'} {Math.abs(summary.pctWeek).toFixed(1)}% vs last period
              </p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground">Avg Cost / Truck / Month</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">${summary.avgCostPerTruckMonth.toFixed(2)}</div>
              <p className="text-xs mt-1 flex items-center gap-1">
                {summary.pctMonth >= 0 ? <TrendingUp className="w-3.5 h-3.5 text-green-600" /> : <TrendingDown className="w-3.5 h-3.5 text-red-600" />}
                {summary.pctMonth >= 0 ? '↑' : '↓'} {Math.abs(summary.pctMonth).toFixed(1)}% vs last period
              </p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground">Highest Cost Truck</CardTitle>
            </CardHeader>
            <CardContent>
              {summary.highest ? (
                <>
                  <div className="text-lg font-bold text-foreground">
                    {summary.highest.vehicleName} · {summary.highest.siteName}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    ${summary.highest.totalCost.toFixed(2)} this period · {summary.highest.totalScans} scans
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">—</p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Per-Truck Cost Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Per-Truck Cost Trend</CardTitle>
          <p className="text-sm text-muted-foreground">Average daily cost per truck across all sites</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <defs>
                <linearGradient id="perTruckGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `$${v}`} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Avg cost/truck']}
                labelFormatter={(label) => label}
              />
              <Line
                type="monotone"
                dataKey="avgCostPerTruck"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#perTruckGradient)"
                dot={{ r: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Cost Breakdown by Vehicle */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle>Cost Breakdown by Vehicle</CardTitle>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by vehicle or site..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-72"
                />
              </div>
            </div>
          </div>
          {filteredVehicles.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredVehicles.length)} of {filteredVehicles.length} results
            </p>
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-primary text-primary-foreground">
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase">Site</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase">Vehicle</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase">Total Scans</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase">L / Scan</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase">Price / L</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase">Cost / Scan</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase">Total Cost</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase">Avg / Day</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase">Avg / Week</th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase">Trend</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase">vs Expected</th>
                </tr>
              </thead>
              <tbody>
                {paginatedVehicles.map((vehicle, index) => (
                  <tr
                    key={`${vehicle.vehicleRef}-${vehicle.siteRef}`}
                    className={`border-b ${index % 2 === 0 ? 'bg-card' : 'bg-muted/30'} hover:bg-primary/5`}
                  >
                    <td className="px-4 py-3 text-sm text-foreground">{vehicle.customerName}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{vehicle.siteName}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-foreground">{vehicle.vehicleName}</td>
                    <td className="px-4 py-3 text-sm text-right text-foreground">{vehicle.totalScans}</td>
                    <td className="px-4 py-3 text-sm text-right text-muted-foreground">{typeof vehicle.litresPerScan === 'number' ? vehicle.litresPerScan.toFixed(2) : '0.00'}L</td>
                    <td className="px-4 py-3 text-sm text-right text-muted-foreground">${vehicle.pricePerLitre.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-right text-foreground">${vehicle.costPerScan.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-primary">${vehicle.totalCost.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-right text-foreground">${vehicle.avgPerDay.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-right text-foreground">${vehicle.avgPerWeek.toFixed(2)}</td>
                    <td className="px-4 py-3 text-center align-middle">
                      <TrendSparkline data={vehicle.dailyTrend} idSuffix={`${vehicle.vehicleRef}-${vehicle.siteRef}`} />
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="secondary"
                        className={
                          vehicle.vsExpected.variant === 'normal'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : vehicle.vsExpected.variant === 'over'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }
                      >
                        {vehicle.vsExpected.label}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <DataPagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredVehicles.length}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={setCurrentPage}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
