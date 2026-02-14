import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import DataPagination from '@/components/ui/DataPagination';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  TrendingUp, 
  TrendingDown, 
  CheckCircle, 
  FileSpreadsheet,
  ZoomIn,
  Search,
  Download,
  FileText,
  Loader2
} from 'lucide-react';
import { scansOptions } from '@/query/options';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  Area,
  AreaChart,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  RadialBarChart,
  RadialBar,
  Label,
  PolarRadiusAxis,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
} from 'recharts';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import moment from 'moment';
import { toast } from '@/lib/toast';
import DrillDownModal from './DrillDownModal';
import { LazyChart, sampleDateIndices, MAX_CHART_POINTS } from './LazyChart';

const COMPLIANCE_PAGE_SIZES = [10, 20, 50, 100];

const CHART_CONFIG = {
  compliant: { label: 'Compliant', color: 'hsl(var(--primary))' },
  nonCompliant: { label: 'Non-Compliant', color: 'hsl(var(--primary) / 0.3)' },
  rate: { label: 'Compliance Rate', color: 'hsl(var(--primary))' },
  washes: { label: 'Washes', color: 'hsl(var(--primary) / 0.6)' },
  compliance: { label: 'Compliance %', color: 'hsl(var(--primary))' },
  vehicles: { label: 'Vehicles', color: 'hsl(var(--primary) / 0.4)' },
};

export default function ReportsDashboard({ vehicles, scans, dateRange, selectedSite, selectedCustomer, selectedDriverIds, companyId, isSyncing = false }) {
  const [drillDownModal, setDrillDownModal] = useState({ open: false, type: null, data: null });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [exportingPdf, setExportingPdf] = useState(false);
  const pdfCaptureRef = useRef(null);

  const [complianceSearch, setComplianceSearch] = useState('');
  const [complianceStatusFilter, setComplianceStatusFilter] = useState('all');
  const [compliancePage, setCompliancePage] = useState(1);
  const [compliancePageSize, setCompliancePageSize] = useState(10);
  const [exportingVehicleRef, setExportingVehicleRef] = useState(null);
  const queryClient = useQueryClient();

  // Loading state when filters change
  const [isCalculating, setIsCalculating] = useState(false);

  // Trigger brief loading state only when date/site changes
  useEffect(() => {
    setIsCalculating(true);
    const t = setTimeout(() => setIsCalculating(false), 80);
    return () => clearTimeout(t);
  }, [dateRange, selectedSite]);

  // No deferred values; loading is handled by isCalculating only
  const isStale = false;

  // Get unique sites for filtering
  const sites = useMemo(() => {
    const siteMap = new Map();
    vehicles.forEach(v => {
      if (v.site_id && v.site_name) siteMap.set(v.site_id, v.site_name);
    });
    return Array.from(siteMap.entries()).map(([id, name]) => ({ id, name }));
  }, [vehicles]);

  // Filter data based on site
  const filteredData = useMemo(() => {
    const filteredScans = selectedSite && selectedSite !== 'all'
      ? (scans?.filter(scan => scan.siteRef === selectedSite || scan.siteRef == null) ?? [])
      : scans ?? [];
    const filteredVehicles = selectedSite && selectedSite !== 'all'
      ? vehicles.filter(v => v.site_id === selectedSite || v.site_id == null)
      : vehicles;
    return { filteredScans, filteredVehicles };
  }, [scans, vehicles, selectedSite]);

  // Fetch individual wash records (scans) for CSV/PDF export - respects filters
  const { data: rawScansData = [], isLoading: scansLoading } = useQuery({
    ...scansOptions(companyId, {
      fromDate: dateRange?.start,
      toDate: dateRange?.end,
      customerId: selectedCustomer && selectedCustomer !== 'all' ? selectedCustomer : undefined,
      siteId: selectedSite && selectedSite !== 'all' ? selectedSite : undefined,
      status: 'success,exceeded',
      export: 'all',
    }),
    enabled: !!companyId && !!dateRange?.start && !!dateRange?.end,
  });

  const allScans = Array.isArray(rawScansData) ? rawScansData : (rawScansData?.data ?? []);
  const exportScans = useMemo(() => {
    let list = allScans;
    if (selectedDriverIds?.length > 0) {
      const driverSet = new Set(selectedDriverIds.map(String));
      list = list.filter(s => s.vehicleRef != null && driverSet.has(String(s.vehicleRef)));
    }
    return list;
  }, [allScans, selectedDriverIds]);

  const vehicleMap = useMemo(() => {
    const map = new Map();
    (vehicles || []).forEach(v => map.set(v.id ?? v.rfid, v));
    return map;
  }, [vehicles]);


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


  // Single-pass date aggregation: one loop over scans -> Map<dateStr, { count, vehicleRefs }>
  const dateAggregation = useMemo(() => {
    const map = new Map();
    const scansList = filteredData.filteredScans ?? [];
    for (let i = 0; i < scansList.length; i++) {
      const s = scansList[i];
      const dateStr = moment(s.timestamp).format('YYYY-MM-DD');
      let entry = map.get(dateStr);
      if (!entry) {
        entry = { count: 0, vehicleRefs: new Set() };
        map.set(dateStr, entry);
      }
      entry.count++;
      if (s.vehicleRef != null) entry.vehicleRefs.add(s.vehicleRef);
    }
    return map;
  }, [filteredData.filteredScans]);

  // Compliance Trend (uses dateAggregation, capped at MAX_CHART_POINTS for smooth UI)
  const complianceTrend = useMemo(() => {
    if (!dateRange) return [];
    const start = moment(dateRange.start);
    const end = moment(dateRange.end);
    const diffDays = end.diff(start, 'days');
    const maxDays = Math.min(diffDays, 90);
    const indices = sampleDateIndices(maxDays, MAX_CHART_POINTS);
    const days = [];
    for (let j = 0; j < indices.length; j++) {
      const i = indices[j];
      const date = moment(start).add(i, 'days');
      const dateStr = date.format('YYYY-MM-DD');
      const entry = dateAggregation.get(dateStr);
      const scansOnDate = entry ? entry.count : 0;
      days.push({ date: date.format('MMM D'), scans: scansOnDate });
    }
    return days;
  }, [dateAggregation, dateRange]);

  const filteredComplianceVehicles = useMemo(() => {
    let data = filteredData.filteredVehicles || [];
    const q = complianceSearch.toLowerCase().trim();
    if (q) {
      data = data.filter(v =>
        (v.name ?? '').toLowerCase().includes(q) ||
        (v.rfid ?? '').toLowerCase().includes(q) ||
        (v.site_name ?? '').toLowerCase().includes(q) ||
        (v.customer_name ?? '').toLowerCase().includes(q)
      );
    }
    if (complianceStatusFilter === 'compliant') {
      data = data.filter(v => (v.washes_completed ?? 0) >= (v.target ?? 12));
    } else if (complianceStatusFilter === 'non-compliant') {
      data = data.filter(v => (v.washes_completed ?? 0) < (v.target ?? 12));
    }
    return data;
  }, [filteredData.filteredVehicles, complianceSearch, complianceStatusFilter]);

  React.useEffect(() => {
    setCompliancePage(1);
  }, [complianceSearch, complianceStatusFilter, compliancePageSize]);

  const complianceTotalPages = Math.max(1, Math.ceil(filteredComplianceVehicles.length / compliancePageSize));
  const paginatedComplianceVehicles = useMemo(() => {
    const start = (compliancePage - 1) * compliancePageSize;
    return filteredComplianceVehicles.slice(start, start + compliancePageSize);
  }, [filteredComplianceVehicles, compliancePage, compliancePageSize]);

  // Compliance Distribution (Radial Chart data)
  const complianceDistribution = useMemo(() => {
    const total = filteredData.filteredVehicles.length;
    if (total === 0) return [];
    const compliant = complianceStats.compliantVehicles;
    const nonCompliant = complianceStats.nonCompliantVehicles;
    return [
      { status: 'compliant', count: compliant, fill: 'hsl(var(--primary))' },
      { status: 'non-compliant', count: nonCompliant, fill: 'hsl(var(--primary) / 0.3)' },
    ];
  }, [filteredData.filteredVehicles, complianceStats]);

  // Compliance Over Time (Area Chart - uses same dateAggregation, capped points)
  const complianceOverTime = useMemo(() => {
    if (!dateRange) return [];
    const start = moment(dateRange.start);
    const end = moment(dateRange.end);
    const diffDays = end.diff(start, 'days');
    const maxDays = Math.min(diffDays, 90);
    const totalVehicles = filteredData.filteredVehicles.length;
    const indices = sampleDateIndices(maxDays, MAX_CHART_POINTS);
    const dailyData = [];
    for (let j = 0; j < indices.length; j++) {
      const i = indices[j];
      const date = moment(start).add(i, 'days');
      const dateStr = date.format('YYYY-MM-DD');
      const entry = dateAggregation.get(dateStr);
      const washes = entry ? entry.count : 0;
      const vehiclesWashedOnDate = entry ? entry.vehicleRefs.size : 0;
      const dailyRate = totalVehicles > 0 ? Math.round((vehiclesWashedOnDate / totalVehicles) * 100) : 0;
      dailyData.push({ date: date.format('MMM D'), rate: dailyRate, washes });
    }
    return dailyData;
  }, [dateAggregation, filteredData.filteredVehicles.length, dateRange]);

  // Site Performance Radar (Top 6 sites across multiple metrics)
  const sitePerformanceRadar = useMemo(() => {
    const siteMetrics = {};
    filteredData.filteredVehicles.forEach(v => {
      const site = v.site_name || 'Unknown';
      if (!siteMetrics[site]) {
        siteMetrics[site] = { 
          site, 
          totalVehicles: 0, 
          compliantVehicles: 0, 
          totalWashes: 0, 
          avgCompliance: 0 
        };
      }
      siteMetrics[site].totalVehicles++;
      if ((v.washes_completed ?? 0) >= (v.target ?? 12)) {
        siteMetrics[site].compliantVehicles++;
      }
      siteMetrics[site].totalWashes += (v.washes_completed ?? 0);
    });

    const siteData = Object.values(siteMetrics)
      .map(s => ({
        ...s,
        avgCompliance: s.totalVehicles > 0 ? Math.round((s.compliantVehicles / s.totalVehicles) * 100) : 0
      }))
      .sort((a, b) => b.totalWashes - a.totalWashes)
      .slice(0, 6);

    return siteData.map(s => ({
      site: s.site.substring(0, 12),
      compliance: s.avgCompliance,
      washes: s.totalWashes,
      vehicles: s.totalVehicles,
    }));
  }, [filteredData.filteredVehicles]);

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

  const exportComplianceReport = (useFiltered = false) => {
    const source = useFiltered ? filteredComplianceVehicles : (filteredData.filteredVehicles || []);
    const reportData = source.map(v => ({
      Vehicle: v.name,
      Customer: v.customer_name,
      Site: v.site_name,
      'Washes Completed': v.washes_completed,
      Target: v.target,
      'Compliance Rate': `${Math.round(((v.washes_completed ?? 0) / (v.target || 1)) * 100)}%`,
      Status: (v.washes_completed ?? 0) >= (v.target ?? 12) ? 'Compliant' : 'Non-Compliant',
      'Last Scan': v.last_scan ? moment(v.last_scan).format('YYYY-MM-DD HH:mm') : ''
    }));
    exportToCSV(reportData, 'vehicle_compliance_detail');
  };

  /** Export all wash events for a single vehicle - one row per wash event with timestamps (Option A).
   * No date restriction. Fetches all pages (API returns paginated, max 1000/page) so export includes every wash. */
  const exportVehicleWashEventsCSV = async (vehicle) => {
    const vehicleRef = vehicle.vehicleRef ?? vehicle.id;
    if (!vehicleRef || !companyId) {
      toast('Cannot export', { description: 'Missing vehicle or company.' });
      return;
    }
    setExportingVehicleRef(vehicleRef);
    try {
      const baseFilters = {
        customerId: selectedCustomer && selectedCustomer !== 'all' ? selectedCustomer : undefined,
        siteId: selectedSite && selectedSite !== 'all' ? selectedSite : undefined,
        status: 'success,exceeded',
        vehicleId: vehicleRef,
      };
      const pageSize = 1000;
      let allScans = [];
      let page = 1;
      let pageCount = 1;
      do {
        const options = scansOptions(companyId, { ...baseFilters, page, pageSize });
        const raw = await queryClient.fetchQuery(options);
        const data = Array.isArray(raw) ? raw : (raw?.data ?? []);
        allScans = allScans.concat(data);
        pageCount = raw?.pageCount ?? 1;
        if (data.length < pageSize || page >= pageCount) break;
        page += 1;
      } while (true);

      const vehicleScans = allScans;
      if (vehicleScans.length === 0) {
        toast('No wash events', { description: `No wash events found for ${vehicle.name ?? vehicle.rfid ?? 'this vehicle'}.` });
        return;
      }
      const rows = vehicleScans.map(s => {
        const dt = s.createdAt ?? s.timestamp ?? s.scanDate;
        const m = dt ? moment(dt) : null;
        const duration = s.washDurationSeconds ?? s.durationSeconds ?? s.washTime;
        return {
          Site: s.siteName ?? vehicle.site_name ?? '—',
          'Vehicle / Truck': s.vehicleName ?? vehicle.name ?? '—',
          'Vehicle RFID': s.rfid ?? vehicle.rfid ?? '—',
          'Wash Timestamp': m ? m.format('YYYY-MM-DD HH:mm:ss') : '—',
          'Wash Type / Status': s.statusLabel ?? s.status ?? '—',
          Location: s.siteName ?? vehicle.site_name ?? '—',
          'Wash Time (Secs)': duration != null ? duration : '—',
        };
      });
      exportToCSV(rows, `wash_events_${(vehicle.name || vehicle.rfid || 'vehicle').toString().replace(/\s+/g, '_')}`);
      toast('Export complete', { description: `${rows.length} wash event${rows.length === 1 ? '' : 's'} for ${vehicle.name ?? 'vehicle'} (all time, one row per wash).` });
    } catch (e) {
      console.error('Export vehicle wash events failed:', e);
      toast('Export failed', { description: e?.message || 'Could not load wash events for this vehicle.' });
    } finally {
      setExportingVehicleRef(null);
    }
  };

  const exportWashRecordsCSV = () => {
    const rows = exportScans.map(s => {
      const dt = s.createdAt ?? s.timestamp ?? s.scanDate;
      const m = dt ? moment(dt) : null;
      const v = vehicleMap.get(s.vehicleRef) || {};
      const duration = s.washDurationSeconds ?? s.durationSeconds ?? s.washTime;
      return {
        Date: m ? m.format('YYYY-MM-DD') : '—',
        Time: m ? m.format('HH:mm:ss') : '—',
        Vehicle: s.vehicleName ?? v.name ?? '—',
        'Vehicle RFID': s.rfid ?? v.rfid ?? s.vehicleRef ?? '—',
        Site: s.siteName ?? '—',
        Customer: s.customerName ?? v.customer_name ?? '—',
        Status: s.statusLabel ?? s.status ?? '—',
        'Wash Time (Secs)': duration != null ? duration : '—',
      };
    });
    if (rows.length === 0) return;
    exportToCSV(rows, 'wash_records');
  };

  const handleExportPdf = async () => {
    if (!pdfCaptureRef.current) return;
    setExportingPdf(true);
    try {
      const el = pdfCaptureRef.current;
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#f8fafc',
        logging: false,
        height: el.scrollHeight,
        windowHeight: el.scrollHeight,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;
      const imgWidth = contentWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = margin;
      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= (pageHeight - margin * 2);
      while (heightLeft > 0) {
        position = -(imgHeight - heightLeft) + margin;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= (pageHeight - margin * 2);
      }
      pdf.save(`reports-${moment().format('YYYY-MM-DD')}.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setExportingPdf(false);
    }
  };

  // Skeleton components for charts
  const ChartSkeleton = ({ height = "250px" }) => (
    <div className="space-y-3" style={{ height }}>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-full w-full" />
    </div>
  );

  const RadialChartSkeleton = () => (
    <div className="flex flex-col items-center gap-4 py-6">
      <Skeleton className="h-[200px] w-[200px] rounded-full" />
      <div className="space-y-2 w-full px-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  );

  const reportsDateRangeStr = dateRange?.start && dateRange?.end
    ? `${moment(dateRange.start).format('D MMM yyyy')} – ${moment(dateRange.end).format('D MMM yyyy')}`
    : null;

  if (isSyncing) {
    return (
      <div className="space-y-8 w-full">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-80" />
          </div>
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="rounded-2xl"><CardContent className="p-5"><Skeleton className="h-24 w-full" /></CardContent></Card>
          <Card className="rounded-2xl"><CardContent className="p-5"><Skeleton className="h-24 w-full" /></CardContent></Card>
        </div>
        <Card className="rounded-2xl">
          <CardHeader><Skeleton className="h-6 w-48" /><Skeleton className="h-10 w-full mt-3" /></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                {[1,2,3,4,5,6].map(i => <TableHead key={i}><Skeleton className="h-4 w-16" /></TableHead>)}
              </TableRow></TableHeader>
              <TableBody>
                {Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {[1,2,3,4,5,6].map(j => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[300px] w-full rounded-lg" />
          <Skeleton className="h-[300px] w-full rounded-lg" />
        </div>
        <Skeleton className="h-[250px] w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-8 w-full" ref={pdfCaptureRef}>
      {/* Header with Filters */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Fleet Reports & Analytics</h2>
          <p className="text-muted-foreground mt-1">Advanced analytics with predictive insights</p>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <Button 
            variant="outline" 
            size="sm"
            onClick={exportComplianceReport}
            className="gap-2"
            disabled={filteredData.filteredVehicles.length === 0}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export Compliance
          </Button>
        </div>
      </div>

      {/* Key Metrics - 2 cards aligned side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-card border-border rounded-2xl shadow-lg shadow-black/[0.03]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Compliance Rate</p>
                {reportsDateRangeStr && (
                  <p className="text-xs text-muted-foreground/90 mt-0.5">{reportsDateRangeStr}</p>
                )}
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
              </div>
            </div>
          </CardContent>
        </Card>


        <Card className="bg-card border-border rounded-2xl shadow-lg shadow-black/[0.03]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-primary font-semibold">Total Washes</p>
                {reportsDateRangeStr && (
                  <p className="text-xs text-muted-foreground/90 mt-0.5">{reportsDateRangeStr}</p>
                )}
                <p className="text-3xl font-bold text-foreground mt-1">
                  {filteredData.filteredVehicles.reduce((sum, v) => sum + (v.washes_completed ?? 0), 0)}
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

      {/* 1. Vehicle Compliance Details - directly under KPI cards */}
      <Card className="bg-card border-border rounded-2xl shadow-lg shadow-black/[0.03]">
        <CardHeader>
          <div className="flex flex-col gap-4">
            <CardTitle className="text-lg">Vehicle Compliance Details</CardTitle>
            <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by vehicle, customer, or site..."
                  value={complianceSearch}
                  onChange={(e) => setComplianceSearch(e.target.value)}
                  className="pl-10 h-9"
                />
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="w-[160px]">
                  <Select value={complianceStatusFilter} onValueChange={setComplianceStatusFilter}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="compliant">Compliant</SelectItem>
                      <SelectItem value="non-compliant">Non-Compliant</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-[100px]">
                  <Select
                    value={String(compliancePageSize)}
                    onValueChange={(v) => setCompliancePageSize(Number(v))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COMPLIANCE_PAGE_SIZES.map((s) => (
                        <SelectItem key={s} value={String(s)}>{s} per page</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportComplianceReport(true)}
                  className="gap-2 h-9"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Vehicle</TableHead>
                  <TableHead className="font-semibold">Customer</TableHead>
                  <TableHead className="font-semibold">Site</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold text-right">Washes</TableHead>
                  <TableHead className="font-semibold text-right">Target</TableHead>
                  <TableHead className="font-semibold text-right">Rate</TableHead>
                  <TableHead className="font-semibold text-right w-[80px]">Export</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedComplianceVehicles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      No vehicles match your filters
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedComplianceVehicles.map((v, idx) => {
                    const rate = (v.target && v.target > 0)
                      ? Math.round(((v.washes_completed ?? 0) / v.target) * 100)
                      : 0;
                    const isCompliant = (v.washes_completed ?? 0) >= (v.target ?? 12);
                    return (
                      <TableRow key={v.id || v.rfid || idx} className="hover:bg-muted/30">
                        <TableCell className="font-medium">{v.name || '—'}</TableCell>
                        <TableCell>{v.customer_name || '—'}</TableCell>
                        <TableCell>{v.site_name || '—'}</TableCell>
                        <TableCell>
                          <Badge className={isCompliant ? 'bg-primary' : 'bg-red-500'}>
                            {isCompliant ? 'Compliant' : 'Non-Compliant'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{v.washes_completed ?? 0}</TableCell>
                        <TableCell className="text-right">{v.target ?? '—'}</TableCell>
                        <TableCell className="text-right font-medium">{rate}%</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 text-xs"
                            onClick={() => exportVehicleWashEventsCSV(v)}
                            disabled={scansLoading || exportingVehicleRef != null}
                            title={exportingVehicleRef ? 'Exporting...' : (scansLoading ? 'Loading...' : 'Export all wash events (one row per event with timestamps)')}
                          >
                            {(scansLoading || exportingVehicleRef === (v.vehicleRef ?? v.id)) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
                            CSV
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          {filteredComplianceVehicles.length > 0 && (
            <DataPagination
              currentPage={compliancePage}
              totalPages={complianceTotalPages}
              totalItems={filteredComplianceVehicles.length}
              pageSize={compliancePageSize}
              onPageChange={setCompliancePage}
              className="mt-4"
            />
          )}
        </CardContent>
      </Card>

      {/* 2. Wash Activity Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border rounded-2xl shadow-lg shadow-black/[0.03]">
          <CardHeader>
            <CardTitle className="text-lg text-foreground">Wash Activity Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {isCalculating || isStale ? (
              <ChartSkeleton height="300px" />
            ) : (
            <LazyChart skeleton={<ChartSkeleton height="300px" />}>
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
            </LazyChart>
            )}
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
                disabled={isCalculating || isStale}
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isCalculating || isStale ? (
              <ChartSkeleton height="300px" />
            ) : (
            <LazyChart skeleton={<ChartSkeleton height="300px" />}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={washFrequencyBySite} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis dataKey="site" type="category" width={120} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                <Bar dataKey="washes" fill="hsl(var(--primary))" name="Washes" />
              </BarChart>
            </ResponsiveContainer>
            </LazyChart>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Fleet Compliance Distribution + Compliance Rate Over Time */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="flex flex-col bg-card border-border rounded-2xl shadow-lg shadow-black/[0.03]">
          <CardHeader className="items-center pb-0">
            <CardTitle className="text-lg">Fleet Compliance Distribution</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Current status breakdown</p>
          </CardHeader>
          <CardContent className="flex-1 pb-0">
            {isCalculating || isStale ? (
              <RadialChartSkeleton />
            ) : (
            <LazyChart skeleton={<RadialChartSkeleton />}>
            <ChartContainer config={CHART_CONFIG} className="mx-auto aspect-square max-h-[250px]">
              <RadialBarChart
                data={complianceDistribution}
                startAngle={-90}
                endAngle={270}
                innerRadius={60}
                outerRadius={110}
              >
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel nameKey="status" />}
                />
                <RadialBar dataKey="count" background cornerRadius={10} />
                <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
                  <Label
                    content={({ viewBox }) => {
                      if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                        return (
                          <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle">
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy || 0) - 10}
                              className="fill-foreground text-3xl font-bold"
                            >
                              {complianceStats.complianceRate}%
                            </tspan>
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy || 0) + 16}
                              className="fill-muted-foreground text-sm"
                            >
                              Compliant
                            </tspan>
                          </text>
                        )
                      }
                    }}
                  />
                </PolarRadiusAxis>
              </RadialBarChart>
            </ChartContainer>
            </LazyChart>
            )}
          </CardContent>
          {!isCalculating && !isStale && (
          <div className="flex flex-col gap-2 p-4 pt-0 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <span>{complianceStats.compliantVehicles} Compliant</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-3 h-3 rounded-full bg-primary/30" />
              <span>{complianceStats.nonCompliantVehicles} Non-Compliant</span>
            </div>
          </div>
          )}
        </Card>

        <Card className="lg:col-span-2 bg-card border-border rounded-2xl shadow-lg shadow-black/[0.03]">
          <CardHeader>
            <CardTitle className="text-lg">Compliance Rate Over Time</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Daily compliance rate and wash activity</p>
          </CardHeader>
          <CardContent>
            {isCalculating || isStale ? (
              <ChartSkeleton height="250px" />
            ) : (
            <LazyChart skeleton={<ChartSkeleton height="250px" />}>
            <ChartContainer config={CHART_CONFIG} className="h-[250px] w-full">
              <AreaChart data={complianceOverTime} margin={{ left: 12, right: 12 }}>
                <defs>
                  <linearGradient id="fillRate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="fillWashes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={32}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                <Area
                  dataKey="washes"
                  type="natural"
                  fill="url(#fillWashes)"
                  stroke="hsl(var(--primary) / 0.6)"
                  stackId="a"
                />
                <Area
                  dataKey="rate"
                  type="natural"
                  fill="url(#fillRate)"
                  stroke="hsl(var(--primary))"
                  stackId="a"
                />
                <ChartLegend content={<ChartLegendContent />} />
              </AreaChart>
            </ChartContainer>
            </LazyChart>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Wash Records - individual wash events with date stamps */}
      {exportScans.length > 0 && (
        <Card className="bg-card border-border rounded-2xl shadow-lg shadow-black/[0.03]">
          <CardHeader>
            <CardTitle className="text-lg">Wash Records</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Individual wash events with date stamps. {exportScans.length > 100 ? `Showing most recent 100 of ${exportScans.length}. Use Export CSV for full dataset.` : `${exportScans.length} records.`}
            </p>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border overflow-hidden max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Date</TableHead>
                    <TableHead className="font-semibold">Time</TableHead>
                    <TableHead className="font-semibold">Vehicle</TableHead>
                    <TableHead className="font-semibold">Site</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold text-right">Wash Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exportScans.slice(0, 100).map((s, idx) => {
                    const dt = s.createdAt ?? s.timestamp ?? s.scanDate;
                    const m = dt ? moment(dt) : null;
                    const v = vehicleMap.get(s.vehicleRef) || {};
                    const duration = s.washDurationSeconds ?? s.durationSeconds ?? s.washTime;
                    return (
                      <TableRow key={s.scanRef ?? s.internalScanId ?? idx}>
                        <TableCell className="text-muted-foreground text-sm">{m ? m.format('DD/MM/YYYY') : '—'}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{m ? m.format('HH:mm') : '—'}</TableCell>
                        <TableCell className="font-medium">{s.vehicleName ?? v.name ?? '—'}</TableCell>
                        <TableCell>{s.siteName ?? '—'}</TableCell>
                        <TableCell>{s.statusLabel ?? s.status ?? '—'}</TableCell>
                        <TableCell className="text-right text-muted-foreground text-sm">
                          {duration != null ? (duration >= 60 ? `${Math.round(duration / 60)}m` : `${duration}s`) : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Site Performance Comparison - Radar Chart */}
      <Card className="bg-card border-border rounded-2xl shadow-lg shadow-black/[0.03]">
        <CardHeader className="items-center pb-4">
          <CardTitle className="text-lg">Site Performance Comparison</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Top 6 sites across key metrics</p>
        </CardHeader>
        <CardContent className="pb-0">
          {isCalculating || isStale ? (
            <ChartSkeleton height="400px" />
          ) : (
          <LazyChart skeleton={<ChartSkeleton height="400px" />}>
          <>
          <ChartContainer config={CHART_CONFIG} className="mx-auto aspect-square max-h-[400px]">
            <RadarChart data={sitePerformanceRadar}>
              <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
              <PolarAngleAxis dataKey="site" tick={{ fontSize: 11 }} />
              <PolarGrid gridType="circle" stroke="hsl(var(--border))" />
              <Radar
                dataKey="compliance"
                fill="hsl(var(--primary))"
                fillOpacity={0.6}
                stroke="hsl(var(--primary))"
                strokeWidth={2}
              />
              <Radar
                dataKey="washes"
                fill="hsl(var(--primary))"
                fillOpacity={0.3}
                stroke="hsl(var(--primary) / 0.7)"
                strokeWidth={2}
              />
              <Radar
                dataKey="vehicles"
                fill="hsl(var(--primary))"
                fillOpacity={0.15}
                stroke="hsl(var(--primary) / 0.4)"
                strokeWidth={2}
              />
            </RadarChart>
          </ChartContainer>
          <div className="flex flex-wrap justify-center gap-4 mt-4 pb-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-muted-foreground">Compliance %</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-primary/70" />
              <span className="text-muted-foreground">Total Washes</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-primary/40" />
              <span className="text-muted-foreground">Vehicles</span>
            </div>
          </div>
          </>
          </LazyChart>
          )}
        </CardContent>
      </Card>

      <DrillDownModal
        open={drillDownModal.open}
        onClose={() => setDrillDownModal({ open: false, type: null, data: null })}
        type={drillDownModal.type}
        data={drillDownModal.data}
      />
    </div>
  );
}