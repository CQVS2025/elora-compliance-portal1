import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Truck, CheckCircle, Droplet, Users, Loader2, Trophy, ChevronRight, AlertTriangle, Settings } from 'lucide-react';
import { motion } from 'framer-motion';
import moment from 'moment';
import { supabaseClient } from "@/api/supabaseClient";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

async function fetchDashboardData({ customerId, siteId, startDate, endDate } = {}) {
  const params = {};
  if (customerId && customerId !== 'all') params.customer_id = customerId;
  if (siteId && siteId !== 'all') params.site_id = siteId;
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;

  const response = await supabaseClient.elora.dashboard(params);
  return response?.data ?? response;
}

async function fetchCustomers() {
  const response = await supabaseClient.elora.customers();
  const data = response?.data ?? response ?? [];
  return data.map(c => ({
    id: c.ref,
    name: c.name
  }));
}

async function fetchSites() {
  const response = await supabaseClient.elora.sites({});
  const data = response?.data ?? response ?? [];
  return data.map(s => ({
    id: s.ref,
    name: s.siteName,
    customer_ref: s.customerRef
  }));
}

import BrandedHeader from '@/components/dashboard/BrandedHeader';
import FilterSection from '@/components/dashboard/FilterSection';
import StatsCard from '@/components/dashboard/StatsCard';
import VehicleTable from '@/components/dashboard/VehicleTable';
import WashAnalytics from '@/components/dashboard/WashAnalytics';
import VehiclePerformanceChart from '@/components/dashboard/VehiclePerformanceChart';
import SiteManagement from '@/components/sites/SiteManagement';
import ReportsDashboard from '@/components/reports/ReportsDashboard';
import EmailReportSettings from '@/components/reports/EmailReportSettings';
import RoleManagement from '@/components/admin/RoleManagement';
import MultiTenantConfig from '@/components/admin/MultiTenantConfig';
import UsageCosts from '@/components/costs/UsageCosts';
import MobileDashboard from './MobileDashboard';
import DeviceHealth from '@/components/devices/DeviceHealth';
import CostForecast from '@/components/analytics/CostForecast';
import WashPatternAnalytics from '@/components/analytics/WashPatternAnalytics';
import RefillAnalytics from '@/components/refills/RefillAnalytics';
import RecentActivityFeed from '@/components/dashboard/RecentActivityFeed';
import FavoriteVehicles from '@/components/dashboard/FavoriteVehicles';
import DashboardCustomizer from '@/components/dashboard/DashboardCustomizer';
import EmailDigestPreferences from '@/components/settings/EmailDigestPreferences';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';
import CustomComplianceTargets from '@/components/compliance/CustomComplianceTargets';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions, useFilteredData, getUserSpecificConfig } from '@/components/auth/PermissionGuard';


export default function Dashboard() {
  const permissions = usePermissions();
  const [isMobile, setIsMobile] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState('all');
  const [selectedSite, setSelectedSite] = useState('all');
  const [showCustomizer, setShowCustomizer] = useState(false);

  // Get user-specific configuration
  const userConfig = getUserSpecificConfig(permissions.user?.email);

  // Define and filter available tabs based on user permissions
  const availableTabs = useMemo(() => {
    const allTabs = [
      { value: 'compliance', label: 'Compliance' },
      { value: 'costs', label: 'Usage Costs' },
      { value: 'refills', label: 'Refills' },
      { value: 'devices', label: 'Device Health' },
      { value: 'sites', label: 'Sites' },
      { value: 'reports', label: 'Reports' },
      { value: 'email-reports', label: 'Email Reports' },
      { value: 'users', label: 'Users' }
    ];

    // Filter tabs based on user configuration
    if (userConfig?.visibleTabs) {
      return allTabs.filter(tab => userConfig.visibleTabs.includes(tab.value));
    } else if (userConfig?.hiddenTabs) {
      return allTabs.filter(tab => !userConfig.hiddenTabs.includes(tab.value));
    }

    return allTabs;
  }, [userConfig]);

  const [dateRange, setDateRange] = useState({
    start: moment().startOf('month').format('YYYY-MM-DD'),
    end: moment().format('YYYY-MM-DD')
  });
  const [activePeriod, setActivePeriod] = useState('Month');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('compliance');

  // Detect mobile and redirect drivers to mobile view
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Ensure user can only access tabs they have permission for
  useEffect(() => {
    const allowedTabValues = availableTabs.map(tab => tab.value);
    if (!allowedTabValues.includes(activeTab) && allowedTabValues.length > 0) {
      setActiveTab(allowedTabValues[0]);
    }
  }, [availableTabs, activeTab]);

  // Update date range when period changes
  useEffect(() => {
    if (activePeriod === 'Today') {
      setDateRange({
        start: moment().format('YYYY-MM-DD'),
        end: moment().format('YYYY-MM-DD')
      });
    } else if (activePeriod === 'Week') {
      setDateRange({
        start: moment().startOf('week').format('YYYY-MM-DD'),
        end: moment().format('YYYY-MM-DD')
      });
    } else if (activePeriod === 'Month') {
      setDateRange({
        start: moment().startOf('month').format('YYYY-MM-DD'),
        end: moment().format('YYYY-MM-DD')
      });
    }
  }, [activePeriod]);

  const { data: customers = [], isLoading: customersLoading, error: customersError } = useQuery({
    queryKey: ['customers'],
    queryFn: fetchCustomers,
    retry: 1,
    staleTime: 30000,
  });

  // Filter customers based on user-specific restrictions
  const filteredCustomers = useMemo(() => {
    if (!userConfig?.restrictedCustomer) return customers;

    // Find customer by name match (case-insensitive, partial match)
    const restrictedCustomer = customers.find(c =>
      c.name && c.name.toUpperCase().includes(userConfig.restrictedCustomer.toUpperCase())
    );

    return restrictedCustomer ? [restrictedCustomer] : customers;
  }, [customers, userConfig]);

  // Auto-select restricted customer when customers are loaded
  useEffect(() => {
    if (userConfig?.restrictedCustomer && filteredCustomers.length === 1) {
      setSelectedCustomer(filteredCustomers[0].id);
    }
  }, [filteredCustomers, userConfig]);

  const { data: rawSites = [], isLoading: sitesLoading, error: sitesError } = useQuery({
    queryKey: ['sites'],
    queryFn: () => fetchSites(),
    retry: 1,
    staleTime: 30000,
  });

  // Filter sites by selected customer on the client side
  const allSites = useMemo(() => {
    if (selectedCustomer === 'all' || !selectedCustomer) return rawSites;
    return rawSites.filter(site => site.id === selectedCustomer || site.customer_ref === selectedCustomer);
  }, [rawSites, selectedCustomer]);

  const { data: dashboardData, isLoading: dashboardLoading, error: dashboardError } = useQuery({
    queryKey: ['dashboard', selectedCustomer, selectedSite, dateRange.start, dateRange.end],
    queryFn: () => fetchDashboardData({
      customerId: selectedCustomer,
      siteId: selectedSite,
      startDate: dateRange.start,
      endDate: dateRange.end
    }),
    retry: 1,
    staleTime: 30000,
  });

  const { data: refills = [], isLoading: refillsLoading, error: refillsError } = useQuery({
    queryKey: ['refills', selectedCustomer, selectedSite, dateRange.start, dateRange.end],
    queryFn: async () => {
      const response = await supabaseClient.elora.refills({
        fromDate: dateRange.start,
        toDate: dateRange.end,
        customerRef: selectedCustomer,
        siteRef: selectedSite
      });
      return response?.data ?? response ?? [];
    },
    retry: 1,
    staleTime: 30000,
  });

  // Reset site when customer changes
  useEffect(() => {
    setSelectedSite('all');
  }, [selectedCustomer]);

  // Process dashboard data
  const processedData = useMemo(() => {
    if (!dashboardData?.rows || !Array.isArray(dashboardData.rows)) return { vehicles: [], scans: [] };

    const vehicleMap = new Map();
    const scansArray = [];

    // Filter rows to only include the selected date range
    const startMoment = moment(dateRange.start);
    const endMoment = moment(dateRange.end);
    
    dashboardData.rows.forEach(row => {
      // Check if this row falls within the selected date range
      const rowDate = moment(`${row.year}-${String(row.month).padStart(2, '0')}-01`);
      if (!rowDate.isBetween(startMoment, endMoment, 'month', '[]')) {
        return; // Skip rows outside the date range
      }
      
      const vehicleKey = row.vehicleRef;
      
      if (!vehicleMap.has(vehicleKey)) {
        vehicleMap.set(vehicleKey, {
          id: row.vehicleRef,
          name: row.vehicleName,
          rfid: row.vehicleRef,
          site_id: row.siteRef,
          site_name: row.siteName,
          washes_completed: row.totalScans || 0,
          target: row.washesPerWeek || 12,
          last_scan: row.lastScan,
        });
      } else {
        const existing = vehicleMap.get(vehicleKey);
        existing.washes_completed += (row.totalScans || 0);
        if (row.lastScan && (!existing.last_scan || row.lastScan > existing.last_scan)) {
          existing.last_scan = row.lastScan;
        }
      }
      
      // Create scan records for compatibility
      if (row.totalScans > 0) {
        scansArray.push({
          vehicleRef: row.vehicleRef,
          siteRef: row.siteRef,
          siteName: row.siteName,
          timestamp: row.lastScan
        });
      }
    });
    
    return {
      vehicles: Array.from(vehicleMap.values()),
      scans: scansArray
    };
  }, [dashboardData, dateRange]);

  const enrichedVehicles = processedData.vehicles;
  const scans = processedData.scans;

  // Apply permission-based filtering
  const { filteredVehicles, filteredSites } = useFilteredData(enrichedVehicles, allSites);

  // Generate chart data from dashboard API
  const washTrendsData = useMemo(() => {
    if (!dashboardData?.charts?.totalWashesByMonth?.length) {
      // Fallback to scanning data
      if (!scans || !Array.isArray(scans) || scans.length === 0) return [];
      
      const scansByDate = {};
      scans.forEach(scan => {
        const date = moment(scan.timestamp).format('MMM D');
        scansByDate[date] = (scansByDate[date] || 0) + 1;
      });

      const days = [];
      const start = moment(dateRange.start);
      const end = moment(dateRange.end);
      const diff = end.diff(start, 'days');
      
      for (let i = 0; i <= Math.min(diff, 30); i++) {
        const date = moment(start).add(i, 'days');
        const dateKey = date.format('MMM D');
        days.push({
          date: dateKey,
          washes: scansByDate[dateKey] || 0,
        });
      }
      return days;
    }
    
    // Use API's pre-aggregated data
    return dashboardData.charts.totalWashesByMonth.map(item => ({
      date: `${item.month}/${item.year}`,
      washes: item.totalWashes || 0
    }));
  }, [dashboardData, scans, dateRange]);

  // Calculate stats
  const stats = useMemo(() => {
    const vehicles = Array.isArray(filteredVehicles) ? filteredVehicles : [];
    const compliantCount = vehicles.filter(v => v && v.washes_completed >= v.target).length;
    const totalWashes = vehicles.reduce((sum, v) => sum + (v?.washes_completed || 0), 0);
    const activeDriversCount = vehicles.filter(v => v && v.washes_completed > 0).length;

    return {
      totalVehicles: vehicles.length,
      complianceRate: vehicles.length > 0
        ? Math.round((compliantCount / vehicles.length) * 100)
        : 0,
      monthlyWashes: totalWashes,
      activeDrivers: activeDriversCount,
    };
  }, [filteredVehicles]);

  const isLoading = permissions.isLoading || customersLoading || sitesLoading || dashboardLoading;
  const hasError = customersError || sitesError || dashboardError;

  // Redirect drivers to mobile view on mobile devices
  if (isMobile && permissions.isDriver) {
    return <MobileDashboard />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#7CB342] animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Failed to Load Dashboard</h2>
          <p className="text-slate-600 mb-4">
            {customersError ? 'Failed to load customers. ' : ''}
            {sitesError ? 'Failed to load sites. ' : ''}
            {dashboardError ? 'Failed to load dashboard data. ' : ''}
            Please try refreshing the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-[#7CB342] hover:bg-[#6BA032] text-white font-medium py-2 px-6 rounded-lg transition-colors"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  const statsConfig = [
    {
      icon: Truck,
      iconBg: 'bg-slate-100 text-slate-600',
      value: stats.totalVehicles.toLocaleString(),
      label: 'Current fleet size',
    },
    {
      icon: CheckCircle,
      iconBg: 'bg-[#7CB342]/10 text-[#7CB342]',
      value: `${stats.complianceRate}%`,
      label: 'Current compliance rate',
    },
    {
      icon: Droplet,
      iconBg: 'bg-blue-100 text-blue-600',
      value: stats.monthlyWashes.toLocaleString(),
      label: 'Total washes this month',
    },
    {
      icon: Users,
      iconBg: 'bg-purple-100 text-purple-600',
      value: stats.activeDrivers.toLocaleString(),
      label: 'Current active drivers',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <BrandedHeader />
      
      <main className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 space-y-6">
        {/* Filters and Customizer Button */}
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <FilterSection
                customers={filteredCustomers}
                sites={allSites}
                selectedCustomer={selectedCustomer}
                setSelectedCustomer={setSelectedCustomer}
                selectedSite={selectedSite}
                setSelectedSite={setSelectedSite}
                dateRange={dateRange}
                setDateRange={setDateRange}
                activePeriod={activePeriod}
                setActivePeriod={setActivePeriod}
                lockCustomerFilter={userConfig?.lockCustomerFilter}
                restrictedCustomerName={userConfig?.restrictedCustomer}
              />
            </div>
            <button
              onClick={() => setShowCustomizer(true)}
              className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg border border-slate-200 transition-colors shadow-sm"
              title="Customize Dashboard"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Customize</span>
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statsConfig.map((stat, index) => (
            <StatsCard key={index} {...stat} index={index} />
          ))}
        </div>

        {/* Activity Feed and Favorites Widgets */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecentActivityFeed
            customerRef={selectedCustomer}
            siteRef={selectedSite}
          />
          <FavoriteVehicles
            vehicles={filteredVehicles}
            selectedCustomer={selectedCustomer}
            selectedSite={selectedSite}
          />
        </div>

        {/* Cost Forecast - Hidden for restricted users */}
        {!userConfig?.hideCostForecast && (
          <CostForecast
            scans={scans}
            selectedCustomer={selectedCustomer}
            selectedSite={selectedSite}
          />
        )}

        {/* Leaderboard Quick Link - Hidden for restricted users */}
        {!userConfig?.hideLeaderboard && (
          <Link to={`${createPageUrl('Leaderboard')}?customer=${selectedCustomer}&site=${selectedSite}`}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                    <Trophy className="w-6 h-6" />
                    Driver Leaderboard
                  </h3>
                  <p className="text-purple-100">
                    See who's leading the pack this month! 🏆
                  </p>
                </div>
                <ChevronRight className="w-8 h-8 group-hover:translate-x-2 transition-transform" />
              </div>
            </motion.div>
          </Link>
        )}

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-6xl gap-1" style={{ gridTemplateColumns: `repeat(${availableTabs.length}, minmax(0, 1fr))` }}>
            {availableTabs.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="compliance" className="space-y-6">
            {/* Vehicle Table */}
            <VehicleTable
              vehicles={filteredVehicles}
              scans={scans}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
            />

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <WashAnalytics
                data={washTrendsData}
                vehicles={filteredVehicles}
                scans={scans}
              />
              <VehiclePerformanceChart vehicles={filteredVehicles} />
            </div>

            {/* Custom Compliance Targets */}
            {permissions.isAdmin && selectedCustomer !== 'all' && (
              <CustomComplianceTargets
                customerRef={selectedCustomer}
                vehicles={enrichedVehicles}
                sites={allSites}
              />
            )}
          </TabsContent>

          <TabsContent value="costs" className="mt-6">
            <UsageCosts
              selectedCustomer={selectedCustomer}
              selectedSite={selectedSite}
              dateRange={dateRange}
            />
          </TabsContent>

          <TabsContent value="refills" className="mt-6">
            <RefillAnalytics 
              refills={refills}
              scans={scans}
              sites={allSites}
              selectedCustomer={selectedCustomer}
              selectedSite={selectedSite}
            />
          </TabsContent>

          <TabsContent value="devices" className="mt-6">
            <DeviceHealth
              selectedCustomer={selectedCustomer}
              selectedSite={selectedSite}
            />
          </TabsContent>

          <TabsContent value="sites" className="mt-6">
            <SiteManagement customers={customers} vehicles={enrichedVehicles} />
          </TabsContent>

          <TabsContent value="reports" className="mt-6">
            <ReportsDashboard vehicles={filteredVehicles} scans={scans} />
          </TabsContent>

          <TabsContent value="email-reports" className="mt-6">
            <EmailReportSettings />
          </TabsContent>

          <TabsContent value="users" className="mt-6">
            <div className="space-y-6">
              <Tabs defaultValue="roles" className="w-full">
                <TabsList>
                  <TabsTrigger value="roles">User Roles</TabsTrigger>
                  <TabsTrigger value="multitenant">Multi-Tenant Config</TabsTrigger>
                  <TabsTrigger value="preferences">User Preferences</TabsTrigger>
                  <TabsTrigger value="digest">Email Digest</TabsTrigger>
                </TabsList>
                <TabsContent value="roles" className="mt-6">
                  <RoleManagement vehicles={enrichedVehicles} sites={allSites} />
                </TabsContent>
                <TabsContent value="multitenant" className="mt-6">
                  <MultiTenantConfig />
                </TabsContent>
                <TabsContent value="preferences" className="mt-6">
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4">User Preferences</h3>
                    <p className="text-sm text-slate-500">
                      User preference options will be available here.
                    </p>
                  </div>
                </TabsContent>
                <TabsContent value="digest" className="mt-6">
                  <EmailDigestPreferences />
                </TabsContent>
              </Tabs>
            </div>
          </TabsContent>
        </Tabs>

        {/* Wash Pattern Analytics */}
        <WashPatternAnalytics scans={scans} />
      </main>

      {/* Dashboard Customizer Modal */}
      {showCustomizer && (
        <DashboardCustomizer
          userEmail={permissions.user?.email}
          onClose={() => setShowCustomizer(false)}
        />
      )}

      {/* Onboarding Wizard - First Time User Experience */}
      <OnboardingWizard
        userEmail={permissions.user?.email}
        userName="Rebekah Sharp"
        companyName="Heidelberg Materials"
      />
    </div>
  );
}
