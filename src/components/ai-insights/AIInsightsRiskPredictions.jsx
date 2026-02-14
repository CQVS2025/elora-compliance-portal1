import React, { useMemo, useState } from 'react';
import { Send, Download, Info, X, RotateCcw } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import DataTable from '@/components/DataTable';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from '@/lib/toast';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const NO_ACCESS_MESSAGE = "You don't have access to perform this operation.";

const RISK_COLORS = {
  critical: 'bg-destructive/90 text-destructive-foreground',
  high: 'bg-amber-500/90 text-white',
  medium: 'bg-yellow-500/80 text-black',
  low: 'bg-primary/80 text-primary-foreground',
};

const RISK_LEVEL_OPTIONS = [
  { value: 'all', label: 'All risk levels' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export default function AIInsightsRiskPredictions({ 
  predictions, 
  isLoading, 
  isSuperAdmin, 
  canSendAlerts = false, 
  onRefresh,
  sitesForCustomer = [],
  viewSiteFilter = 'all',
  onSiteFilterChange,
}) {
  const [riskLevelFilter, setRiskLevelFilter] = useState('all');
  const [siteFilter, setSiteFilter] = useState('all');

  // Handler for clicking on chart bars to filter
  const handleChartBarClick = (data) => {
    if (!data || !data.level) return;
    const levelValue = data.level.toLowerCase();
    // Toggle: if already selected, clear it; otherwise set it
    setRiskLevelFilter(prev => prev === levelValue ? 'all' : levelValue);
  };

  // Clear all filters
  const clearFilters = () => {
    setRiskLevelFilter('all');
    setSiteFilter('all');
  };

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (riskLevelFilter !== 'all') count++;
    if (siteFilter !== 'all') count++;
    return count;
  }, [riskLevelFilter, siteFilter]);

  const uniqueSites = useMemo(() => {
    const set = new Set();
    (predictions || []).forEach((p) => {
      const s = p.site_name || p.site_ref;
      if (s) set.add(s);
    });
    return Array.from(set).sort();
  }, [predictions]);

  const filteredPredictions = useMemo(() => {
    let list = predictions || [];
    if (riskLevelFilter !== 'all') list = list.filter((p) => p.risk_level === riskLevelFilter);
    if (siteFilter !== 'all') list = list.filter((p) => (p.site_name || p.site_ref) === siteFilter);
    return list;
  }, [predictions, riskLevelFilter, siteFilter]);

  const critical = (predictions || []).filter((p) => p.risk_level === 'critical').length;
  const high = (predictions || []).filter((p) => p.risk_level === 'high').length;
  const medium = (predictions || []).filter((p) => p.risk_level === 'medium').length;

  const riskLevelChartData = useMemo(() => [
    { level: 'Critical', count: critical, fill: 'hsl(var(--chart-critical))' },
    { level: 'High', count: high, fill: 'hsl(var(--chart-high))' },
    { level: 'Medium', count: medium, fill: 'hsl(var(--chart-medium))' },
    { level: 'Low', count: (predictions || []).filter((p) => p.risk_level === 'low').length, fill: 'hsl(var(--chart-low))' },
  ].filter((d) => d.count > 0), [predictions, critical, high, medium]);

  const riskBySiteData = useMemo(() => {
    const bySite = {};
    (predictions || []).forEach((p) => {
      const s = p.site_name || p.site_ref || 'Unknown';
      if (!bySite[s]) bySite[s] = { site: s, critical: 0, high: 0, medium: 0, low: 0, total: 0 };
      const level = p.risk_level || 'low';
      if (['critical', 'high', 'medium', 'low'].includes(level)) {
        bySite[s][level]++;
        bySite[s].total++;
      }
    });
    return Object.values(bySite).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [predictions]);

  const riskChartConfig = { count: { label: 'Vehicles' }, level: { label: 'Risk Level' } };
  const siteChartConfig = {
    critical: { label: 'Critical', color: 'hsl(var(--chart-critical))' },
    high: { label: 'High', color: 'hsl(var(--chart-high))' },
    medium: { label: 'Medium', color: 'hsl(var(--chart-medium))' },
    low: { label: 'Low', color: 'hsl(var(--chart-low))' },
  };

  const handleSendReminder = (vehicleRef) => {
    if (!canSendAlerts) return;
    toast('Queued', { description: 'SMS will be enabled in Phase 2.' });
  };

  const handleSendAllReminders = () => {
    if (!canSendAlerts) return;
    toast('Queued', { description: 'SMS will be enabled in Phase 2.' });
  };

  const handleExport = () => {
    toast('Export', { description: 'Export will be available in a future update.' });
  };

  const columns = [
    { id: 'vehicle', header: 'Vehicle', accessorKey: 'vehicle_name', cell: (row) => row.vehicle_name || row.vehicle_ref || '—' },
    { id: 'driver', header: 'Driver', accessorKey: 'driver_name', cell: (row) => row.driver_name || '—' },
    { id: 'site', header: 'Site', accessorKey: 'site_name', cell: (row) => row.site_name || row.site_ref || '—' },
    { id: 'progress', header: 'Progress', cell: () => '—' },
    {
      id: 'risk_level',
      header: 'Risk Level',
      cell: (row) => (
        <Badge className={RISK_COLORS[row.risk_level] || RISK_COLORS.medium}>{row.risk_level}</Badge>
      ),
    },
    {
      id: 'confidence',
      header: (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 cursor-help">
                <span>Chance of Missing Target (%)</span>
                <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-[280px]">
              <p className="text-xs">
                Percentage chance this vehicle will miss its required number of washes, based on historical patterns and current progress.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ),
      cell: (row) => (row.confidence_score != null ? `${Math.round(Number(row.confidence_score))}%` : '—'),
    },
    {
      id: 'action',
      header: 'Action',
      cell: (row) => {
        const btn = (
          <Button
            variant="ghost"
            size="sm"
            disabled={!canSendAlerts}
            onClick={() => handleSendReminder(row.vehicle_ref)}
          >
            Send Reminder
          </Button>
        );
        return canSendAlerts ? (
          btn
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-block cursor-not-allowed">{btn}</span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{NO_ACCESS_MESSAGE}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Site Filter at top */}
      {sitesForCustomer.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Filter by site:</span>
          <Select value={viewSiteFilter} onValueChange={onSiteFilterChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sites</SelectItem>
              {sitesForCustomer.map((site) => (
                <SelectItem key={site.id} value={site.ref || site.id}>
                  {site.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Card className="bg-muted/40">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-2xl font-bold">{predictions?.length ?? 0}</p>
              <p className="text-sm text-primary font-semibold">Vehicles at risk</p>
            </div>
            <div>
              <p className="text-2xl font-bold">73%</p>
              <p className="text-sm text-primary font-semibold">Predicted fleet compliance</p>
            </div>
            <div className="flex gap-4">
              <div>
                <p className="text-xl font-bold">{critical}</p>
                <p className="text-xs text-primary font-semibold">Critical (24hrs)</p>
              </div>
              <div>
                <p className="text-xl font-bold">{high}</p>
                <p className="text-xs text-primary font-semibold">High (48hrs)</p>
              </div>
              <div>
                <p className="text-xl font-bold">{medium}</p>
                <p className="text-xs text-primary font-semibold">Medium (72hrs)</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts: Risk level breakdown + By site */}
      {(riskLevelChartData.length > 0 || riskBySiteData.length > 0) && !isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {riskLevelChartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Risk Level Breakdown</CardTitle>
                <CardDescription>Click on a bar to filter vehicles by risk level</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={riskChartConfig} className="aspect-auto h-[200px] w-full">
                  <BarChart 
                    data={riskLevelChartData} 
                    margin={{ left: 12, right: 12 }}
                    onClick={(data) => {
                      if (data && data.activePayload && data.activePayload[0]) {
                        handleChartBarClick(data.activePayload[0].payload);
                      }
                    }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="level" tickLine={false} axisLine={false} tickMargin={8} />
                    <ChartTooltip 
                      cursor={{ fill: 'hsl(var(--muted))', opacity: 0.2 }} 
                      content={<ChartTooltipContent hideLabel />} 
                    />
                    <Bar dataKey="count" radius={4} className="cursor-pointer">
                      {riskLevelChartData.map((entry, i) => {
                        const isSelected = riskLevelFilter === entry.level.toLowerCase();
                        return (
                          <Cell 
                            key={i} 
                            fill={entry.fill} 
                            opacity={isSelected ? 1 : (riskLevelFilter !== 'all' ? 0.3 : 0.9)}
                            className="transition-opacity hover:opacity-100"
                          />
                        );
                      })}
                    </Bar>
                  </BarChart>
                </ChartContainer>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  {riskLevelFilter !== 'all' 
                    ? `Filtered by: ${RISK_LEVEL_OPTIONS.find(o => o.value === riskLevelFilter)?.label || riskLevelFilter}` 
                    : 'Click a bar to filter by risk level'}
                </p>
              </CardContent>
            </Card>
          )}
          {riskBySiteData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>At-risk vehicles by site</CardTitle>
                <CardDescription>Sites with most at-risk vehicles, segmented by risk level</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={siteChartConfig} className="aspect-auto h-[200px] w-full">
                  <BarChart data={riskBySiteData} layout="vertical" margin={{ left: 12, right: 12 }}>
                    <CartesianGrid horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="site" type="category" width={100} tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(v) => (v && v.length > 12 ? v.slice(0, 10) + '…' : v)} />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                    <Bar dataKey="critical" stackId="site" fill="hsl(var(--chart-critical))" radius={[0, 0, 0, 0]} layout="vertical" />
                    <Bar dataKey="high" stackId="site" fill="hsl(var(--chart-high))" radius={[0, 0, 0, 0]} layout="vertical" />
                    <Bar dataKey="medium" stackId="site" fill="hsl(var(--chart-medium))" radius={[0, 0, 0, 0]} layout="vertical" />
                    <Bar dataKey="low" stackId="site" fill="hsl(var(--chart-low))" radius={[0, 4, 4, 0]} layout="vertical" />
                  </BarChart>
                </ChartContainer>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground justify-center">
                  <span><span className="inline-block w-2 h-2 rounded-full bg-[hsl(var(--chart-critical))]" /> Critical</span>
                  <span><span className="inline-block w-2 h-2 rounded-full bg-[hsl(var(--chart-high))]" /> High</span>
                  <span><span className="inline-block w-2 h-2 rounded-full bg-[hsl(var(--chart-medium))]" /> Medium</span>
                  <span><span className="inline-block w-2 h-2 rounded-full bg-[hsl(var(--chart-low))]" /> Low</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {isLoading && (
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      )}
      {!isLoading && !filteredPredictions.length && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm py-8">
              {predictions?.length
                ? 'No vehicles match the current filters.'
                : 'No at-risk vehicles. Run Fleet Analysis to refresh.'}
            </p>
          </CardContent>
        </Card>
      )}
      {!isLoading && filteredPredictions.length > 0 && (
        <div className="space-y-3">
          {/* Active Filters Badge */}
          {activeFiltersCount > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-muted-foreground">Active filters:</span>
              {riskLevelFilter !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  Risk: {RISK_LEVEL_OPTIONS.find(o => o.value === riskLevelFilter)?.label}
                  <button
                    onClick={() => setRiskLevelFilter('all')}
                    className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {siteFilter !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  Site: {siteFilter}
                  <button
                    onClick={() => setSiteFilter('all')}
                    className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="h-7 text-xs gap-1"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset filters
              </Button>
            </div>
          )}
          
          <DataTable
            columns={columns}
            data={filteredPredictions}
            getRowId={(row) => row.id}
            searchPlaceholder="Filter vehicles by name, driver, or site..."
            title="At-Risk Vehicle Details"
            pageSize={20}
            headerExtra={
              <>
                <Select value={riskLevelFilter} onValueChange={setRiskLevelFilter}>
                  <SelectTrigger className="w-[160px] h-9">
                    <SelectValue placeholder="Filter by risk" />
                  </SelectTrigger>
                  <SelectContent>
                    {RISK_LEVEL_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={siteFilter} onValueChange={setSiteFilter}>
                  <SelectTrigger className="w-[180px] h-9">
                    <SelectValue placeholder="Filter by site" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sites</SelectItem>
                    {uniqueSites.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {canSendAlerts ? (
                  <Button variant="outline" size="sm" onClick={handleSendAllReminders}>
                    <Send className="h-4 w-4 mr-1" />
                    Send All Reminders
                  </Button>
                ) : (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-block cursor-not-allowed">
                          <Button variant="outline" size="sm" disabled>
                            <Send className="h-4 w-4 mr-1" />
                            Send All Reminders
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{NO_ACCESS_MESSAGE}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <Download className="h-4 w-4 mr-1" />
                  Export Report
                </Button>
                {activeFiltersCount > 0 && (
                  <Button variant="outline" size="sm" onClick={clearFilters} className="gap-1">
                    <RotateCcw className="h-4 w-4" />
                    Reset
                  </Button>
                )}
                {onRefresh && (
                  <Button variant="ghost" size="sm" onClick={onRefresh}>
                    Refresh
                  </Button>
                )}
              </>
            }
          />
        </div>
      )}
    </div>
  );
}
