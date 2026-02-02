import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import moment from 'moment';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar, TrendingUp, AlertTriangle, Droplet, Loader2, Download } from 'lucide-react';
import Header from '@/components/dashboard/Header';
import { usePermissions, useFilteredData } from '@/components/auth/PermissionGuard';
import { sitesOptions, vehiclesOptions, scansOptions } from '@/query/options';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/query/keys';

export default function SiteAnalytics() {
  const permissions = usePermissions();
  const companyId = permissions.userProfile?.company_id;
  
  const [dateRange, setDateRange] = useState({
    start: moment().subtract(30, 'days').format('YYYY-MM-DD'),
    end: moment().format('YYYY-MM-DD')
  });

  const { data: rawSites = [], isLoading: sitesLoading } = useQuery({
    ...sitesOptions(companyId),
    placeholderData: (prev) => prev,
  });

  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery({
    ...vehiclesOptions(companyId),
    placeholderData: (prev) => prev,
  });

  const { data: scans = [], isLoading: scansLoading } = useQuery({
    ...scansOptions(companyId, {
      startDate: dateRange.start,
      endDate: dateRange.end,
    }),
    placeholderData: (prev) => prev,
  });

  const { data: issues = [] } = useQuery({
    queryKey: queryKeys.tenant.issues(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('issues')
        .select('*')
        .order('created_date', { ascending: false })
        .limit(1000);
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
    enabled: !!companyId,
  });

  // Apply permission filtering
  const { filteredSites } = useFilteredData(vehicles, rawSites);

  // Calculate site metrics
  const siteMetrics = useMemo(() => {
    const metrics = {};

    filteredSites.forEach(site => {
      metrics[site.id] = {
        name: site.name,
        totalWashes: 0,
        totalVehicles: 0,
        compliantVehicles: 0,
        issues: {
          mechanical: 0,
          wash_equipment: 0,
          rfid_scanner: 0,
          damage: 0,
          cleanliness: 0,
          other: 0
        }
      };
    });

    // Count washes per site
    scans.forEach(scan => {
      const siteId = scan.siteId || scan.customerRef;
      if (metrics[siteId]) {
        metrics[siteId].totalWashes++;
      }
    });

    // Count vehicles and compliance per site
    vehicles.forEach(vehicle => {
      const siteId = vehicle.siteId || vehicle.customerRef;
      if (metrics[siteId]) {
        metrics[siteId].totalVehicles++;
        
        // Count washes for this vehicle
        const vehicleWashes = scans.filter(s =>
          s.vehicleRef === vehicle.vehicleRef ||
          (vehicle.device_ref && s.deviceRef === vehicle.device_ref) ||
          (vehicle.vehicleRef && s.deviceRef === vehicle.vehicleRef)
        ).length;
        const target = vehicle.washesPerWeek || 12;
        
        if (vehicleWashes >= target) {
          metrics[siteId].compliantVehicles++;
        }
      }
    });

    // Count issues per site
    issues.forEach(issue => {
      const vehicle = vehicles.find(v => v.vehicleRef === issue.vehicle_id);
      if (vehicle) {
        const siteId = vehicle.siteId || vehicle.customerRef;
        if (metrics[siteId] && issue.issue_type) {
          metrics[siteId].issues[issue.issue_type] = (metrics[siteId].issues[issue.issue_type] || 0) + 1;
        }
      }
    });

    return Object.entries(metrics).map(([id, data]) => ({
      id,
      ...data,
      complianceRate: data.totalVehicles > 0 
        ? Math.round((data.compliantVehicles / data.totalVehicles) * 100) 
        : 0,
      avgWashesPerVehicle: data.totalVehicles > 0
        ? (data.totalWashes / data.totalVehicles).toFixed(1)
        : 0
    }));
  }, [filteredSites, vehicles, scans, issues]);

  // Prepare chart data
  const washesPerSiteData = siteMetrics
    .sort((a, b) => b.totalWashes - a.totalWashes)
    .slice(0, 10);

  const compliancePerSiteData = siteMetrics
    .sort((a, b) => b.complianceRate - a.complianceRate);

  const allIssueTypes = siteMetrics.reduce((acc, site) => {
    Object.entries(site.issues).forEach(([type, count]) => {
      acc[type] = (acc[type] || 0) + count;
    });
    return acc;
  }, {});

  const issueTypeData = Object.entries(allIssueTypes)
    .map(([type, count]) => ({
      name: type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value: count
    }))
    .filter(item => item.value > 0);

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];
  const ISSUE_COLORS = ['hsl(var(--destructive))', 'hsl(var(--chart-4))', 'hsl(var(--primary))', 'hsl(var(--chart-3))', 'hsl(var(--chart-5))', 'hsl(var(--muted-foreground))'];

  const totalWashes = siteMetrics.reduce((sum, site) => sum + site.totalWashes, 0);
  const totalVehicles = siteMetrics.reduce((sum, site) => sum + site.totalVehicles, 0);
  const totalIssues = Object.values(allIssueTypes).reduce((sum, count) => sum + count, 0);
  const overallCompliance = totalVehicles > 0
    ? Math.round((siteMetrics.reduce((sum, site) => sum + site.compliantVehicles, 0) / totalVehicles) * 100)
    : 0;

  const exportToCSV = () => {
    const headers = ['Site', 'Total Washes', 'Total Vehicles', 'Compliant Vehicles', 'Compliance Rate', 'Avg Washes/Vehicle', 'Total Issues'];
    const rows = siteMetrics.map(site => [
      site.name,
      site.totalWashes,
      site.totalVehicles,
      site.compliantVehicles,
      `${site.complianceRate}%`,
      site.avgWashesPerVehicle,
      Object.values(site.issues).reduce((sum, count) => sum + count, 0)
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `site-analytics-${dateRange.start}-to-${dateRange.end}.csv`;
    a.click();
  };

  const isLoading = sitesLoading || vehiclesLoading || scansLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      
      <main className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Site Analytics</h1>
            <p className="text-slate-600 mt-1">Performance metrics across all sites</p>
          </div>
          {permissions.canExportData && (
            <Button onClick={exportToCSV}>
              <Download className="w-4 h-4 mr-2" />
              Export Report
            </Button>
          )}
        </div>

        {/* Date Range Filter */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Calendar className="w-5 h-5 text-slate-500" />
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="w-40"
                />
                <span className="text-slate-500">to</span>
                <Input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="w-40"
                />
              </div>
              <div className="flex gap-2 ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDateRange({
                    start: moment().subtract(7, 'days').format('YYYY-MM-DD'),
                    end: moment().format('YYYY-MM-DD')
                  })}
                >
                  Last 7 Days
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDateRange({
                    start: moment().subtract(30, 'days').format('YYYY-MM-DD'),
                    end: moment().format('YYYY-MM-DD')
                  })}
                >
                  Last 30 Days
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDateRange({
                    start: moment().startOf('month').format('YYYY-MM-DD'),
                    end: moment().format('YYYY-MM-DD')
                  })}
                >
                  This Month
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Droplet className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">{totalWashes.toLocaleString()}</p>
                  <p className="text-sm text-slate-600">Total Washes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">{overallCompliance}%</p>
                  <p className="text-sm text-slate-600">Overall Compliance</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">{filteredSites.length}</p>
                  <p className="text-sm text-slate-600">Active Sites</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">{totalIssues}</p>
                  <p className="text-sm text-slate-600">Total Issues</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Total Washes Per Site */}
          <Card>
            <CardHeader>
              <CardTitle>Total Washes by Site</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={washesPerSiteData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  <Bar dataKey="totalWashes" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Compliance Rate Per Site */}
          <Card>
            <CardHeader>
              <CardTitle>Compliance Rate by Site</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={compliancePerSiteData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis domain={[0, 100]} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                  <Bar dataKey="complianceRate" fill="hsl(var(--chart-2))" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Issue Types Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Issues by Type</CardTitle>
            </CardHeader>
            <CardContent>
              {issueTypeData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No issues reported in this period
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={issueTypeData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="hsl(var(--primary))"
                      dataKey="value"
                    >
                      {issueTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={ISSUE_COLORS[index % ISSUE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Site Details Table */}
          <Card>
            <CardHeader>
              <CardTitle>Site Performance Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-[300px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white border-b">
                    <tr className="text-left">
                      <th className="pb-2 font-semibold">Site</th>
                      <th className="pb-2 font-semibold text-center">Washes</th>
                      <th className="pb-2 font-semibold text-center">Compliance</th>
                      <th className="pb-2 font-semibold text-center">Issues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {siteMetrics.map((site, index) => (
                      <tr key={site.id} className={index % 2 === 0 ? 'bg-slate-50' : ''}>
                        <td className="py-2">{site.name}</td>
                        <td className="py-2 text-center">{site.totalWashes}</td>
                        <td className="py-2 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            site.complianceRate >= 80 ? 'bg-green-100 text-green-800' :
                            site.complianceRate >= 60 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {site.complianceRate}%
                          </span>
                        </td>
                        <td className="py-2 text-center">
                          {Object.values(site.issues).reduce((sum, count) => sum + count, 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
