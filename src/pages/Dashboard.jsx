import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useLocation } from 'react-router-dom';
import { Loader2, Trophy, ChevronRight, AlertTriangle, Download, Check, X } from 'lucide-react';
import VehicleLikelihoodCell from '@/components/dashboard/VehicleLikelihoodCell';
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
  vehicleLikelihoodOverridesOptions,
} from '@/query/options';
import { useSetVehicleLikelihood } from '@/query/mutations';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import SectionCards from '@/components/SectionCards';
import ChartAreaInteractive from '@/components/ChartAreaInteractive';
import DataTable from '@/components/DataTable';
import FilterSection from '@/components/dashboard/FilterSection';
import FavoriteVehicles, { FavoriteButton } from '@/components/dashboard/FavoriteVehicles';
import VehiclePerformanceChart from '@/components/dashboard/VehiclePerformanceChart';
import VehicleWashHistoryModal from '@/components/dashboard/VehicleWashHistoryModal';
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
  { value: 'refills', label: 'Tank Levels' },
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

/**
 * On-track status for day / week / month. Based on time elapsed in period and washes completed.
 * Returns { day: 'on_track'|'off_track'|null, week: ..., month: ... } (null = not applicable).
 */
function getOnTrackStatus(vehicle, dateRange, activePeriod) {
  const now = moment();
  const start = moment(dateRange.start);
  const end = moment(dateRange.end);
  const washes = vehicle.washes_completed ?? 0;
  const washesPerWeek = vehicle.washesPerWeek ?? vehicle.target ?? 12;
  const washesPerDay = vehicle.washesPerDay;
  const monthlyTarget = washesPerWeek * 4;
  const periodEnded = now.isAfter(end);

  const result = { day: null, week: null, month: null };

  // Day: only when we have daily target and period is Today (single day)
  if (washesPerDay != null && activePeriod === 'Today' && start.isSame(end, 'day') && start.isSame(now, 'day')) {
    const fractionOfDay = (now.hours() * 60 + now.minute()) / (24 * 60);
    const required = washesPerDay * fractionOfDay;
    result.day = washes >= required ? 'on_track' : 'off_track';
  }

  // Week: when period is Week (or range is ~7 days)
  if (activePeriod === 'Week' || (end.diff(start, 'days') <= 8 && start.isSame(now, 'week'))) {
    const totalDays = Math.max(1, end.diff(start, 'days') + 1);
    const required = periodEnded ? washesPerWeek : washesPerWeek * (Math.min(totalDays, Math.max(0, now.diff(start, 'days') + 1)) / 7);
    result.week = washes >= required ? 'on_track' : 'off_track';
  }

  // Month: when period is Month (or range is current month)
  if (activePeriod === 'Month' || start.isSame(end, 'month')) {
    const daysInPeriod = Math.max(1, end.diff(start, 'days') + 1);
    const elapsedDays = periodEnded ? daysInPeriod : Math.min(daysInPeriod, Math.max(0, now.diff(start, 'days') + 1));
    const required = monthlyTarget * (elapsedDays / daysInPeriod);
    result.month = washes >= required ? 'on_track' : 'off_track';
  }

  return result;
}

// Tabs that use filters (customer, site, date) - shared across all tabs
const FILTER_TABS = ['compliance', 'costs', 'refills', 'devices', 'sites', 'reports', 'email-reports'];

// Email Reports uses the same shared filters as other tabs
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

  // Single shared filter state - same customer, site, and date range across all navigation tabs
  const [sharedFilters, setSharedFilters] = useState(getDefaultFilters);
  const { selectedCustomer, selectedSite, dateRange, activePeriod } = sharedFilters;

  // Use database-driven tab visibility from permissions (for filter/access checks)
  const availableTabs = useAvailableTabs(ALL_TABS);
  const [searchQuery, setSearchQuery] = useState('');
  const [complianceStatusFilter, setComplianceStatusFilter] = useState('all');
  const [complianceSiteFilter, setComplianceSiteFilter] = useState('all');
  const [selectedVehicleForWashHistory, setSelectedVehicleForWashHistory] = useState(null);

  // Get tenant context (company_id) from user profile for query keys
  const companyId = permissions.userProfile?.company_id;

  // For super_admin viewing a specific customer, resolve company_id from elora_customer_ref
  const { data: companyForCustomer } = useQuery({
    queryKey: ['companyForEloraCustomer', selectedCustomer],
    queryFn: async () => {
      if (!selectedCustomer || selectedCustomer === 'all') return null;
      const { data } = await supabase
        .from('companies')
        .select('id')
        .eq('elora_customer_ref', selectedCustomer)
        .single();
      return data?.id ?? null;
    },
    enabled: !companyId && !!selectedCustomer && selectedCustomer !== 'all' && !!permissions.isSuperAdmin,
  });

  const effectiveCompanyIdForLikelihood = companyId ?? companyForCustomer ?? null;

  const { data: likelihoodOverrides = {} } = useQuery(
    vehicleLikelihoodOverridesOptions(effectiveCompanyIdForLikelihood)
  );

  const setLikelihoodMutation = useSetVehicleLikelihood(effectiveCompanyIdForLikelihood);

  // Update shared filters (applies to all tabs)
  const updateSharedFilter = useCallback((updates) => {
    setSharedFilters(prev => {
      const next = { ...prev, ...updates };
      if (updates.selectedCustomer != null && updates.selectedCustomer !== prev.selectedCustomer) {
        next.selectedSite = 'all';
      }
      return next;
    });
  }, []);

  const setSelectedCustomer = useCallback((v) => updateSharedFilter({ selectedCustomer: v }), [updateSharedFilter]);
  const setSelectedSite = useCallback((v) => updateSharedFilter({ selectedSite: v }), [updateSharedFilter]);
  const setDateRange = useCallback((v) => updateSharedFilter({ dateRange: v, activePeriod: 'Custom' }), [updateSharedFilter]);
  const setActivePeriod = useCallback((period) => {
    const range = getDateRangeForPeriod(period);
    if (range) updateSharedFilter({ activePeriod: period, dateRange: range });
  }, [updateSharedFilter]);

  const resetDateRangeToDefault = useCallback(() => {
    setSharedFilters(prev => ({
      ...prev,
      dateRange: getDefaultFilters().dateRange,
      activePeriod: getDefaultFilters().activePeriod,
    }));
  }, []);

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
  const { data: allVehicles = [], isLoading: vehiclesLoading, isFetching: vehiclesFetching, dataUpdatedAt: vehiclesUpdatedAt, error: vehiclesError } = useQuery({
    ...vehiclesOptions(companyId, {
      customerId: selectedCustomer !== 'all' ? selectedCustomer : undefined,
      siteId: selectedSite !== 'all' ? selectedSite : undefined,
    }),
    placeholderData: (previousData) => previousData, // Keep previous data while refetching
  });

  const { data: dashboardData, isLoading: dashboardLoading, isFetching: dashboardFetching, dataUpdatedAt: dashboardUpdatedAt, error: dashboardError } = useQuery({
    ...dashboardOptions(companyId, {
      customerId: selectedCustomer,
      siteId: selectedSite,
      startDate: dateRange.start,
      endDate: dateRange.end,
    }),
    placeholderData: (previousData) => previousData, // Keep previous data while refetching
  });

  // Extended dashboard fetch (last 90 days) for Wash Frequency chart so period filter (7d–90d) has data
  const washChartEnd = moment(dateRange.end);
  const washChartStart = moment(dateRange.end).subtract(89, 'days');
  const { data: washChartDashboardData } = useQuery({
    ...dashboardOptions(companyId, {
      customerId: selectedCustomer,
      siteId: selectedSite,
      startDate: washChartStart.format('YYYY-MM-DD'),
      endDate: washChartEnd.format('YYYY-MM-DD'),
    }),
    placeholderData: (previousData) => previousData,
    enabled: FILTER_TABS.includes(activeTab),
  });

  // Fetch ALL refills (no date range limit) - includes past and future scheduled refills
  const { data: refills = [], isFetching: refillsFetching, dataUpdatedAt: refillsUpdatedAt } = useQuery({
    ...refillsOptions(companyId, {
      customerRef: selectedCustomer !== 'all' ? selectedCustomer : undefined,
      siteRef: selectedSite !== 'all' ? selectedSite : undefined,
    }),
    placeholderData: (previousData) => previousData, // Keep previous data while refetching
  });

  // Show spinner when filters trigger refetch (only for tabs that use this data)
  const isFiltersFetching = (vehiclesFetching || dashboardFetching || refillsFetching) && FILTER_TABS.includes(activeTab);

  // Last sync timestamp for signal indicator (max of relevant query updates)
  const lastSyncedAt = Math.max(vehiclesUpdatedAt ?? 0, dashboardUpdatedAt ?? 0, refillsUpdatedAt ?? 0) || null;

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
        washesPerDay: vehicle.washesPerDay ?? null,
        washesPerWeek: vehicle.washesPerWeek ?? 12,
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
            washesPerDay: row.washesPerDay ?? null,
            washesPerWeek: row.washesPerWeek ?? 12,
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

  // Auto-select and lock to company customer for non-super-admin
  useEffect(() => {
    const companyRef = permissions.userProfile?.company_elora_customer_ref?.trim();
    if (permissions.isSuperAdmin || !companyRef) return;
    setSharedFilters(prev => {
      if (prev.selectedCustomer === companyRef) return prev;
      return { ...prev, selectedCustomer: companyRef, selectedSite: prev.selectedSite || 'all' };
    });
  }, [permissions.isSuperAdmin, permissions.userProfile?.company_elora_customer_ref]);

  // Auto-select site for batchers
  useEffect(() => {
    if (permissions.isBatcher && permissionFilteredSites.length === 1) {
      const siteId = permissionFilteredSites[0].id;
      setSharedFilters(prev => ({ ...prev, selectedSite: siteId }));
    }
  }, [permissions.isBatcher, permissionFilteredSites]);

  // Auto-select customer for managers/batchers if they only have access to one
  useEffect(() => {
    if ((permissions.isManager || permissions.isBatcher) && filteredCustomers.length === 1 && selectedCustomer === 'all') {
      const customerId = filteredCustomers[0].id;
      setSharedFilters(prev => ({ ...prev, selectedCustomer: customerId, selectedSite: 'all' }));
    }
  }, [permissions.isManager, permissions.isBatcher, filteredCustomers, selectedCustomer]);

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

  // Scans from extended 90-day dashboard for Wash Frequency chart (so 7d–90d period filter has data)
  const washChartScans = useMemo(() => {
    const raw = [];
    if (washChartDashboardData?.rows && Array.isArray(washChartDashboardData.rows)) {
      washChartDashboardData.rows.forEach(row => {
        if (row.totalScans > 0 && row.lastScan) {
          raw.push({
            vehicleRef: row.vehicleRef,
            siteRef: row.siteRef,
            siteName: row.siteName,
            timestamp: row.lastScan,
          });
        }
      });
    }
    let result = raw;
    if (permissionFilteredSites.length === 0 && filteredVehicles?.length > 0) {
      const accessibleVehicleRefs = new Set(
        filteredVehicles.map(v => v.id || v.rfid).filter(Boolean)
      );
      result = result.filter(s => accessibleVehicleRefs.has(s.vehicleRef));
    } else if (permissionFilteredSites.length > 0) {
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
  }, [washChartDashboardData, selectedCustomer, selectedSite, permissionFilteredSites, filteredVehicles]);

  const washTrendsData = useMemo(() => {
    // Use extended 90-day scans when available so chart period filter (7d–90d) shows correct x-axis range
    const scansToUse = washChartScans?.length > 0 ? washChartScans : filteredScans;
    const chartStart = washChartScans?.length > 0
      ? moment(dateRange.end).subtract(89, 'days')
      : moment(dateRange.start);
    const chartEnd = moment(dateRange.end);
    const maxDays = washChartScans?.length > 0 ? 90 : Math.min(chartEnd.diff(chartStart, 'days') + 1, 90);

    if (scansToUse && Array.isArray(scansToUse) && scansToUse.length > 0) {
      const scansByDate = {};
      scansToUse.forEach(scan => {
        const date = moment(scan.timestamp).format('MMM D');
        scansByDate[date] = (scansByDate[date] || 0) + 1;
      });

      const days = [];
      const diff = chartEnd.diff(chartStart, 'days');
      for (let i = 0; i <= Math.min(diff, maxDays - 1); i++) {
        const date = moment(chartStart).add(i, 'days');
        const dateKey = date.format('MMM D');
        days.push({
          date: dateKey,
          washes: scansByDate[dateKey] || 0,
        });
      }
      return days;
    }

    // Fallback to monthly data when no scan data
    if (!dashboardData?.charts?.totalWashesByMonth?.length) return [];

    const start = moment(dateRange.start);
    const end = moment(dateRange.end);
    return dashboardData.charts.totalWashesByMonth
      .filter(item => {
        const monthDate = moment({ year: item.year, month: (item.month || 1) - 1, date: 1 });
        return !monthDate.isBefore(start, 'month') && !monthDate.isAfter(end, 'month');
      })
      .map(item => ({
        date: `${item.month}/${item.year}`,
        washes: item.totalWashes || 0
      }));
  }, [dashboardData, filteredScans, washChartScans, dateRange]);

  const stats = useMemo(() => {
    const vehicles = Array.isArray(filteredVehicles) ? filteredVehicles : [];
    const targetDefault = 12;
    const onTrackCount = vehicles.filter(v => v && (v.washes_completed ?? 0) >= (v.target ?? targetDefault)).length;
    const criticalCount = vehicles.filter(v => v && (v.washes_completed ?? 0) === 0).length;
    const atRiskCount = vehicles.length - onTrackCount - criticalCount;
    const totalWashes = vehicles.reduce((sum, v) => sum + (v?.washes_completed || 0), 0);
    const activeDriversCount = vehicles.filter(v => v && v.washes_completed > 0).length;

    const total = vehicles.length;
    return {
      totalVehicles: total,
      complianceRate: total > 0 ? Math.round((onTrackCount / total) * 100) : 0,
      monthlyWashes: totalWashes,
      activeDrivers: activeDriversCount,
      complianceLikelihood: total > 0 ? {
        onTrackPct: Math.round((onTrackCount / total) * 100),
        atRiskPct: Math.round((atRiskCount / total) * 100),
        criticalPct: Math.round((criticalCount / total) * 100),
      } : { onTrackPct: 0, atRiskPct: 0, criticalPct: 0 },
    };
  }, [filteredVehicles]);

  // Unique sites for compliance table site filter (from current filtered vehicles)
  const complianceTableSites = useMemo(() => {
    const list = Array.isArray(filteredVehicles) ? filteredVehicles : [];
    const byKey = new Map();
    list.forEach((v) => {
      const id = v.site_id ?? v.site_name;
      const name = v.site_name || '—';
      if (id != null && id !== '' && !byKey.has(String(id))) byKey.set(String(id), { id: String(id), name });
    });
    return Array.from(byKey.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredVehicles]);

  // Compliance table: filter by site then by status
  const complianceFilteredVehicles = useMemo(() => {
    let list = Array.isArray(filteredVehicles) ? filteredVehicles : [];
    if (complianceSiteFilter !== 'all') {
      list = list.filter(
        (v) =>
          String(v.site_id ?? v.site_name) === String(complianceSiteFilter) ||
          String(v.site_name) === String(complianceSiteFilter)
      );
    }
    if (complianceStatusFilter === 'all') return list;
    const targetDefault = 12;
    if (complianceStatusFilter === 'compliant') {
      return list.filter((v) => (v.washes_completed ?? 0) >= (v.target ?? targetDefault));
    }
    if (complianceStatusFilter === 'non-compliant') {
      return list.filter((v) => (v.washes_completed ?? 0) < (v.target ?? targetDefault));
    }
    return list;
  }, [filteredVehicles, complianceStatusFilter, complianceSiteFilter]);

  const handleLikelihoodOverride = useCallback(
    (vehicleRef, value) => {
      if (!effectiveCompanyIdForLikelihood) return;
      setLikelihoodMutation.mutate({
        vehicleRef,
        likelihood: value,
        userEmail: permissions.user?.email,
      });
    },
    [effectiveCompanyIdForLikelihood, setLikelihoodMutation, permissions.user?.email]
  );

  const exportComplianceCSV = useCallback(() => {
    const reportData = complianceFilteredVehicles.map((v) => ({
      Vehicle: v.name ?? '—',
      RFID: v.rfid ?? '—',
      Site: v.site_name ?? '—',
      Washes: v.washes_completed ?? 0,
      Target: v.target ?? '—',
      Status: (v.washes_completed ?? 0) >= (v.target ?? 12) ? 'Compliant' : 'Non-Compliant',
      'Progress %': v.target ? Math.round(((v.washes_completed ?? 0) / v.target) * 100) : '—',
      'Last Scan': v.last_scan ? moment(v.last_scan).format('YYYY-MM-DD HH:mm') : '—',
    }));
    const headers = Object.keys(reportData[0] || {});
    const rows = reportData.map((row) => headers.map((h) => String(row[h] ?? '')).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vehicle-compliance-${moment().format('YYYY-MM-DD')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }, [complianceFilteredVehicles]);

  // Only block full-page spinner on permissions + customers + sites (needed for shell).
  // Vehicles and dashboard load in background so the page appears sooner.
  const isLoading = permissions.isLoading || customersLoading || sitesLoading;
  const hasError = customersError || sitesError || vehiclesError || dashboardError;
  const isDataLoading = vehiclesLoading || dashboardLoading;

  // Must be called unconditionally (before any early return) to satisfy Rules of Hooks
  const userEmail = permissions.user?.email;
  const vehicleColumns = useMemo(() => {
    const base = [
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
      ...(permissions.isAdmin ? [] : [{ id: 'rfid', header: 'RFID', accessorKey: 'rfid' }]),
      { id: 'site_name', header: 'Site', accessorKey: 'site_name' },
      { id: 'washes_completed', header: 'Washes', accessorKey: 'washes_completed' },
      { id: 'target', header: 'Target', accessorKey: 'target' },
      {
        id: 'status',
        header: 'Status',
        cell: (row) => {
          const target = row.target ?? 12;
          const isCompliant = (row.washes_completed ?? 0) >= target;
          return (
            <Badge className={isCompliant ? 'bg-primary' : 'bg-red-500 hover:bg-red-600'}>
              {isCompliant ? 'Compliant' : 'Non-Compliant'}
            </Badge>
          );
        },
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
        id: 'likelihood',
        header: 'Likelihood',
        cell: (row) => (
          <VehicleLikelihoodCell
            row={row}
            override={likelihoodOverrides[row.id ?? row.rfid]}
            onOverride={handleLikelihoodOverride}
            canEdit={!!effectiveCompanyIdForLikelihood}
          />
        ),
      },
      {
        id: 'on_track_day',
        header: <span className="cursor-help underline decoration-dotted decoration-muted-foreground/50" title="Meets today's wash target — ✓ on track, ✗ off track, — not applicable">Day</span>,
        cell: (row) => {
          const status = getOnTrackStatus(row, dateRange, activePeriod).day;
          if (status == null) return <span className="text-muted-foreground" title="Not applicable for this period">—</span>;
          return status === 'on_track' ? (
            <span className="inline-flex items-center text-green-600" title="On track for today"><Check className="w-4 h-4" /></span>
          ) : (
            <span className="inline-flex items-center text-destructive" title="Off track for today"><X className="w-4 h-4" /></span>
          );
        },
      },
      {
        id: 'on_track_week',
        header: <span className="cursor-help underline decoration-dotted decoration-muted-foreground/50" title="Meets weekly wash target — ✓ on track, ✗ off track, — not applicable">Week</span>,
        cell: (row) => {
          const status = getOnTrackStatus(row, dateRange, activePeriod).week;
          if (status == null) return <span className="text-muted-foreground" title="Not applicable for this period">—</span>;
          return status === 'on_track' ? (
            <span className="inline-flex items-center text-green-600" title="On track for week"><Check className="w-4 h-4" /></span>
          ) : (
            <span className="inline-flex items-center text-destructive" title="Off track for week"><X className="w-4 h-4" /></span>
          );
        },
      },
      {
        id: 'on_track_month',
        header: <span className="cursor-help underline decoration-dotted decoration-muted-foreground/50" title="Meets monthly wash target — ✓ on track, ✗ off track, — not applicable">Month</span>,
        cell: (row) => {
          const status = getOnTrackStatus(row, dateRange, activePeriod).month;
          if (status == null) return <span className="text-muted-foreground" title="Not applicable for this period">—</span>;
          return status === 'on_track' ? (
            <span className="inline-flex items-center text-green-600" title="On track for month"><Check className="w-4 h-4" /></span>
          ) : (
            <span className="inline-flex items-center text-destructive" title="Off track for month"><X className="w-4 h-4" /></span>
          );
        },
      },
      {
        id: 'last_scan',
        header: 'Last Scan',
        cell: (row) => (row.last_scan ? moment(row.last_scan).fromNow() : '—'),
      },
    ];
    return base;
  }, [userEmail, dateRange, activePeriod, likelihoodOverrides, handleLikelihoodOverride, effectiveCompanyIdForLikelihood, permissions.isAdmin]);


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
            companyName={permissions.userProfile?.company_name ?? null}
            companyLogoUrl={permissions.userProfile?.company_logo_url ?? null}
            onResetDateRange={resetDateRangeToDefault}
            lockCustomerFilter={lockCustomerFilter}
            lockSiteFilter={permissions.isBatcher}
            restrictedCustomerName={restrictedCustomerName}
            restrictedSiteName={permissions.isBatcher && allSites.length === 1 ? allSites[0].name : null}
            isFiltering={isFiltersFetching}
            isDataLoading={isDataLoading}
            lastSyncedAt={lastSyncedAt}
          />
        </div>

        {/* Stats cards (dashboard-01 SectionCards) */}
        <SectionCards stats={stats} dateRange={dateRange} />

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
                {/* Vehicle Compliance Table - immediately after KPI cards */}
                <DataTable
                  columns={vehicleColumns}
                  data={complianceFilteredVehicles}
                  getRowId={(row) => row.id ?? row.rfid ?? ''}
                  onRowClick={(row) => setSelectedVehicleForWashHistory(row)}
                  searchPlaceholder="Search by vehicle, RFID, or site..."
                  title="Vehicle compliance"
                  disablePagination={complianceSiteFilter !== 'all'}
                  footerMessage={
                    complianceSiteFilter !== 'all'
                      ? (() => {
                          const site = complianceTableSites.find((s) => String(s.id) === String(complianceSiteFilter));
                          const siteName = site?.name ?? 'selected site';
                          return `Showing ${complianceFilteredVehicles.length} vehicle${complianceFilteredVehicles.length !== 1 ? 's' : ''} for ${siteName}`;
                        })()
                      : undefined
                  }
                  headerExtra={
                    <>
                      <Select value={complianceStatusFilter} onValueChange={setComplianceStatusFilter}>
                        <SelectTrigger className="w-[160px] h-9">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          <SelectItem value="compliant">Compliant</SelectItem>
                          <SelectItem value="non-compliant">Non-Compliant</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={complianceSiteFilter} onValueChange={setComplianceSiteFilter}>
                        <SelectTrigger className="w-[160px] h-9">
                          <SelectValue placeholder="Site" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Sites</SelectItem>
                          {complianceTableSites.map((site) => (
                            <SelectItem key={site.id} value={site.id}>
                              {site.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="outline" size="sm" className="h-9 gap-2" onClick={exportComplianceCSV}>
                        <Download className="h-4 w-4" />
                        Export CSV
                      </Button>
                    </>
                  }
                />
                {/* Vehicle Performance Chart + Wash Frequency Chart */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ChartAreaInteractive data={washTrendsData} />
                  <VehiclePerformanceChart vehicles={filteredVehicles} />
                </div>
                {/* Favorite Vehicles - moved to bottom */}
                <div>
                  <FavoriteVehicles
                    vehicles={filteredVehicles}
                    selectedCustomer={selectedCustomer}
                    selectedSite={selectedSite}
                    userEmail={permissions.user?.email}
                  />
                </div>
                {/* Driver Leaderboard - moved to very bottom */}
                {!permissions.hideLeaderboard && (
                  <Link to={`${createPageUrl('Leaderboard')}?customer=${selectedCustomer}&site=${selectedSite}`}>
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className="
                        backdrop-blur-xl bg-gradient-to-r from-purple-600 to-blue-600
                        rounded-2xl p-6
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

                <VehicleWashHistoryModal
                  vehicle={selectedVehicleForWashHistory}
                  dateRange={dateRange}
                  selectedCustomer={selectedCustomer}
                  selectedSite={selectedSite}
                  companyId={companyId}
                  open={!!selectedVehicleForWashHistory}
                  onClose={() => setSelectedVehicleForWashHistory(null)}
                />
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
                onSetDateRange={(range) => updateSharedFilter({ dateRange: range, activePeriod: 'Custom' })}
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
