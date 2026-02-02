import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DollarSign, Calculator, Droplet, MapPin, Download, Search, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import moment from 'moment';
import { motion } from 'framer-motion';
import DataPagination from '@/components/ui/DataPagination';
import { usePermissions } from '@/components/auth/PermissionGuard';
import { scansOptions } from '@/query/options';
import CostForecast from '@/components/analytics/CostForecast';

// Pricing rules
const PRICING_RULES = {
  NSW: { litres: 2, pricePerLitre: 3.85 },
  VIC: { litres: 2, pricePerLitre: 3.85 },
  QLD: { litres: 4, pricePerLitre: 3.85 },
  GUNLAKE: { litres: 2, pricePerLitre: 3.95 }, // NSW/VIC exception
  BORAL_QLD: { litres: 4, pricePerLitre: 3.65 } // QLD exception
};

// Site to state mapping from Addresses.xlsx
const SITE_STATE_MAPPING = {
  // ACM - VIC
  'ACM - Clyde': 'VIC',
  'ACM - Epping': 'VIC',
  'ACM - Rockbank': 'VIC',
  // BORAL - QLD
  'BORAL - QLD - Archerfield': 'QLD',
  'BORAL - QLD - Beenleigh': 'QLD',
  'BORAL - QLD - Benowa': 'QLD',
  'BORAL - QLD - Browns Plains': 'QLD',
  'BORAL - QLD - Burleigh': 'QLD',
  'BORAL - QLD - Caloundra': 'QLD',
  'BORAL - QLD - Capalaba': 'QLD',
  'BORAL - QLD - Cleveland': 'QLD',
  'BORAL - QLD - Everton Park': 'QLD',
  'BORAL - QLD - Geebung': 'QLD',
  'BORAL - QLD - Ipswich': 'QLD',
  'BORAL - QLD - Kingston': 'QLD',
  'BORAL - QLD - Labrador': 'QLD',
  'BORAL - QLD - Morayfield': 'QLD',
  'BORAL - QLD - Murarrie': 'QLD',
  'BORAL - QLD - Narangba': 'QLD',
  'BORAL - QLD - Redbank Plains': 'QLD',
  'BORAL - QLD - Southport': 'QLD',
  'BORAL - QLD - Wacol': 'QLD',
  // CLEARY BROS - NSW
  'CLEARY BROS - Albion Park': 'NSW',
  'CLEARY BROS - Wollongong': 'NSW',
  // EASY MIX - NSW
  'EASY MIX - Berkley Vale': 'NSW',
  // Environex - QLD
  'Environex': 'QLD',
  // GUNLAKE - NSW
  'GUNLAKE - Banksmeadow': 'NSW',
  'GUNLAKE - Glendenning': 'NSW',
  'GUNLAKE - Prestons': 'NSW',
  'GUNLAKE - Silverwater': 'NSW',
  'GUNLAKE - Smeaton Grange': 'NSW',
  // HEIDELBERG MATERIALS - VIC
  'HEIDELBERG MATERIALS - Brooklyn': 'VIC',
  'HEIDELBERG MATERIALS - Collingwood': 'VIC',
  'HEIDELBERG MATERIALS - Croydon': 'VIC',
  'HEIDELBERG MATERIALS - Dandenong': 'VIC',
  'HEIDELBERG MATERIALS - Dromana': 'VIC',
  'HEIDELBERG MATERIALS - Epping': 'VIC',
  'HEIDELBERG MATERIALS - Frankston': 'VIC',
  'HEIDELBERG MATERIALS - Geelong': 'VIC',
  'HEIDELBERG MATERIALS - Lysterfield': 'VIC',
  'HEIDELBERG MATERIALS - Melton': 'VIC',
  'HEIDELBERG MATERIALS - Port Melbourne': 'VIC',
  'HEIDELBERG MATERIALS - Somerton': 'VIC',
  'HEIDELBERG MATERIALS - Sunbury': 'VIC',
  'HEIDELBERG MATERIALS - Weriribee': 'VIC',
  'HEIDELBERG MATERIALS - Westall': 'VIC',
  'HEIDELBERG MATERIALS - Wollert': 'VIC',
  // HEIDELBERG MATERIALS - NSW
  'HEIDELBERG MATERIALS - NSW - Artarmon': 'NSW',
  'HEIDELBERG MATERIALS - NSW - Banksmeadow': 'NSW',
  'HEIDELBERG MATERIALS - NSW - Caringbah': 'NSW',
  'HEIDELBERG MATERIALS - NSW - Greenacre': 'NSW',
  'HEIDELBERG MATERIALS - NSW - Pendle Hill': 'NSW',
  'HEIDELBERG MATERIALS - NSW - Prestons': 'NSW',
  'HEIDELBERG MATERIALS - NSW - Thornleigh': 'NSW',
  // HOLCIM - VIC
  'HOLCIM - Bayswater': 'VIC',
  'HOLCIM - Footscray': 'VIC',
  'HOLCIM - Laverton': 'VIC',
  'HOLCIM - Melbourne Airport': 'VIC',
  'HOLCIM - Oaklands Junction': 'VIC',
  'HOLCIM - Prestons': 'VIC',
  // HOLCIM - NSW
  'HOLCIM - Camellia': 'NSW',
  'HOLCIM - Lidcombe': 'NSW',
  // HUNTER READY MIX - NSW
  'HUNTER READY MIX - Cessnock': 'NSW',
  'HUNTER READY MIX - Gateshead': 'NSW',
  'HUNTER READY MIX - Thornton': 'NSW',
  // HYMIX - NSW
  'HYMIX - Belmont': 'NSW',
  'HYMIX - Berkley Vale': 'NSW',
  'HYMIX - Kincumber': 'NSW',
  'HYMIX - Rutherford': 'NSW',
  'HYMIX - Steel River': 'NSW',
  'HYMIX - Toronto': 'NSW',
  // MAITLAND READY MIX - NSW
  'MAITLAND READY MIX - Maitland': 'NSW',
  // NUCON - QLD
  'NUCON - Burleigh': 'QLD',
  // REDIMIX
  'REDIMIX - Rockhampton': 'QLD',
  'REDIMIX - Tamworth': 'NSW',
  // SUNMIX - QLD
  'SUNMIX - Beaudesert': 'QLD',
  'SUNMIX - Kingston': 'QLD',
  'SUNMIX - Swanbank': 'QLD',
  // WANGERS - QLD
  'WANGERS - Pinkenba': 'QLD',
  'WANGERS - Toowoomba': 'QLD'
};

// State mapping based on site names
const getStateFromSite = (siteName, customerName = '') => {
  if (!siteName) return 'NSW';
  
  // Direct lookup from mapping
  if (SITE_STATE_MAPPING[siteName]) {
    return SITE_STATE_MAPPING[siteName];
  }
  
  // Check customer name for BORAL - QLD
  const customerUpper = (customerName || '').toUpperCase();
  if (customerUpper.includes('BORAL') && customerUpper.includes('QLD')) {
    return 'QLD';
  }
  
  // Specific QLD site names for BORAL
  const siteUpper = siteName.toUpperCase();
  const qldSites = ['BURLEIGH', 'ARCHERFIELD', 'BEENLEIGH', 'BENOWA', 'BROWNS PLAINS', 
                    'CALOUNDRA', 'CAPALABA', 'CLEVELAND', 'EVERTON PARK', 'GEEBUNG',
                    'IPSWICH', 'KINGSTON', 'LABRADOR', 'MORAYFIELD', 'MURARRIE',
                    'NARANGBA', 'REDBANK PLAINS', 'SOUTHPORT', 'WACOL'];
  
  if (qldSites.some(site => siteUpper.includes(site))) {
    return 'QLD';
  }
  
  // Fallback to keyword matching
  if (siteUpper.includes('QLD') || siteUpper.includes('BRISBANE') || siteUpper.includes('QUEENSLAND')) return 'QLD';
  if (siteUpper.includes('VIC') || siteUpper.includes('MELBOURNE') || siteUpper.includes('VICTORIA')) return 'VIC';
  if (siteUpper.includes('NSW') || siteUpper.includes('SYDNEY')) return 'NSW';
  
  return 'NSW'; // Default
};

const calculateCostPerScan = (customerName, state) => {
  if (!customerName) return PRICING_RULES[state].litres * PRICING_RULES[state].pricePerLitre;
  const customerUpper = customerName.toUpperCase();
  
  if (customerUpper.includes('GUNLAKE')) {
    return PRICING_RULES.GUNLAKE.litres * PRICING_RULES.GUNLAKE.pricePerLitre;
  }
  
  if (state === 'QLD' && customerUpper.includes('BORAL')) {
    return PRICING_RULES.BORAL_QLD.litres * PRICING_RULES.BORAL_QLD.pricePerLitre;
  }
  
  const rule = PRICING_RULES[state];
  return rule.litres * rule.pricePerLitre;
};

const getPricingDetails = (customerName, state) => {
  if (!customerName) return PRICING_RULES[state];
  const customerUpper = customerName.toUpperCase();
  
  if (customerUpper.includes('GUNLAKE')) {
    return PRICING_RULES.GUNLAKE;
  }
  
  if (state === 'QLD' && customerUpper.includes('BORAL')) {
    return PRICING_RULES.BORAL_QLD;
  }
  
  return PRICING_RULES[state];
};

const SCANS_PAGE_SIZE = 100;

export default function UsageCosts({ selectedCustomer, selectedSite, dateRange }) {
  const permissions = usePermissions();
  const companyId = permissions.userProfile?.company_id ?? 'portal';
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCustomers, setExpandedCustomers] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [apiPage, setApiPage] = useState(1);
  const itemsPerPage = 20;

  // Scans API: paginated { total, page, pageSize, pageCount, data }. Each item is a wash event
  // (deviceRef, deviceName, rfid, createdAt, etc.). We group by vehicle/device, apply pricing
  // by state, then show: summary cards, Cost Breakdown by Vehicle table, Cost Over Time chart,
  // Top Sites, and Cost Summary by Customer. Use API pagination (Previous/Next) to load more pages.
  const { data: scansResult, isLoading, isFetching } = useQuery(
    scansOptions(companyId, {
      customerId: selectedCustomer,
      siteId: selectedSite,
      startDate: dateRange.start,
      endDate: dateRange.end,
      page: apiPage,
      pageSize: SCANS_PAGE_SIZE,
    })
  );

  const isPaginated = scansResult != null && typeof scansResult === 'object' && 'data' in scansResult;
  const scans = isPaginated ? scansResult.data ?? [] : (Array.isArray(scansResult) ? scansResult : []);
  const totalFromApi = isPaginated ? scansResult.total ?? 0 : scans.length;
  const pageCount = isPaginated ? scansResult.pageCount ?? 1 : 1;
  const currentApiPage = isPaginated ? scansResult.page ?? apiPage : 1;

  useEffect(() => {
    setApiPage(1);
    setCurrentPage(1);
  }, [selectedCustomer, selectedSite, dateRange.start, dateRange.end]);

  // Process data: scans API returns { total, page, pageSize, pageCount, data }.
  // We group scans by vehicle (or by device when customer/site/vehicle are null),
  // compute cost per row, then drive summary cards, table, charts, and customer summary.
  const costData = useMemo(() => {
    if (!scans.length) return { vehicles: [], summary: {}, customerSummary: [], dailyCosts: [], topSites: [] };

    const hasVehicleContext = (s) => s.customerRef != null && s.siteRef != null && s.vehicleRef != null;

    // Group scans by vehicle when API provides customer/site/vehicle; otherwise by device
    const vehicleGroups = {};
    scans.forEach(scan => {
      const key = hasVehicleContext(scan)
        ? `${scan.customerRef}_${scan.siteRef}_${scan.vehicleRef}`
        : `device_${scan.deviceRef ?? scan.internalScanId ?? scan.scanRef}`;
      if (!vehicleGroups[key]) {
        const deviceOnly = !hasVehicleContext(scan);
        vehicleGroups[key] = {
          customerName: scan.customerName ?? '—',
          customerRef: scan.customerRef ?? key,
          siteName: scan.siteName ?? (deviceOnly ? (scan.deviceName ?? '—') : '—'),
          siteRef: scan.siteRef ?? (deviceOnly ? (scan.deviceRef ?? key) : key),
          vehicleName: scan.vehicleName ?? scan.deviceName ?? '—',
          vehicleRef: scan.vehicleRef ?? scan.deviceRef ?? key,
          vehicleRfid: scan.vehicleRfid ?? scan.rfid ?? '—',
          scans: [],
        };
      }
      vehicleGroups[key].scans.push(scan);
    });

    // Calculate costs for each vehicle
    const vehicles = Object.values(vehicleGroups).map(group => {
      const state = getStateFromSite(group.siteName, group.customerName);
      const totalScans = group.scans.length;
      const costPerScan = calculateCostPerScan(group.customerName, state);
      const pricingDetails = getPricingDetails(group.customerName, state);
      const totalCost = totalScans * costPerScan;
      const lastScan = group.scans.sort((a, b) => new Date(b.createdAt ?? b.timestamp ?? 0) - new Date(a.createdAt ?? a.timestamp ?? 0))[0];
      const lastScanDate = lastScan?.createdAt ?? lastScan?.timestamp;

      return {
        ...group,
        state,
        totalScans,
        litresPerScan: pricingDetails.litres,
        pricePerLitre: pricingDetails.pricePerLitre,
        costPerScan,
        totalCost,
        lastScan: lastScanDate,
      };
    });

    // Calculate summary
    const totalCost = vehicles.reduce((sum, v) => sum + v.totalCost, 0);
    const totalScans = vehicles.reduce((sum, v) => sum + v.totalScans, 0);
    const avgCostPerScan = totalScans > 0 ? totalCost / totalScans : 0;
    const mostExpensiveSite = vehicles.reduce((max, v) => {
      const siteCost = vehicles
        .filter(x => x.siteRef === v.siteRef)
        .reduce((sum, x) => sum + x.totalCost, 0);
      return siteCost > (max.cost || 0) ? { name: v.siteName, cost: siteCost } : max;
    }, {});

    // Customer summary (aggregate device-only rows under "Devices (this page)")
    const customerGroups = {};
    vehicles.forEach(v => {
      const isDeviceOnly = v.customerName === '—';
      const custKey = isDeviceOnly ? '__devices__' : v.customerRef;
      const custName = isDeviceOnly ? 'Devices (this page)' : v.customerName;
      if (!customerGroups[custKey]) {
        customerGroups[custKey] = {
          customerName: custName,
          customerRef: custKey,
          totalScans: 0,
          totalCost: 0,
          sites: {}
        };
      }
      customerGroups[custKey].totalScans += v.totalScans;
      customerGroups[custKey].totalCost += v.totalCost;

      if (!customerGroups[custKey].sites[v.siteRef]) {
        customerGroups[custKey].sites[v.siteRef] = {
          siteName: v.siteName,
          state: v.state,
          totalScans: 0,
          totalCost: 0,
          costPerScan: v.costPerScan
        };
      }
      customerGroups[custKey].sites[v.siteRef].totalScans += v.totalScans;
      customerGroups[custKey].sites[v.siteRef].totalCost += v.totalCost;
    });

    // Daily costs for chart
    const dailyGroups = {};
    scans.forEach(scan => {
      const date = moment(scan.createdAt ?? scan.timestamp).format('MMM D');
      const state = getStateFromSite(scan.siteName, scan.customerName);
      const cost = calculateCostPerScan(scan.customerName, state);
      dailyGroups[date] = (dailyGroups[date] || 0) + cost;
    });
    const dailyCosts = Object.entries(dailyGroups).map(([date, cost]) => ({ date, cost }));

    // Top sites by cost
    const siteGroups = {};
    vehicles.forEach(v => {
      if (!siteGroups[v.siteRef]) {
        siteGroups[v.siteRef] = {
          siteName: v.siteName,
          state: v.state,
          totalCost: 0,
          totalScans: 0
        };
      }
      siteGroups[v.siteRef].totalCost += v.totalCost;
      siteGroups[v.siteRef].totalScans += v.totalScans;
    });
    const topSites = Object.values(siteGroups)
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 10);

    return {
      vehicles: vehicles.sort((a, b) => b.totalCost - a.totalCost),
      summary: { totalCost, totalScans, avgCostPerScan, mostExpensiveSite },
      customerSummary: Object.values(customerGroups),
      dailyCosts,
      topSites
    };
  }, [scans]);

  // Filter and paginate
  const filteredVehicles = useMemo(() => {
    return costData.vehicles.filter(v =>
      (v.customerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.siteName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.vehicleName || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [costData.vehicles, searchQuery]);

  const totalPages = Math.ceil(filteredVehicles.length / itemsPerPage);
  const paginatedVehicles = useMemo(() => {
    return filteredVehicles.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );
  }, [filteredVehicles, currentPage, itemsPerPage]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Customer', 'Site', 'State', 'Vehicle', 'RFID', 'Total Scans', 'Litres/Scan', 'Price/Litre', 'Cost/Scan', 'Total Cost', 'Date Range'];
    const rows = costData.vehicles.map(v => [
      v.customerName,
      v.siteName,
      v.state,
      v.vehicleName,
      v.vehicleRfid,
      v.totalScans,
      v.litresPerScan,
      `$${v.pricePerLitre.toFixed(2)}`,
      `$${v.costPerScan.toFixed(2)}`,
      `$${v.totalCost.toFixed(2)}`,
      `${dateRange.start} to ${dateRange.end}`
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `elora-usage-costs-${dateRange.start}-${dateRange.end}.csv`;
    a.click();
  };

  const toggleCustomer = (customerRef) => {
    const newSet = new Set(expandedCustomers);
    if (newSet.has(customerRef)) {
      newSet.delete(customerRef);
    } else {
      newSet.add(customerRef);
    }
    setExpandedCustomers(newSet);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Calculating costs...</p>
        </div>
      </div>
    );
  }

  if (!scans.length) {
    return (
      <div className="space-y-6">
        {!permissions.hideCostForecast && (
          <CostForecast scans={[]} selectedCustomer={selectedCustomer} selectedSite={selectedSite} />
        )}
        <div className="flex items-center justify-center py-12 rounded-xl border border-border bg-card">
          <div className="text-center">
            <Droplet className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground text-lg">No wash data for selected period</p>
            <p className="text-sm text-muted-foreground mt-1">Adjust the date range to see cost data</p>
          </div>
        </div>
      </div>
    );
  }

  const { summary } = costData;

  return (
    <div className="space-y-6 relative">
      {!permissions.hideCostForecast && (
        <CostForecast
          scans={scans}
          selectedCustomer={selectedCustomer}
          selectedSite={selectedSite}
        />
      )}
      {isFetching && (
        <div className="absolute inset-0 bg-background/60 backdrop-blur-sm z-10 flex items-center justify-center rounded-2xl">
          <div className="flex items-center gap-3 bg-card px-6 py-3 rounded-xl shadow-lg border border-border">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
            <span className="text-sm font-medium text-foreground">Updating costs...</span>
          </div>
        </div>
      )}
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Usage Cost</CardTitle>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">${summary.totalCost.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {isPaginated && pageCount > 1 ? 'Cost for scans on this page' : 'Total wash costs (selected period)'}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Average Cost Per Scan</CardTitle>
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Calculator className="w-5 h-5 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">${summary.avgCostPerScan.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">Average cost per wash</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Scans</CardTitle>
              <div className="w-10 h-10 rounded-lg bg-cyan-100 flex items-center justify-center">
                <Droplet className="w-5 h-5 text-cyan-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{totalFromApi > 0 ? totalFromApi.toLocaleString() : summary.totalScans.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {isPaginated && pageCount > 1
                  ? `Showing page ${currentApiPage} of ${pageCount} (${scans.length} scans on this page)`
                  : 'Total washes (selected period)'}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Most Expensive Site</CardTitle>
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-foreground">{summary.mostExpensiveSite.name || 'N/A'}</div>
              <p className="text-sm text-primary font-semibold mt-1">${(summary.mostExpensiveSite.cost || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* API pagination: load next/previous page of scans */}
      {isPaginated && pageCount > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Scans page <span className="font-semibold text-foreground">{currentApiPage}</span> of <span className="font-semibold text-foreground">{pageCount.toLocaleString()}</span>
            {' '}({totalFromApi.toLocaleString()} total in period)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setApiPage((p) => Math.max(1, p - 1))}
              disabled={currentApiPage <= 1 || isFetching}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground min-w-[6rem] text-center">
              {currentApiPage} / {pageCount.toLocaleString()}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setApiPage((p) => Math.min(pageCount, p + 1))}
              disabled={currentApiPage >= pageCount || isFetching}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Main Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle>Cost Breakdown by Vehicle</CardTitle>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by customer, site, or vehicle..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-72"
                />
              </div>
              <Button onClick={exportToCSV} variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-primary text-primary-foreground">
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase">Site</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase">Vehicle</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase">RFID</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase">Total Scans</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase">Litres/Scan</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase">Price/Litre</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase">Cost/Scan</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase">Total Cost</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase">Last Scan</th>
                </tr>
              </thead>
              <tbody>
                {paginatedVehicles.map((vehicle, index) => (
                  <tr key={index} className={`border-b ${index % 2 === 0 ? 'bg-card' : 'bg-muted/30'} hover:bg-primary/5`}>
                    <td className="px-4 py-3 text-sm text-foreground">{vehicle.customerName}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-foreground">{vehicle.siteName}</span>
                        <Badge className={`text-xs ${
                          vehicle.state === 'QLD' ? 'bg-orange-100 text-orange-800' :
                          vehicle.state === 'VIC' ? 'bg-blue-100 text-blue-800' :
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {vehicle.state}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-foreground">{vehicle.vehicleName}</td>
                    <td className="px-4 py-3 text-sm font-mono text-muted-foreground">{vehicle.vehicleRfid}</td>
                    <td className="px-4 py-3 text-sm text-right text-foreground">{vehicle.totalScans}</td>
                    <td className="px-4 py-3 text-sm text-right text-muted-foreground">{vehicle.litresPerScan}L</td>
                    <td className="px-4 py-3 text-sm text-right text-muted-foreground">${vehicle.pricePerLitre.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-right text-foreground">${vehicle.costPerScan.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-primary">${vehicle.totalCost.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{moment(vehicle.lastScan).format('MMM D, YYYY')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <DataPagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredVehicles.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          )}
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Cost Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={costData.dailyCosts}>
                <defs>
                  <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                  formatter={(value) => [`$${value.toFixed(2)}`, 'Cost']}
                />
                <Line type="monotone" dataKey="cost" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#costGradient)" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 10 Sites by Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={costData.topSites} layout="vertical">
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.5}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis dataKey="siteName" type="category" width={100} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                  formatter={(value, name, props) => [
                    `$${value.toFixed(2)}`,
                    `${props.payload.totalScans} scans`
                  ]}
                />
                <Bar dataKey="totalCost" fill="url(#barGradient)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Customer Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Cost Summary by Customer</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {costData.customerSummary.map((customer) => (
              <div key={customer.customerRef} className="border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleCustomer(customer.customerRef)}
                  className="w-full px-4 py-3 flex items-center justify-between bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {expandedCustomers.has(customer.customerRef) ? 
                      <ChevronUp className="w-4 h-4 text-muted-foreground" /> : 
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    }
                    <div className="text-left">
                      <p className="font-semibold text-foreground">{customer.customerName}</p>
                      <p className="text-sm text-muted-foreground">{customer.totalScans} scans</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-primary">${customer.totalCost.toFixed(2)}</p>
                  </div>
                </button>

                {expandedCustomers.has(customer.customerRef) && (
                  <div className="p-4 bg-card">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground">Site</th>
                          <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground">State</th>
                          <th className="px-2 py-2 text-right text-xs font-semibold text-muted-foreground">Scans</th>
                          <th className="px-2 py-2 text-right text-xs font-semibold text-muted-foreground">Cost/Scan</th>
                          <th className="px-2 py-2 text-right text-xs font-semibold text-muted-foreground">Total Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.values(customer.sites).map((site, idx) => (
                          <tr key={idx} className="border-b last:border-0">
                            <td className="px-2 py-2 text-sm text-foreground">{site.siteName}</td>
                            <td className="px-2 py-2">
                              <Badge className={`text-xs ${
                                site.state === 'QLD' ? 'bg-orange-100 text-orange-800' :
                                site.state === 'VIC' ? 'bg-blue-100 text-blue-800' :
                                'bg-purple-100 text-purple-800'
                              }`}>
                                {site.state}
                              </Badge>
                            </td>
                            <td className="px-2 py-2 text-sm text-right text-foreground">{site.totalScans}</td>
                            <td className="px-2 py-2 text-sm text-right text-muted-foreground">${site.costPerScan.toFixed(2)}</td>
                            <td className="px-2 py-2 text-sm text-right font-semibold text-primary">${site.totalCost.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
