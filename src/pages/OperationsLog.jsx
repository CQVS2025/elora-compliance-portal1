import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  List,
  Hash,
  LayoutGrid,
  Calendar as CalendarIcon,
  Download,
  Plus,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useAuth } from '@/lib/AuthContext';
import { usePermissions } from '@/components/auth/PermissionGuard';
import {
  customersOptions,
  sitesOptions,
  vehiclesOptions,
  operationsLogCategoriesOptions,
  operationsLogEntriesOptions,
  productsOptions,
  operationsLogMyPermissionsOptions,
} from '@/query/options';
import { supabase } from '@/lib/supabase';
import { OperationsLogFeedView } from '@/components/operations-log/OperationsLogFeedView';
import { OperationsLogTableView } from '@/components/operations-log/OperationsLogTableView';
import { OperationsLogBoardView } from '@/components/operations-log/OperationsLogBoardView';
import { OperationsLogCalendarView } from '@/components/operations-log/OperationsLogCalendarView';
import { NewEntryModal } from '@/components/operations-log/NewEntryModal';
import {
  SummaryCardsSkeleton,
  ByCategoryBySiteSkeleton,
  ActivityFeedSkeleton,
  ActivityTableSkeleton,
  ActivityBoardSkeleton,
  ActivityCalendarSkeleton,
  FiltersRowSkeleton,
} from '@/components/operations-log/OperationsLogSkeletons';
import { MultiSelection } from '@/components/ui/multi-selection';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

const VIEWS = [
  { value: 'feed', label: 'Feed', icon: List },
  { value: 'table', label: 'Table', icon: Hash },
  { value: 'board', label: 'Board', icon: LayoutGrid },
  { value: 'calendar', label: 'Calendar', icon: CalendarIcon },
];

const OPS_LOG_CHART_CONFIG = {
  count: { label: 'Items', color: 'hsl(var(--primary))' },
  items: { label: 'Items', color: 'hsl(var(--primary))' },
};

const CATEGORY_CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--primary))',
];

export default function OperationsLog() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const permissions = usePermissions();
  const effectiveCompanyId = userProfile?.company_id ?? (permissions.isSuperAdmin ? 'all' : null);

  const [customerRef, setCustomerRef] = useState('all');
  const [siteRef, setSiteRef] = useState('all');
  const [vehicleRefs, setVehicleRefs] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState('feed');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [newEntryOpen, setNewEntryOpen] = useState(false);
  const onSelectEntry = (id) => id && navigate(`/operations-log/entry/${id}`);

  const { data: companyForCustomer } = useQuery({
    queryKey: ['companyForEloraCustomer', customerRef],
    queryFn: async () => {
      if (!customerRef || customerRef === 'all') return null;
      const { data } = await supabase
        .from('companies')
        .select('id')
        .eq('elora_customer_ref', customerRef)
        .maybeSingle();
      return data?.id ?? null;
    },
    enabled: !!customerRef && customerRef !== 'all' && (effectiveCompanyId === 'all' || !effectiveCompanyId),
  });

  const companyForQueries =
    effectiveCompanyId && effectiveCompanyId !== 'all'
      ? effectiveCompanyId
      : customerRef && customerRef !== 'all'
        ? companyForCustomer
        : effectiveCompanyId;

  const { data: customers = [], isLoading: customersLoading } = useQuery(customersOptions(effectiveCompanyId));
  const isSuperAdmin = permissions.isSuperAdmin;

  // For admins (not super_admin): default customer to their company's customer; dropdown has no "All Customers" option
  React.useEffect(() => {
    if (isSuperAdmin) return;
    if (effectiveCompanyId === 'all' || !effectiveCompanyId) return;
    if (customers.length > 0 && customerRef === 'all') {
      setCustomerRef(String(customers[0].id ?? customers[0].ref ?? ''));
    }
  }, [isSuperAdmin, effectiveCompanyId, customers, customerRef]);

  const { data: sitesRaw = [], isLoading: sitesLoading } = useQuery(
    sitesOptions(companyForQueries ?? effectiveCompanyId, {
      customerId: customerRef === 'all' ? undefined : customerRef,
    })
  );
  const sites = React.useMemo(() => {
    if (!customerRef || customerRef === 'all') return [];
    return (sitesRaw || []).filter(
      (s) =>
        String(s.customer_ref ?? '') === String(customerRef) ||
        String(s.id ?? s.ref ?? '') === String(customerRef)
    );
  }, [sitesRaw, customerRef]);

  const { data: vehiclesRaw = [], isLoading: vehiclesLoading } = useQuery({
    ...vehiclesOptions(companyForQueries ?? effectiveCompanyId, {
      customerId: customerRef === 'all' ? undefined : customerRef,
      siteId: siteRef === 'all' ? undefined : siteRef,
    }),
    enabled: !!(companyForQueries ?? effectiveCompanyId),
  });

  const vehicleOptions = React.useMemo(() => {
    let list = vehiclesRaw || [];
    if (siteRef && siteRef !== 'all') {
      list = list.filter(
        (v) => String(v.siteId ?? v.siteRef ?? v.site_id ?? '') === String(siteRef)
      );
    }
    return list
      .map((v) => ({
        value: String(v.vehicleRef ?? v.ref ?? v.id ?? ''),
        label: v.vehicleName ?? v.name ?? v.vehicleRef ?? v.ref ?? '—',
      }))
      .filter((o) => o.value);
  }, [vehiclesRaw, siteRef]);

  const { data: categories = [] } = useQuery(operationsLogCategoriesOptions());
  const { data: products = [] } = useQuery(productsOptions());
  const { data: myOpsPermissions } = useQuery(
    operationsLogMyPermissionsOptions(permissions.user?.id ?? userProfile?.id)
  );

  React.useEffect(() => {
    setPage(1);
  }, [customerRef, siteRef, vehicleRefs, statusFilter, categoryFilter, searchQuery]);

  const setCustomerRefAndReset = (v) => {
    setCustomerRef(v);
    setSiteRef('all');
    setVehicleRefs([]);
  };
  const setSiteRefAndReset = (v) => {
    setSiteRef(v);
    setVehicleRefs([]);
  };

  const resetFilters = () => {
    setCustomerRef('all');
    setSiteRef('all');
    setVehicleRefs([]);
    setStatusFilter('all');
    setCategoryFilter('all');
    setSearchQuery('');
    setPage(1);
  };

  const filters = useMemo(
    () => ({
      customerRef: customerRef === 'all' ? undefined : customerRef,
      siteRef: siteRef === 'all' ? undefined : siteRef,
      vehicleIds: vehicleRefs?.length > 0 ? vehicleRefs : undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
      categoryId: categoryFilter === 'all' ? undefined : categoryFilter,
      search: searchQuery.trim() || undefined,
      page,
      pageSize,
    }),
    [customerRef, siteRef, vehicleRefs, statusFilter, categoryFilter, searchQuery, page, pageSize]
  );

  const { data: entriesData, isLoading: entriesLoading } = useQuery(
    operationsLogEntriesOptions(effectiveCompanyId, filters)
  );
  const entries = entriesData?.entries ?? [];
  const totalEntries = entriesData?.total ?? 0;

  const summaryFilters = useMemo(
    () => ({
      customerRef: customerRef === 'all' ? undefined : customerRef,
      siteRef: siteRef === 'all' ? undefined : siteRef,
      vehicleIds: vehicleRefs?.length > 0 ? vehicleRefs : undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
      categoryId: categoryFilter === 'all' ? undefined : categoryFilter,
      search: searchQuery.trim() || undefined,
      page: 1,
      pageSize: 500,
    }),
    [customerRef, siteRef, vehicleRefs, statusFilter, categoryFilter, searchQuery]
  );
  const { data: summaryData, isLoading: summaryLoading } = useQuery(
    operationsLogEntriesOptions(effectiveCompanyId, summaryFilters)
  );
  const summaryEntries = summaryData?.entries ?? [];

  const siteRefToName = useMemo(() => {
    const m = {};
    (sitesRaw || []).forEach((s) => {
      const name = s.name ?? s.siteName ?? s.id ?? s.ref ?? '';
      if (name && (s.ref != null || s.id != null)) {
        if (s.ref != null) m[String(s.ref)] = name;
        if (s.id != null) m[String(s.id)] = name;
      }
    });
    return m;
  }, [sitesRaw]);

  const vehicleIdToName = useMemo(() => {
    const m = {};
    (vehiclesRaw || []).forEach((v) => {
      const name = v.vehicleName ?? v.name ?? v.vehicleRef ?? v.ref ?? '—';
      const ids = [
        v.vehicleRef,
        v.ref,
        v.id,
        v.internalVehicleId,
        v.vehicle_ref,
      ].filter((x) => x != null && x !== '');
      ids.forEach((id) => {
        m[String(id)] = name;
      });
    });
    return m;
  }, [vehiclesRaw]);

  const entriesWithDisplayNames = useMemo(() => {
    return (entries || []).map((e) => ({
      ...e,
      siteDisplayName: siteRefToName[String(e?.site_ref ?? '')] ?? e?.site_ref ?? '—',
      vehicleLinksWithNames: (e?.operations_log_vehicle_links ?? []).map((l) => ({
        ...l,
        displayName: vehicleIdToName[String(l?.vehicle_id ?? '')] ?? l?.vehicle_id ?? '—',
      })),
    }));
  }, [entries, siteRefToName, vehicleIdToName]);

  const summary = useMemo(() => {
    const list = summaryEntries;
    const now = new Date();
    const thisMonthStart = startOfMonth(now);
    const thisMonthEnd = endOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));

    const open = list.filter((e) => e.status === 'open');
    const inProgress = list.filter((e) => e.status === 'in_progress');
    const resolved = list.filter((e) => e.status === 'resolved');
    const resolvedThisMonth = list.filter(
      (e) => e.resolved_at && new Date(e.resolved_at) >= thisMonthStart && new Date(e.resolved_at) <= thisMonthEnd
    );
    const resolvedLastMonth = list.filter(
      (e) => e.resolved_at && new Date(e.resolved_at) >= lastMonthStart && new Date(e.resolved_at) <= lastMonthEnd
    );

    const urgentHigh = open.filter((e) => e.priority === 'urgent' || e.priority === 'high');
    const byCategory = {};
    list.forEach((e) => {
      const name = e.category?.name ?? 'Other';
      if (!byCategory[name]) byCategory[name] = 0;
      byCategory[name]++;
    });
    const bySite = {};
    list.forEach((e) => {
      const ref = e.site_ref || '';
      const siteName = ref ? (siteRefToName[ref] ?? ref) : 'Unknown site';
      if (!bySite[siteName]) bySite[siteName] = 0;
      bySite[siteName]++;
    });

    let avgResolutionDays = null;
    if (resolved.length > 0) {
      const withDates = resolved.filter((e) => e.resolved_at && e.created_at);
      if (withDates.length > 0) {
        const totalDays = withDates.reduce(
          (acc, e) => acc + (new Date(e.resolved_at) - new Date(e.created_at)) / (24 * 60 * 60 * 1000),
          0
        );
        avgResolutionDays = (totalDays / withDates.length).toFixed(1);
      }
    }

    const lastMonthCount = resolvedLastMonth.length;
    const thisMonthCount = resolvedThisMonth.length;
    const pctChange =
      lastMonthCount > 0 ? Math.round(((thisMonthCount - lastMonthCount) / lastMonthCount) * 100) : 0;

    return {
      openCount: open.length,
      urgentHigh: urgentHigh.length,
      inProgressCount: inProgress.length,
      resolvedThisMonth: resolvedThisMonth.length,
      pctChange,
      avgResolutionDays,
      byCategory: Object.entries(byCategory).map(([name, count]) => ({ name, count })),
      bySite: Object.entries(bySite).map(([site, count]) => ({ site, count })),
    };
  }, [summaryEntries, siteRefToName]);

  const canCreate =
    permissions.canEditOperationsLog &&
    (myOpsPermissions === undefined || myOpsPermissions?.can_create !== false);

  const handleExport = () => {
    const headers = ['Title', 'Site', 'Category', 'Priority', 'Status', 'Assigned', 'Due', 'Created'];
    const rows = entries.map((e) => [
      e.title,
      siteRefToName[e.site_ref] ?? e.site_ref ?? '',
      e.category?.name ?? '',
      e.priority,
      e.status,
      e.assigned_to ?? '',
      e.due_date ? format(new Date(e.due_date), 'dd/MM/yyyy') : '',
      e.created_at ? format(new Date(e.created_at), 'dd/MM/yyyy') : '',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `operations-log-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6 p-3 sm:p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight truncate">Operations Log</h1>
          <p className="text-sm text-muted-foreground">Site activity tracking, notes & task management.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={entriesLoading}>
            <Download className="mr-2 size-4" />
            Export
          </Button>
          {canCreate && (
            <Button size="sm" onClick={() => setNewEntryOpen(true)}>
              <Plus className="mr-2 size-4" />
              New Entry
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {customersLoading ? (
          <FiltersRowSkeleton />
        ) : (
          <>
            <div className="w-full min-w-0 sm:w-auto sm:min-w-[180px]">
              <Select
                value={customerRef}
                onValueChange={setCustomerRefAndReset}
              >
                <SelectTrigger className="w-full sm:w-[200px] min-w-0">
                  <SelectValue placeholder={isSuperAdmin ? 'Customer' : (customers[0]?.name ?? 'Customer')} />
                </SelectTrigger>
                <SelectContent>
                  {isSuperAdmin && (
                    <SelectItem value="all">All Customers</SelectItem>
                  )}
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full min-w-0 sm:w-auto sm:min-w-[160px]">
              <Select
                value={siteRef}
                onValueChange={setSiteRefAndReset}
                disabled={!customerRef || customerRef === 'all'}
              >
                <SelectTrigger className="w-full sm:w-[180px] min-w-0">
                  <SelectValue placeholder={customerRef === 'all' ? 'Select customer first' : 'Site'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sites</SelectItem>
                  {sites.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name ?? s.siteName ?? s.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full min-w-0 sm:min-w-[200px] sm:max-w-[280px]">
              <MultiSelection
                value={vehicleRefs}
                options={vehicleOptions}
                onValueSelected={(ids) => setVehicleRefs(ids ?? [])}
                isLoading={vehiclesLoading}
                placeholder="Select vehicles"
              />

            </div>
            <div className="w-full min-w-0 sm:w-auto flex flex-wrap items-center gap-2 sm:gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[140px] min-w-0">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-[160px] min-w-0">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Search…"
                className="w-full min-w-0 sm:w-[160px] flex-1 sm:flex-initial"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Button variant="ghost" size="sm" onClick={resetFilters} className="text-muted-foreground hover:text-foreground shrink-0">
                <RotateCcw className="mr-1.5 size-4" />
                Reset
              </Button>
            </div>
            <div className="w-full sm:w-auto flex items-center justify-end sm:ml-auto">
              <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v)} className="border rounded-md inline-flex flex-wrap">
                {VIEWS.map((v) => {
                  const Icon = v.icon;
                  return (
                    <ToggleGroupItem key={v.value} value={v.value} aria-label={v.label} className="px-3">
                      <Icon className="size-4" />
                    </ToggleGroupItem>
                  );
                })}
              </ToggleGroup>
            </div>
          </>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {summaryLoading ? (
          <SummaryCardsSkeleton />
        ) : (
          <>
        <Card className="bg-card border-border overflow-hidden">
          <CardHeader className="pb-2 px-3 sm:px-6">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open Items</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="text-xl sm:text-2xl font-bold">{summary.openCount}</div>
                <p className="text-xs text-muted-foreground">
                  {summary.urgentHigh > 0 ? `${summary.urgentHigh} urgent, high priority` : '—'}
                </p>
              </CardContent>
            </Card>
        <Card className="bg-card border-border overflow-hidden">
          <CardHeader className="pb-2 px-3 sm:px-6">
            <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="text-xl sm:text-2xl font-bold">{summary.inProgressCount}</div>
              </CardContent>
            </Card>
        <Card className="bg-card border-border overflow-hidden">
          <CardHeader className="pb-2 px-3 sm:px-6">
            <CardTitle className="text-sm font-medium text-muted-foreground">Resolved (This Month)</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="text-xl sm:text-2xl font-bold">{summary.resolvedThisMonth}</div>
                <p className="text-xs text-muted-foreground">
                  {summary.pctChange !== 0 ? `↑ ${summary.pctChange}% from last month` : '—'}
                </p>
              </CardContent>
            </Card>
        <Card className="bg-card border-border overflow-hidden">
          <CardHeader className="pb-2 px-3 sm:px-6">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg. Resolution Time</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="text-xl sm:text-2xl font-bold">{summary.avgResolutionDays != null ? `${summary.avgResolutionDays}d` : '—'}</div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {summaryLoading ? (
          <ByCategoryBySiteSkeleton />
        ) : (
          <>
        <Card className="bg-card border-border overflow-hidden">
          <CardHeader className="pb-2 px-3 sm:px-6">
            <CardTitle className="text-sm font-medium text-foreground">By Category</CardTitle>
            <p className="text-xs text-muted-foreground">Open and in-progress items by type.</p>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 min-w-0">
                {summary.byCategory.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">No items in current filters.</p>
                ) : (
                  <ChartContainer config={OPS_LOG_CHART_CONFIG} className="h-[280px] w-full">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                      <Pie
                        data={[...summary.byCategory].sort((a, b) => b.count - a.count).slice(0, 8)}
                        dataKey="count"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={56}
                        outerRadius={88}
                        paddingAngle={2}
                        stroke="hsl(var(--border))"
                      >
                        {[...summary.byCategory].sort((a, b) => b.count - a.count).slice(0, 8).map((_, index) => (
                          <Cell key={index} fill={CATEGORY_CHART_COLORS[index % CATEGORY_CHART_COLORS.length]} stroke="hsl(var(--border))" />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
        <Card className="bg-card border-border overflow-hidden">
          <CardHeader className="pb-2 px-3 sm:px-6">
            <CardTitle className="text-sm font-medium text-foreground">Open Items by Site</CardTitle>
            <p className="text-xs text-muted-foreground">Sites with outstanding tasks.</p>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 min-w-0">
                {summary.bySite.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">No items in current filters.</p>
                ) : (
                  <ChartContainer config={OPS_LOG_CHART_CONFIG} className="h-[280px] w-full">
                    <BarChart
                      data={[...summary.bySite].sort((a, b) => b.count - a.count).slice(0, 8)}
                      layout="vertical"
                      margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis type="category" dataKey="site" width={140} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                      <ChartTooltip content={<ChartTooltipContent nameKey="site" />} />
                      <Bar dataKey="count" name="Items" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} maxBarSize={24} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Card className="bg-card border-border overflow-hidden">
        <CardHeader className="pb-2 px-3 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-foreground">
              Activity
              {entriesLoading && (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              )}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
              <span className="text-xs text-muted-foreground truncate">
                {entriesLoading
                  ? 'Loading…'
                  : `Showing ${totalEntries === 0 ? 0 : (page - 1) * pageSize + 1}-${Math.min(page * pageSize, totalEntries)} of ${totalEntries}`}
              </span>
              <div className="flex items-center gap-1.5">
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}
                >
                  <SelectTrigger className="h-8 w-[72px] shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground whitespace-nowrap">per page</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 overflow-x-auto">
          {entriesLoading ? (
            view === 'feed' ? (
              <ActivityFeedSkeleton />
            ) : view === 'table' ? (
              <ActivityTableSkeleton />
            ) : view === 'board' ? (
              <ActivityBoardSkeleton />
            ) : (
              <ActivityCalendarSkeleton />
            )
          ) : view === 'feed' ? (
            <OperationsLogFeedView
              entries={entriesWithDisplayNames}
              onSelectEntry={onSelectEntry}
              page={page}
              total={totalEntries}
              onPageChange={setPage}
              pageSize={pageSize}
            />
          ) : view === 'table' ? (
            <OperationsLogTableView
              entries={entriesWithDisplayNames}
              onSelectEntry={onSelectEntry}
              page={page}
              total={totalEntries}
              onPageChange={setPage}
              pageSize={pageSize}
            />
          ) : view === 'board' ? (
            <OperationsLogBoardView
              entries={entriesWithDisplayNames}
              onSelectEntry={onSelectEntry}
              page={page}
              total={totalEntries}
              onPageChange={setPage}
              pageSize={pageSize}
            />
          ) : (
            <OperationsLogCalendarView
              entries={entriesWithDisplayNames}
              onSelectEntry={onSelectEntry}
              page={page}
              total={totalEntries}
              onPageChange={setPage}
              pageSize={pageSize}
            />
          )}
        </CardContent>
      </Card>

      <NewEntryModal
        open={newEntryOpen}
        onOpenChange={setNewEntryOpen}
        customers={customers}
        sites={sites}
        categories={categories}
        products={products}
        effectiveCompanyId={effectiveCompanyId}
        onSuccess={() => setNewEntryOpen(false)}
      />
    </div>
  );
}
