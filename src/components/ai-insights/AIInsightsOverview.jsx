import React, { useState, useMemo } from 'react';
import { Sparkles, ChevronRight, Clock, User, MapPin } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, LabelList, Pie, PieChart, XAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import DataPagination from '@/components/ui/DataPagination';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

const PRIORITY_ACTIONS_PAGE_SIZES = [5, 10, 20];

function PaginatedInsightList({ title, description, items = [], pageSize = 10, emptyMessage, renderItem }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const slice = items.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {slice.map(renderItem)}
        </div>
        <DataPagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={items.length}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      </CardContent>
    </Card>
  );
}

const RISK_COLORS = {
  critical: 'bg-destructive/90 text-destructive-foreground',
  high: 'bg-amber-500/90 text-white',
  medium: 'bg-yellow-500/80 text-black',
  low: 'bg-primary/80 text-primary-foreground',
};

function PriorityActionsTable({ predictions, onSendReminder, isSuperAdmin, onViewAllAtRisk }) {
  const priorityAll = useMemo(
    () => (predictions || []).filter((p) => ['critical', 'high'].includes(p.risk_level)),
    [predictions]
  );
  const atRiskTotal = priorityAll.length;
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const totalPages = Math.max(1, Math.ceil(atRiskTotal / pageSize));
  const currentPage = Math.min(page, totalPages);
  const priority = useMemo(
    () => priorityAll.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [priorityAll, currentPage, pageSize]
  );

  const handleAction = (vehicleRef) => {
    onSendReminder?.(vehicleRef);
    toast({ title: 'Queued', description: 'SMS will be enabled in Phase 2.' });
  };

  if (priorityAll.length === 0) {
    return (
      <p className="text-muted-foreground text-sm py-4">No priority actions. Run Fleet Analysis to refresh.</p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Immediate attention needed</p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Per page</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              setPageSize(Number(v));
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[90px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_ACTIONS_PAGE_SIZES.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {priority.map((p) => {
        const isSchedule = p.recommended_action?.toLowerCase().includes('schedule') ?? false;
        return (
          <div
            key={p.id}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4"
          >
            <Badge className={RISK_COLORS[p.risk_level] || RISK_COLORS.medium}>
              {p.risk_level}
            </Badge>
            <div className="flex-1 min-w-0">
              <span className="font-semibold">{p.vehicle_name || p.vehicle_ref}</span>
              {p.site_name && <span className="text-muted-foreground text-sm ml-2">• {p.site_name}</span>}
              <p className="text-sm text-muted-foreground mt-0.5">{p.reasoning}</p>
              {p.recommended_action && (
                <p className="text-sm text-primary mt-1">{p.recommended_action}</p>
              )}
              {p.confidence_score != null && (
                <span className="text-xs text-muted-foreground">{Math.round(Number(p.confidence_score))}% confidence</span>
              )}
            </div>
            {isSuperAdmin && (
              <Button variant="outline" size="sm" onClick={() => handleAction(p.vehicle_ref, isSchedule)}>
                {isSchedule ? 'Schedule' : 'Take Action'}
              </Button>
            )}
          </div>
        );
      })}
      <DataPagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={atRiskTotal}
        pageSize={pageSize}
        onPageChange={setPage}
      />
      {onViewAllAtRisk && (
        <Button variant="ghost" size="sm" className="w-full" onClick={onViewAllAtRisk}>
          View all {atRiskTotal} at-risk vehicles in Risk Predictions
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      )}
    </div>
  );
}

export default function AIInsightsOverview({
  atRiskCount,
  pendingRecs,
  highPriorityRecs,
  predictions,
  recommendations,
  washWindows = [],
  driverPatterns = [],
  siteInsights = [],
  isLoading,
  isSuperAdmin,
  onViewAllAtRisk,
  onRefresh,
}) {
  const predictedCompliance = 73;
  const potentialCompliance = 78;

  const riskDistributionData = useMemo(() => {
    const list = predictions || [];
    return [
      { name: 'Critical', value: list.filter((p) => p.risk_level === 'critical').length, fill: 'hsl(var(--chart-critical))' },
      { name: 'High', value: list.filter((p) => p.risk_level === 'high').length, fill: 'hsl(var(--chart-high))' },
      { name: 'Medium', value: list.filter((p) => p.risk_level === 'medium').length, fill: 'hsl(var(--chart-medium))' },
      { name: 'Low', value: list.filter((p) => p.risk_level === 'low').length, fill: 'hsl(var(--chart-low))' },
    ].filter((d) => d.value > 0);
  }, [predictions]);

  const siteComplianceData = useMemo(() => {
    return (siteInsights || []).map((s) => ({
      site: s.site_name || 'Site',
      compliance: Math.round(Number(s.compliance_rate) ?? 0),
      fill: 'hsl(var(--primary))',
    }));
  }, [siteInsights]);

  const riskChartConfig = {
    value: { label: 'Vehicles' },
    Critical: { label: 'Critical', color: 'hsl(var(--chart-critical))' },
    High: { label: 'High', color: 'hsl(var(--chart-high))' },
    Medium: { label: 'Medium', color: 'hsl(var(--chart-medium))' },
    Low: { label: 'Low', color: 'hsl(var(--chart-low))' },
  };
  const siteChartConfig = { compliance: { label: 'Compliance %', color: 'hsl(var(--primary))' } };

  return (
    <div className="space-y-6">
      {/* Summary banner */}
      <Card className="overflow-hidden bg-gradient-to-r from-primary/90 to-primary/70 text-primary-foreground border-0">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-2 opacity-90">
            <Sparkles className="h-5 w-5" />
            <span className="text-sm">AI Summary • Based on ASI Wash Data</span>
          </div>
          <h2 className="text-xl font-bold">
            {atRiskCount > 0 ? `Your fleet needs attention today` : `Fleet status`}
          </h2>
          <p className="mt-2 text-primary-foreground/90">
            {atRiskCount > 0
              ? `${atRiskCount} vehicle${atRiskCount !== 1 ? 's are' : ' is'} at risk of missing weekly target.`
              : 'No vehicles currently at critical or high risk.'}
          </p>
        </CardContent>
      </Card>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">At Risk Vehicles</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : <span className="text-2xl font-bold">{atRiskCount}</span>}
            <p className="text-xs text-muted-foreground mt-1">Next 48 hours</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : <span className="text-2xl font-bold">{pendingRecs}</span>}
            <p className="text-xs text-muted-foreground mt-1">{highPriorityRecs} high priority</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Predicted Compliance</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{predictedCompliance}%</span>
            <p className="text-xs text-muted-foreground mt-1">End of week forecast</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Optimization Score</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">B+</span>
            <p className="text-xs text-muted-foreground mt-1">Fleet efficiency</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts row: Risk distribution (Pie) + Site compliance (Bar) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Risk Distribution</CardTitle>
            <CardDescription>Vehicles by risk level</CardDescription>
          </CardHeader>
          <CardContent>
            {riskDistributionData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Run Fleet Analysis to see risk distribution.</p>
            ) : (
              <ChartContainer config={riskChartConfig} className="mx-auto aspect-square max-h-[260px]">
                <PieChart>
                  <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel indicator="dot" />} />
                  <Pie
                    data={riskDistributionData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    strokeWidth={4}
                    stroke="transparent"
                  />
                  <ChartLegend content={<ChartLegendContent nameKey="name" />} className="-translate-y-2 flex-wrap gap-x-4 gap-y-1 *:justify-center" />
                </PieChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Site Compliance</CardTitle>
            <CardDescription>Compliance rate by site</CardDescription>
          </CardHeader>
          <CardContent>
            {siteComplianceData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Run Fleet Analysis to see site compliance.</p>
            ) : (
              <ChartContainer config={siteChartConfig} className="aspect-auto h-[240px] w-full">
                <BarChart data={siteComplianceData} margin={{ left: 12, right: 12, top: 20 }}>
                  <defs>
                    <linearGradient id="fillComplianceOverview" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted/50" />
                  <XAxis dataKey="site" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(v) => (v && v.length > 10 ? v.slice(0, 8) + '…' : v)} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
                  <Bar dataKey="compliance" fill="url(#fillComplianceOverview)" radius={[6, 6, 0, 0]}>
                    <LabelList position="top" offset={8} className="fill-foreground" fontSize={12} formatter={(v) => v + '%'} />
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Priority actions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>Priority Actions Required</CardTitle>
          {onRefresh && (
            <Button variant="ghost" size="sm" onClick={onRefresh}>
              Refresh
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <PriorityActionsTable
              predictions={predictions}
              onSendReminder={() => {}}
              isSuperAdmin={isSuperAdmin}
              onViewAllAtRisk={onViewAllAtRisk}
            />
          )}
        </CardContent>
      </Card>

      {/* Today's Optimal Wash Windows */}
      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s Optimal Wash Windows</CardTitle>
          <CardDescription>Based on delivery schedules</CardDescription>
        </CardHeader>
        <CardContent>
          {washWindows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Run Fleet Analysis to generate optimal wash windows.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {washWindows.map((w) => {
                const start = typeof w.window_start === 'string' ? w.window_start.slice(0, 5) : '';
                const end = typeof w.window_end === 'string' ? w.window_end.slice(0, 5) : '';
                const label = w.window_label || `${start} - ${end}`;
                const count = Array.isArray(w.recommended_vehicle_refs) ? w.recommended_vehicle_refs.length : 0;
                const util = w.utilization_rate != null ? Math.round(Number(w.utilization_rate)) : null;
                return (
                  <div key={w.id} className="rounded-lg border border-border bg-muted/30 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      {start} – {end}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{label}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant={w.window_type === 'optimal' ? 'default' : 'secondary'}>
                        {w.window_type === 'optimal' ? 'Recommended' : w.window_type || 'Available'}
                      </Badge>
                      <span className="text-sm">{count} vehicles</span>
                      {util != null && <span className="text-xs text-muted-foreground">• {util}% utilized</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Driver Insights */}
      <PaginatedInsightList
        title="Driver Insights"
        description="Behavioral patterns detected"
        items={driverPatterns}
        pageSize={10}
        emptyMessage="Run Fleet Analysis to generate driver insights."
        renderItem={(d) => (
          <div key={d.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{d.driver_name}</p>
              <p className="text-sm text-muted-foreground">{d.pattern_description}</p>
              {d.is_positive && (
                <span className="mt-1 inline-block text-xs text-primary">Top performer</span>
              )}
            </div>
          </div>
        )}
      />

      {/* Site Intelligence */}
      <PaginatedInsightList
        title="Site Intelligence"
        description="Location-based patterns and recommendations"
        items={siteInsights}
        pageSize={10}
        emptyMessage="Run Fleet Analysis to generate site insights."
        renderItem={(s) => (
          <div key={s.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <MapPin className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium">{s.site_name}</p>
                {s.compliance_rate != null && (
                  <span className="text-sm font-medium text-muted-foreground">
                    {Math.round(Number(s.compliance_rate))}%
                  </span>
                )}
              </div>
              {s.recommendation && (
                <p className="text-sm text-muted-foreground mt-0.5">{s.recommendation}</p>
              )}
            </div>
          </div>
        )}
      />
    </div>
  );
}
