import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Server, 
  CheckCircle, 
  XCircle,
  Activity,
  Clock,
  Search,
  TrendingUp,
  Loader2,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertTriangle
} from 'lucide-react';
import moment from 'moment';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import DataPagination from '@/components/ui/DataPagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// NEW: Import queryOptions with tenant isolation
import { devicesOptions, scansOptions } from '@/query/options';
import { usePermissions } from '@/components/auth/PermissionGuard';

// Status filter for "last activity" including auto check-ins (devices check in ~every 20 min)
const DEVICE_LAST_ACTIVITY_SCAN_STATUS = 'success,exceeded,auto';

const getDeviceLastScan = (device) =>
  device?.lastScanAt ??
  device?.lastScan ??
  device?.last_scan_at ??
  device?.last_scanned_at ??
  device?.last_scan ??
  device?._raw?.devices_lastscan ??
  null;

// Normalize to UTC ISO. Only append Z when NO timezone is present (avoid corrupting +11:00 etc).
function toUTCISO(value) {
  if (value == null || value === '') return null;

  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  const s = String(value).trim();
  if (!s) return null;

  const hasTimezone = /[Zz]|[+-]\d{2}:?\d{2}$/.test(s);
  const d = hasTimezone ? new Date(s) : new Date(s + 'Z');

  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// Compare in UTC so relative time matches old platform / server (same as client’s expectation).
function formatLastScanRelative(utcIsoOrNull) {
  if (!utcIsoOrNull) return '—';

  const scan = moment.utc(utcIsoOrNull);
  if (!scan.isValid()) return '—';

  return scan.from(moment.utc());
}

export default function DeviceHealth({ selectedCustomer, selectedSite }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [siteFilter, setSiteFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [applicationFilter, setApplicationFilter] = useState('all');
  const [firmwareFilter, setFirmwareFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  const [sortColumn, setSortColumn] = useState('lastScan');
  const [sortDirection, setSortDirection] = useState('desc');
  const [attentionPage, setAttentionPage] = useState(1);
  const [attentionCustomer, setAttentionCustomer] = useState('all');
  const [attentionSite, setAttentionSite] = useState('all');
  const [attentionApplication, setAttentionApplication] = useState('all');
  const attentionPerPage = 10;

  // NEW: Get tenant context for query key
  const permissions = usePermissions();
  const companyId = permissions.userProfile?.company_id;

  // NEW: Use tenant-aware query options with filters
  const { data: allDevices = [], isLoading, isFetching } = useQuery(
    devicesOptions(companyId, {
      status: '1,2', // Active + inactive
      customerId: selectedCustomer !== 'all' ? selectedCustomer : undefined,
      siteId: selectedSite !== 'all' ? selectedSite : undefined,
    })
  );

  // Fetch recent scans including auto check-ins so "Last scan" reflects last device activity (~every 20 min)
  const dateRange = useMemo(() => {
    const end = moment.utc();
    const start = moment.utc().subtract(7, 'days');
    return {
      fromDate: start.format('YYYY-MM-DD'),
      toDate: end.format('YYYY-MM-DD'),
    };
  }, []);
  const { data: recentScansData } = useQuery({
    ...scansOptions(companyId, {
      ...dateRange,
      status: DEVICE_LAST_ACTIVITY_SCAN_STATUS,
      customerId: selectedCustomer !== 'all' ? selectedCustomer : undefined,
      siteId: selectedSite !== 'all' ? selectedSite : undefined,
    }),
    staleTime: 60 * 1000, // 1 min – device check-ins are frequent
  });
  const recentScansList = Array.isArray(recentScansData) ? recentScansData : (recentScansData?.data ?? []);

  // Latest scan timestamp per device (from scans API, includes auto check-ins)
  const latestScanByDeviceRef = useMemo(() => {
    const map = {};
    recentScansList.forEach((scan) => {
      const ref = scan.deviceRef ?? scan.device_ref ?? null;
      if (!ref) return;
      const ts = scan.createdAt ?? scan.timestamp ?? scan.updatedAt ?? null;
      if (!ts) return;
      const iso = toUTCISO(ts);
      if (!iso) return;
      if (!map[ref] || iso > map[ref]) map[ref] = iso;
    });
    return map;
  }, [recentScansList]);

  // Single source of truth for last scan: max of device API lastScan and latest scan (incl. auto check-in) per device
  const devices = useMemo(
    () =>
      (allDevices ?? []).map((device) => {
        const rawLast = getDeviceLastScan(device);
        const fromDeviceApi = toUTCISO(rawLast);
        const fromScans = latestScanByDeviceRef[device.deviceRef ?? ''] ?? latestScanByDeviceRef[device.device_ref ?? ''] ?? null;
        const normalizedLastScan = [fromDeviceApi, fromScans].filter(Boolean).sort().pop() ?? fromDeviceApi ?? null;
        return {
          ...device,
          normalizedLastScan,
          lastScanAt: normalizedLastScan ?? device.lastScanAt,
        };
      }),
    [allDevices, latestScanByDeviceRef]
  );

  // Calculate device health stats (use canonical last scan; compare in UTC)
  const stats = useMemo(() => {
    const now = moment.utc();
    const online = devices.filter(d => {
      const lastScan = d.normalizedLastScan ?? d.lastScanAt;
      if (!lastScan) return false;
      return now.diff(moment.utc(lastScan), 'hours') < 24;
    }).length;
    const offline = devices.filter(d => {
      const lastScan = d.normalizedLastScan ?? d.lastScanAt;
      if (!lastScan) return true;
      return now.diff(moment.utc(lastScan), 'hours') >= 24;
    }).length;



    const healthScore = devices.length > 0
      ? Math.round((online / devices.length) * 100)
      : 0;

    return { online, offline, healthScore, total: devices.length };
  }, [devices]);

  // Filter devices: search + status, site, customer, application, firmware
  const filteredDevices = useMemo(() => {
    return devices.filter(d => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = !query ||
        (d.customerName ?? '').toLowerCase().includes(query) ||
        (d.siteName ?? '').toLowerCase().includes(query) ||
        (d.computerName ?? '').toLowerCase().includes(query) ||
        (d.deviceRef ?? '').toLowerCase().includes(query) ||
        (d.computerSerialId ?? '').toLowerCase().includes(query) ||
        (d.application ?? '').toLowerCase().includes(query) ||
        (d.note ?? '').toLowerCase().includes(query);

      const status = (() => {
        if (!d.normalizedLastScan) return 'Offline';
        const hoursSince = moment.utc().diff(moment.utc(d.normalizedLastScan), 'hours');
        if (hoursSince < 1) return 'Online';
        if (hoursSince < 24) return 'Active';
        return 'Offline';
      })();
      const matchesStatus = statusFilter === 'all' || status === statusFilter;

      const siteName = d.siteName || 'Unknown';
      const matchesSite = siteFilter === 'all' || siteName === siteFilter;

      const customerName = d.customerName || 'Unknown';
      const matchesCustomer = customerFilter === 'all' || customerName === customerFilter;

      const application = d.application || 'Unknown';
      const matchesApplication = applicationFilter === 'all' || application === applicationFilter;

      const matchesFirmware = firmwareFilter === 'all' || (d.version || '') === firmwareFilter;

      return matchesSearch && matchesStatus && matchesSite && matchesCustomer && matchesApplication && matchesFirmware;
    });
  }, [devices, searchQuery, statusFilter, siteFilter, customerFilter, applicationFilter, firmwareFilter]);

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection(column === 'lastScan' || column === 'created' ? 'desc' : 'asc');
    }
    setCurrentPage(1);
  };

  const sortedDevices = useMemo(() => {
    const dir = sortDirection === 'asc' ? 1 : -1;
    return [...filteredDevices].sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case 'device':
          cmp = (a.computerName || a.deviceRef || '').localeCompare(b.computerName || b.deviceRef || '');
          break;
        case 'status': {
          const aScan = a.normalizedLastScan ? moment.utc(a.normalizedLastScan).valueOf() : 0;
          const bScan = b.normalizedLastScan ? moment.utc(b.normalizedLastScan).valueOf() : 0;
          cmp = aScan - bScan;
          break;
        }
        case 'customer':
          cmp = (a.customerName || '').localeCompare(b.customerName || '');
          break;
        case 'site':
          cmp = (a.siteName || '').localeCompare(b.siteName || '');
          break;
        case 'application':
          cmp = (a.application || '').localeCompare(b.application || '');
          break;
        case 'version':
          cmp = (a.version || '').localeCompare(b.version || '');
          break;
        case 'serial':
          cmp = (a.computerSerialId || '').localeCompare(b.computerSerialId || '');
          break;
        case 'tankLevel': {
          const an = parseFloat(a.lastTankLevelMeters);
          const bn = parseFloat(b.lastTankLevelMeters);
          cmp = (Number.isNaN(an) ? -Infinity : an) - (Number.isNaN(bn) ? -Infinity : bn);
          break;
        }
        case 'lastScan': {
          const aTime = a.normalizedLastScan ? moment.utc(a.normalizedLastScan).valueOf() : 0;
          const bTime = b.normalizedLastScan ? moment.utc(b.normalizedLastScan).valueOf() : 0;
          cmp = aTime - bTime;
          break;
        }
        case 'created': {
          const aCreated = a.createdAt ? moment.utc(a.createdAt).valueOf() : 0;
          const bCreated = b.createdAt ? moment.utc(b.createdAt).valueOf() : 0;
          cmp = aCreated - bCreated;
          break;
        }
        case 'note':
          cmp = (a.note || '').localeCompare(b.note || '');
          break;
        default:
          cmp = 0;
      }
      if (cmp !== 0) return dir * cmp;
      const aFall = a.normalizedLastScan ? moment.utc(a.normalizedLastScan).valueOf() : 0;
      const bFall = b.normalizedLastScan ? moment.utc(b.normalizedLastScan).valueOf() : 0;
      return bFall - aFall;
    });
  }, [filteredDevices, sortColumn, sortDirection]);

  const totalPages = Math.ceil(filteredDevices.length / itemsPerPage);
  const paginatedDevices = useMemo(() => {
    return sortedDevices.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );
  }, [sortedDevices, currentPage, itemsPerPage]);

  // Reset to page 1 when search or filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, siteFilter, customerFilter, applicationFilter, firmwareFilter, selectedCustomer, selectedSite]);

  const SortableHead = ({ column, label, className }) => {
    const isActive = sortColumn === column;
    return (
      <TableHead className={className}>
        <button
          type="button"
          onClick={() => handleSort(column)}
          className="inline-flex items-center gap-1.5 font-medium hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring rounded px-1 -mx-1"
        >
          {label}
          {isActive ? (
            sortDirection === 'asc' ? <ArrowUp className="w-4 h-4 shrink-0" /> : <ArrowDown className="w-4 h-4 shrink-0" />
          ) : (
            <ArrowUpDown className="w-4 h-4 shrink-0 text-muted-foreground/60" />
          )}
        </button>
      </TableHead>
    );
  };

  const hasActiveFilters = statusFilter !== 'all' || siteFilter !== 'all' || customerFilter !== 'all' || applicationFilter !== 'all' || firmwareFilter !== 'all';
  const handleClearFilters = () => {
    setStatusFilter('all');
    setSiteFilter('all');
    setCustomerFilter('all');
    setApplicationFilter('all');
    setFirmwareFilter('all');
  };

  // Device status by site
  const devicesBySite = useMemo(() => {
    const siteMap = {};
    devices.forEach(d => {
      const site = d.siteName || 'Unknown';
      if (!siteMap[site]) {
        siteMap[site] = { site, online: 0, offline: 0 };
      }
      const lastScan = d.normalizedLastScan ?? d.lastScanAt;
      const hoursSince = lastScan ? moment.utc().diff(moment.utc(lastScan), 'hours') : 999;
      if (hoursSince < 24) {
        siteMap[site].online++;
      } else {
        siteMap[site].offline++;
      }
    });
    return Object.values(siteMap).sort((a, b) => (b.online + b.offline) - (a.online + a.offline)).slice(0, 10);
  }, [devices]);

  // Firmware versions distribution for pie chart
  const firmwareDistribution = useMemo(() => {
    const versionMap = {};
    devices.forEach(d => {
      const version = d.version || 'Unknown';
      versionMap[version] = (versionMap[version] || 0) + 1;
    });
    return Object.entries(versionMap)
      .map(([version, count]) => ({ version, count, fill: `var(--color-${version.replace(/[^a-z0-9]/gi, '_')})` }))
      .sort((a, b) => b.count - a.count);
  }, [devices]);

  // Chart config for firmware pie: one entry per version with theme colors
  const CHART_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];
  const firmwareChartConfig = useMemo(() => {
    const config = {};
    firmwareDistribution.forEach((entry, i) => {
      const key = entry.version.replace(/[^a-z0-9]/gi, '_');
      config[key] = {
        label: entry.version,
        color: CHART_COLORS[i % CHART_COLORS.length],
      };
    });
    return config;
  }, [firmwareDistribution]);

  const getDeviceStatus = (device) => {
    const lastScan = device.normalizedLastScan ?? device.lastScanAt;
    if (!lastScan) return { label: 'Offline', color: 'bg-red-100 text-red-800', icon: XCircle };
    const hoursSince = moment.utc().diff(moment.utc(lastScan), 'hours');
    if (hoursSince < 1) return { label: 'Online', color: 'bg-green-100 text-green-800', icon: CheckCircle };
    if (hoursSince < 24) return { label: 'Active', color: 'bg-blue-100 text-blue-800', icon: Activity };
    return { label: 'Offline', color: 'bg-red-100 text-red-800', icon: XCircle };
  };

  // Super Admin only: devices that have not checked in within the last 5 hours (operational visibility)
  const FIVE_HOURS_THRESHOLD = 5;
  const devicesNotCheckedIn5Hours = useMemo(() => {
    const now = moment.utc();
    return devices
      .filter((d) => {
        const lastScan = d.normalizedLastScan ?? d.lastScanAt;
        if (!lastScan) return true;
        const hoursSince = now.diff(moment.utc(lastScan), 'hours', true);
        return hoursSince >= FIVE_HOURS_THRESHOLD;
      })
      .sort((a, b) => {
        const aTime = a.normalizedLastScan ? moment.utc(a.normalizedLastScan).valueOf() : 0;
        const bTime = b.normalizedLastScan ? moment.utc(b.normalizedLastScan).valueOf() : 0;
        return bTime - aTime; // most recent first (newest last-scan at top)
      });
  }, [devices]);

  const attentionFiltered = useMemo(() => {
    return devicesNotCheckedIn5Hours.filter((d) => {
      const matchCustomer = attentionCustomer === 'all' || (d.customerName || 'Unknown') === attentionCustomer;
      const matchSite = attentionSite === 'all' || (d.siteName || 'Unknown') === attentionSite;
      const matchApplication = attentionApplication === 'all' || (d.application || 'Unknown') === attentionApplication;
      return matchCustomer && matchSite && matchApplication;
    });
  }, [devicesNotCheckedIn5Hours, attentionCustomer, attentionSite, attentionApplication]);

  const attentionUniqueCustomers = useMemo(
    () => ['all', ...Array.from(new Set(devicesNotCheckedIn5Hours.map((d) => d.customerName || 'Unknown').filter(Boolean))).sort()],
    [devicesNotCheckedIn5Hours]
  );
  const attentionUniqueSites = useMemo(
    () => ['all', ...Array.from(new Set(devicesNotCheckedIn5Hours.map((d) => d.siteName || 'Unknown'))).sort()],
    [devicesNotCheckedIn5Hours]
  );
  const attentionUniqueApplications = useMemo(
    () => ['all', ...Array.from(new Set(devicesNotCheckedIn5Hours.map((d) => d.application || 'Unknown').filter(Boolean))).sort()],
    [devicesNotCheckedIn5Hours]
  );

  const attentionTotalPages = Math.ceil(attentionFiltered.length / attentionPerPage);
  const attentionPaginated = useMemo(() => {
    const start = (attentionPage - 1) * attentionPerPage;
    return attentionFiltered.slice(start, start + attentionPerPage);
  }, [attentionFiltered, attentionPage, attentionPerPage]);

  React.useEffect(() => {
    if (permissions.isSuperAdmin) setAttentionPage(1);
  }, [attentionCustomer, attentionSite, attentionApplication, permissions.isSuperAdmin]);

  const uniqueSites = useMemo(() => {
    const sites = new Set(devices.map(d => d.siteName || 'Unknown'));
    return ['all', ...Array.from(sites).sort()];
  }, [devices]);

  const uniqueCustomers = useMemo(() => {
    const customers = new Set(devices.map(d => d.customerName || 'Unknown').filter(Boolean));
    return ['all', ...Array.from(customers).sort()];
  }, [devices]);

  const uniqueApplications = useMemo(() => {
    const apps = new Set(devices.map(d => d.application || 'Unknown').filter(Boolean));
    return ['all', ...Array.from(apps).sort()];
  }, [devices]);

  const uniqueFirmware = useMemo(() => {
    const versions = new Set(devices.map(d => d.version).filter(Boolean));
    return ['all', ...Array.from(versions).sort()];
  }, [devices]);



  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {isFetching && (
        <div className="absolute inset-0 bg-background/60 backdrop-blur-sm z-10 flex items-center justify-center rounded-2xl">
          <div className="flex items-center gap-3 bg-card px-6 py-3 rounded-xl shadow-lg border border-border">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
            <span className="text-sm font-medium text-foreground">Updating devices...</span>
          </div>
        </div>
      )}
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-primary font-semibold">Fleet Health</p>
                <p className="text-3xl font-bold text-foreground mt-1">{stats.healthScore}%</p>
                <Progress value={stats.healthScore} className="mt-2 h-2" />
              </div>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-primary font-semibold">Total Devices</p>
                <p className="text-3xl font-bold text-foreground mt-1">{stats.total}</p>
                <p className="text-xs text-muted-foreground mt-2">Active controllers</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Server className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-primary font-semibold">Online</p>
                <p className="text-3xl font-bold text-primary mt-1">{stats.online}</p>
                <p className="text-xs text-muted-foreground mt-2">Last 24 hours</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-primary font-semibold">Offline</p>
                <p className="text-3xl font-bold text-destructive mt-1">{stats.offline}</p>
                <p className="text-xs text-muted-foreground mt-2">Needs attention</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-destructive/10 flex items-center justify-center">
                <XCircle className="w-6 h-6 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>


      </div>

      {/* Super Admin only: devices not checked in within 5 hours */}
      {permissions.isSuperAdmin && (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <CardTitle className="text-lg">Devices not checked in (5+ hours)</CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {devicesNotCheckedIn5Hours.length === 0
                      ? 'All devices have checked in within the last 5 hours.'
                      : `${attentionFiltered.length} of ${devicesNotCheckedIn5Hours.length} device${devicesNotCheckedIn5Hours.length === 1 ? '' : 's'} require attention.`}
                  </p>
                </div>
              </div>
              {devicesNotCheckedIn5Hours.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Customer</label>
                    <Select value={attentionCustomer} onValueChange={setAttentionCustomer}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="All Customers" />
                      </SelectTrigger>
                      <SelectContent>
                        {attentionUniqueCustomers.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c === 'all' ? 'All Customers' : c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Site</label>
                    <Select value={attentionSite} onValueChange={setAttentionSite}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="All Sites" />
                      </SelectTrigger>
                      <SelectContent>
                        {attentionUniqueSites.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s === 'all' ? 'All Sites' : s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Application</label>
                    <Select value={attentionApplication} onValueChange={setAttentionApplication}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="All Applications" />
                      </SelectTrigger>
                      <SelectContent>
                        {attentionUniqueApplications.map((a) => (
                          <SelectItem key={a} value={a}>
                            {a === 'all' ? 'All Applications' : a}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          {attentionFiltered.length > 0 ? (
            <CardContent>
              <div className="overflow-x-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[160px]">Device / Ref</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Site</TableHead>
                      <TableHead>Application</TableHead>
                      <TableHead>Last scan</TableHead>
                      <TableHead>Time since last scan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attentionPaginated.map((device, idx) => (
                      <TableRow key={device.deviceRef ?? idx}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{device.computerName || device.deviceRef || '—'}</span>
                            {device.deviceRef && (
                              <span className="text-xs text-muted-foreground font-mono">{device.deviceRef}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{device.customerName || '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{device.siteName || '—'}</TableCell>
                        <TableCell>{device.application || '—'}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {device.normalizedLastScan ?? device.lastScanAt
                            ? moment.utc(device.normalizedLastScan ?? device.lastScanAt).format('DD/MM/YYYY HH:mm')
                            : '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatLastScanRelative(device.normalizedLastScan ?? device.lastScanAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {attentionTotalPages > 1 && (
                <DataPagination
                  currentPage={attentionPage}
                  totalPages={attentionTotalPages}
                  totalItems={attentionFiltered.length}
                  itemsPerPage={attentionPerPage}
                  onPageChange={setAttentionPage}
                  className="mt-4"
                />
              )}
            </CardContent>
          ) : devicesNotCheckedIn5Hours.length > 0 ? (
            <CardContent>
              <p className="text-sm text-muted-foreground">No devices match the selected filters.</p>
            </CardContent>
          ) : null}
        </Card>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Device Status by Site</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={devicesBySite}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="site" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} angle={-45} textAnchor="end" height={100} />
                <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                <Bar dataKey="online" stackId="a" fill="hsl(var(--primary))" name="Online" />
                <Bar dataKey="offline" stackId="a" fill="hsl(var(--destructive))" name="Offline" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Firmware Versions</CardTitle>
            <p className="text-sm text-muted-foreground">Distribution by version</p>
          </CardHeader>
          <CardContent>
            <ChartContainer config={firmwareChartConfig} className="mx-auto aspect-square h-[300px] w-full max-w-[300px]">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent nameKey="version" />} />
                <Pie
                  data={firmwareDistribution}
                  dataKey="count"
                  nameKey="version"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  strokeWidth={1}
                  stroke="hsl(var(--background))"
                >
                  {firmwareDistribution.map((entry, index) => {
                    const key = entry.version.replace(/[^a-z0-9]/gi, '_');
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                        className="outline-none"
                      />
                    );
                  })}
                </Pie>
              </PieChart>
            </ChartContainer>
            {firmwareDistribution.length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-1 text-xs">
                {firmwareDistribution.slice(0, 8).map((entry, i) => (
                  <div key={entry.version} className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                    <span className="text-muted-foreground">
                      {entry.version} <span className="font-medium text-foreground">{entry.count}</span>
                    </span>
                  </div>
                ))}
                {firmwareDistribution.length > 8 && (
                  <span className="text-muted-foreground">+{firmwareDistribution.length - 8} more</span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Device List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-lg">Device Monitor</CardTitle>
              <div className="flex items-center gap-2">
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearFilters}
                    className="gap-2"
                  >
                    <X className="w-4 h-4" />
                    Clear Filters
                  </Button>
                )}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, ref, serial, app, note..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
              </div>
            </div>
            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="Online">Online</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Offline">Offline</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Customer</label>
                <Select value={customerFilter} onValueChange={setCustomerFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All Customers" />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueCustomers.map(c => (
                      <SelectItem key={c} value={c}>
                        {c === 'all' ? 'All Customers' : c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Site</label>
                <Select value={siteFilter} onValueChange={setSiteFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All Sites" />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueSites.map(site => (
                      <SelectItem key={site} value={site}>
                        {site === 'all' ? 'All Sites' : site}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Application</label>
                <Select value={applicationFilter} onValueChange={setApplicationFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All Applications" />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueApplications.map(app => (
                      <SelectItem key={app} value={app}>
                        {app === 'all' ? 'All Applications' : app}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Firmware</label>
                <Select value={firmwareFilter} onValueChange={setFirmwareFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All Versions" />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueFirmware.map(ver => (
                      <SelectItem key={ver} value={ver}>
                        {ver === 'all' ? 'All Versions' : `v${ver}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead column="device" label="Device / Ref" className="w-[180px]" />
                  <SortableHead column="status" label="Status" />
                  <SortableHead column="customer" label="Customer" />
                  <SortableHead column="site" label="Site" />
                  <SortableHead column="application" label="Application" />
                  <SortableHead column="version" label="Version" />
                  <SortableHead column="serial" label="Serial" />
                  <SortableHead column="tankLevel" label="Tank Level" />
                  <SortableHead column="lastScan" label="Last Scan" />
                  <SortableHead column="created" label="Created" />
                  <SortableHead column="note" label="Note" className="max-w-[150px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedDevices.map((device, idx) => {
                  const status = getDeviceStatus(device);
                  const StatusIcon = status.icon;

                  return (
                    <TableRow key={device.deviceRef ?? idx}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{device.computerName || device.deviceRef || '—'}</span>
                          {device.deviceRef && (
                            <span className="text-xs text-muted-foreground font-mono">{device.deviceRef}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${status.color} gap-1`}>
                          <StatusIcon className="w-3 h-3" />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{device.customerName || '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{device.siteName || '—'}</TableCell>
                      <TableCell>
                        <span className="text-sm">{device.application || '—'}</span>
                      </TableCell>
                      <TableCell>
                        {device.version ? (
                          <span className="text-xs px-2 py-0.5 bg-muted rounded font-mono">v{device.version}</span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-mono text-muted-foreground">
                          {device.computerSerialId || '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {device.lastTankLevelMeters != null && device.lastTankLevelMeters !== ''
                            ? device.lastTankLevelMeters
                            : '—'}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatLastScanRelative(device.normalizedLastScan ?? device.lastScanAt)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {device.createdAt ? moment(device.createdAt).format('DD/MM/YY') : '—'}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate text-sm text-muted-foreground" title={device.note || ''}>
                        {device.note || '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <DataPagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredDevices.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              className="mt-4"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
