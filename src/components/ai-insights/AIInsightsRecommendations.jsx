import React, { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, Pie, PieChart, XAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
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
import { Skeleton } from '@/components/ui/skeleton';

const PRIORITY_COLORS = {
  critical: 'bg-destructive/90 text-destructive-foreground',
  high: 'bg-amber-500/90 text-white',
  medium: 'bg-yellow-500/80 text-black',
  low: 'bg-primary/80 text-primary-foreground',
};

const PRIORITY_OPTIONS = [
  { value: 'all', label: 'All priorities' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'dismissed', label: 'Dismissed' },
  { value: 'completed', label: 'Completed' },
];

const TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: 'vehicle', label: 'Vehicle-specific' },
  { value: 'fleet', label: 'Schedule optimization' },
];

export default function AIInsightsRecommendations({ recommendations, isLoading, onRefresh }) {
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const filteredRecommendations = useMemo(() => {
    let list = recommendations || [];
    if (priorityFilter !== 'all') list = list.filter((r) => r.priority === priorityFilter);
    if (statusFilter !== 'all') list = list.filter((r) => r.status === statusFilter);
    if (typeFilter === 'vehicle') list = list.filter((r) => r.vehicle_ref || r.vehicle_name);
    if (typeFilter === 'fleet') list = list.filter((r) => !r.vehicle_ref && !r.vehicle_name);
    return list;
  }, [recommendations, priorityFilter, statusFilter, typeFilter]);

  const priorityChartData = useMemo(() => {
    const list = recommendations || [];
    return [
      { name: 'Critical', value: list.filter((r) => r.priority === 'critical').length, fill: 'hsl(var(--chart-critical))' },
      { name: 'High', value: list.filter((r) => r.priority === 'high').length, fill: 'hsl(var(--chart-high))' },
      { name: 'Medium', value: list.filter((r) => r.priority === 'medium').length, fill: 'hsl(var(--chart-medium))' },
      { name: 'Low', value: list.filter((r) => r.priority === 'low').length, fill: 'hsl(var(--chart-low))' },
    ].filter((d) => d.value > 0);
  }, [recommendations]);

  const statusChartData = useMemo(() => {
    const list = recommendations || [];
    return [
      { status: 'Pending', count: list.filter((r) => r.status === 'pending').length },
      { status: 'Accepted', count: list.filter((r) => r.status === 'accepted').length },
      { status: 'Completed', count: list.filter((r) => r.status === 'completed').length },
      { status: 'Dismissed', count: list.filter((r) => r.status === 'dismissed').length },
    ].filter((d) => d.count > 0);
  }, [recommendations]);

  const priorityChartConfig = {
    value: { label: 'Recommendations' },
    Critical: { label: 'Critical', color: 'hsl(var(--chart-critical))' },
    High: { label: 'High', color: 'hsl(var(--chart-high))' },
    Medium: { label: 'Medium', color: 'hsl(var(--chart-medium))' },
    Low: { label: 'Low', color: 'hsl(var(--chart-low))' },
  };
  const statusChartConfig = { count: { label: 'Count' }, primary: { label: 'Recommendations', color: 'hsl(var(--primary))' } };

  const columns = [
    {
      id: 'type',
      header: 'Type',
      cell: (row) => (row.vehicle_ref || row.vehicle_name ? 'Vehicle' : 'Fleet'),
    },
    {
      id: 'vehicle_site',
      header: 'Vehicle / Scope',
      accessorKey: 'vehicle_name',
      cell: (row) => row.vehicle_name || row.vehicle_ref || (row.site_name || '—'),
    },
    {
      id: 'priority',
      header: 'Priority',
      cell: (row) => (
        <Badge className={PRIORITY_COLORS[row.priority] || PRIORITY_COLORS.low}>{row.priority}</Badge>
      ),
    },
    { id: 'title', header: 'Title', accessorKey: 'title' },
    {
      id: 'description',
      header: 'Description',
      accessorKey: 'description',
      cell: (row) => (
        <span className="line-clamp-2 max-w-[280px]" title={row.description}>
          {row.description}
        </span>
      ),
    },
    {
      id: 'gain',
      header: 'Compliance gain',
      cell: (row) =>
        row.potential_compliance_gain != null ? `${Number(row.potential_compliance_gain)}%` : '—',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Charts: Priority (Pie) + Status (Bar) */}
      {(priorityChartData.length > 0 || statusChartData.length > 0) && !isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {priorityChartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recommendations by priority</CardTitle>
                <CardDescription>Distribution by priority level</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={priorityChartConfig} className="mx-auto aspect-square max-h-[260px]">
                  <PieChart>
                    <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel indicator="dot" />} />
                    <Pie
                      data={priorityChartData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      strokeWidth={4}
                      stroke="transparent"
                    />
                    <ChartLegend content={<ChartLegendContent nameKey="name" />} className="-translate-y-2 flex-wrap gap-x-4 gap-y-1 *:justify-center" />
                  </PieChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}
          {statusChartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recommendations by status</CardTitle>
                <CardDescription>Pending, completed, and more</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={statusChartConfig} className="aspect-auto h-[240px] w-full">
                  <BarChart data={statusChartData} margin={{ left: 12, right: 12, top: 20 }}>
                    <defs>
                      <linearGradient id="fillStatusRecs" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted/50" />
                    <XAxis dataKey="status" tickLine={false} axisLine={false} tickMargin={8} />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
                    <Bar dataKey="count" fill="url(#fillStatusRecs)" radius={[6, 6, 0, 0]}>
                      <LabelList position="top" offset={8} className="fill-foreground" fontSize={12} />
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Card>
        {isLoading ? (
          <CardContent className="pt-6">
            <Skeleton className="h-32 w-full" />
          </CardContent>
        ) : !filteredRecommendations.length ? (
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm py-8">
              {recommendations?.length
                ? 'No recommendations match the current filters.'
                : 'No recommendations yet. Run Fleet Analysis to generate.'}
            </p>
          </CardContent>
        ) : (
          <DataTable
            columns={columns}
            data={filteredRecommendations}
            getRowId={(row) => row.id}
            searchPlaceholder="Search title, vehicle, site..."
            title="Recommendations"
            pageSize={20}
            headerExtra={
              <>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[160px] h-9">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {onRefresh && (
                  <Button variant="ghost" size="sm" onClick={onRefresh}>
                    Refresh
                  </Button>
                )}
              </>
            }
          />
        )}
      </Card>
    </div>
  );
}
