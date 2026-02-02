import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { Loader2, Trophy, ChevronRight, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import moment from 'moment';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

import {
  customersOptions,
  sitesOptions,
  vehiclesOptions,
  dashboardOptions,
  refillsOptions,
} from '@/query/options';

import { Button } from '@/components/ui/button';
import SectionCards from '@/components/SectionCards';
import ChartAreaInteractive from '@/components/ChartAreaInteractive';
import DataTable from '@/components/DataTable';
import FilterSection from '@/components/dashboard/FilterSection';
import FavoriteVehicles, { FavoriteButton } from '@/components/dashboard/FavoriteVehicles';
import VehiclePerformanceChart from '@/components/dashboard/VehiclePerformanceChart';
import SiteManagement from '@/components/sites/SiteManagement';
import ReportsDashboard from '@/components/reports/ReportsDashboard';
import EmailReportSettings from '@/components/reports/EmailReportSettings';
import BrandingManagement from '@/components/admin/BrandingManagement';
import UsageCosts from '@/components/costs/UsageCosts';
import MobileDashboard from './MobileDashboard';
import DeviceHealth from '@/components/devices/DeviceHealth';
import RefillAnalytics from '@/components/refills/RefillAnalytics';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';
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
  { value: 'branding', label: 'Branding' }
];

// Default filter values - each tab gets its own copy, no mixing
const getDefaultFilters = () => ({
  selectedCustomer: 'all',
  selectedSite: 'all',
  dateRange: {
    start: moment().startOf('month').format('YYYY-MM-DD'),
    end: moment().format('YYYY-MM-DD')
  },
  activePeriod: 'Month'
});

// Date range for period preset
const getDateRangeForPeriod = (period) => {
  if (period === 'Today') {
    return { start: moment().format('YYYY-MM-DD'), end: moment().format('YYYY-MM-DD') };
  }
  if (period === 'Week') {
    return { start: moment().startOf('week').format('YYYY-MM-DD'), end: moment().format('YYYY-MM-DD') };
  }
  if (period === 'Month') {
    return { start: moment().startOf('month').format('YYYY-MM-DD'), end: moment().format('YYYY-MM-DD') };
  }
  return null;
};

// Tabs that use filters (customer, site, date) - each has isolated filter state
const FILTER_TABS = ['compliance', 'costs', 'refills', 'devices', 'sites', 'reports', 'email-reports'];

// Email Reports shares filters with Compliance so the emailed report matches what the user sees
const REPORT_FILTER_SOURCE = 'compliance';

// Route path -> tab value (sidebar nav drives content)
const PATH_TO_TAB = {
  '/': 'compliance',
  '/Dashboard': 'compliance',
  '/dashboard': 'compliance',
  '/usage-costs': 'costs',
  '/refills': 'refills',
  '/device-health': 'devices',
  '/sites': 'sites',
  '/reports': 'reports',
  '/email-reports': 'email-reports',
  '/branding': 'branding',
};

export default function Dashboard() {
  const location = useLocation();
  const permissions = usePermissions();
  const [isMobile, setIsMobile] = useState(false);
  // Active section derived from route (sidebar navigation)
  const activeTab = PATH_TO_TAB[location.pathname] ?? 'compliance';

  // Per-tab filter state - each tab has its own filters, no mixing
  const [tabFilters, setTabFilters] = useState(() => {
    const initial = {};
    FILTER_TABS.forEach(tab => {
      initial[tab] = getDefaultFilters();
    });
    return initial;
  });

  // Use database-driven tab visibility from permissions (for filter/access checks)
  const availableTabs = useAvailableTabs(ALL_TABS);
  const [searchQuery, setSearchQuery] = useState('');

  // Get tenant context (company_id) from user profile for query keys
  const companyId = permissions.userProfile?.company_id;

  // Filter tab used for data queries (Email Reports uses Compliance filters so report matches dashboard)
  const filterTabForData = activeTab === 'email-reports' ? REPORT_FILTER_SOURCE : activeTab;

  // Current tab's filters - used for queries and display (isolated per tab)
  const currentFilters = useMemo(() => {
    const base = tabFilters[filterTabForData] || getDefaultFilters();
    return { ...getDefaultFilters(), ...base };
  }, [tabFilters, filterTabForData]);

  const { selectedCustomer, selectedSite, dateRange, activePeriod } = currentFilters;

  // Update current tab's filter (Email Reports updates Compliance so report stays in sync)
  const updateTabFilter = useCallback((updates) => {
    setTabFilters(prev => {
      const tab = activeTab === 'email-reports' ? REPORT_FILTER_SOURCE : activeTab;
      const current = prev[tab] || getDefaultFilters();
      const next = { ...current, ...updates };
      if (updates.selectedCustomer && updates.selectedCustomer !== current.selectedCustomer) {
        next.selectedSite = 'all';
      }
      return { ...prev, [tab]: next };
    });
  }, [activeTab]);

  const setSelectedCustomer = useCallback((v) => updateTabFilter({ selectedCustomer: v }), [updateTabFilter]);
  const setSelectedSite = useCallback((v) => updateTabFilter({ selectedSite: v }), [updateTabFilter]);
  const setDateRange = useCallback((v) => updateTabFilter({ dateRange: v, activePeriod: 'Custom' }), [updateTabFilter]);
  const setActivePeriod = useCallback((period) => {
    const range = getDateRangeForPeriod(period);
    if (range) updateTabFilter({ activePeriod: period, dateRange: range });
  }, [updateTabFilter]);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // NEW: Use TanStack Query options with tenant-aware keys
  const { data: customers = [], isLoading: customersLoading, error: customersError } = useQuery(
    customersOptions(companyId)
  );

  const { data: rawSites = [], isLoading: sitesLoading, error: sitesError } = useQuery(
    sitesOptions(companyId)
  );

  // Fetch ALL vehicles with filters and placeholderData to prevent flashing
  const { data: allVehicles = [], isLoading: vehiclesLoading, isFetching: vehiclesFetching, error: vehiclesError } = useQuery({
    ...vehiclesOptions(companyId, {
      customerId: selectedCustomer !== 'all' ? selectedCustomer : undefined,
      siteId: selectedSite !== 'all' ? selectedSite : undefined,
    }),
    placeholderData: (previousData) => previousData, // Keep previous data while refetching
  });

  const { data: dashboardData, isLoading: dashboardLoading, isFetching: dashboardFetching, error: dashboardError } = useQuery({
    ...dashboardOptions(companyId, {
      customerId: selectedCustomer,
      siteId: selectedSite,
      startDate: dateRange.start,
      endDate: dateRange.end,
    }),
    placeholderData: (previousData) => previousData, // Keep previous data while refetching
  });

  // Fetch ALL refills (no date range limit) - includes past and future scheduled refills
  const { data: refills = [], isFetching: refillsFetching } = useQuery({
    ...refillsOptions(companyId, {
      customerRef: selectedCustomer !== 'all' ? selectedCustomer : undefined,
      siteRef: selectedSite !== 'all' ? selectedSite : undefined,
    }),
    placeholderData: (previousData) => previousData, // Keep previous data while refetching
  });

  // Show spinner when filters trigger refetch (only for tabs that use this data)
  const isFiltersFetching = (vehiclesFetching || dashboardFetching || refillsFetching) && FILTER_TABS.includes(activeTab);

  const processedData = useMemo(() => {
    // Start with ALL vehicles from vehicles API
    const vehicleMap = new Map();
    
    // First, add all vehicles from the vehicles API
    allVehicles.forEach(vehicle => {
      vehicleMap.set(vehicle.vehicleRef || vehicle.internalVehicleId, {
        id: vehicle.vehicleRef || vehicle.internalVehicleId,
        name: vehicle.vehicleName,
        rfid: vehicle.vehicleRfid,
        site_id: vehicle.siteId,
        site_name: vehicle.siteName,
        customer_name: vehicle.customerName,
        customer_ref: vehicle.customerId,
        washes_completed: 0, // Will be updated from dashboard data
        target: vehicle.washesPerWeek || 12,
        last_scan: vehicle.lastScanAt || null,
        status: vehicle.statusLabel,
      });
    });

    const scansArray = [];
    const startMoment = moment(dateRange.start);
    const endMoment = moment(dateRange.end);

    // Then, update wash counts from dashboard data (for the date range)
    if (dashboardData?.rows && Array.isArray(dashboardData.rows)) {
      dashboardData.rows.forEach(row => {
        const rowDate = moment(`${row.year}-${String(row.month).padStart(2, '0')}-01`);
        if (!rowDate.isBetween(startMoment, endMoment, 'month', '[]')) {
          return;
        }

        const vehicleKey = row.vehicleRef;

        if (vehicleMap.has(vehicleKey)) {
          const existing = vehicleMap.get(vehicleKey);
          existing.washes_completed += (row.totalScans || 0);
          if (row.lastScan && (!existing.last_scan || row.lastScan > existing.last_scan)) {
            existing.last_scan = row.lastScan;
          }
        } else {
          // Vehicle exists in dashboard but not in vehicles API (shouldn't happen, but handle it)
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
    }

    return {
      vehicles: Array.from(vehicleMap.values()),
      scans: scansArray
    };
  }, [allVehicles, dashboardData, dateRange]);

  const enrichedVehicles = processedData.vehicles;
  const scans = processedData.scans;

  // Apply role-based filtering FIRST to get what this user can access
  const { filteredVehicles: permissionFilteredVehicles, filteredSites: permissionFilteredSites } = useFilteredData(enrichedVehicles, rawSites, customers);

  // Customers limited by role (for auto-select and restricted UI); full list used for dropdown below
  const filteredCustomers = useMemo(() => {
    // Driver: derive customers from their vehicles when permissionFilteredSites is empty
    if (permissionFilteredSites.length === 0 && permissionFilteredVehicles?.length > 0) {
      const vehicleCustomerRefs = new Set(
        permissionFilteredVehicles.map(v => v.customer_ref).filter(Boolean)
      );
      const accessibleCustomers = customers.filter(c => vehicleCustomerRefs.has(c.id));
      return accessibleCustomers.length > 0 ? accessibleCustomers : customers;
    }

    // Get unique customer_refs from sites this user can access
    const accessibleCustomerRefs = new Set(
      permissionFilteredSites.map(site => site.customer_ref).filter(Boolean)
    );
    
    const accessibleCustomers = customers.filter(c => accessibleCustomerRefs.has(c.id));
    
    if (permissions.restrictedCustomer && accessibleCustomers.length > 0) {
      const restrictedCustomer = accessibleCustomers.find(c =>
        c.name && c.name.toUpperCase().includes(permissions.restrictedCustomer.toUpperCase())
      );
      return restrictedCustomer ? [restrictedCustomer] : accessibleCustomers;
    }
    
    return accessibleCustomers;
  }, [permissionFilteredSites, permissionFilteredVehicles, customers, permissions.restrictedCustomer]);

  // Customer dropdown: super_admin sees all customers; company users (any other role) see only their company's customer and cannot switch
  const customersForDropdown = useMemo(() => {
    if (permissions.isSuperAdmin) return customers;
    const ref = permissions.userProfile?.company_elora_customer_ref?.trim();
    if (!ref) return [];
    return customers.filter(c => (c.id || c.ref) === ref);
  }, [permissions.isSuperAdmin, permissions.userProfile?.company_elora_customer_ref, customers]);

  // Lock customer filter for all non-super-admins so they cannot switch to another company
  const lockCustomerFilter = permissions.lockCustomerFilter || !permissions.isSuperAdmin;
  const restrictedCustomerName = permissions.restrictedCustomer || (!permissions.isSuperAdmin && permissions.userProfile?.company_name) || null;

  // Auto-select and lock to company customer for non-super-admin (apply to all filter tabs)
  useEffect(() => {
    const companyRef = permissions.userProfile?.company_elora_customer_ref?.trim();
    if (permissions.isSuperAdmin || !companyRef) return;
    setTabFilters(prev => {
      let changed = false;
      const next = { ...prev };
      FILTER_TABS.forEach(tab => {
        const current = next[tab] || getDefaultFilters();
        if (current.selectedCustomer !== companyRef) {
          next[tab] = { ...current, selectedCustomer: companyRef, selectedSite: current.selectedSite || 'all' };
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [permissions.isSuperAdmin, permissions.userProfile?.company_elora_customer_ref]);

  // Auto-select site for batchers (apply to all filter tabs)
  useEffect(() => {
    if (permissions.isBatcher && permissionFilteredSites.length === 1) {
      const siteId = permissionFilteredSites[0].id;
      setTabFilters(prev => {
        const next = { ...prev };
        FILTER_TABS.forEach(tab => {
          next[tab] = { ...(next[tab] || getDefaultFilters()), selectedSite: siteId };
        });
        return next;
      });
    }
  }, [permissions.isBatcher, permissionFilteredSites]);

  // Auto-select customer for managers/batchers if they only have access to one
  useEffect(() => {
    if ((permissions.isManager || permissions.isBatcher) && filteredCustomers.length === 1 && selectedCustomer === 'all') {
      const customerId = filteredCustomers[0].id;
      setTabFilters(prev => {
        const next = { ...prev };
        const tab = activeTab === 'email-reports' ? REPORT_FILTER_SOURCE : activeTab;
        if (FILTER_TABS.includes(activeTab)) {
          next[tab] = { ...(next[tab] || getDefaultFilters()), selectedCustomer: customerId, selectedSite: 'all' };
        }
        return next;
      });
    }
  }, [permissions.isManager, permissions.isBatcher, filteredCustomers, selectedCustomer, activeTab]);

  // Filter sites by selected customer (from role-filtered sites)
  const allSites = useMemo(() => {
    // Driver: derive sites from their vehicles when permissionFilteredSites is empty
    if (permissionFilteredSites.length === 0 && permissionFilteredVehicles?.length > 0) {
      const vehicleSiteIds = new Set(
        permissionFilteredVehicles.map(v => v.site_id).filter(Boolean)
      );
      const driverSites = rawSites.filter(s => vehicleSiteIds.has(s.id));
      if (selectedCustomer === 'all' || !selectedCustomer) return driverSites;
      return driverSites.filter(site => site.id === selectedCustomer || site.customer_ref === selectedCustomer);
    }
    if (selectedCustomer === 'all' || !selectedCustomer) return permissionFilteredSites;
    return permissionFilteredSites.filter(site => site.id === selectedCustomer || site.customer_ref === selectedCustomer);
  }, [permissionFilteredSites, permissionFilteredVehicles, rawSites, selectedCustomer]);

  // Apply customer and site filters to vehicles (client-side filtering)
  const filteredVehicles = useMemo(() => {
    let result = permissionFilteredVehicles || [];

    // Use allSites for filter logic (handles Driver case where allSites is derived from vehicles)
    const sitesForFilter = allSites.length > 0 ? allSites : permissionFilteredSites;

    // Filter by customer (via site's customer_ref)
    if (selectedCustomer && selectedCustomer !== 'all' && sitesForFilter.length > 0) {
      const customerSiteIds = sitesForFilter
        .filter(s => s.customer_ref === selectedCustomer || s.id === selectedCustomer)
        .map(s => s.id);
      result = result.filter(v => customerSiteIds.includes(v.site_id));
    }

    // Filter by site
    if (selectedSite && selectedSite !== 'all') {
      result = result.filter(v => v.site_id === selectedSite);
    }

    return result;
  }, [permissionFilteredVehicles, selectedCustomer, selectedSite, permissionFilteredSites, allSites]);

  // Apply customer and site filters to scans for consistent chart/analytics data
  const filteredScans = useMemo(() => {
    let result = scans || [];

    // Driver: filter by vehicle (permissionFilteredSites is empty; use filteredVehicles so customer/site filters apply)
    if (permissionFilteredSites.length === 0 && filteredVehicles?.length > 0) {
      const accessibleVehicleRefs = new Set(
        filteredVehicles.map(v => v.id || v.rfid).filter(Boolean)
      );
      result = result.filter(s => accessibleVehicleRefs.has(s.vehicleRef));
    } else if (permissionFilteredSites.length > 0) {
      // Other roles: filter by role-accessible sites
      const accessibleSiteIds = permissionFilteredSites.map(s => s.id);
      result = result.filter(s => accessibleSiteIds.includes(s.siteRef));

      if (selectedCustomer && selectedCustomer !== 'all') {
        const customerSiteIds = permissionFilteredSites
          .filter(s => s.customer_ref === selectedCustomer)
          .map(s => s.id);
        result = result.filter(s => customerSiteIds.includes(s.siteRef));
      }

      if (selectedSite && selectedSite !== 'all') {
        result = result.filter(s => s.siteRef === selectedSite);
      }
    }

    return result;
  }, [scans, selectedCustomer, selectedSite, permissionFilteredSites, filteredVehicles]);

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

  // Only block full-page spinner on permissions + customers + sites (needed for shell).
  // Vehicles and dashboard load in background so the page appears sooner.
  const isLoading = permissions.isLoading || customersLoading || sitesLoading;
  const hasError = customersError || sitesError || vehiclesError || dashboardError;
  const isDataLoading = vehiclesLoading || dashboardLoading;

  // Must be called unconditionally (before any early return) to satisfy Rules of Hooks
  const userEmail = permissions.user?.email;
  const vehicleColumns = useMemo(
    () => [
      {
        id: 'favorite',
        header: '',
        cell: (row) => (
          <FavoriteButton
            vehicleRef={row.id ?? row.rfid}
            vehicleName={row.name}
            userEmail={userEmail}
            className="shrink-0"
          />
        ),
      },
      { id: 'name', header: 'Vehicle', accessorKey: 'name' },
      { id: 'rfid', header: 'RFID', accessorKey: 'rfid' },
      { id: 'site_name', header: 'Site', accessorKey: 'site_name' },
      { id: 'washes_completed', header: 'Washes', accessorKey: 'washes_completed' },
      { id: 'target', header: 'Target', accessorKey: 'target' },
      {
        id: 'status',
        header: 'Status',
        cell: (row) =>
          row.washes_completed >= row.target ? 'Compliant' : 'Non-Compliant',
      },
      {
        id: 'progress',
        header: 'Progress',
        cell: (row) =>
          row.target
            ? `${Math.round((row.washes_completed / row.target) * 100)}%`
            : '—',
      },
      {
        id: 'last_scan',
        header: 'Last Scan',
        cell: (row) => (row.last_scan ? moment(row.last_scan).fromNow() : '—'),
      },
    ],
    [userEmail]
  );

  if (isMobile && permissions.isDriver) {
    return <MobileDashboard />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/40 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </motion.div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="min-h-screen bg-muted/40 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md mx-auto p-8"
        >
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Failed to Load Dashboard
          </h2>
          <p className="text-muted-foreground mb-6">
            We couldn't load the dashboard data. Please try again.
          </p>
          <Button
            onClick={() => window.location.reload()}
            className="rounded-md"
          >
            Refresh Page
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <main className="flex-1 p-4 md:p-6 space-y-6">
        {/* Filters */}
        <div>
          <FilterSection
            customers={customersForDropdown}
            sites={allSites}
            selectedCustomer={selectedCustomer}
            setSelectedCustomer={setSelectedCustomer}
            selectedSite={selectedSite}
            setSelectedSite={setSelectedSite}
            dateRange={dateRange}
            setDateRange={setDateRange}
            activePeriod={activePeriod}
            setActivePeriod={setActivePeriod}
            lockCustomerFilter={lockCustomerFilter}
            lockSiteFilter={permissions.isBatcher}
            restrictedCustomerName={restrictedCustomerName}
            restrictedSiteName={permissions.isBatcher && allSites.length === 1 ? allSites[0].name : null}
            isFiltering={isFiltersFetching}
            isDataLoading={isDataLoading}
          />
        </div>

        {/* Stats cards (dashboard-01 SectionCards) */}
        <SectionCards stats={stats} />

        {/* Favorite Vehicles - Full Width */}
        <div className="mb-8">
          <FavoriteVehicles
            vehicles={filteredVehicles}
            selectedCustomer={selectedCustomer}
            selectedSite={selectedSite}
            userEmail={permissions.user?.email}
          />
        </div>

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
                  <div className="w-12 h-12 rounded-full bg-primary-foreground/20 flex items-center justify-center">
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

        {/* Content by route (sidebar-driven) */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'compliance' && (
              <div className="space-y-6">
                <DataTable
                  columns={vehicleColumns}
                  data={filteredVehicles}
                  getRowId={(row) => row.id ?? row.rfid ?? ''}
                  searchPlaceholder="Search vehicles..."
                  title="Vehicle compliance"
                />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ChartAreaInteractive data={washTrendsData} />
                  <VehiclePerformanceChart vehicles={filteredVehicles} />
                </div>
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
                dateRange={dateRange}
              />
            )}

            {activeTab === 'devices' && (
              <DeviceHealth
                selectedCustomer={selectedCustomer}
                selectedSite={selectedSite}
              />
            )}

            {activeTab === 'sites' && (
              <SiteManagement 
                customers={customers} 
                vehicles={enrichedVehicles}
                selectedCustomer={selectedCustomer}
              />
            )}

            {activeTab === 'reports' && (
              <ReportsDashboard 
                vehicles={filteredVehicles} 
                scans={filteredScans}
                dateRange={dateRange}
                selectedSite={selectedSite}
              />
            )}

            {activeTab === 'email-reports' && (
              <EmailReportSettings
                reportData={{
                  stats,
                  dateRange,
                  filteredVehicles,
                  selectedCustomer,
                  selectedSite
                }}
                onSetDateRange={(range) => updateTabFilter({ dateRange: range, activePeriod: 'Custom' })}
                isReportDataUpdating={isDataLoading || isFiltersFetching}
              />
            )}

            {activeTab === 'branding' && (
              <BrandingManagement />
            )}

          </motion.div>
        </AnimatePresence>

      </main>

      {/* Onboarding Wizard */}
      <OnboardingWizard
        userEmail={permissions.user?.email}
        userName="Rebekah Sharp"
        companyName="Heidelberg Materials"
      />
    </div>
  );
}
