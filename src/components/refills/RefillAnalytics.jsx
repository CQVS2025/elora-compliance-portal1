import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  AlertTriangle, 
  Droplet, 
  TrendingDown, 
  TrendingUp,
  Minus, 
  Calendar,
  MapPin,
  Zap,
  Filter,
  X,
  Activity,
  Target
} from 'lucide-react';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  Legend,
  Cell
} from 'recharts';
import moment from 'moment';

export default function RefillAnalytics({ refills, scans, sites, selectedCustomer, selectedSite }) {
  const [productFilter, setProductFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState(moment().subtract(30, 'days').format('YYYY-MM-DD'));
  const [dateTo, setDateTo] = useState(moment().format('YYYY-MM-DD'));
  const [customerFilter, setCustomerFilter] = useState('all');
  const [siteFilter, setSiteFilter] = useState('all');
  // Get unique values for filters
  const uniqueCustomers = useMemo(() => {
    const customers = new Set(refills?.map(r => r.customer) || []);
    return ['all', ...Array.from(customers).sort()];
  }, [refills]);

  const uniqueSites = useMemo(() => {
    const sites = new Set(refills?.map(r => r.site) || []);
    return ['all', ...Array.from(sites).sort()];
  }, [refills]);

  const uniqueProducts = useMemo(() => {
    const products = new Set(refills?.map(r => r.productName) || []);
    return ['all', ...Array.from(products).sort()];
  }, [refills]);

  const uniqueStatuses = useMemo(() => {
    const statuses = new Set(refills?.map(r => r.status) || []);
    return ['all', ...Array.from(statuses).sort()];
  }, [refills]);

  // Apply filters to refills
  const filteredRefills = useMemo(() => {
    if (!refills?.length) return [];
    
    return refills.filter(refill => {
      const refillDate = moment(refill.date);
      const matchesDate = refillDate.isBetween(dateFrom, dateTo, 'day', '[]');
      const matchesCustomer = customerFilter === 'all' || refill.customer === customerFilter;
      const matchesSite = siteFilter === 'all' || refill.site === siteFilter;
      const matchesProduct = productFilter === 'all' || refill.productName === productFilter;
      const matchesStatus = statusFilter === 'all' || refill.status === statusFilter;
      
      return matchesDate && matchesCustomer && matchesSite && matchesProduct && matchesStatus;
    });
  }, [refills, dateFrom, dateTo, customerFilter, siteFilter, productFilter, statusFilter]);

  const analysis = useMemo(() => {
    if (!filteredRefills?.length || !scans?.length) return null;

    // Group refills by site - only count delivered or confirmed refills
    const refillsBySite = {};
    filteredRefills.forEach(refill => {
      // Skip scheduled refills - they haven't happened yet
      if (refill.status === 'scheduled') {
        return;
      }

      const siteKey = refill.site;
      if (!refillsBySite[siteKey]) {
        refillsBySite[siteKey] = {
          site: siteKey,
          customer: refill.customer,
          refills: [],
          totalLitres: 0,
          totalCost: 0,
          lastRefillDate: null,
          currentStock: 0
        };
      }
      refillsBySite[siteKey].refills.push(refill);
      refillsBySite[siteKey].totalLitres += refill.deliveredLitres || 0;
      refillsBySite[siteKey].totalCost += refill.totalExGst || 0;

      const refillDate = moment(refill.date);
      if (!refillsBySite[siteKey].lastRefillDate || refillDate.isAfter(refillsBySite[siteKey].lastRefillDate)) {
        refillsBySite[siteKey].lastRefillDate = refillDate;
        refillsBySite[siteKey].currentStock = refill.newTotalLitres || 0;
      }
    });

    // Group scans by site
    const scansBySite = {};
    scans.forEach(scan => {
      const siteName = scan.site_name || scan.siteName;
      if (!scansBySite[siteName]) {
        scansBySite[siteName] = [];
      }
      scansBySite[siteName].push(scan);
    });

    // Calculate predictions for each site with advanced forecasting
    const predictions = [];
    Object.entries(refillsBySite).forEach(([siteName, siteData]) => {
      const siteScans = scansBySite[siteName] || [];
      const siteRefills = siteData.refills.sort((a, b) => moment(a.date).valueOf() - moment(b.date).valueOf());

      if (siteRefills.length < 1) return;

      const lastRefill = siteRefills[siteRefills.length - 1];
      const lastRefillDate = moment(lastRefill.date);

      // Check for overdue scheduled refills for this site - use original refills array to avoid date filter interference
      const scheduledRefills = (refills || []).filter(r => 
        r.site === siteName && r.status === 'scheduled'
      );
      const overdueScheduled = scheduledRefills.filter(r => 
        moment(r.date).isBefore(moment(), 'day')
      );
      const hasOverdueScheduled = overdueScheduled.length > 0;
      
      // Calculate site-specific litres per scan from historical refill data
      const historicalConsumptionData = [];
      for (let i = 1; i < siteRefills.length; i++) {
        const prevRefill = siteRefills[i - 1];
        const currentRefill = siteRefills[i];
        
        const periodStart = moment(prevRefill.date);
        const periodEnd = moment(currentRefill.date);
        
        // Actual consumption = (previous newTotalLitres - current startLitres)
        const consumed = (prevRefill.newTotalLitres || 0) - (currentRefill.startLitres || 0);
        
        // Count scans in this period
        const scansInPeriod = siteScans.filter(s => 
          moment(s.timestamp).isBetween(periodStart, periodEnd, null, '[]')
        ).length;
        
        if (consumed > 0 && scansInPeriod > 0) {
          historicalConsumptionData.push({
            consumed: consumed,
            scans: scansInPeriod,
            litresPerScan: consumed / scansInPeriod,
            days: periodEnd.diff(periodStart, 'days')
          });
        }
      }

      // Calculate site-specific litres per scan
      let litresPerScan = 5; // Default fallback
      let confidence = 100;
      
      if (historicalConsumptionData.length > 0) {
        // Use weighted average (recent data more important)
        const weights = historicalConsumptionData.map((_, idx) => idx + 1);
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        
        litresPerScan = historicalConsumptionData.reduce((sum, data, idx) => 
          sum + (data.litresPerScan * weights[idx]), 0
        ) / totalWeight;
        
        // Higher confidence if litres per scan is consistent
        const avgLPS = historicalConsumptionData.reduce((sum, d) => sum + d.litresPerScan, 0) / historicalConsumptionData.length;
        const variance = historicalConsumptionData.reduce((sum, d) => 
          sum + Math.pow(d.litresPerScan - avgLPS, 2), 0
        ) / historicalConsumptionData.length;
        const coefficientOfVariation = Math.sqrt(variance) / avgLPS * 100;
        
        if (coefficientOfVariation > 40) confidence -= 20;
        else if (coefficientOfVariation > 25) confidence -= 10;
      } else {
        confidence -= 30; // Using default estimate
      }
      
      // Count scans since last refill
      const scansSinceLastRefill = siteScans.filter(s => 
        moment(s.timestamp).isAfter(lastRefillDate)
      ).length;
      
      // Calculate current stock based on actual usage
      const stockAfterLastRefill = lastRefill.newTotalLitres || 0;
      const consumedSinceRefill = scansSinceLastRefill * litresPerScan;
      const currentStock = Math.max(0, stockAfterLastRefill - consumedSinceRefill);
      
      // Calculate daily consumption from actual refill history (more accurate)
      let dailyConsumption = 0;
      if (siteRefills.length >= 2) {
        // Use the most recent refill interval for accuracy
        const recentRefill = siteRefills[siteRefills.length - 1];
        const previousRefill = siteRefills[siteRefills.length - 2];
        
        const daysInPeriod = moment(recentRefill.date).diff(moment(previousRefill.date), 'days');
        const litresConsumed = (previousRefill.newTotalLitres || 0) - (recentRefill.startLitres || 0);
        
        if (daysInPeriod > 0 && litresConsumed > 0) {
          dailyConsumption = litresConsumed / daysInPeriod;
        }
      }
      
      // Fallback: if we don't have 2 refills, estimate from current consumption
      if (dailyConsumption === 0) {
        const daysSinceLastRefill = moment().diff(lastRefillDate, 'days');
        if (daysSinceLastRefill > 0) {
          dailyConsumption = (stockAfterLastRefill - currentStock) / daysSinceLastRefill;
        }
      }
      
      // Calculate consumption trend from refill intervals
      let consumptionTrend = 'stable';
      if (siteRefills.length >= 3) {
        const recent = moment(siteRefills[siteRefills.length - 1].date).diff(
          moment(siteRefills[siteRefills.length - 2].date), 'days'
        );
        const previous = moment(siteRefills[siteRefills.length - 2].date).diff(
          moment(siteRefills[siteRefills.length - 3].date), 'days'
        );
        
        if (recent < previous * 0.85) consumptionTrend = 'increasing'; // Shorter intervals = more consumption
        else if (recent > previous * 1.15) consumptionTrend = 'decreasing'; // Longer intervals = less consumption
      }
      
      // Apply trend adjustment for prediction
      const trendMultiplier = consumptionTrend === 'increasing' ? 1.1 : 
                             consumptionTrend === 'decreasing' ? 0.9 : 1.0;
      const adjustedDailyConsumption = dailyConsumption * trendMultiplier;
      
      // Predict days until refill needed
      const REFILL_THRESHOLD = 200;
      let daysUntilRefill = 0;
      
      if (adjustedDailyConsumption > 0) {
        daysUntilRefill = (currentStock - REFILL_THRESHOLD) / adjustedDailyConsumption;
      } else if (siteRefills.length >= 2) {
        // Fallback: use historical refill interval for sites with no recent scans
        const intervals = [];
        for (let i = 1; i < siteRefills.length; i++) {
          intervals.push(moment(siteRefills[i].date).diff(moment(siteRefills[i-1].date), 'days'));
        }
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const daysSinceLastRefill = moment().diff(lastRefillDate, 'days');
        daysUntilRefill = avgInterval - daysSinceLastRefill;
        confidence -= 25; // Lower confidence for historical estimate
      }
      
      // Adjust confidence based on data availability
      if (siteRefills.length < 3) confidence -= 20;
      else if (siteRefills.length < 5) confidence -= 10;
      
      // Calculate recent scan activity
      const last7DaysScans = siteScans.filter(s => 
        moment(s.timestamp).isAfter(moment().subtract(7, 'days'))
      ).length;
      
      if (last7DaysScans < 3) confidence -= 15; // Low recent activity
      if (consumptionTrend !== 'stable') confidence -= 10;
      
      confidence = Math.max(40, Math.min(100, confidence));
      
      // Historical analysis
      const refillVolumes = siteRefills.map(r => r.deliveredLitres || 0);
      const avgRefillVolume = refillVolumes.reduce((a, b) => a + b, 0) / refillVolumes.length;
      
      const refillIntervals = [];
      for (let i = 1; i < siteRefills.length; i++) {
        refillIntervals.push(moment(siteRefills[i].date).diff(moment(siteRefills[i-1].date), 'days'));
      }
      const avgRefillInterval = refillIntervals.length > 0 ? 
        refillIntervals.reduce((a, b) => a + b, 0) / refillIntervals.length : 0;
      
      // Calculate cost metrics
      const totalWashes = siteScans.length;
      const costPerWash = totalWashes > 0 ? siteData.totalCost / totalWashes : 0;

      // Determine urgency - overdue scheduled refills are always critical
      let urgency = 'good';
      if (hasOverdueScheduled) urgency = 'critical';
      else if (daysUntilRefill < 3 || currentStock < REFILL_THRESHOLD) urgency = 'critical';
      else if (daysUntilRefill < 7) urgency = 'warning';
      else if (daysUntilRefill < 14) urgency = 'attention';

      const daysSinceLastRefill = moment().diff(lastRefillDate, 'days');

      predictions.push({
        site: siteName,
        customer: siteData.customer,
        hasOverdueScheduled: hasOverdueScheduled,
        overdueScheduledCount: overdueScheduled.length,
        currentStock: Math.round(currentStock),
        stockAfterLastRefill: stockAfterLastRefill,
        scansSinceLastRefill: scansSinceLastRefill,
        litresPerScan: litresPerScan.toFixed(2),
        dailyConsumption: dailyConsumption.toFixed(1),
        adjustedDailyConsumption: adjustedDailyConsumption.toFixed(1),
        daysUntilRefill: Math.max(0, Math.round(daysUntilRefill)),
        predictedRefillDate: moment().add(Math.max(0, daysUntilRefill), 'days').format('MMM DD, YYYY'),
        urgency,
        confidence: Math.round(confidence),
        consumptionTrend,
        avgRefillInterval: avgRefillInterval > 0 ? avgRefillInterval.toFixed(0) : 'N/A',
        avgRefillVolume: avgRefillVolume.toFixed(0),
        totalWashes: totalWashes,
        totalCost: siteData.totalCost,
        costPerWash: costPerWash.toFixed(2),
        lastRefillDate: lastRefillDate.format('MMM DD, YYYY'),
        daysSinceLastRefill: daysSinceLastRefill,
        avgWashesPerRefill: totalWashes > 0 ? (totalWashes / siteData.refills.length).toFixed(0) : '0',
        refillCount: siteData.refills.length,
        dataQuality: historicalConsumptionData.length >= 3 && last7DaysScans >= 5 ? 'excellent' : 
                     historicalConsumptionData.length >= 2 || last7DaysScans >= 3 ? 'good' : 'limited'
      });
    });

    // Sort by urgency
    predictions.sort((a, b) => {
      const urgencyOrder = { critical: 0, warning: 1, attention: 2, good: 3 };
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    });

    // Smart scheduling - group sites needing refills within same week
    const scheduleGroups = [];
    const weekGroups = {};
    predictions.filter(p => p.urgency !== 'good').forEach(pred => {
      const weekKey = moment().add(pred.daysUntilRefill, 'days').week();
      if (!weekGroups[weekKey]) {
        weekGroups[weekKey] = {
          week: moment().add(pred.daysUntilRefill, 'days').format('MMM DD'),
          sites: []
        };
      }
      weekGroups[weekKey].sites.push(pred.site);
    });
    Object.values(weekGroups).forEach(group => {
      if (group.sites.length > 1) {
        scheduleGroups.push(group);
      }
    });

    // Consumption trends over time (last 90 days)
    const consumptionTrends = [];
    const last90Days = moment().subtract(90, 'days');
    const dailyConsumption = {};
    
    scans.forEach(scan => {
      const scanDate = moment(scan.timestamp);
      if (scanDate.isAfter(last90Days)) {
        const dateKey = scanDate.format('YYYY-MM-DD');
        if (!dailyConsumption[dateKey]) {
          dailyConsumption[dateKey] = 0;
        }
        dailyConsumption[dateKey]++;
      }
    });
    
    for (let i = 0; i <= 90; i++) {
      const date = moment().subtract(90 - i, 'days');
      const dateKey = date.format('YYYY-MM-DD');
      consumptionTrends.push({
        date: date.format('MMM DD'),
        fullDate: dateKey,
        scans: dailyConsumption[dateKey] || 0,
        litres: (dailyConsumption[dateKey] || 0) * 5 // Avg litres per scan
      });
    }

    // Historical refill volumes by site
    const refillVolumesBySite = [];
    Object.entries(refillsBySite).forEach(([siteName, siteData]) => {
      refillVolumesBySite.push({
        site: siteName.length > 15 ? siteName.substring(0, 15) + '...' : siteName,
        fullName: siteName,
        totalLitres: siteData.totalLitres,
        totalCost: siteData.totalCost,
        refillCount: siteData.refills.length,
        avgVolume: siteData.totalLitres / siteData.refills.length
      });
    });
    refillVolumesBySite.sort((a, b) => b.totalLitres - a.totalLitres);

    // Monthly refill trends - only count delivered or confirmed refills
    const monthlyRefills = {};
    filteredRefills.forEach(refill => {
      // Skip scheduled refills - they haven't happened yet
      if (refill.status === 'scheduled') {
        return;
      }
      
      const monthKey = moment(refill.date).format('MMM YYYY');
      if (!monthlyRefills[monthKey]) {
        monthlyRefills[monthKey] = {
          month: monthKey,
          count: 0,
          totalLitres: 0,
          totalCost: 0
        };
      }
      monthlyRefills[monthKey].count++;
      monthlyRefills[monthKey].totalLitres += refill.deliveredLitres || 0;
      monthlyRefills[monthKey].totalCost += refill.totalExGst || 0;
    });
    const monthlyTrends = Object.values(monthlyRefills).slice(-12);

    // Usage efficiency by site
    const usageEfficiency = predictions
      .filter(p => p.totalWashes > 0)
      .map(p => ({
        site: p.site.length > 15 ? p.site.substring(0, 15) + '...' : p.site,
        fullName: p.site,
        litresPerScan: parseFloat(p.litresPerScan),
        scans: p.totalWashes,
        efficiency: parseFloat(p.litresPerScan)
      }))
      .sort((a, b) => a.efficiency - b.efficiency)
      .slice(0, 10);

    // Stock level distribution
    const stockLevels = predictions.map(p => ({
      site: p.site.length > 12 ? p.site.substring(0, 12) + '...' : p.site,
      fullName: p.site,
      stock: p.currentStock,
      status: p.urgency
    })).sort((a, b) => a.stock - b.stock);

    return {
      predictions,
      scheduleGroups,
      totalSites: predictions.length,
      criticalSites: predictions.filter(p => p.urgency === 'critical').length,
      warningSites: predictions.filter(p => p.urgency === 'warning').length,
      consumptionTrends,
      refillVolumesBySite: refillVolumesBySite.slice(0, 10),
      monthlyTrends,
      usageEfficiency,
      stockLevels
    };
  }, [filteredRefills, scans, sites]);

  const handleClearFilters = () => {
    setProductFilter('all');
    setStatusFilter('all');
    setCustomerFilter('all');
    setSiteFilter('all');
    setDateFrom(moment().subtract(30, 'days').format('YYYY-MM-DD'));
    setDateTo(moment().format('YYYY-MM-DD'));
  };

  const hasActiveFilters = productFilter !== 'all' || statusFilter !== 'all' || 
    customerFilter !== 'all' || siteFilter !== 'all' ||
    dateFrom !== moment().subtract(30, 'days').format('YYYY-MM-DD') ||
    dateTo !== moment().format('YYYY-MM-DD');

  if (!analysis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplet className="w-5 h-5 text-[#7CB342]" />
            Refill Intelligence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">No refill data available for analysis.</p>
        </CardContent>
      </Card>
    );
  }

  const getUrgencyColor = (urgency) => {
    switch(urgency) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'warning': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'attention': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-green-100 text-green-800 border-green-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-[#7CB342]" />
              Refill Filters
            </CardTitle>
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
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* Date Range */}
            <div>
              <label className="text-xs text-slate-600 mb-1 block">From Date</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-xs text-slate-600 mb-1 block">To Date</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full"
              />
            </div>

            {/* Customer Filter */}
            <div>
              <label className="text-xs text-slate-600 mb-1 block">Customer</label>
              <Select value={customerFilter} onValueChange={setCustomerFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Customers" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueCustomers.map(customer => (
                    <SelectItem key={customer} value={customer}>
                      {customer === 'all' ? 'All Customers' : customer}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Site Filter */}
            <div>
              <label className="text-xs text-slate-600 mb-1 block">Site</label>
              <Select value={siteFilter} onValueChange={setSiteFilter}>
                <SelectTrigger>
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

            {/* Product Filter */}
            <div>
              <label className="text-xs text-slate-600 mb-1 block">Product</label>
              <Select value={productFilter} onValueChange={setProductFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Products" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueProducts.map(product => (
                    <SelectItem key={product} value={product}>
                      {product === 'all' ? 'All Products' : product}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="text-xs text-slate-600 mb-1 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueStatuses.map(status => (
                    <SelectItem key={status} value={status}>
                      {status === 'all' ? 'All Statuses' : status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active Filters Badge */}
          {hasActiveFilters && (
            <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
              <Badge className="bg-[#7CB342] text-white">
                {filteredRefills.length} of {refills?.length || 0} deliveries shown
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Critical Sites</p>
                <p className="text-3xl font-bold text-red-600">{analysis.criticalSites}</p>
                <p className="text-xs text-slate-500 mt-1">Need refill within 3 days</p>
              </div>
              <AlertTriangle className="w-10 h-10 text-red-600 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Attention Needed</p>
                <p className="text-3xl font-bold text-orange-600">{analysis.warningSites}</p>
                <p className="text-xs text-slate-500 mt-1">Within 7 days</p>
              </div>
              <Calendar className="w-10 h-10 text-orange-600 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Monitored</p>
                <p className="text-3xl font-bold text-[#7CB342]">{analysis.totalSites}</p>
                <p className="text-xs text-slate-500 mt-1">Active sites</p>
              </div>
              <Droplet className="w-10 h-10 text-[#7CB342] opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Predictive Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#7CB342]" />
            Predictive Refill Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analysis.predictions.slice(0, 8).map((pred, idx) => (
              <div 
                key={idx} 
                className={`p-4 rounded-lg border-2 ${getUrgencyColor(pred.urgency)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="w-4 h-4" />
                      <div className="flex flex-col">
                        <h4 className="font-semibold">{pred.site}</h4>
                        <p className="text-xs text-slate-600">{pred.customer}</p>
                      </div>
                      <Badge className={getUrgencyColor(pred.urgency)}>
                        {pred.urgency.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                      <div>
                        <p className="text-slate-600">Current Stock</p>
                        <p className="font-semibold">{pred.currentStock}L</p>
                        <p className="text-xs text-slate-500">{pred.stockAfterLastRefill}L @ last refill</p>
                      </div>
                      <div>
                        <p className="text-slate-600">Usage Since Refill</p>
                        <p className="font-semibold">{pred.scansSinceLastRefill} scans</p>
                        <p className="text-xs text-slate-500">{(pred.stockAfterLastRefill - pred.currentStock).toFixed(1)}L consumed</p>
                      </div>
                      <div>
                        <p className="text-slate-600">Daily Consumption</p>
                        <div className="flex items-center gap-1">
                          <p className="font-semibold">{pred.adjustedDailyConsumption}L/day</p>
                          {pred.consumptionTrend === 'increasing' && <TrendingUp className="w-3 h-3 text-red-600" />}
                          {pred.consumptionTrend === 'decreasing' && <TrendingDown className="w-3 h-3 text-green-600" />}
                          {pred.consumptionTrend === 'stable' && <Minus className="w-3 h-3 text-slate-600" />}
                        </div>
                        <p className="text-xs text-slate-500 capitalize">{pred.consumptionTrend} trend</p>
                      </div>
                      <div>
                        <p className="text-slate-600">Refill Needed In</p>
                        <p className="font-semibold">{pred.daysUntilRefill} days</p>
                        <p className="text-xs text-slate-500">{pred.predictedRefillDate}</p>
                      </div>
                      <div>
                        <p className="text-slate-600">Confidence</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-200 rounded-full h-2">
                            <div 
                              className="h-2 rounded-full transition-all"
                              style={{ 
                                width: `${pred.confidence}%`,
                                backgroundColor: pred.confidence >= 80 ? '#7CB342' : 
                                                pred.confidence >= 65 ? '#F59E0B' : '#EF4444'
                              }}
                            />
                          </div>
                          <span className="font-semibold text-xs">{pred.confidence}%</span>
                        </div>
                        <p className="text-xs text-slate-500 capitalize">{pred.dataQuality} data</p>
                      </div>
                    </div>
                    
                    {/* Additional insights */}
                    <div className="mt-3 pt-3 border-t border-current/20 grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
                      <div>
                        <p className="text-slate-600">Consumed Since Refill</p>
                        <p className="font-medium">{pred.stockAfterLastRefill - pred.currentStock}L</p>
                      </div>
                      <div>
                        <p className="text-slate-600">Avg Refill Volume</p>
                        <p className="font-medium">{pred.avgRefillVolume}L</p>
                      </div>
                      <div>
                        <p className="text-slate-600">Avg Refill Interval</p>
                        <p className="font-medium">{pred.avgRefillInterval} days</p>
                      </div>
                      <div>
                        <p className="text-slate-600">Days Since Last Refill</p>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{pred.daysSinceLastRefill} days</p>
                          {pred.hasOverdueScheduled && (
                            <Badge className="bg-red-600 text-white text-xs px-1 py-0">
                              OVERDUE
                            </Badge>
                          )}
                        </div>
                        {pred.hasOverdueScheduled && (
                          <p className="text-xs text-red-600 font-semibold mt-0.5">
                            {pred.overdueScheduledCount} scheduled refill{pred.overdueScheduledCount > 1 ? 's' : ''} overdue
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-slate-600">Last Refill</p>
                        <p className="font-medium">{pred.lastRefillDate}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Data Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Consumption Trends Over Time */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#7CB342]" />
              Daily Consumption Trends (90 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={analysis.consumptionTrends}>
                <defs>
                  <linearGradient id="colorLitres" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7CB342" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#7CB342" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  interval={15}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="litres" 
                  stroke="#7CB342" 
                  fillOpacity={1} 
                  fill="url(#colorLitres)"
                  name="Litres Consumed"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Monthly Refill Trends */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#7CB342]" />
              Monthly Refill Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analysis.monthlyTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="totalLitres" 
                  stroke="#7CB342" 
                  strokeWidth={2}
                  name="Total Litres"
                  dot={{ r: 4 }}
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="count" 
                  stroke="#3B82F6" 
                  strokeWidth={2}
                  name="Refill Count"
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top 10 Sites by Volume */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-[#7CB342]" />
              Top Sites by Total Volume
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analysis.refillVolumesBySite} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="site" type="category" width={120} tick={{ fontSize: 11 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px'
                  }}
                  formatter={(value, name) => {
                    if (name === 'totalLitres') return [`${value.toLocaleString()}L`, 'Total Litres'];
                    return [value, name];
                  }}
                />
                <Bar dataKey="totalLitres" fill="#7CB342" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Usage Efficiency by Site */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#7CB342]" />
              Usage Efficiency (Litres per Scan)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analysis.usageEfficiency} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="site" type="category" width={120} tick={{ fontSize: 11 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px'
                  }}
                  formatter={(value) => [`${value}L/scan`, 'Efficiency']}
                />
                <Bar dataKey="litresPerScan" radius={[0, 8, 8, 0]}>
                  {analysis.usageEfficiency.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.litresPerScan > 6 ? '#EF4444' : entry.litresPerScan > 5 ? '#F59E0B' : '#7CB342'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 flex gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-[#7CB342]" />
                <span className="text-slate-600">Efficient (≤5L)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-[#F59E0B]" />
                <span className="text-slate-600">Moderate (5-6L)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-[#EF4444]" />
                <span className="text-slate-600">High ({'>'}6L)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Stock Levels Across Sites */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplet className="w-5 h-5 text-[#7CB342]" />
            Current Stock Levels by Site
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={analysis.stockLevels}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="site" 
                tick={{ fontSize: 11, angle: -45 }}
                height={100}
                textAnchor="end"
              />
              <YAxis tick={{ fontSize: 12 }} label={{ value: 'Litres', angle: -90, position: 'insideLeft' }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px'
                }}
                formatter={(value) => [`${value}L`, 'Current Stock']}
              />
              <Bar dataKey="stock" radius={[8, 8, 0, 0]}>
                {analysis.stockLevels.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={
                      entry.status === 'critical' ? '#EF4444' : 
                      entry.status === 'warning' ? '#F59E0B' : 
                      entry.status === 'attention' ? '#FCD34D' : 
                      '#7CB342'
                    } 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

    </div>
  );
}