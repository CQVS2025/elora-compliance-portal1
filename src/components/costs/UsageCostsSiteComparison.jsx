import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Loader2, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import moment from 'moment';
import { motion } from 'framer-motion';
import { usePermissions } from '@/components/auth/PermissionGuard';
import { scansOptions, vehiclesOptions, pricingConfigOptions } from '@/query/options';
import { SiteComparisonGlassySkeleton } from './UsageCostsSkeletons';
import { calculateScanCostFromScan, isBillableScan, buildVehicleWashTimeMaps, buildSitePricingMaps, round2, formatDateRangeDisplay } from './usageCostUtils';

const GRANULARITY_OPTIONS = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'custom', label: 'Custom' },
];

const MAX_SITES = 5;
const COMPARISON_COLORS = ['#3b82f6', '#8b5cf6', '#14b8a6', '#f59e0b', '#ef4444'];

function buildSitesFromScans(scans, dateRange, maps, pMaps = null) {
  if (!scans.length) return { siteRows: [], scansExcludedConfigMissing: 0 };
  const start = moment(dateRange.start);
  const end = moment(dateRange.end);
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
        key,
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

    const dailyTrend = [];
    let d = moment(start);
    while (d.isSameOrBefore(end)) {
      const dateKey = d.format('YYYY-MM-DD');
      const cost = costByDay[dateKey] || 0;
      dailyTrend.push({ date: d.format('MMM D'), dateKey, cost: Math.round(cost * 100) / 100 });
      d.add(1, 'day');
    }

    return {
      ...group,
      vehicles,
      totalScans,
      totalLitres: round2(totalLitres),
      totalCost: round2(totalCost),
      costPerTruck,
      costPerWash,
      dailyTrend,
      litresPerTruck: vehicles > 0 ? round2(totalLitres / vehicles) : 0,
    };
  });
  return { siteRows, scansExcludedConfigMissing };
}

function getSiteLabel(site, allSites) {
  const sameName = allSites.filter((s) => s.siteName === site.siteName);
  if (sameName.length <= 1) return site.siteName;
  const abbrev = site.customerName.replace(/\s+/g, ' ').split(' ').map((w) => w[0]).join('').slice(0, 3) || '—';
  return `${site.siteName} (${abbrev})`;
}

export default function UsageCostsSiteComparison({ selectedCustomer, selectedSite, dateRange }) {
  const permissions = usePermissions();
  const companyId = permissions.userProfile?.company_id ?? 'portal';
  const [granularity, setGranularity] = useState('week');
  const [compareKeys, setCompareKeys] = useState([]);

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

  const { siteRows: siteRowsSorted, scansExcludedConfigMissing } = useMemo(() => {
    const { siteRows, scansExcludedConfigMissing: excluded } = buildSitesFromScans(filteredScans, dateRange, maps, pMaps);
    return { siteRows: siteRows.sort((a, b) => b.totalCost - a.totalCost), scansExcludedConfigMissing: excluded };
  }, [filteredScans, dateRange.start, dateRange.end, maps, pMaps]);

  const siteRows = siteRowsSorted;

  const availableSiteOptions = useMemo(() => {
    return siteRows.map((r) => ({ value: r.key, label: `${r.siteName} (${r.customerName})` }));
  }, [siteRows]);

  useEffect(() => {
    if (siteRows.length > 0 && compareKeys.length === 0) {
      setCompareKeys(siteRows.slice(0, 2).map((r) => r.key));
    }
  }, [siteRows.length]);

  const comparedSites = useMemo(() => {
    return compareKeys
      .map((key) => siteRows.find((r) => r.key === key))
      .filter(Boolean)
      .map((site, i) => ({
        ...site,
        shortLabel: getSiteLabel(site, siteRows),
        comparisonKey: `site_${i}`,
      }));
  }, [siteRows, compareKeys]);

  const setCompareKeyAt = (index, value) => {
    setCompareKeys((prev) => {
      const next = [...prev];
      next[index] = value;
      return next.filter(Boolean);
    });
  };

  const addSiteSlot = () => {
    if (compareKeys.length >= MAX_SITES) return;
    const used = new Set(compareKeys);
    const next = siteRows.find((r) => !used.has(r.key));
    if (next) setCompareKeys((prev) => [...prev, next.key]);
    else setCompareKeys((prev) => [...prev, '']);
  };

  const removeSiteAt = (index) => {
    setCompareKeys((prev) => prev.filter((_, i) => i !== index));
  };

  const costTrendData = useMemo(() => {
    const start = moment(dateRange.start);
    const end = moment(dateRange.end);
    if (comparedSites.length === 0) return [];

    const weeks = [];
    let wStart = moment(start).startOf('isoWeek');
    if (wStart.isBefore(start)) wStart = moment(start);
    let wi = 1;
    while (wStart.isSameOrBefore(end)) {
      const wEnd = moment(wStart).add(6, 'days');
      const point = { week: `Wk ${wi}` };
      comparedSites.forEach((site) => {
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
  }, [comparedSites, dateRange.start, dateRange.end]);

  const perTruckComparisonData = useMemo(() => {
    if (comparedSites.length === 0) return [];
    return [
      {
        name: 'Cost/Truck',
        ...comparedSites.reduce((acc, s) => ({ ...acc, [s.comparisonKey]: Math.round(s.costPerTruck * 100) / 100 }), {}),
      },
      {
        name: 'Cost/Wash',
        ...comparedSites.reduce((acc, s) => ({ ...acc, [s.comparisonKey]: Math.round(s.costPerWash * 100) / 100 }), {}),
      },
      {
        name: 'Litres/Truck',
        ...comparedSites.reduce((acc, s) => ({ ...acc, [s.comparisonKey]: Math.round(s.litresPerTruck * 100) / 100 }), {}),
      },
    ];
  }, [comparedSites]);

  const metricsRows = useMemo(() => {
    if (comparedSites.length === 0) return [];
    const rows = [
      {
        metric: 'Total Cost',
        lowerIsBetter: true,
        values: comparedSites.map((s) => ({ key: s.comparisonKey, label: s.shortLabel, value: s.totalCost, format: 'currency' })),
      },
      {
        metric: 'Cost / Truck',
        lowerIsBetter: true,
        values: comparedSites.map((s) => ({ key: s.comparisonKey, label: s.shortLabel, value: s.costPerTruck, format: 'currency' })),
      },
      {
        metric: 'Cost / Wash',
        lowerIsBetter: true,
        values: comparedSites.map((s) => ({ key: s.comparisonKey, label: s.shortLabel, value: s.costPerWash, format: 'currency' })),
      },
      {
        metric: 'Total Scans',
        lowerIsBetter: false,
        values: comparedSites.map((s) => ({ key: s.comparisonKey, label: s.shortLabel, value: s.totalScans, format: 'number' })),
      },
      {
        metric: 'Active Trucks',
        lowerIsBetter: false,
        values: comparedSites.map((s) => ({ key: s.comparisonKey, label: s.shortLabel, value: s.vehicles, format: 'number' })),
      },
      {
        metric: 'Litres Dispensed',
        lowerIsBetter: true,
        values: comparedSites.map((s) => ({ key: s.comparisonKey, label: s.shortLabel, value: s.totalLitres, format: 'litres' })),
      },
    ];
    return rows.map((row) => {
      const bestValue = row.lowerIsBetter
        ? Math.min(...row.values.map((v) => v.value))
        : Math.max(...row.values.map((v) => v.value));
      const bestKey = row.values.find((v) => v.value === bestValue)?.key ?? row.values[0]?.key;
      const bestLabel = row.values.find((v) => v.value === bestValue)?.label ?? '';
      return { ...row, bestKey, bestLabel };
    });
  }, [comparedSites]);

  if (isLoading) {
    return <SiteComparisonGlassySkeleton />;
  }

  if (!filteredScans.length) {
    return (
      <div className="flex items-center justify-center py-12 rounded-xl border border-border bg-card">
        <div className="text-center">
          <p className="text-muted-foreground text-lg">No wash data for selected period</p>
          <p className="text-sm text-muted-foreground mt-1">Adjust the date range or filters to compare sites</p>
        </div>
      </div>
    );
  }

  const dateRangeLabel = formatDateRangeDisplay(dateRange);

  return (
    <div className="space-y-6">
      {dateRangeLabel && (
        <p className="text-sm text-muted-foreground font-medium">Data for period: {dateRangeLabel}</p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-foreground">Compare:</span>
        {compareKeys.map((key, index) => (
          <React.Fragment key={index}>
            {index > 0 && <span className="text-muted-foreground text-sm">vs</span>}
            <div className="flex items-center gap-1">
              <Select
                value={key || '_none'}
                onValueChange={(v) => (v === '_none' ? removeSiteAt(index) : setCompareKeyAt(index, v))}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Select site" />
                </SelectTrigger>
                <SelectContent>
                  {availableSiteOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                  {key && (
                    <SelectItem value="_none">
                      <span className="text-muted-foreground">Remove</span>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {compareKeys.length > 2 && (
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => removeSiteAt(index)} aria-label="Remove site">
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </React.Fragment>
        ))}
        {compareKeys.length < MAX_SITES && availableSiteOptions.some((o) => !compareKeys.includes(o.value)) && (
          <Button type="button" variant="outline" size="sm" onClick={addSiteSlot}>
            <Plus className="w-4 h-4 mr-1" />
            Add Site
          </Button>
        )}
        {/* <div className="flex flex-1 justify-end gap-2">
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
      </div>

      {comparedSites.length >= 2 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {comparedSites.map((site, i) => (
              <motion.div key={site.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className="border-l-4" style={{ borderLeftColor: COMPARISON_COLORS[i % COMPARISON_COLORS.length] }}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold">{site.shortLabel}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-foreground">${site.totalCost.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {site.vehicles} trucks · ${site.costPerTruck.toFixed(2)} / truck
                    </p>
                    {dateRangeLabel && <p className="text-xs text-muted-foreground mt-0.5">{dateRangeLabel}</p>}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Cost Trend Comparison</CardTitle>
              <p className="text-sm text-muted-foreground">Weekly cost per site{dateRangeLabel ? ` · ${dateRangeLabel}` : ''}</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={costTrendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="week" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                    formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Cost']}
                  />
                  <Legend />
                  {comparedSites.map((site, i) => (
                    <Line
                      key={site.key}
                      type="monotone"
                      dataKey={site.siteRef}
                      name={site.shortLabel}
                      stroke={COMPARISON_COLORS[i % COMPARISON_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Per Truck Cost Comparison</CardTitle>
              <p className="text-sm text-muted-foreground">Avg cost per truck at each site{dateRangeLabel ? ` · ${dateRangeLabel}` : ''}</p>
            </CardHeader>
            <CardContent>
              {perTruckComparisonData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={perTruckComparisonData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                    />
                    <Legend />
                    {comparedSites.map((site, i) => (
                      <Bar
                        key={site.key}
                        dataKey={site.comparisonKey}
                        name={site.shortLabel}
                        fill={COMPARISON_COLORS[i % COMPARISON_COLORS.length]}
                        radius={[0, 4, 4, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">Select at least 2 sites to compare</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Side-by-Side Metrics</CardTitle>
              {dateRangeLabel && <p className="text-sm text-muted-foreground mt-0.5">{dateRangeLabel}</p>}
            </CardHeader>
            <CardContent>
              {dateRangeLabel && (
                <p className="text-xs text-muted-foreground mb-3">Period: {dateRangeLabel}</p>
              )}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-foreground uppercase">Metric</th>
                      {comparedSites.map((s) => (
                        <th key={s.key} className="px-4 py-3 text-right text-xs font-semibold text-foreground uppercase">
                          {s.shortLabel}
                        </th>
                      ))}
                      <th className="px-4 py-3 text-left text-xs font-semibold text-foreground uppercase">Best</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metricsRows.map((row) => (
                      <tr key={row.metric} className="border-b hover:bg-muted/30">
                        <td className="px-4 py-3 text-sm font-medium text-foreground">{row.metric}</td>
                        {row.values.map((v) => {
                          const isBest = v.key === row.bestKey;
                          let display = '';
                          if (v.format === 'currency') display = `$${v.value.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                          else if (v.format === 'litres') display = `${Number(v.value).toFixed(2)}L`;
                          else display = String(v.value);
                          return (
                            <td
                              key={v.key}
                              className={`px-4 py-3 text-sm text-right ${isBest ? (row.lowerIsBetter ? 'bg-green-100 dark:bg-green-900/20 font-semibold text-green-800 dark:text-green-400' : 'bg-blue-100 dark:bg-blue-900/20 font-semibold text-blue-800 dark:text-blue-400') : 'text-foreground'}`}
                            >
                              {display}
                            </td>
                          );
                        })}
                        <td className="px-4 py-3 text-sm text-muted-foreground">{row.bestLabel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {comparedSites.length < 2 && (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 py-12 text-center">
          <p className="text-muted-foreground">Select at least 2 sites above to compare costs and metrics.</p>
          <p className="text-sm text-muted-foreground mt-1">Sites are restricted to your selected customer and date range.</p>
        </div>
      )}
    </div>
  );
}
