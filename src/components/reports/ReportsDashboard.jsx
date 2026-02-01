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

  // Filter data based on site (date filtering already done by Dashboard)
  const filteredData = useMemo(() => {
    const filteredScans = selectedSite && selectedSite !== 'all'
      ? scans?.filter(scan => scan.siteRef === selectedSite) || []
      : scans || [];

    const filteredVehicles = selectedSite && selectedSite !== 'all'
      ? vehicles.filter(v => v.site_id === selectedSite)
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


  const COLORS = ['#7CB342', '#9CCC65', '#689F38', '#558B2F', '#33691E', '#827717', '#CDDC39'];

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
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Fleet Reports & Analytics</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Advanced analytics with predictive insights</p>
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
        <Card className="cursor-pointer hover:shadow-lg transition-shadow backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80 border border-gray-200/20 dark:border-zinc-800/50 rounded-2xl shadow-lg shadow-black/[0.03]" onClick={() => setDrillDownModal({ open: true, type: 'compliance', data: filteredData.filteredVehicles })}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-gray-400">Compliance Rate</p>
                <p className="text-3xl font-bold text-slate-800 dark:text-white mt-1">{complianceStats.complianceRate}%</p>
                <div className="flex items-center gap-1 mt-2">
                  {complianceStats.trend === 'good' ? (
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-600" />
                  )}
                  <span className={`text-xs ${complianceStats.trend === 'good' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {complianceStats.compliantVehicles}/{complianceStats.totalVehicles} compliant
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  complianceStats.trend === 'good' ? 'bg-emerald-100' : 'bg-red-100'
                }`}>
                  <CheckCircle className={`w-6 h-6 ${
                    complianceStats.trend === 'good' ? 'text-emerald-600' : 'text-red-600'
                  }`} />
                </div>
                <ZoomIn className="w-3 h-3 text-slate-400" />
              </div>
            </div>
          </CardContent>
        </Card>


        <Card className="backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80 border border-gray-200/20 dark:border-zinc-800/50 rounded-2xl shadow-lg shadow-black/[0.03]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-gray-400">Total Washes</p>
                <p className="text-3xl font-bold text-slate-800 dark:text-white mt-1">
                  {filteredData.filteredScans.length}
                </p>
                <p className="text-xs text-slate-500 mt-2">In selected period</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-[#7CB342]/10 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-[#7CB342]" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>


      {/* Charts - Side by side on large screens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80 border border-gray-200/20 dark:border-zinc-800/50 rounded-2xl shadow-lg shadow-black/[0.03]">
          <CardHeader>
            <CardTitle className="text-lg text-gray-900 dark:text-white">Wash Activity Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={complianceTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="scans" 
                  stroke="#7CB342" 
                  strokeWidth={2}
                  dot={{ fill: '#7CB342', r: 4 }}
                  name="Washes"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80 border border-gray-200/20 dark:border-zinc-800/50 rounded-2xl shadow-lg shadow-black/[0.03]">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between text-gray-900 dark:text-white">
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
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="site" type="category" width={120} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="washes" fill="#9CCC65" name="Washes" />
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