import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabaseClient } from "@/api/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DataPagination from '@/components/ui/DataPagination';
import { 
  TrendingUp, 
  TrendingDown, 
  CheckCircle, 
  FileSpreadsheet,
  ZoomIn
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import moment from 'moment';
import DrillDownModal from './DrillDownModal';

export default function ReportsDashboard({ vehicles, scans, dateRange, selectedSite }) {
  const [drillDownModal, setDrillDownModal] = useState({ open: false, type: null, data: null });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Get unique sites for filtering
  const sites = useMemo(() => {
    const siteMap = new Map();
    vehicles.forEach(v => {
      if (v.site_id && v.site_name) {
        siteMap.set(v.site_id, v.site_name);
      }
    });
    return Array.from(siteMap.entries()).map(([id, name]) => ({ id, name }));
  }, [vehicles]);

  // Filter data based on site; include scans/vehicles with null siteRef/site_id so nothing is hidden
  const filteredData = useMemo(() => {
    const filteredScans = selectedSite && selectedSite !== 'all'
      ? (scans?.filter(scan => scan.siteRef === selectedSite || scan.siteRef == null) ?? [])
      : scans ?? [];

    const filteredVehicles = selectedSite && selectedSite !== 'all'
      ? vehicles.filter(v => v.site_id === selectedSite || v.site_id == null)
      : vehicles;

    return { filteredScans, filteredVehicles };
  }, [scans, vehicles, selectedSite]);


  // Fleet Compliance Analysis
  const complianceStats = useMemo(() => {
    if (!filteredData.filteredVehicles || filteredData.filteredVehicles.length === 0) {
      return {
        compliantVehicles: 0,
        nonCompliantVehicles: 0,
        totalVehicles: 0,
        complianceRate: 0,
        trend: 'warning'
      };
    }
    
    const compliant = filteredData.filteredVehicles.filter(v => v.washes_completed >= v.target).length;
    const total = filteredData.filteredVehicles.length;
    const rate = total > 0 ? Math.round((compliant / total) * 100) : 0;
    
    return {
      compliantVehicles: compliant,
      nonCompliantVehicles: total - compliant,
      totalVehicles: total,
      complianceRate: rate,
      trend: rate >= 75 ? 'good' : rate >= 50 ? 'warning' : 'critical'
    };
  }, [filteredData.filteredVehicles]);

  // Wash Frequency by Site
  const washFrequencyBySite = useMemo(() => {
    if (!filteredData.filteredScans || filteredData.filteredScans.length === 0) return [];
    
    const siteWashes = {};
    filteredData.filteredScans.forEach(scan => {
      const siteName = scan.siteName || 'Unknown';
      siteWashes[siteName] = (siteWashes[siteName] || 0) + 1;
    });
    
    return Object.entries(siteWashes)
      .map(([site, washes]) => ({ site, washes }))
      .sort((a, b) => b.washes - a.washes)
      .slice(0, 10);
  }, [filteredData.filteredScans]);


  // Compliance Trend (using Dashboard dateRange)
  const complianceTrend = useMemo(() => {
    if (!dateRange) return [];
    
    const days = [];
    const start = moment(dateRange.start);
    const end = moment(dateRange.end);
    const diffDays = end.diff(start, 'days');
    
    for (let i = 0; i <= diffDays; i++) {
      const date = moment(start).add(i, 'days');
      const dateStr = date.format('YYYY-MM-DD');
      const scansOnDate = filteredData.filteredScans?.filter(s => 
        moment(s.timestamp).format('YYYY-MM-DD') === dateStr
      ).length || 0;
      
      days.push({
        date: date.format('MMM D'),
        scans: scansOnDate
      });
    }
    return days;
  }, [filteredData.filteredScans, dateRange]);


  const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

  // Export Functions
  const exportToCSV = (data, filename) => {
    const headers = Object.keys(data[0] || {});
    const rows = data.map(row => headers.map(h => row[h] || '').join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${moment().format('YYYY-MM-DD')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportComplianceReport = () => {
    const reportData = filteredData.filteredVehicles.map(v => ({
      Vehicle: v.name,
      RFID: v.rfid,
      Site: v.site_name,
      'Washes Completed': v.washes_completed,
      Target: v.target,
      'Compliance Rate': `${Math.round((v.washes_completed / v.target) * 100)}%`,
      Status: v.washes_completed >= v.target ? 'Compliant' : 'Non-Compliant'
    }));
    exportToCSV(reportData, 'compliance_report');
  };


  return (
    <div className="space-y-8 w-full">
      {/* Header with Filters */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Fleet Reports & Analytics</h2>
          <p className="text-muted-foreground mt-1">Advanced analytics with predictive insights</p>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
          <Button 
            variant="outline" 
            onClick={exportComplianceReport}
            className="gap-2"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export Compliance
          </Button>
        </div>
      </div>

      {/* Key Metrics - 2 cards aligned side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow bg-card border-border rounded-2xl shadow-lg shadow-black/[0.03]" onClick={() => setDrillDownModal({ open: true, type: 'compliance', data: filteredData.filteredVehicles })}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Compliance Rate</p>
                <p className="text-3xl font-bold text-foreground mt-1">{complianceStats.complianceRate}%</p>
                <div className="flex items-center gap-1 mt-2">
                  {complianceStats.trend === 'good' ? (
                    <TrendingUp className="w-4 h-4 text-primary" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-600" />
                  )}
                  <span className={`text-xs ${complianceStats.trend === 'good' ? 'text-primary' : 'text-red-600'}`}>
                    {complianceStats.compliantVehicles}/{complianceStats.totalVehicles} compliant
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  complianceStats.trend === 'good' ? 'bg-primary/10' : 'bg-red-100'
                }`}>
                  <CheckCircle className={`w-6 h-6 ${
                    complianceStats.trend === 'good' ? 'text-primary' : 'text-red-600'
                  }`} />
                </div>
                <ZoomIn className="w-3 h-3 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>


        <Card className="bg-card border-border rounded-2xl shadow-lg shadow-black/[0.03]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Washes</p>
                <p className="text-3xl font-bold text-foreground mt-1">
                  {filteredData.filteredScans.length}
                </p>
                <p className="text-xs text-muted-foreground mt-2">In selected period</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>


      {/* Charts - Side by side on large screens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border rounded-2xl shadow-lg shadow-black/[0.03]">
          <CardHeader>
            <CardTitle className="text-lg text-foreground">Wash Activity Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={complianceTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                <Line 
                  type="monotone" 
                  dataKey="scans" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                  name="Washes"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-card border-border rounded-2xl shadow-lg shadow-black/[0.03]">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between text-foreground">
              <span>Wash Frequency by Site</span>
              <Button 
                size="sm" 
                variant="ghost"
                onClick={() => setDrillDownModal({ open: true, type: 'site', data: washFrequencyBySite })}
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={washFrequencyBySite} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis dataKey="site" type="category" width={120} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                <Bar dataKey="washes" fill="hsl(var(--primary))" name="Washes" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <DrillDownModal
        open={drillDownModal.open}
        onClose={() => setDrillDownModal({ open: false, type: null, data: null })}
        type={drillDownModal.type}
        data={drillDownModal.data}
      />
    </div>
  );
}