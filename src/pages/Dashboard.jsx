import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Truck, CheckCircle, Droplet, Users, Loader2, Trophy, ChevronRight, AlertTriangle, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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

// Import Apple-style components
import AppleHeader from '@/components/layout/AppleHeader';
import AppleStatCard from '@/components/ui/AppleStatCard';
import AppleFilterSection from '@/components/dashboard/AppleFilterSection';
import AppleVehicleList from '@/components/dashboard/AppleVehicleList';
import TabNav from '@/components/ui/TabNav';

// Import existing components
import WashAnalytics from '@/components/dashboard/WashAnalytics';
import VehiclePerformanceChart from '@/components/dashboard/VehiclePerformanceChart';
import SiteManagement from '@/components/sites/SiteManagement';
import ReportsDashboard from '@/components/reports/ReportsDashboard';
import EmailReportSettings from '@/components/reports/EmailReportSettings';
import RoleManagement from '@/components/admin/RoleManagement';
import MultiTenantConfig from '@/components/admin/MultiTenantConfig';
import PermissionsManagement from '@/components/admin/PermissionsManagement';
import BrandingManagement from '@/components/admin/BrandingManagement';
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
import { usePermissions, useFilteredData, useAvailableTabs } from '@/components/auth/PermissionGuard';

// All available tabs (maintenance removed)
const ALL_TABS = [
  { value: 'compliance', label: 'Compliance' },
  { value: 'costs', label: 'Usage Costs' },
  { value: 'refills', label: 'Refills' },
  { value: 'devices', label: 'Device Health' },
  { value: 'sites', label: 'Sites' },
  { value: 'reports', label: 'Reports' },
  { value: 'email-reports', label: 'Email Reports' },
  { value: 'users', label: 'Users' }
];

export default function Dashboard() {
  const permissions = usePermissions();
  const [isMobile, setIsMobile] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState('all');
  const [selectedSite, setSelectedSite] = useState('all');
  const [showCustomizer, setShowCustomizer] = useState(false);

  // Use database-driven tab visibility from permissions
  const availableTabs = useAvailableTabs(ALL_TABS);

  const [dateRange, setDateRange] = useState({
    start: moment().startOf('month').format('YYYY-MM-DD'),
    end: moment().format('YYYY-MM-DD')
  });
  const [activePeriod, setActivePeriod] = useState('Month');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('compliance');

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const allowedTabValues = availableTabs.map(tab => tab.value);
    if (!allowedTabValues.includes(activeTab) && allowedTabValues.length > 0) {
      setActiveTab(allowedTabValues[0]);
    }
  }, [availableTabs, activeTab]);

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

  const filteredCustomers = useMemo(() => {
    if (!permissions.restrictedCustomer) return customers;
    const restrictedCustomer = customers.find(c =>
      c.name && c.name.toUpperCase().includes(permissions.restrictedCustomer.toUpperCase())
    );
    return restrictedCustomer ? [restrictedCustomer] : customers;
  }, [customers, permissions.restrictedCustomer]);

  useEffect(() => {
    if (permissions.restrictedCustomer && filteredCustomers.length === 1) {
      setSelectedCustomer(filteredCustomers[0].id);
    }
  }, [filteredCustomers, permissions.restrictedCustomer]);

  const { data: rawSites = [], isLoading: sitesLoading, error: sitesError } = useQuery({
    queryKey: ['sites'],
    queryFn: () => fetchSites(),
    retry: 1,
    staleTime: 30000,
  });

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

  const { data: refills = [] } = useQuery({
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

  useEffect(() => {
    setSelectedSite('all');
  }, [selectedCustomer]);

  const processedData = useMemo(() => {
    if (!dashboardData?.rows || !Array.isArray(dashboardData.rows)) return { vehicles: [], scans: [] };

    const vehicleMap = new Map();
    const scansArray = [];
    const startMoment = moment(dateRange.start);
    const endMoment = moment(dateRange.end);

    dashboardData.rows.forEach(row => {
      const rowDate = moment(`${row.year}-${String(row.month).padStart(2, '0')}-01`);
      if (!rowDate.isBetween(startMoment, endMoment, 'month', '[]')) {
        return;
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

  const { filteredVehicles: permissionFilteredVehicles } = useFilteredData(enrichedVehicles, allSites);

  // Apply customer and site filters to vehicles (client-side filtering)
  const filteredVehicles = useMemo(() => {
    let result = permissionFilteredVehicles || [];

    // Filter by customer (via site's customer_ref)
    if (selectedCustomer && selectedCustomer !== 'all') {
      const customerSiteIds = rawSites
        .filter(s => s.customer_ref === selectedCustomer)
        .map(s => s.id);
      result = result.filter(v => customerSiteIds.includes(v.site_id));
    }

    // Filter by site
    if (selectedSite && selectedSite !== 'all') {
      result = result.filter(v => v.site_id === selectedSite);
    }

    return result;
  }, [permissionFilteredVehicles, selectedCustomer, selectedSite, rawSites]);

  // Apply customer and site filters to scans for consistent chart/analytics data
  const filteredScans = useMemo(() => {
    let result = scans || [];

    // Filter by customer (via site's customer_ref)
    if (selectedCustomer && selectedCustomer !== 'all') {
      const customerSiteIds = rawSites
        .filter(s => s.customer_ref === selectedCustomer)
        .map(s => s.id);
      result = result.filter(s => customerSiteIds.includes(s.siteRef));
    }

    // Filter by site
    if (selectedSite && selectedSite !== 'all') {
      result = result.filter(s => s.siteRef === selectedSite);
    }

    return result;
  }, [scans, selectedCustomer, selectedSite, rawSites]);

  const washTrendsData = useMemo(() => {
    if (!dashboardData?.charts?.totalWashesByMonth?.length) {
      if (!filteredScans || !Array.isArray(filteredScans) || filteredScans.length === 0) return [];

      const scansByDate = {};
      filteredScans.forEach(scan => {
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

    return dashboardData.charts.totalWashesByMonth.map(item => ({
      date: `${item.month}/${item.year}`,
      washes: item.totalWashes || 0
    }));
  }, [dashboardData, filteredScans, dateRange]);

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

  if (isMobile && permissions.isDriver) {
    return <MobileDashboard />;
  }

  // Apple-style Loading State
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
          </div>
          <p className="text-gray-500 dark:text-gray-400">Loading dashboard...</p>
        </motion.div>
      </div>
    );
  }

  // Apple-style Error State
  if (hasError) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md mx-auto p-8"
        >
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-100 dark:bg-red-500/10 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Failed to Load Dashboard
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            We couldn't load the dashboard data. Please try again.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="h-11 px-6 rounded-full bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 active:scale-95 transition-all"
          >
            Refresh Page
          </button>
        </motion.div>
      </div>
    );
  }

  const statsConfig = [
    {
      icon: Truck,
      value: stats.totalVehicles.toLocaleString(),
      label: 'Total Vehicles',
      accentColor: 'gray',
    },
    {
      icon: CheckCircle,
      value: `${stats.complianceRate}%`,
      label: 'Compliance Rate',
      accentColor: 'emerald',
      trend: stats.complianceRate >= 80 ? 'up' : stats.complianceRate >= 60 ? 'neutral' : 'down',
      trendValue: 'vs target 80%',
    },
    {
      icon: Droplet,
      value: stats.monthlyWashes.toLocaleString(),
      label: 'Total Washes',
      accentColor: 'blue',
    },
    {
      icon: Users,
      value: stats.activeDrivers.toLocaleString(),
      label: 'Active Drivers',
      accentColor: 'purple',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
      {/* Apple-style Header */}
      <AppleHeader />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white tracking-tight">
                Fleet Compliance
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                {filteredCustomers.length === 1 ? filteredCustomers[0].name : 'All Customers'}
              </p>
            </div>
            <button
              onClick={() => setShowCustomizer(true)}
              className="
                w-10 h-10 rounded-full
                bg-white/80 dark:bg-zinc-900/80
                border border-gray-200/50 dark:border-zinc-800/50
                backdrop-blur-xl
                flex items-center justify-center
                hover:bg-gray-100 dark:hover:bg-zinc-800
                active:scale-95
                transition-all
              "
              title="Customize Dashboard"
            >
              <Settings className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </motion.div>

        {/* Filters */}
        <div className="mb-8">
          <AppleFilterSection
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
            lockCustomerFilter={permissions.lockCustomerFilter}
            restrictedCustomerName={permissions.restrictedCustomer}
          />
        </div>

        {/* Hero Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {statsConfig.map((stat, index) => (
            <AppleStatCard key={index} {...stat} index={index} />
          ))}
        </div>

        {/* Activity & Favorites */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
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

        {/* Cost Forecast */}
        {!permissions.hideCostForecast && (
          <div className="mb-8">
            <CostForecast
              scans={filteredScans}
              selectedCustomer={selectedCustomer}
              selectedSite={selectedSite}
            />
          </div>
        )}

        {/* Leaderboard Link */}
        {!permissions.hideLeaderboard && (
          <Link to={`${createPageUrl('Leaderboard')}?customer=${selectedCustomer}&site=${selectedSite}`}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="
                backdrop-blur-xl bg-gradient-to-r from-purple-600 to-blue-600
                rounded-2xl p-6 mb-8
                shadow-xl shadow-purple-500/20
                cursor-pointer group
              "
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                    <Trophy className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Driver Leaderboard</h3>
                    <p className="text-purple-200">See who's leading the pack this month</p>
                  </div>
                </div>
                <ChevronRight className="w-6 h-6 text-white/70 group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.div>
          </Link>
        )}

        {/* Tab Navigation - Apple Pill Style */}
        <div className="mb-6">
          <TabNav tabs={availableTabs} activeTab={activeTab} onChange={setActiveTab} />
        </div>

        {/* Tab Content with Animations */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'compliance' && (
              <div className="space-y-8">
                {/* Apple-style Vehicle List */}
                <AppleVehicleList
                  vehicles={filteredVehicles}
                  scans={filteredScans}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                />

                {/* Charts in Glass Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80 border border-gray-200/20 dark:border-zinc-800/50 rounded-2xl p-6 shadow-lg shadow-black/[0.03]">
                    <WashAnalytics
                      data={washTrendsData}
                      vehicles={filteredVehicles}
                      scans={filteredScans}
                    />
                  </div>
                  <div className="backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80 border border-gray-200/20 dark:border-zinc-800/50 rounded-2xl p-6 shadow-lg shadow-black/[0.03]">
                    <VehiclePerformanceChart vehicles={filteredVehicles} />
                  </div>
                </div>

                {permissions.isAdmin && selectedCustomer !== 'all' && (
                  <CustomComplianceTargets
                    customerRef={selectedCustomer}
                    vehicles={enrichedVehicles}
                    sites={allSites}
                  />
                )}
              </div>
            )}

            {activeTab === 'costs' && (
              <UsageCosts
                selectedCustomer={selectedCustomer}
                selectedSite={selectedSite}
                dateRange={dateRange}
              />
            )}

            {activeTab === 'refills' && (
              <RefillAnalytics
                refills={refills}
                scans={filteredScans}
                sites={allSites}
                selectedCustomer={selectedCustomer}
                selectedSite={selectedSite}
              />
            )}

            {activeTab === 'devices' && (
              <DeviceHealth
                selectedCustomer={selectedCustomer}
                selectedSite={selectedSite}
              />
            )}

            {activeTab === 'sites' && (
              <SiteManagement customers={customers} vehicles={enrichedVehicles} />
            )}

            {activeTab === 'reports' && (
              <ReportsDashboard vehicles={filteredVehicles} scans={filteredScans} />
            )}

            {activeTab === 'email-reports' && (
              <EmailReportSettings />
            )}

            {activeTab === 'users' && (
              <div className="space-y-6">
                <Tabs defaultValue="roles" className="w-full">
                  <TabsList className="backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80 border border-gray-200/20 dark:border-zinc-800/50 rounded-xl p-1 flex-wrap">
                    <TabsTrigger value="roles" className="rounded-lg">User Roles</TabsTrigger>
                    <TabsTrigger value="permissions" className="rounded-lg">Permissions</TabsTrigger>
                    <TabsTrigger value="branding" className="rounded-lg">Branding</TabsTrigger>
                    <TabsTrigger value="multitenant" className="rounded-lg">Multi-Tenant</TabsTrigger>
                    <TabsTrigger value="digest" className="rounded-lg">Email Digest</TabsTrigger>
                  </TabsList>
                  <TabsContent value="roles" className="mt-6">
                    <RoleManagement vehicles={enrichedVehicles} sites={allSites} />
                  </TabsContent>
                  <TabsContent value="permissions" className="mt-6">
                    <PermissionsManagement />
                  </TabsContent>
                  <TabsContent value="branding" className="mt-6">
                    <BrandingManagement />
                  </TabsContent>
                  <TabsContent value="multitenant" className="mt-6">
                    <MultiTenantConfig />
                  </TabsContent>
                  <TabsContent value="digest" className="mt-6">
                    <EmailDigestPreferences />
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Wash Pattern Analytics */}
        <div className="mt-8">
          <WashPatternAnalytics scans={filteredScans} />
        </div>
      </main>

      {/* Dashboard Customizer Modal */}
      {showCustomizer && (
        <DashboardCustomizer
          userEmail={permissions.user?.email}
          onClose={() => setShowCustomizer(false)}
        />
      )}

      {/* Onboarding Wizard */}
      <OnboardingWizard
        userEmail={permissions.user?.email}
        userName="Rebekah Sharp"
        companyName="Heidelberg Materials"
      />
    </div>
  );
}
