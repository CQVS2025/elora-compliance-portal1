import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Search, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import moment from 'moment';
import { motion } from 'framer-motion';
import DataPagination from '@/components/ui/DataPagination';
import { usePermissions } from '@/components/auth/PermissionGuard';
import { scansOptions, vehiclesOptions, pricingConfigOptions } from '@/query/options';
import { calculateScanCostFromScan, isBillableScan, buildVehicleWashTimeMaps, buildSitePricingMaps, round2, formatDateRangeDisplay } from './usageCostUtils';
import { CardsAndChartsGlassySkeleton, ActionLoaderOverlay } from './UsageCostsSkeletons';

const GRANULARITY_OPTIONS = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'custom', label: 'Custom' },
];

const ITEMS_PER_PAGE = 20;
const TOP_SITES_FOR_CHART = 5;

const SITE_LINE_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];
const SITE_BAR_COLORS = ['#ef4444', '#f97316', '#3b82f6', '#8b5cf6', '#14b8a6'];

/** Mini sparkline for a site's daily cost trend. */
function TrendSparkline({ data, width = 88, height = 32, idSuffix = 'default' }) {
  const series = Array.isArray(data) && data.length > 0 ? data : [];
  const gradientId = `siteSparkline-${String(idSuffix).replace(/[^a-z0-9-]/gi, '-')}`;
  return (
    <div className="inline-flex items-center justify-center" style={{ width, height }}>
      <ResponsiveContainer width={width} height={height}>
        <AreaChart data={series} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
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
            isAnimationActive={true}
          />
          {series.length > 0 && (
            <Tooltip
              contentStyle={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
                fontSize: '12px',
              }}
              formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Cost']}
              labelFormatter={(label) => label}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function buildSitesFromScans(scans, dateRange, maps, pMaps = null) {
  if (!scans.length) return { siteRows: [], scansExcludedConfigMissing: 0 };
  const start = moment(dateRange.start);
  const end = moment(dateRange.end);
  const daysInPeriod = Math.max(1, end.diff(start, 'days') + 1);
  let scansExcludedConfigMissing = 0;

  const siteGroups = {};
  scans.forEach((scan) => {
    const pricing = calculateScanCostFromScan(scan, maps, pMaps);
    if (pricing.configMissing) scansExcludedConfigMissing += 1;
    const customerRef = scan.customerRef ?? '—';
    const siteRef = scan.siteRef ?? scan.deviceRef ?? '—';
    const key = `${customerRef}_${siteRef}`;
    if (!siteGroups[key]) {
      siteGroups[key] = {
        customerName: scan.customerName ?? '—',
        customerRef,
        siteName: scan.siteName ?? (scan.deviceName ?? '—'),
        siteRef,
        scans: [],
        vehicleRefs: new Set(),
      };
    }
    siteGroups[key].scans.push(scan);
    if (scan.vehicleRef) siteGroups[key].vehicleRefs.add(scan.vehicleRef);
  });

  const siteRows = Object.values(siteGroups).map((group) => {
    let totalCost = 0;
    let totalLitres = 0;
    const costByDay = {};
    group.scans.forEach((scan) => {
      const pricing = calculateScanCostFromScan(scan, maps, pMaps);
      totalCost += pricing.cost;
      totalLitres += pricing.litresUsed;
      const dateKey = moment(scan.createdAt ?? scan.timestamp).format('YYYY-MM-DD');
      costByDay[dateKey] = (costByDay[dateKey] || 0) + pricing.cost;
    });

    const vehicles = group.vehicleRefs.size || 1;
    const totalScans = group.scans.length;
    const costPerTruck = vehicles > 0 ? round2(totalCost / vehicles) : 0;
    const costPerWash = totalScans > 0 ? round2(totalCost / totalScans) : 0;
    const costPerLitre = totalLitres > 0 ? round2(totalCost / totalLitres) : 0;

    const dailyTrend = [];
    let d = moment(start);
    while (d.isSameOrBefore(end)) {
      const dateKey = d.format('YYYY-MM-DD');
      const cost = costByDay[dateKey] || 0;
      dailyTrend.push({ date: d.format('MMM D'), dateKey, cost: Math.round(cost * 100) / 100 });
      d.add(1, 'day');
    }

    return {
      customerName: group.customerName,
      customerRef: group.customerRef,
      siteName: group.siteName,
      siteRef: group.siteRef,
      vehicles,
      totalScans,
      totalLitres: round2(totalLitres),
      totalCost: round2(totalCost),
      costPerTruck,
      costPerWash,
      costPerLitre,
      dailyTrend,
    };
  });
  return { siteRows, scansExcludedConfigMissing };
}

export default function UsageCostsPerSite({ selectedCustomer, selectedSite, dateRange }) {
  const permissions = usePermissions();
  const companyId = permissions.userProfile?.company_id ?? 'portal';
  const [granularity, setGranularity] = useState('week');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [exportLoading, setExportLoading] = useState(false);

  const { data: currentData, isLoading } = useQuery(
    scansOptions(companyId, {
      customerId: selectedCustomer,
      siteId: selectedSite,
      startDate: dateRange.start,
      endDate: dateRange.end,
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
  const filteredScans = useMemo(() => {
    return currentScans.filter((scan) => isBillableScan(scan));
  }, [currentScans]);

  const daysInPeriod = useMemo(() => {
    const start = moment(dateRange.start);
    const end = moment(dateRange.end);
    return Math.max(1, end.diff(start, 'days') + 1);
  }, [dateRange.start, dateRange.end]);

  const weeksInPeriod = useMemo(() => Math.max(1, Math.ceil(daysInPeriod / 7)), [daysInPeriod]);

  const { siteRows: siteRowsRaw, scansExcludedConfigMissing } = useMemo(() => {
    const { siteRows, scansExcludedConfigMissing: excluded } = buildSitesFromScans(filteredScans, dateRange, maps, pMaps);
    return { siteRows: siteRows.sort((a, b) => b.totalCost - a.totalCost), scansExcludedConfigMissing: excluded };
  }, [filteredScans, dateRange.start, dateRange.end, maps, pMaps]);

  const siteRows = siteRowsRaw;

  const summary = useMemo(() => {
    const totalCostAll = siteRows.reduce((s, r) => s + r.totalCost, 0);
    const totalScansAll = siteRows.reduce((s, r) => s + r.totalScans, 0);
    const totalLitresAll = siteRows.reduce((s, r) => s + r.totalLitres, 0);
    const totalVehiclesAll = siteRows.reduce((s, r) => s + r.vehicles, 0);
    const activeSites = siteRows.length;

    const avgCostPerSiteWeek =
      activeSites && weeksInPeriod ? totalCostAll / activeSites / weeksInPeriod : 0;
    const avgCostPerTruckSite = totalVehiclesAll ? totalCostAll / totalVehiclesAll : 0;
    const avgCostPerWash = totalScansAll ? totalCostAll / totalScansAll : 0;

    return {
      avgCostPerSiteWeek: round2(avgCostPerSiteWeek),
      avgCostPerTruckSite: round2(avgCostPerTruckSite),
      avgCostPerWash: round2(avgCostPerWash),
      totalLitresDispensed: round2(totalLitresAll),
      activeSites,
    };
  }, [siteRows, weeksInPeriod]);

  /** Build weekly cost per site from dailyTrend (use dateKey for correct week). */
  const siteCostOverTimeDataWeekly = useMemo(() => {
    const start = moment(dateRange.start);
    const end = moment(dateRange.end);
    const topSites = siteRows.slice(0, TOP_SITES_FOR_CHART);
    if (topSites.length === 0) return [];

    const weeks = [];
    let wStart = moment(start).startOf('isoWeek');
    if (wStart.isBefore(start)) wStart = moment(start);
    let wi = 1;
    while (wStart.isSameOrBefore(end)) {
      const wEnd = moment(wStart).add(6, 'days');
      const point = { week: `Wk ${wi}` };
      topSites.forEach((site) => {
        const cost = site.dailyTrend.reduce((sum, dp) => {
          const dateKey = dp.dateKey || dp.date;
          const d = moment(dateKey);
          if (!d.isValid()) return sum;
          if (d.isSameOrAfter(wStart) && d.isSameOrBefore(wEnd)) return sum + dp.cost;
          return sum;
        }, 0);
        point[site.siteRef] = Math.round(cost * 100) / 100;
      });
      weeks.push(point);
      wStart.add(7, 'days');
      wi++;
    }
    return weeks;
  }, [siteRows, dateRange.start, dateRange.end]);

  const costPerTruckBySiteDataFixed = useMemo(() => {
    return siteRows.slice(0, 10).map((r, i) => ({
      name: r.siteName.length > 12 ? r.siteName.slice(0, 12) + '…' : r.siteName,
      fullName: `${r.customerName} · ${r.siteName}`,
      costPerTruck: Math.round(r.costPerTruck * 100) / 100,
      fill: SITE_BAR_COLORS[i % SITE_BAR_COLORS.length],
    }));
  }, [siteRows]);

  const filteredSites = useMemo(() => {
    const q = (searchQuery || '').toLowerCase();
    if (!q) return siteRows;
    return siteRows.filter(
      (r) =>
        (r.customerName || '').toLowerCase().includes(q) ||
        (r.siteName || '').toLowerCase().includes(q)
    );
  }, [siteRows, searchQuery]);

  const totalPages = Math.ceil(filteredSites.length / ITEMS_PER_PAGE);
  const paginatedSites = useMemo(() => {
    return filteredSites.slice(
      (currentPage - 1) * ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE
    );
  }, [filteredSites, currentPage]);

  useEffect(() => setCurrentPage(1), [searchQuery]);

  const exportToCSV = () => {
    setExportLoading(true);
    try {
      const headers = [
        'Customer',
        'Site',
        'Vehicles',
        'Total Scans',
        'Total Litres',
        'Total Cost',
        'Cost/Truck',
        'Cost/Wash',
        'Cost/Litre',
      ];
      const rows = siteRows.map((r) => [
        r.customerName,
        r.siteName,
        r.vehicles,
        r.totalScans,
        `${typeof r.totalLitres === 'number' ? r.totalLitres.toFixed(2) : '0.00'}L`,
        `$${r.totalCost.toFixed(2)}`,
        `$${r.costPerTruck.toFixed(2)}`,
        `$${r.costPerWash.toFixed(2)}`,
        `$${r.costPerLitre.toFixed(2)}`,
      ]);
      const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `elora-per-site-costs-${dateRange.start}-${dateRange.end}.csv`;
      a.click();
    } finally {
      setExportLoading(false);
    }
  };

  if (isLoading) {
    return <CardsAndChartsGlassySkeleton />;
  }

  if (!filteredScans.length) {
    return (
      <div className="flex items-center justify-center py-12 rounded-xl border border-border bg-card">
        <div className="text-center">
          <p className="text-muted-foreground text-lg">No wash data for selected period</p>
          <p className="text-sm text-muted-foreground mt-1">Adjust the date range to see per-site cost data</p>
        </div>
      </div>
    );
  }

  const topSitesForLineChart = siteRows.slice(0, TOP_SITES_FOR_CHART);
  const dateRangeLabel = formatDateRangeDisplay(dateRange);

  return (
    <div className="space-y-6 relative">
      {dateRangeLabel && (
        <p className="text-sm text-muted-foreground font-medium">Data for period: {dateRangeLabel}</p>
      )}
      <ActionLoaderOverlay show={exportLoading} message="Exporting CSV..." />
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
        <Button
          variant="outline"
          size="sm"
          className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
          onClick={exportToCSV}
          disabled={exportLoading}
        >
          {exportLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
          Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground">Avg Cost / Site / Week</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                ${summary.avgCostPerSiteWeek.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Across {summary.activeSites} active sites</p>
              {dateRangeLabel && <p className="text-xs text-muted-foreground mt-0.5">{dateRangeLabel}</p>}
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground">Avg Cost / Truck / Site</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">${summary.avgCostPerTruckSite.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">{dateRangeLabel || 'This period'}</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground">Avg Cost / Wash</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">${summary.avgCostPerWash.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">{dateRangeLabel ? `${dateRangeLabel} · all sites` : 'Across all sites'}</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground">Total Litres Dispensed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {typeof summary.totalLitresDispensed === 'number' ? summary.totalLitresDispensed.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'} L
              </div>
              <p className="text-xs text-muted-foreground mt-1">{dateRangeLabel || 'This period'}</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Site Cost Over Time</CardTitle>
          <p className="text-sm text-muted-foreground">Weekly cost by site{dateRangeLabel ? ` · ${dateRangeLabel}` : ''}</p>
        </CardHeader>
        <CardContent>
          {siteCostOverTimeDataWeekly.length > 0 && topSitesForLineChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={siteCostOverTimeDataWeekly} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="week" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Cost']}
                />
                <Legend />
                {topSitesForLineChart.map((site, i) => (
                  <Line
                    key={site.siteRef}
                    type="monotone"
                    dataKey={site.siteRef}
                    name={site.siteName}
                    stroke={SITE_LINE_COLORS[i % SITE_LINE_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">No weekly data to display</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cost Per Truck by Site</CardTitle>
          {dateRangeLabel && <p className="text-sm text-muted-foreground mt-0.5">{dateRangeLabel}</p>}
          <p className="text-sm text-muted-foreground">Average cost per vehicle at each site</p>
        </CardHeader>
        <CardContent>
          {costPerTruckBySiteDataFixed.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={costPerTruckBySiteDataFixed}
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `$${v}`} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={100}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Cost / Truck']}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ''}
                />
                <Bar dataKey="costPerTruck" radius={[0, 4, 4, 0]} fill={(entry) => entry.payload.fill ?? 'hsl(var(--primary))'} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">No site data to display</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Site Cost Summary</CardTitle>
              {dateRangeLabel && <p className="text-sm text-muted-foreground mt-0.5">{dateRangeLabel}</p>}
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by customer or site..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-72"
              />
            </div>
          </div>
          {filteredSites.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
              {Math.min(currentPage * ITEMS_PER_PAGE, filteredSites.length)} of {filteredSites.length} results
            </p>
          )}
        </CardHeader>
        <CardContent>
          {dateRangeLabel && (
            <p className="text-xs text-muted-foreground mb-3">Period: {dateRangeLabel}</p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-primary text-primary-foreground">
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase">Site</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase">Vehicles</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase">Total Scans</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase">Total Litres</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase">Total Cost</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase">Cost / Truck</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase">Cost / Wash</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase">Cost / Litre</th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase">Trend</th>
                </tr>
              </thead>
              <tbody>
                {paginatedSites.map((row, index) => (
                  <tr
                    key={`${row.customerRef}-${row.siteRef}`}
                    className={`border-b ${index % 2 === 0 ? 'bg-card' : 'bg-muted/30'} hover:bg-primary/5`}
                  >
                    <td className="px-4 py-3 text-sm text-foreground">{row.customerName}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{row.siteName}</td>
                    <td className="px-4 py-3 text-sm text-right text-foreground">{row.vehicles}</td>
                    <td className="px-4 py-3 text-sm text-right text-foreground">{row.totalScans}</td>
                    <td className="px-4 py-3 text-sm text-right text-muted-foreground">{typeof row.totalLitres === 'number' ? row.totalLitres.toFixed(2) : '0.00'}L</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-primary">${row.totalCost.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-right text-foreground">${row.costPerTruck.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-right text-foreground">${row.costPerWash.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-right text-foreground">${row.costPerLitre.toFixed(2)}</td>
                    <td className="px-4 py-3 text-center align-middle">
                      <TrendSparkline data={row.dailyTrend} idSuffix={`${row.customerRef}-${row.siteRef}`} />
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
              totalItems={filteredSites.length}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={setCurrentPage}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
