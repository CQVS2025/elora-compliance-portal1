import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from "@/api/base44Client";
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
  TrendingUp
} from 'lucide-react';
import moment from 'moment';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function DeviceHealth({ selectedCustomer, selectedSite }) {
  const [searchQuery, setSearchQuery] = useState('');

  const { data: allDevices = [], isLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const response = await base44.functions.invoke('elora_devices', { status: 'active' });
      return response.data || [];
    }
  });

  // Filter devices based on selected customer and site
  const devices = useMemo(() => {
    let filtered = allDevices;
    
    if (selectedCustomer && selectedCustomer !== 'all') {
      filtered = filtered.filter(d => d.customerRef === selectedCustomer);
    }
    
    if (selectedSite && selectedSite !== 'all') {
      filtered = filtered.filter(d => d.siteRef === selectedSite);
    }
    
    return filtered;
  }, [allDevices, selectedCustomer, selectedSite]);

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

  // Filter devices
  const filteredDevices = useMemo(() => {
    if (!searchQuery) return devices;
    const query = searchQuery.toLowerCase();
    return devices.filter(d => 
      d.customerName?.toLowerCase().includes(query) ||
      d.siteName?.toLowerCase().includes(query) ||
      d.computerName?.toLowerCase().includes(query) ||
      d.deviceRef?.toLowerCase().includes(query)
    );
  }, [devices, searchQuery]);

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

  // Firmware versions distribution
  const firmwareDistribution = useMemo(() => {
    const versionMap = {};
    devices.forEach(d => {
      const version = d.version || 'Unknown';
      versionMap[version] = (versionMap[version] || 0) + 1;
    });
    return Object.entries(versionMap)
      .map(([version, count]) => ({ version, count }))
      .sort((a, b) => b.count - a.count);
  }, [devices]);

  const getDeviceStatus = (device) => {
    if (!device.lastScanAt) return { label: 'Offline', color: 'bg-red-100 text-red-800', icon: XCircle };
    
    const hoursSince = moment().diff(moment(device.lastScanAt), 'hours');
    
    if (hoursSince < 1) return { label: 'Online', color: 'bg-green-100 text-green-800', icon: CheckCircle };
    if (hoursSince < 24) return { label: 'Active', color: 'bg-blue-100 text-blue-800', icon: Activity };
    return { label: 'Offline', color: 'bg-red-100 text-red-800', icon: XCircle };
  };



  const COLORS = ['#7CB342', '#EF4444', '#F59E0B', '#3B82F6'];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Server className="w-12 h-12 text-[#7CB342] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Fleet Health</p>
                <p className="text-3xl font-bold text-slate-800 mt-1">{stats.healthScore}%</p>
                <Progress value={stats.healthScore} className="mt-2 h-2" />
              </div>
              <div className="w-12 h-12 rounded-lg bg-[#7CB342]/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-[#7CB342]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Devices</p>
                <p className="text-3xl font-bold text-slate-800 mt-1">{stats.total}</p>
                <p className="text-xs text-slate-500 mt-2">Active controllers</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <Server className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Online</p>
                <p className="text-3xl font-bold text-green-600 mt-1">{stats.online}</p>
                <p className="text-xs text-slate-500 mt-2">Last 24 hours</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Offline</p>
                <p className="text-3xl font-bold text-red-600 mt-1">{stats.offline}</p>
                <p className="text-xs text-slate-500 mt-2">Needs attention</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-600" />
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
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="site" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={100} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="online" stackId="a" fill="#10B981" name="Online" />
                <Bar dataKey="offline" stackId="a" fill="#EF4444" name="Offline" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Firmware Versions</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={firmwareDistribution}
                  dataKey="count"
                  nameKey="version"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(entry) => `${entry.version} (${entry.count})`}
                >
                  {firmwareDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Device List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Device Monitor</CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
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
            {filteredDevices.map((device, idx) => {
              const status = getDeviceStatus(device);
              const StatusIcon = status.icon;

              return (
                <div key={idx} className="p-4 bg-white rounded-lg border border-slate-200 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${status.color.replace('text', 'bg').replace('800', '100')}`}>
                        <StatusIcon className={`w-6 h-6 ${status.color}`} />
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-slate-800">{device.computerName || device.deviceRef}</h3>
                          <Badge className={status.color}>{status.label}</Badge>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-slate-600">
                          <span className="flex items-center gap-1">
                            <Server className="w-3 h-3" />
                            {device.siteName}
                          </span>
                          <span>{device.customerName}</span>
                          {device.version && (
                            <span className="text-xs px-2 py-0.5 bg-slate-100 rounded">v{device.version}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      {device.lastScanAt && (
                        <div className="flex items-center gap-1 text-sm text-slate-600">
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
        </CardContent>
      </Card>
    </div>
  );
}