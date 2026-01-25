import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabaseClient } from "@/api/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import DataPagination from '@/components/ui/DataPagination';
import { 
  TrendingUp, 
  TrendingDown, 
  CheckCircle, 
  DollarSign, 
  Wrench,
  Download,
  FileSpreadsheet,
  FileText,
  Brain,
  ZoomIn,
  Sparkles,
  Loader2
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
import { usePermissions } from '@/components/auth/PermissionGuard';

export default function ReportsDashboard({ vehicles, scans }) {
  const permissions = usePermissions();
  const [dateFilter, setDateFilter] = useState('30');
  const [siteFilter, setSiteFilter] = useState('all');
  const [drillDownModal, setDrillDownModal] = useState({ open: false, type: null, data: null });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // AI Report Generation States
  const [showAIReportBuilder, setShowAIReportBuilder] = useState(false);
  const [aiReportType, setAiReportType] = useState('compliance_trends');
  const [aiCustomPrompt, setAiCustomPrompt] = useState('');
  const [generatingAIReport, setGeneratingAIReport] = useState(false);
  const [aiGeneratedReport, setAiGeneratedReport] = useState(null);

  const { data: maintenanceRecords = [] } = useQuery({
    queryKey: ['maintenance'],
    queryFn: async () => {
      const { data, error } = await supabaseClient.tables.maintenanceRecords
        .select('*')
        .order('service_date', { ascending: false })
        .limit(1000);
      return data || [];
    }
  });

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

  // Filter data based on date and site
  const filteredData = useMemo(() => {
    const daysAgo = parseInt(dateFilter);
    const cutoffDate = moment().subtract(daysAgo, 'days').startOf('day');
    
    const filteredScans = scans?.filter(scan => {
      const dateMatch = moment(scan.timestamp).isAfter(cutoffDate);
      const siteMatch = siteFilter === 'all' || scan.siteName === siteFilter;
      return dateMatch && siteMatch;
    }) || [];

    const filteredVehicles = siteFilter === 'all' 
      ? vehicles 
      : vehicles.filter(v => v.site_name === siteFilter);

    return { filteredScans, filteredVehicles };
  }, [scans, vehicles, dateFilter, siteFilter]);

  // Predictive Maintenance Analysis
  const predictiveMaintenance = useMemo(() => {
    const predictions = [];
    const now = new Date();

    vehicles.forEach(vehicle => {
      const vehicleRecords = maintenanceRecords.filter(r => r.vehicle_id === vehicle.id);
      
      if (vehicleRecords.length >= 2) {
        // Calculate average service interval
        const sortedRecords = vehicleRecords
          .filter(r => r.service_date)
          .sort((a, b) => new Date(a.service_date) - new Date(b.service_date));
        
        if (sortedRecords.length >= 2) {
          let totalDays = 0;
          for (let i = 1; i < sortedRecords.length; i++) {
            const days = moment(sortedRecords[i].service_date)
              .diff(moment(sortedRecords[i - 1].service_date), 'days');
            totalDays += days;
          }
          const avgInterval = totalDays / (sortedRecords.length - 1);
          
          const lastService = sortedRecords[sortedRecords.length - 1];
          const daysSinceLastService = moment().diff(moment(lastService.service_date), 'days');
          const predictedDaysUntilNext = avgInterval - daysSinceLastService;
          
          if (predictedDaysUntilNext <= 30 && predictedDaysUntilNext > 0) {
            predictions.push({
              vehicle,
              lastServiceDate: lastService.service_date,
              avgInterval: Math.round(avgInterval),
              predictedDaysUntilNext: Math.round(predictedDaysUntilNext),
              confidence: vehicleRecords.length >= 5 ? 'high' : 'medium'
            });
          }
        }
      }
    });

    return predictions.sort((a, b) => a.predictedDaysUntilNext - b.predictedDaysUntilNext);
  }, [vehicles, maintenanceRecords]);

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

  // Maintenance Cost Analysis
  const maintenanceCostAnalysis = useMemo(() => {
    const monthlyData = {};
    let totalCost = 0;
    
    maintenanceRecords.forEach(record => {
      if (record.cost) {
        totalCost += record.cost;
        const month = moment(record.service_date).format('MMM YY');
        monthlyData[month] = (monthlyData[month] || 0) + record.cost;
      }
    });

    const chartData = Object.entries(monthlyData)
      .map(([month, cost]) => ({ month, cost: Math.round(cost) }))
      .sort((a, b) => moment(a.month, 'MMM YY').valueOf() - moment(b.month, 'MMM YY').valueOf())
      .slice(-12);

    const avgCost = maintenanceRecords.length > 0 ? totalCost / maintenanceRecords.length : 0;

    return {
      totalCost,
      avgCost,
      chartData,
      recordCount: maintenanceRecords.length
    };
  }, [maintenanceRecords]);

  // Compliance Trend
  const complianceTrend = useMemo(() => {
    const days = [];
    const daysCount = parseInt(dateFilter);
    for (let i = daysCount - 1; i >= 0; i--) {
      const date = moment().subtract(i, 'days');
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
  }, [filteredData.filteredScans, dateFilter]);

  // Service Type Distribution
  const serviceTypeDistribution = useMemo(() => {
    const distribution = {};
    maintenanceRecords.forEach(record => {
      const type = record.service_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
      distribution[type] = (distribution[type] || 0) + 1;
    });

    return Object.entries(distribution)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  }, [maintenanceRecords]);

  const COLORS = ['#7CB342', '#9CCC65', '#689F38', '#558B2F', '#33691E', '#827717', '#CDDC39'];

  // Generate AI Report
  const generateAIReport = async () => {
    setGeneratingAIReport(true);
    setAiGeneratedReport(null);
    
    try {
      // Prepare data summary for AI
      const dataSummary = {
        dateRange: `Last ${dateFilter} days`,
        site: siteFilter === 'all' ? 'All sites' : siteFilter,
        compliance: {
          totalVehicles: complianceStats.totalVehicles,
          compliantVehicles: complianceStats.compliantVehicles,
          complianceRate: complianceStats.complianceRate,
          trend: complianceStats.trend
        },
        maintenance: {
          totalCost: maintenanceCostAnalysis.totalCost,
          avgCost: Math.round(maintenanceCostAnalysis.avgCost),
          recordCount: maintenanceCostAnalysis.recordCount,
          predictedNeeds: predictiveMaintenance.length
        },
        washes: {
          totalWashes: filteredData.filteredScans.length,
          topSites: washFrequencyBySite.slice(0, 5)
        },
        serviceDistribution: serviceTypeDistribution.slice(0, 5)
      };

      // Build prompt based on report type
      let prompt = '';
      const baseContext = `You are an expert fleet management analyst. Analyze the following data and provide actionable insights:\n\n${JSON.stringify(dataSummary, null, 2)}\n\n`;
      
      if (aiReportType === 'compliance_trends') {
        prompt = baseContext + `Create a comprehensive compliance status report analyzing:
1. Overall fleet compliance performance and trends
2. Vehicles/sites requiring immediate attention
3. Key risk factors affecting compliance
4. Specific recommendations to improve compliance rates
5. Expected outcomes if recommendations are implemented

Format the response with clear sections, bullet points, and actionable items.`;
      } else if (aiReportType === 'maintenance_analysis') {
        prompt = baseContext + `Create a detailed maintenance cost analysis report covering:
1. Maintenance spending patterns and trends
2. Cost efficiency analysis across the fleet
3. Upcoming maintenance needs based on predictive data
4. Budget recommendations for next period
5. Cost optimization opportunities

Include specific numbers, percentages, and cost-saving recommendations.`;
      } else if (aiReportType === 'wash_usage_trends') {
        prompt = baseContext + `Create a wash usage and efficiency report analyzing:
1. Wash frequency patterns across sites and vehicles
2. Usage trends and seasonal variations
3. Site performance comparison
4. Optimization opportunities for wash programs
5. Recommendations to improve wash compliance

Highlight best and worst performers with specific metrics.`;
      } else if (aiReportType === 'custom') {
        prompt = baseContext + `Based on the fleet data provided, please address the following:\n\n${aiCustomPrompt}\n\nProvide detailed analysis with specific metrics, trends, and actionable recommendations.`;
      }

      // AI insights generation with Supabase
      // Note: This requires a custom implementation or edge function
      const response = "AI insights generation is being migrated to Supabase. This feature will be available soon.";

      setAiGeneratedReport({
        type: aiReportType,
        content: response,
        generatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error generating AI report:', error);
      setAiGeneratedReport({
        type: 'error',
        content: 'Failed to generate AI report. Please try again.',
        generatedAt: new Date().toISOString()
      });
    } finally {
      setGeneratingAIReport(false);
    }
  };

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

  const exportMaintenanceReport = () => {
    const reportData = maintenanceRecords.map(r => ({
      Vehicle: r.vehicle_name,
      'Service Date': moment(r.service_date).format('YYYY-MM-DD'),
      'Service Type': r.service_type,
      Cost: r.cost || 0,
      Mileage: r.mileage || 0,
      'Next Service': r.next_service_date ? moment(r.next_service_date).format('YYYY-MM-DD') : 'N/A'
    }));
    exportToCSV(reportData, 'maintenance_report');
  };

  return (
    <div className="space-y-6">
      {/* Header with Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Fleet Reports & Analytics</h2>
          <p className="text-slate-600 mt-1">Advanced analytics with predictive insights and AI-powered reports</p>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 Days</SelectItem>
              <SelectItem value="30">Last 30 Days</SelectItem>
              <SelectItem value="90">Last 90 Days</SelectItem>
              <SelectItem value="365">Last Year</SelectItem>
            </SelectContent>
          </Select>

          <Select value={siteFilter} onValueChange={setSiteFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sites</SelectItem>
              {sites.map(site => (
                <SelectItem key={site.id} value={site.name}>{site.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={() => setShowAIReportBuilder(!showAIReportBuilder)}
            className="bg-purple-600 hover:bg-purple-700 gap-2"
          >
            <Sparkles className="w-4 h-4" />
            AI Report
          </Button>

          <Button 
            variant="outline" 
            onClick={exportComplianceReport}
            className="gap-2"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export Compliance
          </Button>
          <Button 
            variant="outline" 
            onClick={exportMaintenanceReport}
            className="gap-2"
          >
            <FileText className="w-4 h-4" />
            Export Maintenance
          </Button>
        </div>
      </div>

      {/* AI Report Builder */}
      {showAIReportBuilder && (
        <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-white">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              AI-Powered Report Generator
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                Select Report Type
              </label>
              <Select value={aiReportType} onValueChange={setAiReportType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="compliance_trends">
                    Compliance Status & Trends Analysis
                  </SelectItem>
                  <SelectItem value="maintenance_analysis">
                    Maintenance Cost Analysis & Forecast
                  </SelectItem>
                  <SelectItem value="wash_usage_trends">
                    Wash Usage Trends & Optimization
                  </SelectItem>
                  <SelectItem value="custom">
                    Custom Analysis (Specify Below)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {aiReportType === 'custom' && (
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">
                  What would you like to analyze?
                </label>
                <Textarea
                  placeholder="E.g., Compare maintenance costs between top 3 performing sites and identify cost drivers..."
                  value={aiCustomPrompt}
                  onChange={(e) => setAiCustomPrompt(e.target.value)}
                  className="h-24"
                />
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button
                onClick={generateAIReport}
                disabled={generatingAIReport || (aiReportType === 'custom' && !aiCustomPrompt)}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {generatingAIReport ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Report
                  </>
                )}
              </Button>
              <p className="text-xs text-slate-500">
                Report will analyze data from {siteFilter === 'all' ? 'all sites' : siteFilter} for the last {dateFilter} days
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Generated Report Display */}
      {aiGeneratedReport && (
        <Card className="border-purple-300 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-purple-600 to-purple-700 text-white">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Brain className="w-5 h-5" />
                AI-Generated Report
              </CardTitle>
              <Badge className="bg-white/20 text-white">
                {moment(aiGeneratedReport.generatedAt).format('MMM D, YYYY h:mm A')}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="prose prose-slate max-w-none">
              <div className="whitespace-pre-wrap text-slate-700 leading-relaxed">
                {aiGeneratedReport.content}
              </div>
            </div>
            <div className="mt-6 pt-4 border-t flex items-center justify-between">
              <p className="text-xs text-slate-500">
                This report was generated using AI analysis of your fleet data. 
                Always verify critical decisions with your team.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const blob = new Blob([aiGeneratedReport.content], { type: 'text/plain' });
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `ai-report-${moment(aiGeneratedReport.generatedAt).format('YYYY-MM-DD-HHmm')}.txt`;
                  a.click();
                }}
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Download Report
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setDrillDownModal({ open: true, type: 'compliance', data: filteredData.filteredVehicles })}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Compliance Rate</p>
                <p className="text-3xl font-bold text-slate-800 mt-1">{complianceStats.complianceRate}%</p>
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

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Maintenance Cost</p>
                <p className="text-3xl font-bold text-slate-800 mt-1">
                  ${maintenanceCostAnalysis.totalCost.toLocaleString()}
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  Avg: ${Math.round(maintenanceCostAnalysis.avgCost).toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">AI Predictions</p>
                <p className="text-3xl font-bold text-slate-800 mt-1">
                  {predictiveMaintenance.length}
                </p>
                <p className="text-xs text-slate-500 mt-2">Maintenance needed</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                <Brain className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Washes</p>
                <p className="text-3xl font-bold text-slate-800 mt-1">
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

      {/* Predictive Maintenance AI */}
      {predictiveMaintenance.length > 0 && (
        <Card className="border-purple-200 bg-purple-50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-600" />
              AI-Powered Predictive Maintenance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {predictiveMaintenance
                .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                .map((prediction, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-lg border border-purple-200">
                  <div className="flex items-center gap-3">
                    <Wrench className="w-4 h-4 text-purple-600" />
                    <div>
                      <p className="font-semibold text-sm text-slate-800">{prediction.vehicle.name}</p>
                      <p className="text-xs text-slate-600">
                        Last service: {moment(prediction.lastServiceDate).format('MMM D, YYYY')} 
                        • Avg interval: {prediction.avgInterval} days
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge className="bg-purple-500 text-white mb-1">
                      ~{prediction.predictedDaysUntilNext} days
                    </Badge>
                    <p className="text-xs text-slate-500">{prediction.confidence} confidence</p>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Pagination */}
            {Math.ceil(predictiveMaintenance.length / itemsPerPage) > 1 && (
              <DataPagination
                currentPage={currentPage}
                totalPages={Math.ceil(predictiveMaintenance.length / itemsPerPage)}
                totalItems={predictiveMaintenance.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                className="mt-4"
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Wash Activity Trend</CardTitle>
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

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Maintenance Cost Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={maintenanceCostAnalysis.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="cost" fill="#7CB342" name="Cost ($)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
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

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Maintenance Service Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={serviceTypeDistribution}
                  dataKey="count"
                  nameKey="type"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(entry) => entry.type}
                >
                  {serviceTypeDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
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