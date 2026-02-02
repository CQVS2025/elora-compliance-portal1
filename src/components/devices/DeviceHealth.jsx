import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { 
  Server, 
  CheckCircle, 
  XCircle,
  Activity,
  Clock,
  Search,
  TrendingUp,
  Loader2
} from 'lucide-react';
import moment from 'moment';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import DataPagination from '@/components/ui/DataPagination';

// NEW: Import queryOptions with tenant isolation
import { devicesOptions } from '@/query/options';
import { usePermissions } from '@/components/auth/PermissionGuard';

export default function DeviceHealth({ selectedCustomer, selectedSite }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

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

  // Filter devices based on selected customer and site (already done in query, so simplified)
  const devices = allDevices;

  // Calculate device health stats
  const stats = useMemo(() => {
    const now = moment();
    
    const online = devices.filter(d => {
      if (!d.lastScanAt) return false;
      const hoursSince = now.diff(moment(d.lastScanAt), 'hours');
      return hoursSince < 24;
    }).length;

    const offline = devices.filter(d => {
      if (!d.lastScanAt) return true;
      const hoursSince = now.diff(moment(d.lastScanAt), 'hours');
      return hoursSince >= 24;
    }).length;



    const healthScore = devices.length > 0
      ? Math.round((online / devices.length) * 100)
      : 0;

    return { online, offline, healthScore, total: devices.length };
  }, [devices]);

  // Filter devices; safe null so rows with null fields are not excluded
  const filteredDevices = useMemo(() => {
    if (!searchQuery) return devices;
    const query = searchQuery.toLowerCase();
    return devices.filter(d =>
      (d.customerName ?? '').toLowerCase().includes(query) ||
      (d.siteName ?? '').toLowerCase().includes(query) ||
      (d.computerName ?? '').toLowerCase().includes(query) ||
      (d.deviceRef ?? '').toLowerCase().includes(query)
    );
  }, [devices, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredDevices.length / itemsPerPage);
  const paginatedDevices = useMemo(() => {
    return filteredDevices.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );
  }, [filteredDevices, currentPage, itemsPerPage]);

  // Reset to page 1 when search or filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCustomer, selectedSite]);

  // Device status by site
  const devicesBySite = useMemo(() => {
    const siteMap = {};
    devices.forEach(d => {
      const site = d.siteName || 'Unknown';
      if (!siteMap[site]) {
        siteMap[site] = { site, online: 0, offline: 0 };
      }
      
      const now = moment();
      const hoursSince = d.lastScanAt ? now.diff(moment(d.lastScanAt), 'hours') : 999;
      
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
    if (!device.lastScanAt) return { label: 'Offline', color: 'bg-red-100 text-red-800', icon: XCircle };
    
    const hoursSince = moment().diff(moment(device.lastScanAt), 'hours');
    
    if (hoursSince < 1) return { label: 'Online', color: 'bg-green-100 text-green-800', icon: CheckCircle };
    if (hoursSince < 24) return { label: 'Active', color: 'bg-blue-100 text-blue-800', icon: Activity };
    return { label: 'Offline', color: 'bg-red-100 text-red-800', icon: XCircle };
  };



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
                <p className="text-sm text-muted-foreground">Fleet Health</p>
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
                <p className="text-sm text-muted-foreground">Total Devices</p>
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
                <p className="text-sm text-muted-foreground">Online</p>
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
                <p className="text-sm text-muted-foreground">Offline</p>
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
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Device Monitor</CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search devices..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {paginatedDevices.map((device, idx) => {
              const status = getDeviceStatus(device);
              const StatusIcon = status.icon;

              return (
                <div key={idx} className="p-4 bg-card rounded-lg border border-border hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${status.color.replace('text', 'bg').replace('800', '100')}`}>
                        <StatusIcon className={`w-6 h-6 ${status.color}`} />
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-foreground">{device.computerName || device.deviceRef}</h3>
                          <Badge className={status.color}>{status.label}</Badge>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Server className="w-3 h-3" />
                            {device.siteName}
                          </span>
                          <span>{device.customerName}</span>
                          {device.version && (
                            <span className="text-xs px-2 py-0.5 bg-muted rounded">v{device.version}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      {device.lastScanAt && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          <span>{moment(device.lastScanAt).fromNow()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
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
