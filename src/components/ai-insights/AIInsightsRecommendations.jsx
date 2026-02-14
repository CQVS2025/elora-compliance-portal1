import React, { useMemo, useState } from 'react';
import { Pie, PieChart, Cell } from 'recharts';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, AlertTriangle, CheckCircle2, X, RotateCcw, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

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

export default function AIInsightsRecommendations({ 
  recommendations, 
  isLoading, 
  onRefresh,
  sitesForCustomer = [],
  viewSiteFilter = 'all',
  onSiteFilterChange,
}) {
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedRecommendation, setSelectedRecommendation] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [groupPage, setGroupPage] = useState(1);
  const GROUP_PAGE_SIZE = 20;

  // Handler for clicking on chart segments to filter
  const handleChartClick = (data) => {
    if (!data || !data.name) return;
    const priorityValue = data.name.toLowerCase();
    // Toggle: if already selected, clear it; otherwise set it
    setPriorityFilter(prev => prev === priorityValue ? 'all' : priorityValue);
  };

  // Clear all filters
  const clearFilters = () => {
    setPriorityFilter('all');
    setStatusFilter('all');
    setTypeFilter('all');
  };

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (priorityFilter !== 'all') count++;
    if (statusFilter !== 'all') count++;
    if (typeFilter !== 'all') count++;
    return count;
  }, [priorityFilter, statusFilter, typeFilter]);

  const filteredRecommendations = useMemo(() => {
    let list = recommendations || [];
    if (priorityFilter !== 'all') list = list.filter((r) => r.priority === priorityFilter);
    if (statusFilter !== 'all') list = list.filter((r) => r.status === statusFilter);
    if (typeFilter === 'vehicle') list = list.filter((r) => r.vehicle_ref || r.vehicle_name);
    if (typeFilter === 'fleet') list = list.filter((r) => !r.vehicle_ref && !r.vehicle_name);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((r) =>
        (r.title || '').toLowerCase().includes(q) ||
        (r.vehicle_name || '').toLowerCase().includes(q) ||
        (r.vehicle_ref || '').toLowerCase().includes(q) ||
        (r.site_name || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [recommendations, priorityFilter, statusFilter, typeFilter, searchQuery]);

  const groupedByVehicle = useMemo(() => {
    const groups = new Map();
    for (const r of filteredRecommendations) {
      const key = r.vehicle_ref || r.vehicle_name || null;
      const groupKey = key ?? `fleet-${r.id}`;
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          key: groupKey,
          label: key ? (r.vehicle_name || r.vehicle_ref) : 'Fleet-wide',
          site: r.site_name || null,
          items: [],
        });
      }
      groups.get(groupKey).items.push(r);
    }
    return Array.from(groups.values());
  }, [filteredRecommendations]);

  const totalGroupPages = Math.max(1, Math.ceil(groupedByVehicle.length / GROUP_PAGE_SIZE));
  const paginatedGroups = useMemo(
    () => groupedByVehicle.slice((groupPage - 1) * GROUP_PAGE_SIZE, groupPage * GROUP_PAGE_SIZE),
    [groupedByVehicle, groupPage]
  );

  const toggleGroup = (key) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const priorityChartData = useMemo(() => {
    const list = recommendations || [];
    return [
      { name: 'Critical', value: list.filter((r) => r.priority === 'critical').length, fill: 'hsl(var(--chart-critical))' },
      { name: 'High', value: list.filter((r) => r.priority === 'high').length, fill: 'hsl(var(--chart-high))' },
      { name: 'Medium', value: list.filter((r) => r.priority === 'medium').length, fill: 'hsl(var(--chart-medium))' },
      { name: 'Low', value: list.filter((r) => r.priority === 'low').length, fill: 'hsl(var(--chart-low))' },
    ].filter((d) => d.value > 0);
  }, [recommendations]);

  const priorityChartConfig = {
    value: { label: 'Recommendations' },
    Critical: { label: 'Critical', color: 'hsl(var(--chart-critical))' },
    High: { label: 'High', color: 'hsl(var(--chart-high))' },
    Medium: { label: 'Medium', color: 'hsl(var(--chart-medium))' },
    Low: { label: 'Low', color: 'hsl(var(--chart-low))' },
  };

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

      {/* Chart: Priority (Interactive Pie Chart) */}
      {priorityChartData.length > 0 && !isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Recommendations by Priority</CardTitle>
              <CardDescription>Click on a segment to filter by priority level</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={priorityChartConfig} className="mx-auto aspect-square max-h-[280px]">
                <PieChart 
                  onClick={(data) => {
                    if (data && data.activePayload && data.activePayload[0]) {
                      handleChartClick(data.activePayload[0].payload);
                    }
                  }}
                >
                  <ChartTooltip 
                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.2 }} 
                    content={<ChartTooltipContent hideLabel indicator="dot" />} 
                  />
                  <Pie
                    data={priorityChartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    strokeWidth={5}
                    stroke="hsl(var(--background))"
                    className="cursor-pointer"
                  >
                    {priorityChartData.map((entry, index) => {
                      const isSelected = priorityFilter === entry.name.toLowerCase();
                      return (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.fill}
                          opacity={isSelected ? 1 : (priorityFilter !== 'all' ? 0.3 : 0.9)}
                          className="transition-opacity hover:opacity-100"
                        />
                      );
                    })}
                  </Pie>
                  <ChartLegend 
                    content={<ChartLegendContent nameKey="name" />} 
                    className="-translate-y-2 flex-wrap gap-x-4 gap-y-1 *:justify-center" 
                  />
                </PieChart>
              </ChartContainer>
              <p className="text-xs text-muted-foreground text-center mt-2">
                {priorityFilter !== 'all' 
                  ? `Filtered by: ${PRIORITY_OPTIONS.find(o => o.value === priorityFilter)?.label || priorityFilter}` 
                  : 'Click a segment to filter by priority'}
              </p>
            </CardContent>
          </Card>
          
          {/* Summary Stats Card */}
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Recommendations Summary
              </CardTitle>
              <CardDescription>Overview of actionable insights</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b">
                <span className="text-sm text-primary font-semibold">Total Recommendations</span>
                <span className="text-2xl font-bold text-foreground">{recommendations?.length || 0}</span>
              </div>
              <div className="flex items-center justify-between pb-3 border-b">
                <span className="text-sm text-primary font-semibold">High Priority</span>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span className="text-xl font-semibold text-foreground">
                    {(recommendations || []).filter(r => r.priority === 'critical' || r.priority === 'high').length}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-primary font-semibold">Potential Compliance Gain</span>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span className="text-xl font-semibold text-primary">
                    {Math.round((recommendations || []).reduce((sum, r) => sum + (Number(r.potential_compliance_gain) || 0), 0) / Math.max(1, recommendations?.length || 1))}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recommendation Detail Modal */}
      <Dialog open={!!selectedRecommendation} onOpenChange={(open) => !open && setSelectedRecommendation(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <DialogTitle className="text-xl">{selectedRecommendation?.title || 'Recommendation Details'}</DialogTitle>
                <DialogDescription className="mt-1">
                  {selectedRecommendation?.vehicle_name || selectedRecommendation?.vehicle_ref 
                    ? `For vehicle: ${selectedRecommendation.vehicle_name || selectedRecommendation.vehicle_ref}` 
                    : 'Fleet-wide recommendation'}
                </DialogDescription>
              </div>
              <Badge className={cn(
                "shrink-0",
                PRIORITY_COLORS[selectedRecommendation?.priority] || PRIORITY_COLORS.low
              )}>
                {selectedRecommendation?.priority}
              </Badge>
            </div>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            {/* Description */}
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-2">Description</h4>
              <p className="text-sm text-foreground leading-relaxed">
                {selectedRecommendation?.description}
              </p>
            </div>

            {/* Reasoning */}
            {selectedRecommendation?.reasoning && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-2">Why this recommendation?</h4>
                <p className="text-sm text-foreground leading-relaxed">
                  {selectedRecommendation.reasoning}
                </p>
              </div>
            )}

            {/* Key Details */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Type</p>
                <p className="text-sm font-medium">
                  {selectedRecommendation?.vehicle_ref || selectedRecommendation?.vehicle_name ? 'Vehicle-specific' : 'Fleet-wide'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Compliance Gain</p>
                <p className="text-sm font-semibold text-primary">
                  {selectedRecommendation?.potential_compliance_gain 
                    ? `+${Number(selectedRecommendation.potential_compliance_gain)}%` 
                    : 'N/A'}
                </p>
              </div>
              {selectedRecommendation?.site_name && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Site</p>
                  <p className="text-sm font-medium">{selectedRecommendation.site_name}</p>
                </div>
              )}
              {selectedRecommendation?.vehicle_name && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Vehicle</p>
                  <p className="text-sm font-medium">{selectedRecommendation.vehicle_name}</p>
                </div>
              )}
            </div>

            {/* Suggested Action */}
            {selectedRecommendation?.suggested_action && (
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <h4 className="text-sm font-semibold text-primary mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Suggested Action
                </h4>
                <p className="text-sm text-foreground leading-relaxed">
                  {selectedRecommendation.suggested_action}
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
          <div className="space-y-3">
            {/* Active Filters Badge */}
            {activeFiltersCount > 0 && (
              <div className="flex items-center gap-2 flex-wrap px-6 pt-4">
                <span className="text-sm font-medium text-muted-foreground">Active filters:</span>
                {priorityFilter !== 'all' && (
                  <Badge variant="secondary" className="gap-1">
                    Priority: {PRIORITY_OPTIONS.find(o => o.value === priorityFilter)?.label}
                    <button
                      onClick={() => setPriorityFilter('all')}
                      className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {statusFilter !== 'all' && (
                  <Badge variant="secondary" className="gap-1">
                    Status: {STATUS_OPTIONS.find(o => o.value === statusFilter)?.label}
                    <button
                      onClick={() => setStatusFilter('all')}
                      className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {typeFilter !== 'all' && (
                  <Badge variant="secondary" className="gap-1">
                    Type: {TYPE_OPTIONS.find(o => o.value === typeFilter)?.label}
                    <button
                      onClick={() => setTypeFilter('all')}
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

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-2">
                <h3 className="text-lg font-semibold">Recommendations</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Filter by title, vehicle, or site..."
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); setGroupPage(1); }}
                      className="pl-8 w-[220px] h-9"
                    />
                  </div>
                  <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setGroupPage(1); }}>
                    <SelectTrigger className="w-[180px] h-9">
                      <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={priorityFilter} onValueChange={(v) => { setPriorityFilter(v); setGroupPage(1); }}>
                    <SelectTrigger className="w-[160px] h-9">
                      <SelectValue placeholder="Filter by priority" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                </div>
              </div>
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="w-10" />
                      <TableHead>Vehicle / Scope</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead className="max-w-[280px]">Description</TableHead>
                      <TableHead>Compliance gain</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedGroups.map((group) => {
                      const isExpanded = expandedGroups.has(group.key);
                      const hasMultiple = group.items.length > 1;
                      return (
                        <React.Fragment key={group.key}>
                          <TableRow
                            className={cn(
                              'cursor-pointer hover:bg-muted/50',
                              hasMultiple && 'font-medium'
                            )}
                            onClick={() => {
                              if (hasMultiple) {
                                toggleGroup(group.key);
                              } else {
                                setSelectedRecommendation(group.items[0]);
                              }
                            }}
                          >
                            <TableCell className="w-10 py-2">
                              {hasMultiple ? (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); toggleGroup(group.key); }}
                                  className="p-0.5 rounded hover:bg-muted"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </button>
                              ) : (
                                <span className="w-4 inline-block" />
                              )}
                            </TableCell>
                            <TableCell className="py-2">
                              <span className="font-medium">{group.label}</span>
                              {group.site && <span className="text-muted-foreground text-sm ml-1">({group.site})</span>}
                              {hasMultiple && (
                                <Badge variant="secondary" className="ml-2 text-xs">
                                  {group.items.length}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="py-2">
                              {hasMultiple ? (
                                <div className="flex gap-1 flex-wrap">
                                  {[...new Set(group.items.map((r) => r.priority))].map((p) => (
                                    <Badge key={p} className={cn('text-xs', PRIORITY_COLORS[p] || PRIORITY_COLORS.low)}>
                                      {p}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <Badge className={PRIORITY_COLORS[group.items[0]?.priority] || PRIORITY_COLORS.low}>
                                  {group.items[0]?.priority}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="py-2">
                              {hasMultiple && !isExpanded
                                ? `${group.items.length} recommendations`
                                : group.items[0]?.title}
                            </TableCell>
                            <TableCell className="py-2 max-w-[280px]">
                              {hasMultiple && !isExpanded ? (
                                <span className="text-muted-foreground text-sm">Click to expand</span>
                              ) : (
                                <span className="line-clamp-2 text-sm" title={group.items[0]?.description}>
                                  {group.items[0]?.description}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="py-2">
                              {group.items[0]?.potential_compliance_gain != null
                                ? `${Number(group.items[0].potential_compliance_gain)}%`
                                : '—'}
                            </TableCell>
                          </TableRow>
                          {isExpanded &&
                            group.items.map((rec, idx) => (
                              <TableRow
                                key={rec.id || idx}
                                className="cursor-pointer hover:bg-muted/30 bg-muted/10"
                                onClick={() => setSelectedRecommendation(rec)}
                              >
                                <TableCell className="w-10 py-2" />
                                <TableCell className="py-2 pl-8 text-sm text-muted-foreground">
                                  {rec.vehicle_name || rec.vehicle_ref || rec.site_name || '—'}
                                </TableCell>
                                <TableCell className="py-2">
                                  <Badge className={PRIORITY_COLORS[rec.priority] || PRIORITY_COLORS.low}>
                                    {rec.priority}
                                  </Badge>
                                </TableCell>
                                <TableCell className="py-2 font-medium">{rec.title}</TableCell>
                                <TableCell className="py-2 max-w-[280px]">
                                  <span className="line-clamp-2 text-sm" title={rec.description}>
                                    {rec.description}
                                  </span>
                                </TableCell>
                                <TableCell className="py-2">
                                  {rec.potential_compliance_gain != null
                                    ? `${Number(rec.potential_compliance_gain)}%`
                                    : '—'}
                                </TableCell>
                              </TableRow>
                            ))}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {totalGroupPages > 1 && (
                <div className="flex items-center justify-between px-6 py-3 border-t">
                  <p className="text-sm text-muted-foreground">
                    Showing {((groupPage - 1) * GROUP_PAGE_SIZE) + 1}–{Math.min(groupPage * GROUP_PAGE_SIZE, groupedByVehicle.length)} of {groupedByVehicle.length} vehicle groups
                  </p>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setGroupPage((p) => Math.max(1, p - 1))}
                          className={groupPage <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                      {Array.from({ length: Math.min(5, totalGroupPages) }, (_, i) => {
                        const p = groupPage <= 3 ? i + 1 : Math.min(groupPage - 2 + i, totalGroupPages);
                        return (
                          <PaginationItem key={p}>
                            <PaginationLink
                              onClick={() => setGroupPage(p)}
                              isActive={groupPage === p}
                              className="cursor-pointer"
                            >
                              {p}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setGroupPage((p) => Math.min(totalGroupPages, p + 1))}
                          className={groupPage >= totalGroupPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
