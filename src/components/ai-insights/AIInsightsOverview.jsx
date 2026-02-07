import React, { useState, useMemo } from 'react';
import { Sparkles, ChevronRight, Clock, User, MapPin, TrendingUp, AlertTriangle } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, LabelList, Pie, PieChart, XAxis, Line, LineChart, YAxis } from 'recharts';
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
import { Skeleton } from '@/components/ui/skeleton';

const PRIORITY_ACTIONS_PAGE_SIZES = [5, 10, 20];

function CardBasedInsightList({ title, description, items = [], pageSize = 10, emptyMessage, renderCard }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const slice = items.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  
  if (items.length === 0) {
    return (
      <div>
        <div className="mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Card className="border-dashed">
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground text-center">{emptyMessage}</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div>
      <div className="mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        {slice.map(renderCard)}
      </div>
      {totalPages > 1 && (
        <DataPagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={items.length}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}

const RISK_COLORS = {
  critical: 'bg-destructive text-destructive-foreground',
  high: 'bg-amber-500 text-white',
  medium: 'bg-yellow-500 text-black',
  low: 'bg-primary text-primary-foreground',
};

const RISK_BORDER_COLORS = {
  critical: 'border-destructive/50',
  high: 'border-amber-500/50',
  medium: 'border-yellow-500/50',
  low: 'border-primary/50',
};

function PriorityActionsTable({ predictions, onViewAllAtRisk }) {
  const priorityAll = useMemo(
    () => (predictions || []).filter((p) => ['critical', 'high'].includes(p.risk_level)),
    [predictions]
  );
  const atRiskTotal = priorityAll.length;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const totalPages = Math.max(1, Math.ceil(atRiskTotal / pageSize));
  const currentPage = Math.min(page, totalPages);
  const priority = useMemo(
    () => priorityAll.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [priorityAll, currentPage, pageSize]
  );

  if (priorityAll.length === 0) {
    return (
      <p className="text-muted-foreground text-sm py-4">No priority actions. Run Fleet Analysis to refresh.</p>
    );
  }

  return (
    <div className="space-y-4">
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
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {priority.map((p) => (
          <Card 
            key={p.id} 
            className={`relative overflow-hidden border-l-4 ${RISK_BORDER_COLORS[p.risk_level] || RISK_BORDER_COLORS.medium}`}
          >
            <CardContent className="p-4">
              <div className="space-y-3">
                {/* Header: Vehicle Info */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-lg font-bold text-foreground tracking-tight">
                      {p.vehicle_name || p.vehicle_ref}
                    </h4>
                    {(p.site_name || p.company_name) && (
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {[p.site_name, p.company_name].filter(Boolean).join(' | ')}
                      </p>
                    )}
                  </div>
                  <Badge className={`${RISK_COLORS[p.risk_level] || RISK_COLORS.medium} shrink-0 font-semibold uppercase text-xs`}>
                    {p.risk_level}
                  </Badge>
                </div>

                {/* Insight Description */}
                <div className="space-y-2">
                  <p className="text-sm text-foreground leading-relaxed">
                    {p.reasoning}
                  </p>
                  
                  {p.recommended_action && (
                    <div className="flex items-start gap-2 rounded-md bg-primary/5 border border-primary/20 p-2.5">
                      <AlertTriangle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <p className="text-sm text-primary font-medium leading-relaxed">
                        {p.recommended_action}
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer: Confidence */}
                {p.confidence_score != null && (
                  <div className="pt-2 border-t">
                    <span className="text-xs text-muted-foreground font-medium">
                      {Math.round(Number(p.confidence_score))}% confidence
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
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
  sitesForCustomer = [],
  viewSiteFilter = 'all',
  onSiteFilterChange,
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
    <div className="space-y-8">
      {/* Site Filter - Add at top of Overview tab */}
      {sitesForCustomer.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Filter by site:</span>
          <Select value={viewSiteFilter} onValueChange={onSiteFilterChange}>
            <SelectTrigger className="w-[220px]">
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

      {/* Summary banner */}
      <Card className="overflow-hidden bg-gradient-to-r from-primary/90 to-primary/70 text-primary-foreground border-0">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-3 opacity-90">
            <Sparkles className="h-5 w-5" />
            <span className="text-sm font-medium">AI Summary • Based on ASI Wash Data</span>
          </div>
          <h2 className="text-2xl font-bold">
            {atRiskCount > 0 ? `Your fleet needs attention today` : `Fleet status`}
          </h2>
          <p className="mt-2 text-primary-foreground/90 text-base">
            {atRiskCount > 0
              ? `${atRiskCount} vehicle${atRiskCount !== 1 ? 's are' : ' is'} at risk of missing weekly target.`
              : 'No vehicles currently at critical or high risk.'}
          </p>
        </CardContent>
      </Card>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-primary">At Risk Vehicles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {isLoading ? (
                <Skeleton className="h-9 w-20" />
              ) : (
                <span className="text-3xl font-bold text-foreground">{atRiskCount}</span>
              )}
              <p className="text-xs text-muted-foreground">Next 48 hours</p>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-primary">Active Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {isLoading ? (
                <Skeleton className="h-9 w-20" />
              ) : (
                <span className="text-3xl font-bold text-foreground">{pendingRecs}</span>
              )}
              <p className="text-xs text-muted-foreground">
                {highPriorityRecs} high priority
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-primary">Predicted Compliance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <span className="text-3xl font-bold text-foreground">{predictedCompliance}%</span>
              <p className="text-xs text-muted-foreground">End of week forecast</p>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-primary">Optimization Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <span className="text-3xl font-bold text-foreground">B+</span>
              <p className="text-xs text-muted-foreground">Fleet efficiency</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts row: Risk distribution (Pie) + Site compliance (Bar) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle>Risk Distribution</CardTitle>
            <CardDescription>Vehicles by risk level across your fleet</CardDescription>
          </CardHeader>
          <CardContent>
            {riskDistributionData.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-muted-foreground">Run Fleet Analysis to see risk distribution.</p>
              </div>
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
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle>Site Compliance</CardTitle>
            <CardDescription>Compliance rate by site location</CardDescription>
          </CardHeader>
          <CardContent>
            {siteComplianceData.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-muted-foreground">Run Fleet Analysis to see site compliance.</p>
              </div>
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
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-xl">Priority Actions Required</CardTitle>
            <CardDescription className="mt-1">Critical and high-risk vehicles needing immediate attention</CardDescription>
          </div>
          {/* {onRefresh && (
            <Button variant="ghost" size="sm" onClick={onRefresh}>
              Refresh
            </Button>
          )} */}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <PriorityActionsTable
              predictions={predictions}
              onViewAllAtRisk={onViewAllAtRisk}
            />
          )}
        </CardContent>
      </Card>

      {/* Today's Optimal Wash Windows */}
      <div>
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Today&apos;s Optimal Wash Windows</h3>
          <p className="text-sm text-muted-foreground">Based on delivery schedules and site availability</p>
        </div>
        {washWindows.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8">
              <p className="text-sm text-muted-foreground text-center">
                Run Fleet Analysis to generate optimal wash windows.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {washWindows.map((w) => {
              const start = typeof w.window_start === 'string' ? w.window_start.slice(0, 5) : '';
              const end = typeof w.window_end === 'string' ? w.window_end.slice(0, 5) : '';
              const label = w.window_label || `${start} - ${end}`;
              const count = Array.isArray(w.recommended_vehicle_refs) ? w.recommended_vehicle_refs.length : 0;
              const util = w.utilization_rate != null ? Math.round(Number(w.utilization_rate)) : null;
              const isOptimal = w.window_type === 'optimal';
              
              return (
                <Card 
                  key={w.id} 
                  className={`hover:shadow-md transition-shadow ${isOptimal ? 'border-primary/50 bg-primary/5' : ''}`}
                >
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      {/* Time Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                            <Clock className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-base font-bold text-foreground">
                              {start} – {end}
                            </p>
                            <p className="text-xs text-muted-foreground">{label}</p>
                          </div>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Vehicles</span>
                          <span className="font-semibold text-foreground">{count}</span>
                        </div>
                        {util != null && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Utilization</span>
                            <span className="font-semibold text-foreground">{util}%</span>
                          </div>
                        )}
                      </div>

                      {/* Badge */}
                      <Badge 
                        variant={isOptimal ? 'default' : 'secondary'} 
                        className="w-full justify-center"
                      >
                        {isOptimal ? 'Recommended' : w.window_type || 'Available'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Driver Insights - Card-based layout */}
      <CardBasedInsightList
        title="Driver Insights"
        description="Behavioral patterns detected across your fleet"
        items={driverPatterns}
        pageSize={9}
        emptyMessage="Run Fleet Analysis to generate driver insights."
        renderCard={(d) => (
          <Card key={d.id} className="h-full hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="space-y-3">
                {/* Driver Header */}
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-base text-foreground truncate">
                      {d.driver_name}
                    </h4>
                    {(d.site_name || d.vehicle_name) && (
                      <p className="text-xs text-muted-foreground truncate">
                        {[d.vehicle_name, d.site_name].filter(Boolean).join(' • ')}
                      </p>
                    )}
                  </div>
                </div>

                {/* Pattern Description */}
                <p className="text-sm text-foreground leading-relaxed">
                  {d.pattern_description}
                </p>

                {/* Footer badges/indicators */}
                <div className="flex items-center gap-2 pt-2 border-t">
                  {d.is_positive && (
                    <Badge variant="default" className="text-xs font-medium">
                      Top Performer
                    </Badge>
                  )}
                  {d.confidence_score != null && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      {Math.round(Number(d.confidence_score))}% confidence
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      />

      {/* Site Intelligence - Card-based layout */}
      <CardBasedInsightList
        title="Site Intelligence"
        description="Location-based patterns and recommendations"
        items={siteInsights}
        pageSize={9}
        emptyMessage="Run Fleet Analysis to generate site insights."
        renderCard={(s) => (
          <Card key={s.id} className="h-full hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="space-y-3">
                {/* Site Header */}
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-base text-foreground">
                      {s.site_name}
                    </h4>
                    {s.company_name && (
                      <p className="text-xs text-muted-foreground truncate">
                        {s.company_name}
                      </p>
                    )}
                  </div>
                  {s.compliance_rate != null && (
                    <Badge variant="outline" className="shrink-0 font-semibold">
                      {Math.round(Number(s.compliance_rate))}%
                    </Badge>
                  )}
                </div>

                {/* Recommendation */}
                {s.recommendation && (
                  <p className="text-sm text-foreground leading-relaxed">
                    {s.recommendation}
                  </p>
                )}

                {/* Footer info */}
                {(s.vehicle_count || s.avg_wash_frequency) && (
                  <div className="flex items-center gap-3 pt-2 border-t text-xs text-muted-foreground">
                    {s.vehicle_count && (
                      <span>{s.vehicle_count} vehicles</span>
                    )}
                    {s.avg_wash_frequency && (
                      <span>Avg: {s.avg_wash_frequency} washes/week</span>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      />
    </div>
  );
}
