import React, { useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Truck,
  Droplets,
  Loader2,
  User,
  FileText,
  Hash,
  Download,
  Filter,
  Settings,
  CreditCard,
  Clock,
  BarChart3,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import moment from 'moment';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { vehiclesOptions, dashboardOptions, scansOptions } from '@/query/options';
import { usePermissions } from '@/components/auth/PermissionGuard';
import { Skeleton } from '@/components/ui/skeleton';
import {
  VehicleWashActivityTrend,
  VehicleComplianceProgress,
  VehicleCumulativeWashesChart,
  VehicleWashFrequencyByDay,
  VehicleWashActivityByHour,
} from '@/components/vehicle-detail/VehicleDetailCharts';

const WASH_HISTORY_PAGE_SIZES = [10, 20, 50, 100];
const EMPTY_LABEL = '—';

function orEmpty(value) {
  if (value == null) return EMPTY_LABEL;
  if (typeof value === 'string' && value.trim() === '') return EMPTY_LABEL;
  return value;
}

function maskPhone(value) {
  if (!value || typeof value !== 'string') return EMPTY_LABEL;
  const s = value.trim();
  if (s.length <= 4) return '***';
  if (s.length <= 8) return s.slice(0, 2) + '***' + s.slice(-2);
  return s.slice(0, 3) + '***' + s.slice(-4);
}

const DEFAULT_DATE_RANGE = {
  start: moment().startOf('month').format('YYYY-MM-DD'),
  end: moment().format('YYYY-MM-DD'),
};

function formatSyncAgo(dataUpdatedAt) {
  if (!dataUpdatedAt) return null;
  const sec = Math.floor((Date.now() - dataUpdatedAt) / 1000);
  if (sec < 60) return 'just now';
  if (sec < 120) return '1 minute ago';
  if (sec < 3600) return `${Math.floor(sec / 60)} minutes ago`;
  if (sec < 7200) return '1 hour ago';
  return `${Math.floor(sec / 3600)} hours ago`;
}

function VehicleDetailSkeleton({ onBack }) {
  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <Button variant="ghost" onClick={onBack} className="gap-2 -ml-2 mb-1">
        <ArrowLeft className="h-4 w-4" /> Back to Compliance
      </Button>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-6 w-24 rounded-full ml-auto" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-5 w-20 rounded" />
          <Skeleton className="h-5 w-16 rounded" />
          <Skeleton className="h-5 w-28 rounded" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="pt-5 pb-4">
              <Skeleton className="h-4 w-28 mb-2" />
              <Skeleton className="h-8 w-12 mt-1" />
              <Skeleton className="h-3 w-20 mt-1" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="h-3 w-24 mb-1" />
                <Skeleton className="h-4 w-full mt-0.5" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <section>
        <Skeleton className="h-6 w-40 mb-4" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-4 w-48 mt-2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[240px] w-full rounded" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-4 w-56 mt-2" />
            </CardHeader>
            <CardContent className="flex gap-6">
              <Skeleton className="h-32 w-32 rounded-full shrink-0" />
              <div className="space-y-2 flex-1">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-52 mt-2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[240px] w-full rounded" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-48 mt-2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[220px] w-full rounded" />
            </CardContent>
          </Card>
        </div>
        <div className="mt-6">
          <Card>
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-4 w-64 mt-2" />
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: 24 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-8 rounded shrink-0" />
                ))}
              </div>
              <div className="flex gap-3 mt-3">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-3 w-12" />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-5 w-28" />
        </CardHeader>
        <CardContent>
          <div className="flex justify-between mb-3">
            <Skeleton className="h-4 w-48" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-16" />
              <Skeleton className="h-9 w-20" />
            </div>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <TableHead key={i}><Skeleton className="h-4 w-16" /></TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {[1, 2, 3, 4, 5, 6].map((j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 flex justify-between">
            <Skeleton className="h-4 w-40" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-9 w-12" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-5 w-52" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-lg border bg-muted/30 p-4 text-center">
                <Skeleton className="h-8 w-12 mx-auto" />
                <Skeleton className="h-3 w-20 mt-2 mx-auto" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-5 w-28" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i}>
                <Skeleton className="h-3 w-16 mb-1" />
                <Skeleton className="h-4 w-32 mt-0.5" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <footer className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-4 w-48" />
      </footer>
    </div>
  );
}

export default function VehicleDetail() {
  const { vehicleRef } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const permissions = usePermissions();
  const companyId = permissions.userProfile?.company_id;

  const periodFromState = location.state?.fromDate && location.state?.toDate
    ? { start: location.state.fromDate, end: location.state.toDate }
    : null;
  const scansDateRange = useMemo(() => {
    if (periodFromState) return { from: periodFromState.start, to: periodFromState.end };
    return {
      from: moment().subtract(3, 'months').format('YYYY-MM-DD'),
      to: moment().format('YYYY-MM-DD'),
    };
  }, [periodFromState]);

  const { data: allVehicles = [], isLoading: vehiclesLoading, error: vehiclesError, dataUpdatedAt: vehiclesUpdatedAt } = useQuery({
    ...vehiclesOptions(companyId, {}),
    enabled: !!companyId && !!vehicleRef,
  });

  const vehicle = useMemo(() => {
    if (!vehicleRef || !Array.isArray(allVehicles)) return null;
    return allVehicles.find(
      (v) =>
        String(v.vehicleRef ?? '') === String(vehicleRef) ||
        String(v.internalVehicleId ?? '') === String(vehicleRef)
    ) ?? null;
  }, [allVehicles, vehicleRef]);

  const { data: dashboardData, dataUpdatedAt: dashboardUpdatedAt, isFetching: dashboardFetching } = useQuery({
    ...dashboardOptions(companyId, {
      customerId: vehicle?.customerId ?? 'all',
      siteId: vehicle?.siteId ?? 'all',
      startDate: periodFromState?.start ?? DEFAULT_DATE_RANGE.start,
      endDate: periodFromState?.end ?? DEFAULT_DATE_RANGE.end,
    }),
    enabled: !!companyId && !!vehicle,
  });

  // Wash history: success only; use compliance date range when opened from compliance, else last 3 months
  const { data: scansRaw, isLoading: scansLoading, dataUpdatedAt: scansUpdatedAt } = useQuery({
    ...scansOptions(companyId, {
      vehicleId: vehicleRef,
      fromDate: scansDateRange.from,
      toDate: scansDateRange.to,
      status: 'success',
    }),
    enabled: !!companyId && !!vehicleRef,
  });

  const scans = useMemo(() => {
    const list = Array.isArray(scansRaw) ? scansRaw : (scansRaw?.data ?? []);
    return [...list].sort((a, b) => {
      const ta = new Date(a.createdAt ?? a.timestamp ?? a.scanDate ?? 0).getTime();
      const tb = new Date(b.createdAt ?? b.timestamp ?? b.scanDate ?? 0).getTime();
      return tb - ta;
    });
  }, [scansRaw]);

  const dashboardRowForVehicle = useMemo(() => {
    if (!vehicle?.vehicleRef || !dashboardData?.rows?.length) return null;
    const start = periodFromState ? moment(periodFromState.start) : moment(DEFAULT_DATE_RANGE.start);
    const end = periodFromState ? moment(periodFromState.end) : moment(DEFAULT_DATE_RANGE.end);
    const rows = dashboardData.rows.filter(
      (r) => r.vehicleRef === vehicle.vehicleRef && moment(`${r.year}-${String(r.month).padStart(2, '0')}-01`).isBetween(start, end, 'month', '[]')
    );
    const lastScan = rows.length
      ? rows.reduce((latest, r) => (!latest || (r.lastScan && r.lastScan > latest) ? r.lastScan : latest), null)
      : vehicle.lastScanAt;
    return { lastScan, rows };
  }, [vehicle, dashboardData, periodFromState]);

  const targetWashes = vehicle?.protocolNumber ?? 12;
  const washesPerDay = vehicle?.washesPerDay ?? (vehicle?.washesPerWeek ? Math.ceil(vehicle.washesPerWeek / 7) : 2);
  const periodStart = useMemo(
    () => (periodFromState ? moment(periodFromState.start).startOf('day') : moment().startOf('month')),
    [periodFromState]
  );
  const periodEnd = useMemo(
    () => (periodFromState ? moment(periodFromState.end).endOf('day') : moment().endOf('month')),
    [periodFromState]
  );
  const scansInPeriod = useMemo(() => {
    return scans.filter((s) => {
      const t = s.createdAt ?? s.timestamp ?? s.scanDate;
      return t && moment(t).isBetween(periodStart, periodEnd, null, '[]');
    });
  }, [scans, periodStart, periodEnd]);
  const washesInPeriod = scansInPeriod.length;
  const isCompliant = washesInPeriod >= targetWashes;
  const progressPct = targetWashes ? Math.round((washesInPeriod / targetWashes) * 100) : 0;
  const lastScanDt = dashboardRowForVehicle?.lastScan ?? vehicle?.lastScanAt;
  const now = moment();
  const daysInMonth = now.daysInMonth();
  const expectedPctAtMidMonth = 50;
  const likelihoodLabel = progressPct >= expectedPctAtMidMonth ? 'ON TRACK' : 'OFF TRACK';

  const [washHistoryPage, setWashHistoryPage] = useState(1);
  const [washHistoryPageSize, setWashHistoryPageSize] = useState(20);
  const washHistoryList = scansInPeriod;
  const periodLabel = periodFromState
    ? `${moment(periodFromState.start).format('D MMM YYYY')} – ${moment(periodFromState.end).format('D MMM YYYY')}`
    : now.format('MMMM YYYY');
  const washHistoryTotalPages = Math.max(1, Math.ceil(washHistoryList.length / washHistoryPageSize));
  const safePage = Math.min(washHistoryPage, washHistoryTotalPages);
  React.useEffect(() => {
    if (washHistoryPage > washHistoryTotalPages) setWashHistoryPage(1);
  }, [washHistoryList.length, washHistoryTotalPages, washHistoryPage]);
  const paginatedScans = useMemo(() => {
    const start = (safePage - 1) * washHistoryPageSize;
    return washHistoryList.slice(start, start + washHistoryPageSize);
  }, [washHistoryList, safePage, washHistoryPageSize]);
  const showingFrom = washHistoryList.length === 0 ? 0 : (safePage - 1) * washHistoryPageSize + 1;
  const showingTo = Math.min(safePage * washHistoryPageSize, washHistoryList.length);

  const lastSyncedAt = Math.max(vehiclesUpdatedAt ?? 0, dashboardUpdatedAt ?? 0, scansUpdatedAt ?? 0) || null;
  const syncLabel = formatSyncAgo(lastSyncedAt);

  const isDetailLoading =
    vehiclesLoading ||
    (vehicleRef && !vehicle && !vehiclesError) ||
    (!!vehicle && (scansLoading || dashboardFetching));

  const handleExportCSV = () => {
    const headers = ['Date & Time', 'Site', 'Device', 'Status', 'Wash Time', 'Protocol'];
    const washTimeFallback = vehicle?.washTime1Seconds != null ? `${vehicle.washTime1Seconds}s` : '';
    const protocolFallback = vehicle?.protocolNumber ?? '';
    const listToExport = scansInPeriod.length ? scansInPeriod : scans;
    const rows = listToExport.map((s) => {
      const dt = s.createdAt ?? s.timestamp ?? s.scanDate;
      const dateStr = dt ? moment(dt).format('DD MMM YYYY · HH:mm') : '—';
      const washTime = s.washDurationSeconds != null ? `${s.washDurationSeconds}s` : s.washTime != null ? `${s.washTime}s` : washTimeFallback;
      const protocol = s.protocol ?? s.protocolNumber ?? protocolFallback;
      return [dateStr, s.siteName ?? '—', s.deviceName ?? s.deviceSerial ?? '—', s.statusLabel ?? 'Success', washTime, protocol];
    });
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `vehicle-wash-history-${vehicle?.vehicleRef ?? vehicleRef}-${moment().format('YYYY-MM-DD')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (!vehicle && (vehiclesLoading || (vehicleRef && !vehiclesError))) {
    return <VehicleDetailSkeleton onBack={() => navigate('/compliance')} />;
  }

  if (!vehicle) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate('/')} className="mb-4 gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Vehicle not found. It may be outside your access or the link is invalid.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isDetailLoading) {
    return <VehicleDetailSkeleton onBack={() => navigate('/compliance')} />;
  }

  const displayName = vehicle.vehicleName ?? vehicle.vehicleRef ?? vehicleRef;
  const customerName = vehicle.customerName ?? '—';
  const siteName = vehicle.siteName ?? '—';
  const driverLabel = [vehicle.legacyFirstName, vehicle.legacyLastName].filter(Boolean).join(' ') || vehicle.email || '—';
  const positionLabel = vehicle.legacyPosition ?? '—';
  const emailDriverLabel = positionLabel !== EMPTY_LABEL ? `${driverLabel} — ${positionLabel}` : driverLabel;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <Button variant="ghost" onClick={() => navigate('/compliance')} className="gap-2 -ml-2 mb-1">
        <ArrowLeft className="h-4 w-4" /> Back to Compliance
      </Button>

      {/* Breadcrumb + Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <nav className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/compliance" className="hover:text-foreground transition-colors">Compliance</Link>
          <span aria-hidden>/</span>
          <span className="font-medium text-foreground truncate">{customerName}</span>
          <span aria-hidden>/</span>
          <span className="font-semibold text-foreground truncate">{displayName}</span>
        </nav>
        <div className="flex items-center gap-2 flex-wrap">
          {syncLabel && (
            <span className="text-xs text-muted-foreground">Live — Synced {syncLabel}</span>
          )}
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExportCSV}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          {/* <Button variant="outline" size="sm" asChild>
            <Link to="/settings" className="gap-2">
              <Settings className="h-4 w-4" /> Settings
            </Link>
          </Button> */}
        </div>
      </div>

      {/* Vehicle header */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Truck className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold truncate">{displayName}</h1>
            <p className="text-sm text-muted-foreground">
              {customerName} — {siteName}
            </p>
          </div>
          <Badge className={isCompliant ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-500 hover:bg-red-600'} style={{ marginLeft: 'auto' }}>
            {isCompliant ? 'Compliant' : 'Non-Compliant'}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isCompliant && (
            <Badge variant="secondary" className="bg-red-500/10 text-red-700 dark:text-red-400">Non-Compliant</Badge>
          )}
          {(vehicle.notes && vehicle.notes.trim()) && (
            <Badge variant="secondary">{vehicle.notes.trim()}</Badge>
          )}
          <Badge variant="outline">Internal ID: {orEmpty(vehicle.internalVehicleId)}</Badge>
          <span className="text-sm text-muted-foreground">
            {[vehicle.legacyFirstName, vehicle.legacyLastName].filter(Boolean).join(' ') || '—'} · Pos {orEmpty(vehicle.legacyPosition)}
          </span>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {periodFromState ? 'Washes in selected period' : 'Washes This Month'}
                </p>
                <p className="text-2xl font-bold mt-1">{washesInPeriod}</p>
                <p className="text-xs text-muted-foreground mt-0.5">of {targetWashes} target</p>
              </div>
              <BarChart3 className="h-4 w-4 text-muted-foreground shrink-0" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Target (Monthly)</p>
                <p className="text-2xl font-bold mt-1">{targetWashes}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {vehicle.washesPerWeek ?? 6}/week · {washesPerDay}/day
                </p>
              </div>
              <TrendingUp className="h-4 w-4 text-muted-foreground shrink-0" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Progress</p>
                <p className={`text-2xl font-bold mt-1 ${progressPct >= 50 ? 'text-emerald-600' : 'text-red-600'}`}>{progressPct}%</p>
                <p className="text-xs text-muted-foreground mt-0.5">vs {expectedPctAtMidMonth}% expected at mid-month</p>
              </div>
              <TrendingDown className="h-4 w-4 text-muted-foreground shrink-0" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Last Scan</p>
                <p className="text-lg font-bold mt-1">
                  {lastScanDt ? moment(lastScanDt).format('D MMM') : EMPTY_LABEL}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {lastScanDt ? moment(lastScanDt).format('YYYY · HH:mm') + ' ' + (moment().format('z') || '') : ''}
                </p>
              </div>
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Identity & Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Hash className="h-4 w-4" /> Identity & Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Vehicle Reference</p>
              <p className="font-mono text-sm mt-0.5">{orEmpty(vehicle.vehicleRef)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Internal ID</p>
              <p className="font-mono text-sm mt-0.5">{orEmpty(vehicle.internalVehicleId)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">RFID Tag</p>
              <p className="font-mono text-sm mt-0.5">{orEmpty(vehicle.vehicleRfid)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Status</p>
              <p className="flex items-center gap-1.5 mt-0.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                {orEmpty(vehicle.statusLabel)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">First Name</p>
              <p className="text-sm mt-0.5">{orEmpty(vehicle.legacyFirstName)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Last Name</p>
              <p className="text-sm mt-0.5">{orEmpty(vehicle.legacyLastName)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Position</p>
              <p className="text-sm mt-0.5">{orEmpty(vehicle.legacyPosition)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Record Created</p>
              <p className="text-sm mt-0.5">{vehicle.createdAt ? moment(vehicle.createdAt).format('D MMM YYYY') : EMPTY_LABEL}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vehicle Analytics */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Vehicle Analytics</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <VehicleWashActivityTrend
            scans={scans}
            dailyTarget={washesPerDay}
            vehicleName={displayName}
          />
          <VehicleComplianceProgress
            washesThisMonth={washesInPeriod}
            targetWashes={targetWashes}
            vehicleName={displayName}
            monthLabel={now.format('MMM YYYY')}
          />
          <VehicleCumulativeWashesChart
            scans={scansInPeriod}
            targetWashes={targetWashes}
            vehicleName={displayName}
          />
          <VehicleWashFrequencyByDay
            scans={scansInPeriod}
            vehicleName={displayName}
            monthLabel={now.format('MMM YYYY')}
          />
        </div>
        <div className="mt-6">
          <VehicleWashActivityByHour scans={scans} vehicleName={displayName} />
        </div>
      </section>

      {/* Wash History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <CardTitle className="text-base">Wash History</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Wash Records · {washHistoryList.length} scan{washHistoryList.length !== 1 ? 's' : ''} total · {periodLabel}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2" disabled>
                <Filter className="h-4 w-4" /> Filter
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={handleExportCSV}>
                <Download className="h-4 w-4" /> Export
              </Button>
            </div>
          </div>
          {scansLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : washHistoryList.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              {periodFromState ? 'No wash scans in the selected period.' : 'No wash scans this month.'}
            </p>
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Site</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Wash Time</TableHead>
                      <TableHead>Protocol</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedScans.map((scan, i) => {
                      const dt = scan.createdAt ?? scan.timestamp ?? scan.scanDate;
                      const washTimeSec = scan.washDurationSeconds ?? scan.washTime ?? vehicle?.washTime1Seconds;
                      const washTimeStr = washTimeSec != null ? `${washTimeSec}s` : '—';
                      const protocol = scan.protocol ?? scan.protocolNumber ?? vehicle?.protocolNumber ?? '—';
                      return (
                        <TableRow key={scan.internalScanId ?? scan.scanRef ?? `${safePage}-${i}`}>
                          <TableCell className="font-medium">
                            {dt ? moment(dt).format('DD MMM YYYY · HH:mm') : '—'}
                          </TableCell>
                          <TableCell>{scan.siteName ?? '—'}</TableCell>
                          <TableCell>{scan.deviceName ?? scan.deviceSerial ?? '—'}</TableCell>
                          <TableCell>
                            <span className="flex items-center gap-1.5">
                              <span className="text-emerald-600">✓</span> {scan.statusLabel ?? 'Success'}
                            </span>
                          </TableCell>
                          <TableCell>{washTimeStr}</TableCell>
                          <TableCell>{protocol}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                  Showing {showingFrom} to {showingTo} of {washHistoryList.length} records
                </p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Per page</span>
                    <Select
                      value={String(washHistoryPageSize)}
                      onValueChange={(v) => {
                        setWashHistoryPageSize(Number(v));
                        setWashHistoryPage(1);
                      }}
                    >
                      <SelectTrigger className="w-[80px] h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WASH_HISTORY_PAGE_SIZES.map((n) => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {washHistoryTotalPages > 1 && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setWashHistoryPage((p) => Math.max(1, p - 1))}
                        disabled={safePage <= 1}
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {safePage} of {washHistoryTotalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setWashHistoryPage((p) => Math.min(washHistoryTotalPages, p + 1))}
                        disabled={safePage >= washHistoryTotalPages}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Scan Card Programmed Parameters */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <CreditCard className="h-4 w-4" />
          <CardTitle className="text-base">Scan Card Programmed Parameters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-lg border bg-muted/30 p-4 text-center">
              <p className="text-2xl font-bold">{vehicle.washTime1Seconds != null ? `${vehicle.washTime1Seconds}s` : '—'}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Wash Time</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4 text-center">
              <p className="text-2xl font-bold">{orEmpty(vehicle.washesPerDay)}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Washes / Day</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4 text-center">
              <p className="text-2xl font-bold">{orEmpty(vehicle.washesPerWeek)}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Washes / Week</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4 text-center">
              <p className="text-2xl font-bold">{orEmpty(vehicle.protocolNumber)}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Target (Monthly)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact & Notes */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <User className="h-4 w-4" />
          <CardTitle className="text-base">Contact & Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Phone</p>
              <p className="text-sm mt-0.5">{vehicle.phone ? maskPhone(vehicle.phone) : EMPTY_LABEL}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Mobile</p>
              <p className="text-sm mt-0.5">{vehicle.mobile ? maskPhone(vehicle.mobile) : EMPTY_LABEL}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Email / Driver</p>
              <p className="text-sm mt-0.5">{emailDriverLabel}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Notes</p>
              <p className="text-sm mt-0.5 rounded-lg border bg-muted/30 p-3">{orEmpty(vehicle.notes)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <footer className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground pt-2 border-t">
        <span>
          Vehicle record created {vehicle.createdAt ? moment(vehicle.createdAt).format('D MMM YYYY') : '—'}
          {vehicle.updatedAt && ` · Last updated ${moment(vehicle.updatedAt).format('D MMM YYYY')}`}.
        </span>
      </footer>
    </div>
  );
}
