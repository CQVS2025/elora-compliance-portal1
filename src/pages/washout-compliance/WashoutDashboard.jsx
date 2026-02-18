import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { gsap, useGSAP } from '@/lib/gsap';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Download, Search, RotateCcw, Play } from 'lucide-react';
import MetricCard from '@/components/washout-compliance/MetricCard';
import WESScoreBadge, { WESScoreStatus } from '@/components/washout-compliance/WESScoreBadge';
import BuildupRiskIndicator from '@/components/washout-compliance/BuildupRiskIndicator';
import AIInsightsBox from '@/components/washout-compliance/AIInsightsBox';
import WESDistributionChart from '@/components/washout-compliance/WESDistributionChart';
import SiteComplianceChart from '@/components/washout-compliance/SiteComplianceChart';
import { PriorityActionsSection } from '@/components/washout-compliance/PriorityActionCard';
import {
  SITE_COMPLIANCE,
  WES_DISTRIBUTION,
  FLEET_METRICS,
  AI_SUMMARY,
  PRIORITY_ACTIONS,
  RISK_SUMMARY,
  DEDAGGING_RISK_ROWS,
  COMBINED_RISK_MESSAGE,
  RECOMMENDATIONS_BY_PRIORITY,
  RECOMMENDATIONS_SUMMARY,
  OPTIMAL_WASH_WINDOWS,
  DRIVER_INSIGHTS,
  PATTERNS_METRICS,
  POSITIVE_PATTERNS,
  AREAS_OF_CONCERN,
} from '@/data/washout-dummy-data';
import { useWashoutFilteredData } from '@/hooks/useWashoutFilteredData';
import WashoutEmptyState from '@/components/washout-compliance/WashoutEmptyState';
import { TrendingUp, Activity, AlertTriangle, Droplet, DollarSign, Clock, User, AlertCircle } from 'lucide-react';
import moment from 'moment';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { CHART_TOOLTIP_STYLES } from '@/components/washout-compliance/chartTheme';
import DataPagination from '@/components/ui/DataPagination';

const FLEET_PAGE_SIZES = [10, 25, 50, 100];
const RISK_TABLE_PAGE_SIZES = [5, 10, 25, 50];

export default function WashoutDashboard() {
  const navigate = useNavigate();
  const washoutData = useWashoutFilteredData();
  const {
    isBoralQld,
    vehicles: dashboardFilteredVehicles,
    customerName,
    showEmptyState,
    isLoading,
    emptyMessage,
  } = washoutData;

  const [dateRange, setDateRange] = useState({
    start: '2026-02-01',
    end: '2026-02-16'
  });
  const [selectedSite, setSelectedSite] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [fleetTablePage, setFleetTablePage] = useState(1);
  const [fleetTablePageSize, setFleetTablePageSize] = useState(10);
  const [riskTablePage, setRiskTablePage] = useState(1);
  const [riskTablePageSize, setRiskTablePageSize] = useState(10);

  const mainRef = useRef(null);
  useGSAP(() => {
    if (isLoading || showEmptyState) return;
    const ctx = mainRef.current;
    if (!ctx) return;
    // Animate only the active tab's content (when tab changes, animate that tab's sections)
    const tabPanel = ctx.querySelector(`[data-tab="${activeTab}"]`);
    const els = tabPanel ? tabPanel.querySelectorAll('.gsap-fade-up') : ctx.querySelectorAll('.gsap-fade-up');
    if (els.length) {
      gsap.from(els, {
        opacity: 0,
        y: 18,
        duration: 0.35,
        stagger: 0.06,
        ease: 'power2.out',
      });
    }
  }, { scope: mainRef, dependencies: [showEmptyState, isLoading, activeTab] });

  // Filter vehicles: first by dashboard customer/site (in hook), then by local search and site
  const filteredVehicles = useMemo(() => {
    const base = dashboardFilteredVehicles || [];
    return base.filter(vehicle => {
      const matchesSearch = !searchQuery ||
        vehicle.vehicleId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        vehicle.driver.toLowerCase().includes(searchQuery.toLowerCase()) ||
        vehicle.site.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSite = selectedSite === 'all' || vehicle.site === selectedSite;
      return matchesSearch && matchesSite;
    });
  }, [dashboardFilteredVehicles, searchQuery, selectedSite]);

  const fleetTotalPages = Math.max(1, Math.ceil(filteredVehicles.length / fleetTablePageSize));
  const paginatedFleet = useMemo(() => {
    const start = (fleetTablePage - 1) * fleetTablePageSize;
    return filteredVehicles.slice(start, start + fleetTablePageSize);
  }, [filteredVehicles, fleetTablePage, fleetTablePageSize]);

  const riskRowsTotalPages = Math.max(1, Math.ceil(DEDAGGING_RISK_ROWS.length / riskTablePageSize));
  const paginatedRiskRows = useMemo(() => {
    const start = (riskTablePage - 1) * riskTablePageSize;
    return DEDAGGING_RISK_ROWS.slice(start, start + riskTablePageSize);
  }, [riskTablePage, riskTablePageSize]);

  useEffect(() => {
    setFleetTablePage(1);
  }, [searchQuery, selectedSite, fleetTablePageSize]);
  useEffect(() => {
    if (fleetTablePage > fleetTotalPages) setFleetTablePage(1);
  }, [fleetTotalPages, fleetTablePage]);
  useEffect(() => {
    setRiskTablePage(1);
  }, [riskTablePageSize]);
  useEffect(() => {
    if (riskTablePage > riskRowsTotalPages) setRiskTablePage(1);
  }, [riskRowsTotalPages, riskTablePage]);

  // Sites for dropdown: from current (dashboard-filtered) vehicle set
  const sites = useMemo(() => {
    const unique = [...new Set((dashboardFilteredVehicles || []).map(v => v.site))];
    return unique.sort();
  }, [dashboardFilteredVehicles]);

  const handleReset = () => {
    setDateRange({ start: '2026-02-01', end: '2026-02-16' });
    setSelectedSite('all');
    setSearchQuery('');
  };

  const handleExportCSV = () => {
    const headers = ['Vehicle', 'Driver', 'Site', 'Last Washout', 'WES Score', 'Water (L)', 'Drum RPM', 'End NTU', 'Buildup Risk', 'Dedag ETA', 'Status'];
    const rows = filteredVehicles.map(v => [
      v.vehicleId,
      v.driver,
      v.site,
      moment(v.lastWashout).format('YYYY-MM-DD HH:mm'),
      v.wesScore,
      v.waterVolume,
      v.drumRPM,
      v.endNTU,
      v.buildupRisk,
      v.dedagETA || '-',
      v.status
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `washout-compliance-${dateRange.start}-to-${dateRange.end}.csv`;
    a.click();
  };

  const handleVehicleClick = (vehicleId) => {
    navigate(`/washout-compliance/wes-scoring/${vehicleId}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (showEmptyState) {
    return <WashoutEmptyState message={emptyMessage} />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Washout Compliance</h1>
              <p className="text-muted-foreground mt-1">Fleet washout monitoring & dedagging prevention</p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-2 border-b border-border">
            <button
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                'Dashboard' === 'Dashboard' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              Dashboard
            </button>
            <button
              className="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => navigate('/washout-compliance/wes-scoring')}
            >
              Vehicle Detail
            </button>
            <button
              className="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => navigate('/washout-compliance/sensor-data')}
            >
              Data Integration
            </button>
          </div>
        </div>
      </div>

      <main ref={mainRef} className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 space-y-6">
        {/* Filter Section */}
        <Card className="gsap-fade-up">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">Customer</span>
                <Select value="boral-qld" disabled>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue>{customerName ?? 'BORAL — QLD'}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="boral-qld">BORAL — QLD</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="w-[150px]"
                />
                <span className="text-muted-foreground">—</span>
                <Input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="w-[150px]"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">Site</span>
                <Select value={selectedSite} onValueChange={setSelectedSite}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Sites" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sites</SelectItem>
                    {sites.map(site => (
                      <SelectItem key={site} value={site}>{site}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 ml-auto">
                <Button variant="default" size="sm">
                  <Play className="w-4 h-4 mr-2" />
                  Run Analysis
                </Button>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Summary */}
        <div className="gsap-fade-up">
          <AIInsightsBox
            title={AI_SUMMARY.title}
            description={AI_SUMMARY.description}
            confidence={AI_SUMMARY.confidence}
          />
        </div>

        {/* Fleet Metrics */}
        <div className="gsap-fade-up grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <MetricCard
            title="Fleet Compliance"
            value={`${FLEET_METRICS.fleetCompliance}%`}
            label="Weekly target: 90%"
            change={FLEET_METRICS.change}
            icon={TrendingUp}
            iconBgColor="bg-primary/10 dark:bg-primary/20"
            iconColor="text-primary"
          />
          <MetricCard
            title="Avg WES Score"
            value={FLEET_METRICS.avgWESScore}
            label="Out of 100"
            change={FLEET_METRICS.wesChange}
            icon={Activity}
            iconBgColor="bg-blue-100 dark:bg-primary/20"
            iconColor="text-blue-600 dark:text-primary"
          />
          <MetricCard
            title="Vehicles At Risk"
            value={FLEET_METRICS.vehiclesAtRisk}
            label="Next 48 hours"
            change={FLEET_METRICS.riskChange}
            icon={AlertTriangle}
            iconBgColor="bg-chart-critical/10 dark:bg-chart-critical/20"
            iconColor="text-chart-critical"
          />
          <MetricCard
            title="Washouts This Week"
            value={FLEET_METRICS.washoutsThisWeek}
            label="Avg 7.8 per truck"
            change={FLEET_METRICS.washoutChange}
            icon={Droplet}
            iconBgColor="bg-primary/10 dark:bg-primary/20"
            iconColor="text-primary"
          />
          <MetricCard
            title="Est. Savings"
            value={`$${(FLEET_METRICS.estSavings / 1000).toFixed(0)}K`}
            label="This month (dedagging avoided)"
            change={FLEET_METRICS.savingsChange}
            changeFormatted={`$${(FLEET_METRICS.savingsChange / 1000).toFixed(0)}K`}
            icon={DollarSign}
            iconBgColor="bg-primary/10 dark:bg-primary/20"
            iconColor="text-primary"
          />
        </div>

        {/* Tabs for different views — client design: active = solid primary bg + white text */}
        <div className="gsap-fade-up">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-auto p-0 gap-0 bg-transparent border-b border-border rounded-none w-full justify-start">
            <TabsTrigger
              value="overview"
              className={cn(
                'rounded-t-md px-4 py-2.5 text-sm font-medium border-b-2 border-transparent -mb-px',
                'data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground',
                'data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-none'
              )}
            >
              ⊞ Overview
            </TabsTrigger>
            <TabsTrigger
              value="risk"
              className={cn(
                'rounded-t-md px-4 py-2.5 text-sm font-medium border-b-2 border-transparent -mb-px',
                'data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground',
                'data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-none'
              )}
            >
              ⚠ Risk Predictions
            </TabsTrigger>
            <TabsTrigger
              value="recommendations"
              className={cn(
                'rounded-t-md px-4 py-2.5 text-sm font-medium border-b-2 border-transparent -mb-px',
                'data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground',
                'data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-none'
              )}
            >
              💡 Recommendations
            </TabsTrigger>
            <TabsTrigger
              value="patterns"
              className={cn(
                'rounded-t-md px-4 py-2.5 text-sm font-medium border-b-2 border-transparent -mb-px',
                'data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground',
                'data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-none'
              )}
            >
              📊 Patterns
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6" data-tab="overview">
            {/* Charts Row */}
            <div className="gsap-fade-up grid grid-cols-1 lg:grid-cols-2 gap-6">
              <WESDistributionChart data={WES_DISTRIBUTION} />
              <SiteComplianceChart data={SITE_COMPLIANCE} />
            </div>

            {/* Fleet Washout Status Table */}
            <Card className="gsap-fade-up">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-foreground">Fleet Washout Status</h2>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Filter vehicles by name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 w-[250px]"
                      />
                    </div>
                    <Button variant="outline" size="sm" onClick={handleExportCSV}>
                      <Download className="w-4 h-4 mr-2" />
                      Export Report
                    </Button>
                    <Button variant="ghost" size="sm">
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Refresh
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vehicle</TableHead>
                        <TableHead>Driver</TableHead>
                        <TableHead>Site</TableHead>
                        <TableHead>Last Washout</TableHead>
                        <TableHead className="text-center">WES Score</TableHead>
                        <TableHead className="text-center">Water (L)</TableHead>
                        <TableHead className="text-center">Drum RPM</TableHead>
                        <TableHead className="text-center">End NTU</TableHead>
                        <TableHead>Buildup Risk</TableHead>
                        <TableHead>Dedag ETA</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedFleet.map((vehicle, index) => (
                        <TableRow 
                          key={vehicle.vehicleRef ?? vehicle.vehicleId ?? index}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleVehicleClick(vehicle.vehicleId)}
                        >
                          <TableCell className="font-medium">{vehicle.vehicleId}</TableCell>
                          <TableCell>{vehicle.driver}</TableCell>
                          <TableCell>{vehicle.site}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            {moment(vehicle.lastWashout).format('DD MMM HH:mm')}
                          </TableCell>
                          <TableCell className="text-center">
                            <WESScoreBadge score={vehicle.wesScore} />
                          </TableCell>
                          <TableCell className="text-center">{vehicle.waterVolume}</TableCell>
                          <TableCell className={cn(
                            'text-center font-medium',
                            vehicle.drumRPM === 0 ? 'text-chart-critical' :
                            vehicle.drumRPM < 8 ? 'text-chart-medium' : 'text-primary'
                          )}>
                            {vehicle.drumRPM.toFixed(1)}
                          </TableCell>
                          <TableCell className={cn(
                            'text-center font-medium',
                            vehicle.endNTU > 500 ? 'text-chart-critical' :
                            vehicle.endNTU > 150 ? 'text-chart-medium' : 'text-primary'
                          )}>
                            {vehicle.endNTU}
                          </TableCell>
                          <TableCell>
                            <BuildupRiskIndicator risk={vehicle.buildupRisk} />
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {vehicle.dedagETA || '—'}
                          </TableCell>
                          <TableCell>
                            <WESScoreStatus status={vehicle.status} />
                          </TableCell>
                          <TableCell>
                            {vehicle.status === 'Non-Compliant' && (
                              <Button size="sm" variant="destructive">
                                Escalate
                              </Button>
                            )}
                            {vehicle.status === 'Marginal' && (
                              <Button size="sm" variant="outline">
                                SMS Alert
                              </Button>
                            )}
                            {vehicle.status === 'Compliant' && (
                              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                                ✓ Compliant
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Rows per page</span>
                    <Select value={String(fleetTablePageSize)} onValueChange={(v) => { setFleetTablePageSize(Number(v)); setFleetTablePage(1); }}>
                      <SelectTrigger className="w-[72px] h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FLEET_PAGE_SIZES.map((s) => (
                          <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <DataPagination
                    currentPage={fleetTablePage}
                    totalPages={fleetTotalPages}
                    totalItems={filteredVehicles.length}
                    pageSize={fleetTablePageSize}
                    onPageChange={setFleetTablePage}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Info Note */}
            <Card className="gsap-fade-up bg-primary/5 border-primary/20 dark:bg-primary/10 dark:border-primary/30">
              <CardContent className="p-4">
                <p className="text-sm text-foreground">
                  💧 <strong>Water volume is a fixed 340L</strong> dispensed per washout event (timed valve). 
                  The WES score differentiates washout quality based on drum rotation, discharge turbidity, 
                  and contextual factors — not water volume.
                </p>
              </CardContent>
            </Card>

            {/* WES Score — How It Works */}
            <Card className="gsap-fade-up">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <span className="text-xl" aria-hidden>🧠</span>
                  <CardTitle className="text-lg">WES Score — How It Works</CardTitle>
                </div>
                <p className="text-sm text-muted-foreground">Washout Effectiveness Score · 0–100 scale</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { range: '90–100', label: 'Excellent', desc: 'Clean discharge, full rotation', className: 'bg-primary/15 border-primary/30 text-primary dark:bg-primary/20' },
                    { range: '70–89', label: 'Good', desc: 'Acceptable washout quality', className: 'bg-primary/10 border-primary/20 text-primary dark:bg-primary/15' },
                    { range: '50–69', label: 'Marginal', desc: 'Insufficient — buildup likely', className: 'bg-chart-medium/10 border-chart-medium/30 text-chart-medium dark:bg-chart-medium/20' },
                    { range: '<50', label: 'Poor', desc: 'Negligible wash or gaming', className: 'bg-chart-critical/10 border-chart-critical/30 text-chart-critical dark:bg-chart-critical/20' },
                  ].map((item) => (
                    <div key={item.range} className={cn('rounded-lg border p-4', item.className)}>
                      <div className="font-bold text-foreground">{item.range}</div>
                      <div className="font-semibold text-foreground">{item.label}</div>
                      <p className="text-sm text-muted-foreground mt-1">{item.desc}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-4 text-sm">
                  <div className="border-l-4 border-primary/50 pl-4 py-2 bg-muted/30 dark:bg-muted/20 rounded-r">
                    <span className="font-medium text-primary">Discharge Turbidity (NTU)</span>
                    <span className="text-muted-foreground"> · 40% weight</span>
                    <p className="text-muted-foreground mt-1">Measures how clean the water running out of the drum is at the end of the washout. Lower NTU = cleaner discharge = more concrete removed. Scored as: &lt;50 NTU = full marks, 50–150 = good, 150–500 = marginal, &gt;500 = poor.</p>
                  </div>
                  <div className="border-l-4 border-primary/50 pl-4 py-2 bg-muted/30 dark:bg-muted/20 rounded-r">
                    <span className="font-medium text-primary">Drum Rotation (RPM & Direction)</span>
                    <span className="text-muted-foreground"> · 30% weight</span>
                    <p className="text-muted-foreground mt-1">Confirms the drum was actually spinning during the washout — and in the correct discharge direction. Zero RPM with water flow = card tap fraud (WES heavily penalised).</p>
                  </div>
                  <div className="border-l-4 border-chart-medium/50 pl-4 py-2 bg-muted/30 dark:bg-muted/20 rounded-r">
                    <span className="font-medium text-chart-medium">Wash Duration</span>
                    <span className="text-muted-foreground"> · 15% weight</span>
                    <p className="text-muted-foreground mt-1">How long the washout ran from RFID tap to valve close. Early card-off or incomplete cycles are penalised.</p>
                  </div>
                  <div className="border-l-4 border-chart-high/50 pl-4 py-2 bg-muted/30 dark:bg-muted/20 rounded-r">
                    <span className="font-medium text-chart-high">Context Adjustments</span>
                    <span className="text-muted-foreground"> · 15% weight</span>
                    <p className="text-muted-foreground mt-1">AI adjusts the raw score based on mix type, ambient temperature, and time since batch.</p>
                  </div>
                  <div className="border-l-4 border-chart-critical pl-4 py-2 bg-chart-critical/5 dark:bg-chart-critical/10 rounded-r">
                    <span className="font-medium text-chart-critical flex items-center gap-1">🚨 Fraud & Anomaly Detection</span>
                    <p className="text-muted-foreground mt-1">Water flow with zero drum rotation, multiple scans within minutes, or NTU not decreasing trigger a WES floor of 0–20.</p>
                  </div>
                  <div className="border-l-4 border-primary/50 pl-4 py-2 bg-muted/30 dark:bg-muted/20 rounded-r">
                    <span className="font-medium text-primary flex items-center gap-1">💧 Why Water Volume Isn&apos;t Scored</span>
                    <p className="text-muted-foreground mt-1">Every washout dispenses the same fixed 340L. What varies is whether the driver runs the drum properly during that time (measured by NTU).</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Priority Actions Required */}
            <div className="gsap-fade-up">
              <PriorityActionsSection actions={PRIORITY_ACTIONS} />
            </div>
          </TabsContent>

          <TabsContent value="risk" className="space-y-6 mt-6" data-tab="risk">
            {/* Risk summary cards */}
            <div className="gsap-fade-up grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <MetricCard title="Vehicles at risk" value={String(RISK_SUMMARY.vehiclesAtRisk)} label={RISK_SUMMARY.riskLabel} icon={AlertTriangle} iconBgColor="bg-chart-critical/10 dark:bg-chart-critical/20" iconColor="text-chart-critical" />
              <MetricCard title="Predicted compliance" value={`${RISK_SUMMARY.predictedCompliance}%`} label={RISK_SUMMARY.predictedLabel} icon={Activity} iconBgColor="bg-primary/10 dark:bg-primary/20" iconColor="text-primary" />
              <MetricCard title="Critical (24hrs)" value={String(RISK_SUMMARY.critical24h)} label={RISK_SUMMARY.criticalLabel} icon={AlertCircle} iconBgColor="bg-chart-critical/10 dark:bg-chart-critical/20" iconColor="text-chart-critical" />
              <MetricCard title="High (48hrs)" value={String(RISK_SUMMARY.high48h)} label={RISK_SUMMARY.highLabel} icon={AlertTriangle} iconBgColor="bg-chart-high/10 dark:bg-chart-high/20" iconColor="text-chart-high" />
              <MetricCard title="Medium (72hrs)" value={String(RISK_SUMMARY.medium72h)} label={RISK_SUMMARY.mediumLabel} icon={Activity} iconBgColor="bg-primary/10 dark:bg-primary/20" iconColor="text-primary" />
            </div>
            {/* Dedagging Risk Predictions table */}
            <Card className="gsap-fade-up">
              <CardHeader>
                <CardTitle>Dedagging Risk Predictions</CardTitle>
                <p className="text-sm text-muted-foreground">AI-predicted time to dedagging threshold (500 kg buildup)</p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vehicle</TableHead>
                        <TableHead>Driver</TableHead>
                        <TableHead>Site</TableHead>
                        <TableHead>Est. Buildup (kg)</TableHead>
                        <TableHead>Monthly Rate</TableHead>
                        <TableHead>Predicted Dedag</TableHead>
                        <TableHead>Risk Level</TableHead>
                        <TableHead>Est. Cost</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedRiskRows.map((row) => (
                        <TableRow
                          key={row.vehicleId}
                          className={cn(
                            row.riskLevel === 'Critical' && 'bg-chart-critical/5 dark:bg-chart-critical/10',
                            row.riskLevel === 'High' && 'bg-chart-high/5 dark:bg-chart-high/10',
                            row.riskLevel === 'Medium' && 'bg-primary/5 dark:bg-primary/10'
                          )}
                        >
                          <TableCell className="font-medium">{row.vehicleId}</TableCell>
                          <TableCell>{row.driver}</TableCell>
                          <TableCell>{row.site}</TableCell>
                          <TableCell className={cn(row.riskLevel === 'Critical' && 'font-semibold text-chart-critical')}>{row.estBuildup}</TableCell>
                          <TableCell>{row.monthlyRate}</TableCell>
                          <TableCell className={cn((row.riskLevel === 'Critical' || row.riskLevel === 'High') && 'font-medium text-chart-high')}>{row.predictedDedag}</TableCell>
                          <TableCell><BuildupRiskIndicator risk={row.riskLevel} /></TableCell>
                          <TableCell>{row.estCost != null ? `$${row.estCost.toLocaleString()}` : '—'}</TableCell>
                          <TableCell>
                            {row.action === 'Escalate' && <Button size="sm" variant="destructive">Escalate</Button>}
                            {row.action === 'Coach' && <Button size="sm" variant="default">Coach</Button>}
                            {row.action === 'Monitor' && <Button size="sm" variant="outline">Monitor</Button>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Rows per page</span>
                    <Select value={String(riskTablePageSize)} onValueChange={(v) => { setRiskTablePageSize(Number(v)); setRiskTablePage(1); }}>
                      <SelectTrigger className="w-[72px] h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RISK_TABLE_PAGE_SIZES.map((s) => (
                          <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <DataPagination
                    currentPage={riskTablePage}
                    totalPages={riskRowsTotalPages}
                    totalItems={DEDAGGING_RISK_ROWS.length}
                    pageSize={riskTablePageSize}
                    onPageChange={setRiskTablePage}
                  />
                </div>
                <div className="gsap-fade-up mt-4 flex items-center gap-2 rounded-lg bg-chart-medium/10 dark:bg-chart-medium/20 border border-chart-medium/30 px-4 py-3">
                  <span className="text-xl" aria-hidden>💰</span>
                  <div>
                    <span className="font-medium text-foreground">Combined risk exposure: </span>
                    <span className="text-muted-foreground">{COMBINED_RISK_MESSAGE}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recommendations" className="space-y-6 mt-6" data-tab="recommendations">
            <div className="gsap-fade-up grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recommendations by Priority</CardTitle>
                  <p className="text-sm text-muted-foreground">Click on a segment to filter</p>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={RECOMMENDATIONS_BY_PRIORITY}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={2}
                        label={({ name, value }) => `${name} — ${value}`}
                      >
                        {RECOMMENDATIONS_BY_PRIORITY.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [value, 'Count']}
                        contentStyle={CHART_TOOLTIP_STYLES.contentStyle}
                        labelStyle={CHART_TOOLTIP_STYLES.labelStyle}
                        itemStyle={CHART_TOOLTIP_STYLES.itemStyle}
                        wrapperStyle={CHART_TOOLTIP_STYLES.wrapperStyle}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Summary</CardTitle>
                  <p className="text-sm text-muted-foreground">Overview of actionable insights</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between text-foreground">
                    <span>Total Recommendations</span>
                    <span className="font-bold">{RECOMMENDATIONS_SUMMARY.total}</span>
                  </div>
                  <div className="flex justify-between text-foreground">
                    <span className="flex items-center gap-1">▲ High Priority</span>
                    <span className="font-bold text-chart-high">{RECOMMENDATIONS_SUMMARY.highPriority}</span>
                  </div>
                  <div className="flex justify-between text-foreground">
                    <span className="flex items-center gap-1">✓ Potential Compliance Gain</span>
                    <span className="font-bold text-primary">{RECOMMENDATIONS_SUMMARY.complianceGain}%</span>
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="gsap-fade-up">
              <h3 className="text-lg font-semibold text-foreground mb-2">Today&apos;s Optimal Wash Windows</h3>
              <p className="text-sm text-muted-foreground mb-4">Based on delivery schedules, temperature, and site availability</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {OPTIMAL_WASH_WINDOWS.map((w) => (
                  <Card key={w.time}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-foreground font-medium">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        {w.time}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{w.label}</p>
                      <p className="text-sm text-muted-foreground">Vehicles: {w.vehicles} · Utilization: {w.utilization}%</p>
                      <Button size="sm" className="mt-3">Recommended</Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
            <div className="gsap-fade-up">
              <h3 className="text-lg font-semibold text-foreground mb-2">Driver Insights</h3>
              <p className="text-sm text-muted-foreground mb-4">Behavioral patterns detected across your fleet</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {DRIVER_INSIGHTS.map((d) => (
                  <Card key={d.vehicleId}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium text-foreground">{d.vehicleId}</span>
                        {d.topPerformer && <Badge variant="secondary" className="text-xs">Top Performer</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">{d.text}</p>
                      <p className="text-xs text-muted-foreground mt-2">{d.confidence}% confidence</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="patterns" className="space-y-6 mt-6" data-tab="patterns">
            <div className="gsap-fade-up grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Peak Wash Hour</p>
                  <p className="text-xl font-bold text-foreground mt-1">{PATTERNS_METRICS.peakWashHour}</p>
                  <p className="text-xs text-muted-foreground">{PATTERNS_METRICS.peakWashLabel}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Lowest Day</p>
                  <p className="text-xl font-bold text-foreground mt-1">{PATTERNS_METRICS.lowestDay}</p>
                  <p className="text-xs text-muted-foreground">{PATTERNS_METRICS.lowestDayLabel}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Best Site</p>
                  <p className="text-xl font-bold text-foreground mt-1">{PATTERNS_METRICS.bestSite}</p>
                  <p className="text-xs text-muted-foreground">{PATTERNS_METRICS.bestSiteLabel}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Top Driver</p>
                  <p className="text-xl font-bold text-foreground mt-1">{PATTERNS_METRICS.topDriver}</p>
                  <p className="text-xs text-muted-foreground">{PATTERNS_METRICS.topDriverLabel}</p>
                </CardContent>
              </Card>
            </div>
            <div className="gsap-fade-up grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Positive Patterns</CardTitle>
                  <p className="text-sm text-muted-foreground">Detected from wash history</p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    {POSITIVE_PATTERNS.map((p, i) => (
                      <li key={i} className="flex justify-between gap-2 text-foreground">
                        <span>{p.text} — </span>
                        <span className="text-primary font-medium shrink-0">{p.confidence}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Areas of Concern</CardTitle>
                  <p className="text-sm text-muted-foreground">Patterns to address</p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    {AREAS_OF_CONCERN.map((p, i) => (
                      <li key={i} className="flex justify-between gap-2 text-foreground">
                        <span>{p.text} — </span>
                        <span className="text-chart-high font-medium shrink-0">{p.confidence}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
        </div>
      </main>
    </div>
  );
}
