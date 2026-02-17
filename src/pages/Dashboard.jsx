import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, Trophy, ChevronRight, AlertTriangle, Download } from 'lucide-react';
import VehicleLikelihoodCell, { getDefaultLikelihood } from '@/components/dashboard/VehicleLikelihoodCell';
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
import DashboardHomeExecutive from '@/components/dashboard/DashboardHomeExecutive';
import DashboardHero from '@/components/dashboard/DashboardHero';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePermissions, useFilteredData, useAvailableTabs } from '@/components/auth/PermissionGuard';

// Tabs for sidebar; intelligence tabs used for quick-link visibility
const INTELLIGENCE_TABS = [
  { value: 'ai-insights', label: 'Elora AI' },
  { value: 'sms-alerts', label: 'SMS Alerts' },
];

// All available tabs (maintenance removed)
const ALL_TABS = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'costs', label: 'Usage Costs' },
  { value: 'refills', label: 'Tank Levels' },
  { value: 'devices', label: 'Device Health' },
  { value: 'sites', label: 'Sites' },
  { value: 'reports', label: 'Reports' },
  { value: 'email-reports', label: 'Email Reports' },
  { value: 'branding', label: 'Branding' }
];

const FILTER_STORAGE_KEY = 'elora-dashboard-filters';

// Default filter values - each tab gets its own copy, no mixing
const getDefaultFilters = () => ({
  selectedCustomer: 'all',
  selectedSite: 'all',
  selectedDriverIds: [],
  dateRange: {
    start: moment().startOf('month').format('YYYY-MM-DD'),
    end: moment().format('YYYY-MM-DD')
  },
  activePeriod: 'Month'
});

function getInitialFilters() {
  try {
    const raw = typeof sessionStorage !== 'undefined' && sessionStorage.getItem(FILTER_STORAGE_KEY);
    if (!raw) return getDefaultFilters();
    const parsed = JSON.parse(raw);
    const defaults = getDefaultFilters();
    return {
      selectedCustomer: parsed.selectedCustomer ?? defaults.selectedCustomer,
      selectedSite: parsed.selectedSite ?? defaults.selectedSite,
      selectedDriverIds: Array.isArray(parsed.selectedDriverIds) ? parsed.selectedDriverIds : defaults.selectedDriverIds,
      dateRange: parsed.dateRange && typeof parsed.dateRange === 'object' && parsed.dateRange.start && parsed.dateRange.end
        ? { start: parsed.dateRange.start, end: parsed.dateRange.end }
        : defaults.dateRange,
      activePeriod: parsed.activePeriod ?? defaults.activePeriod,
    };
  } catch {
    return getDefaultFilters();
  }
}

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
 * On-track status for day / week / month. Compares washes_completed (in selected period) to
 * prorated target for that timeframe. Returns { day, week, month } = 'on_track'|'off_track'|null.
 * Derives which columns to show from the actual date range (not just activePeriod).
 */
function getOnTrackStatus(vehicle, dateRange, activePeriod) {
  const result = { day: null, week: null, month: null };
  if (!dateRange || dateRange.start == null || dateRange.end == null) return result;

  const now = moment();
  const start = moment(dateRange.start);
  const end = moment(dateRange.end);
  if (!start.isValid() || !end.isValid()) return result;

  const washes = vehicle.washes_completed ?? 0;
  const washesPerWeek = vehicle.washesPerWeek ?? vehicle.target ?? 12;
  const washesPerDay = vehicle.washesPerDay;
  const periodEnded = now.isAfter(end);
  const totalDays = Math.max(1, end.diff(start, 'days') + 1);

  // Day: single-day range that is today, and vehicle has a daily target
  const isSingleDay = start.isSame(end, 'day');
  const isToday = start.isSame(now, 'day');
  if (washesPerDay != null && isSingleDay && isToday) {
    const fractionOfDay = (now.hours() * 60 + now.minute()) / (24 * 60);
    const required = washesPerDay * fractionOfDay;
    result.day = washes >= required ? 'on_track' : 'off_track';
  }

  // Week: range is roughly a week (≤ 10 days) — show "on track for this period" as week
  if (totalDays <= 10) {
    const elapsedDays = periodEnded ? totalDays : Math.min(totalDays, Math.max(0, now.diff(start, 'days') + 1));
    const required = washesPerWeek * (elapsedDays / 7);
    result.week = washes >= required ? 'on_track' : 'off_track';
  }

  // Month: range is within same month or spans a month — show "on track for this period" as month
  if (start.isSame(end, 'month') || totalDays >= 14) {
    const elapsedDays = periodEnded ? totalDays : Math.min(totalDays, Math.max(0, now.diff(start, 'days') + 1));
    const required = washesPerWeek * (elapsedDays / 7);
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
  '/': 'dashboard',
  '/Dashboard': 'dashboard',
  '/dashboard': 'dashboard',
  '/compliance': 'compliance',
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
  const navigate = useNavigate();
  const permissions = usePermissions();
  const [isMobile, setIsMobile] = useState(false);
  // Active section derived from route (sidebar navigation)
  const activeTab = PATH_TO_TAB[location.pathname] ?? 'dashboard';

  // Single shared filter state - persisted so it survives navigation to vehicle detail and back
  const [sharedFilters, setSharedFilters] = useState(getInitialFilters);
  const { selectedCustomer, selectedSite, selectedDriverIds = [], dateRange, activePeriod } = sharedFilters;

  useEffect(() => {
    try {
      sessionStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(sharedFilters));
    } catch {
      // ignore storage errors
    }
  }, [sharedFilters]);

  // Use database-driven tab visibility from permissions (for filter/access checks)
  const availableTabs = useAvailableTabs(ALL_TABS);
  const availableIntelligenceTabs = useAvailableTabs(INTELLIGENCE_TABS);
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
        next.selectedDriverIds = [];
      }
      if (updates.selectedSite != null && updates.selectedSite !== prev.selectedSite) {
        next.selectedDriverIds = [];
      }
      return next;
    });
  }, []);

  const setSelectedCustomer = useCallback((v) => updateSharedFilter({ selectedCustomer: v }), [updateSharedFilter]);
  const setSelectedSite = useCallback((v) => updateSharedFilter({ selectedSite: v }), [updateSharedFilter]);
  const setSelectedDriverIds = useCallback((v) => updateSharedFilter({ selectedDriverIds: v }), [updateSharedFilter]);
  const setDateRange = useCallback((v) => updateSharedFilter({ dateRange: v, activePeriod: 'Custom' }), [updateSharedFilter]);
  const setActivePeriod = useCallback((period) => {
    const range = getDateRangeForPeriod(period);
    if (range) updateSharedFilter({ activePeriod: period, dateRange: range });
  }, [updateSharedFilter]);

  const [isResetting, setIsResetting] = useState(false);
  const resetAllFiltersToDefault = useCallback(() => {
    setIsResetting(true);
    const defaults = getDefaultFilters();
    setSharedFilters(defaults);
    try {
      sessionStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(defaults));
    } catch {
      // ignore
    }
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
    sitesOptions(companyId, { customerId: selectedCustomer !== 'all' ? selectedCustomer : undefined })
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

  // Clear reset label once filter/data fetch completes so status shows "Live — Synced …" again
  const anyFilterFetching = vehiclesFetching || dashboardFetching || refillsFetching;
  useEffect(() => {
    if (isResetting && !anyFilterFetching) setIsResetting(false);
  }, [isResetting, anyFilterFetching]);

  const processedData = useMemo(() => {
    // Start with ALL vehicles from vehicles API
    const vehicleMap = new Map();
    
    // First, add all vehicles from the vehicles API
    allVehicles.forEach(vehicle => {
      const ref = vehicle.vehicleRef || vehicle.internalVehicleId;
      vehicleMap.set(ref, {
        id: ref,
        vehicleRef: vehicle.vehicleRef ?? ref,
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
        washTime1Seconds: vehicle.washTime1Seconds ?? vehicle.washTime ?? null,
        protocolNumber: vehicle.protocolNumber ?? vehicle.protocol ?? null,
      });
    });

    const scansArray = [];
    const startMoment = moment(dateRange.start);
    const endMoment = moment(dateRange.end);

    // Then, update wash counts from dashboard data (for the date range)
    // API may return totalScans as string (e.g. "6") — coerce to number so we sum correctly
    if (dashboardData?.rows && Array.isArray(dashboardData.rows)) {
      dashboardData.rows.forEach(row => {
        const rowDate = moment(`${row.year}-${String(row.month).padStart(2, '0')}-01`);
        if (!rowDate.isBetween(startMoment, endMoment, 'month', '[]')) {
          return;
        }

        const totalScansNum = Number(row.totalScans) || 0;
        const vehicleKey = row.vehicleRef;

        if (vehicleMap.has(vehicleKey)) {
          const existing = vehicleMap.get(vehicleKey);
          existing.washes_completed += totalScansNum;
          if (row.lastScan && (!existing.last_scan || row.lastScan > existing.last_scan)) {
            existing.last_scan = row.lastScan;
          }
        } else {
          // Vehicle exists in dashboard but not in vehicles API (shouldn't happen, but handle it)
          vehicleMap.set(vehicleKey, {
            id: row.vehicleRef,
            vehicleRef: row.vehicleRef,
            name: row.vehicleName,
            rfid: row.vehicleRef,
            site_id: row.siteRef,
            site_name: row.siteName,
            customer_name: row.customerName,
            customer_ref: row.customerRef,
            washes_completed: totalScansNum,
            target: row.washesPerWeek || 12,
            washesPerDay: row.washesPerDay ?? null,
            washesPerWeek: row.washesPerWeek ?? 12,
            last_scan: row.lastScan,
            washTime1Seconds: row.washTime ?? null,
            protocolNumber: null,
          });
        }

        if (totalScansNum > 0) {
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

  // Apply customer and site filters to vehicles (no driver filter yet)
  const vehiclesAfterCustomerSite = useMemo(() => {
    let result = permissionFilteredVehicles || [];

    const sitesForFilter = allSites.length > 0 ? allSites : permissionFilteredSites;

    if (selectedCustomer && selectedCustomer !== 'all' && sitesForFilter.length > 0) {
      const customerSiteIds = sitesForFilter
        .filter(s => s.customer_ref === selectedCustomer || s.id === selectedCustomer)
        .map(s => s.id);
      result = result.filter(v => customerSiteIds.includes(v.site_id));
    }

    if (selectedSite && selectedSite !== 'all') {
      result = result.filter(v => v.site_id === selectedSite);
    }

    return result;
  }, [permissionFilteredVehicles, selectedCustomer, selectedSite, permissionFilteredSites, allSites]);

  // Apply driver-level filter on top of customer/site (shared across Compliance + Reports)
  const filteredVehicles = useMemo(() => {
    const list = vehiclesAfterCustomerSite || [];
    if (!selectedDriverIds?.length) return list;
    const idSet = new Set(selectedDriverIds.map(String));
    return list.filter(v => idSet.has(String(v.id ?? v.rfid ?? '')));
  }, [vehiclesAfterCustomerSite, selectedDriverIds]);

  // Apply customer and site filters to scans for consistent chart/analytics data
  const filteredScans = useMemo(() => {
    let result = scans || [];

    // Driver: filter by vehicle (permissionFilteredSites is empty; use vehiclesAfterCustomerSite so customer/site filters apply)
    if (permissionFilteredSites.length === 0 && vehiclesAfterCustomerSite?.length > 0) {
      const accessibleVehicleRefs = new Set(
        vehiclesAfterCustomerSite.map(v => v.id || v.rfid).filter(Boolean)
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

    // Apply driver-level filter so graphs/compliance update when driver(s) selected
    if (selectedDriverIds?.length > 0) {
      const driverRefs = new Set(selectedDriverIds.map(String));
      result = result.filter(s => s.vehicleRef != null && driverRefs.has(String(s.vehicleRef)));
    }

    return result;
  }, [scans, selectedCustomer, selectedSite, selectedDriverIds, permissionFilteredSites, vehiclesAfterCustomerSite]);

  // Dashboard tab only: data scoped to user's company (no customer/site/date filter)
  const companyRef = permissions.userProfile?.company_elora_customer_ref?.trim() || null;
  const dashboardCompanyVehicles = useMemo(() => {
    if (!companyRef) return permissionFilteredVehicles || [];
    return (permissionFilteredVehicles || []).filter(v => v.customer_ref === companyRef);
  }, [companyRef, permissionFilteredVehicles]);
  const dashboardCompanyScans = useMemo(() => {
    let result = scans || [];
    if (permissionFilteredSites.length === 0 && dashboardCompanyVehicles.length > 0) {
      const refs = new Set(dashboardCompanyVehicles.map(v => v.id || v.rfid).filter(Boolean));
      return result.filter(s => refs.has(s.vehicleRef));
    }
    if (permissionFilteredSites.length > 0) {
      if (companyRef) {
        const siteIds = permissionFilteredSites
          .filter(s => s.customer_ref === companyRef)
          .map(s => s.id);
        result = result.filter(s => siteIds.includes(s.siteRef));
      } else {
        const siteIds = permissionFilteredSites.map(s => s.id);
        result = result.filter(s => siteIds.includes(s.siteRef));
      }
    }
    return result;
  }, [scans, companyRef, permissionFilteredSites, dashboardCompanyVehicles]);

  // Scans from extended 90-day dashboard for Wash Frequency chart (so 7d–90d period filter has data)
  const washChartScans = useMemo(() => {
    const raw = [];
    if (washChartDashboardData?.rows && Array.isArray(washChartDashboardData.rows)) {
      washChartDashboardData.rows.forEach(row => {
        const totalScansNum = Number(row.totalScans) || 0;
        if (totalScansNum > 0 && row.lastScan) {
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
    if (permissionFilteredSites.length === 0 && vehiclesAfterCustomerSite?.length > 0) {
      const accessibleVehicleRefs = new Set(
        vehiclesAfterCustomerSite.map(v => v.id || v.rfid).filter(Boolean)
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
    if (selectedDriverIds?.length > 0) {
      const driverRefs = new Set(selectedDriverIds.map(String));
      result = result.filter(s => s.vehicleRef != null && driverRefs.has(String(s.vehicleRef)));
    }
    return result;
  }, [washChartDashboardData, selectedCustomer, selectedSite, selectedDriverIds, permissionFilteredSites, vehiclesAfterCustomerSite]);

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
    const getTargetWashes = (v) => v?.protocolNumber ?? v?.target ?? targetDefault;
    const onTrackCount = vehicles.filter(v => v && (v.washes_completed ?? 0) >= getTargetWashes(v)).length;
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
    const getTargetWashes = (v) => v.protocolNumber ?? v.target ?? targetDefault;
    if (complianceStatusFilter === 'compliant') {
      return list.filter((v) => (v.washes_completed ?? 0) >= getTargetWashes(v));
    }
    if (complianceStatusFilter === 'non-compliant') {
      return list.filter((v) => (v.washes_completed ?? 0) < getTargetWashes(v));
    }
    return list;
  }, [filteredVehicles, complianceStatusFilter, complianceSiteFilter]);

  const navigateToVehicleDetail = useCallback(
    (vehicleRef) => {
      if (vehicleRef) navigate(`/vehicle/${encodeURIComponent(vehicleRef)}`);
    },
    [navigate]
  );

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
    const empty = '-'; // ASCII-only for CSV so Excel does not show encoding issues (e.g. â€" from em dash)
    const getTargetWashes = (v) => v.protocolNumber ?? v.target ?? 12;
    const reportData = complianceFilteredVehicles.map((v) => {
      const targetWashes = getTargetWashes(v);
      const washes = v.washes_completed ?? 0;
      const progressPct = targetWashes ? Math.round((washes / targetWashes) * 100) : 0;
      return {
        Customer: v.customer_name ?? empty,
        Site: v.site_name ?? empty,
        Vehicle: v.name ?? empty,
        'Washes Total': washes,
        'Target Washes': targetWashes,
        Status: washes >= targetWashes ? 'Compliant' : 'Non-Compliant',
        'Progress %': progressPct,
        'Last Scan': v.last_scan ? moment(v.last_scan).format('YYYY-MM-DD HH:mm') : empty,
      };
    });
    const headers = Object.keys(reportData[0] || {});
    const rows = reportData.map((row) => headers.map((h) => String(row[h] ?? '')).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
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
  const showContentSkeletons = (isDataLoading || isFiltersFetching) && FILTER_TABS.includes(activeTab);

  // Must be called unconditionally (before any early return) to satisfy Rules of Hooks
  const userEmail = permissions.user?.email;
  const vehicleColumns = useMemo(() => {
    const progressBarColor = (likelihood) => {
      if (likelihood === 'green') return 'bg-emerald-500';
      if (likelihood === 'orange') return 'bg-amber-500';
      return 'bg-red-500';
    };

    // Target Washes = protocol (monthly limit/target from scan card). Used for Progress % and Compliant/Non-Compliant.
    const getTargetWashes = (row) => row.protocolNumber ?? row.target ?? 12;

    const scanCardGroup = {
      id: 'scan_card',
      header: 'Scan card programmed parameters',
      columns: [
        {
          id: 'wash_time',
          header: 'Wash Time',
          cell: (row) => {
            const secs = row.washTime1Seconds ?? row.washTime ?? null;
            if (secs == null) return '—';
            return `${secs} Secs`;
          },
        },
        {
          id: 'washes_per_day',
          header: 'Washes/Day',
          cell: (row) => String(row.washesPerDay ?? '—'),
        },
        {
          id: 'washes_per_week',
          header: 'Washes/Week',
          cell: (row) => String(row.washesPerWeek ?? '—'),
        },
      ],
    };

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
      { id: 'customer_name', header: 'Customer', accessorKey: 'customer_name', cell: (row) => row.customer_name ?? '—' },
      { id: 'site_name', header: 'Site', accessorKey: 'site_name', cell: (row) => row.site_name ?? '—' },
      { id: 'name', header: 'Vehicle', accessorKey: 'name', cell: (row) => (
        <span className="font-medium text-primary cursor-pointer hover:underline">{row.name ?? '—'}</span>
      ) },
      { id: 'washes_completed', header: 'Washes Total', accessorKey: 'washes_completed', cell: (row) => row.washes_completed ?? '—' },
      { id: 'target', header: 'Target Washes', cell: (row) => getTargetWashes(row) },
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
        id: 'progress',
        header: 'Progress %',
        cell: (row) => {
          const targetWashes = getTargetWashes(row);
          const washes = row.washes_completed ?? 0;
          const pct = targetWashes ? Math.round((washes / targetWashes) * 100) : 0;
          const effective = likelihoodOverrides[row.id ?? row.rfid] ?? getDefaultLikelihood(row);
          const barColor = progressBarColor(effective);
          const barWidth = Math.min(100, pct);
          return (
            <div className="flex items-center gap-2 min-w-[120px]">
              <div className="flex-1 min-w-0 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${barColor}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <span className="text-sm font-medium tabular-nums shrink-0">{pct}%</span>
            </div>
          );
        },
      },
      {
        id: 'status',
        header: 'Compliance Status',
        cell: (row) => {
          const targetWashes = getTargetWashes(row);
          const isCompliant = (row.washes_completed ?? 0) >= targetWashes;
          return (
            <Badge className={isCompliant ? 'bg-primary' : 'bg-red-500 hover:bg-red-600'}>
              {isCompliant ? 'Compliant' : 'Non-Compliant'}
            </Badge>
          );
        },
      },
      scanCardGroup,
      {
        id: 'last_scan',
        header: 'Last Scan',
        cell: (row) => (row.last_scan ? moment(row.last_scan).format('YYYY-MM-DD HH:mm:ss') : '—'),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: (row) => (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); navigateToVehicleDetail(row.id ?? row.rfid); }}
          >
            View details
          </Button>
        ),
      },
    ];
    return base;
  }, [userEmail, likelihoodOverrides, handleLikelihoodOverride, effectiveCompanyIdForLikelihood, navigateToVehicleDetail]);


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
    <div className="min-h-screen min-w-0 w-full overflow-x-hidden bg-muted/40">
      <main className="flex-1 min-w-0 w-full p-4 md:p-6 space-y-6 overflow-x-hidden">
        {/* Filters — hidden on Dashboard tab; dashboard shows company data only */}
        {activeTab !== 'dashboard' && (
        <div>
          <FilterSection
            customers={customersForDropdown}
            sites={allSites}
            selectedCustomer={selectedCustomer}
            setSelectedCustomer={setSelectedCustomer}
            selectedSite={selectedSite}
            setSelectedSite={setSelectedSite}
            vehiclesForDriverFilter={vehiclesAfterCustomerSite}
            selectedDriverIds={selectedDriverIds}
            setSelectedDriverIds={setSelectedDriverIds}
            dateRange={dateRange}
            setDateRange={setDateRange}
            activePeriod={activePeriod}
            setActivePeriod={setActivePeriod}
            companyName={permissions.userProfile?.company_name ?? null}
            companyLogoUrl={permissions.userProfile?.company_logo_url ?? null}
            onResetDateRange={resetAllFiltersToDefault}
            lockCustomerFilter={lockCustomerFilter}
            lockSiteFilter={permissions.isBatcher}
            restrictedCustomerName={restrictedCustomerName}
            restrictedSiteName={permissions.isBatcher && allSites.length === 1 ? allSites[0].name : null}
            isFiltering={isFiltersFetching}
            filterQueriesFetching={anyFilterFetching}
            isDataLoading={isDataLoading}
            isResetting={isResetting}
            suppressDriverDropdownLoader={showContentSkeletons}
            lastSyncedAt={lastSyncedAt}
          />
        </div>
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
            {activeTab === 'dashboard' && (
              <div className="space-y-6 min-w-0 w-full overflow-hidden">
                {showContentSkeletons ? (
                  <div className="space-y-4">
                    <Skeleton className="h-36 w-full rounded-2xl" />
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <Skeleton className="h-48 rounded-lg" />
                      <Skeleton className="h-48 rounded-lg" />
                    </div>
                  </div>
                ) : (
                  <>
                    <DashboardHero
                      userName={permissions.userProfile?.full_name ?? permissions.user?.email?.split('@')[0]}
                      companyName={permissions.userProfile?.company_name ?? restrictedCustomerName}
                      companyLogoUrl={permissions.userProfile?.company_logo_url ?? null}
                      lastUpdatedAt={lastSyncedAt}
                    />
                    <DashboardHomeExecutive
                      userName={permissions.userProfile?.full_name ?? permissions.user?.email?.split('@')[0]}
                      companyName={permissions.userProfile?.company_name ?? restrictedCustomerName}
                      lastUpdatedAt={lastSyncedAt}
                      filteredVehicles={dashboardCompanyVehicles}
                      filteredScans={dashboardCompanyScans}
                      hasAIInsights={availableIntelligenceTabs.some((t) => t.value === 'ai-insights')}
                      hasSMSAlerts={availableIntelligenceTabs.some((t) => t.value === 'sms-alerts')}
                      hasDeviceHealth={availableTabs.some((t) => t.value === 'devices')}
                      hasEmailReports={availableTabs.some((t) => t.value === 'email-reports')}
                      showWelcome={false}
                      onViewBelow50Click={() => navigate('/compliance')}
                    />
                  </>
                )}
              </div>
            )}

            {activeTab === 'compliance' && (
              <div className="space-y-6 min-w-0 w-full overflow-hidden">
                {showContentSkeletons ? (
                  <>
                    <Card>
                      <CardHeader>
                        <Skeleton className="h-6 w-40" />
                        <div className="flex gap-2 mt-2">
                          <Skeleton className="h-9 w-32" />
                          <Skeleton className="h-9 w-32" />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {[1, 2, 3, 4, 5, 6].map((i) => (
                                <TableHead key={i}><Skeleton className="h-4 w-16" /></TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {Array.from({ length: 10 }).map((_, i) => (
                              <TableRow key={i}>
                                {[1, 2, 3, 4, 5, 6].map((j) => (
                                  <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <Skeleton className="h-[320px] w-full rounded-lg" />
                      <Skeleton className="h-[320px] w-full rounded-lg" />
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-6 w-32" />
                      <div className="flex gap-2 flex-wrap">
                        {[1, 2, 3, 4].map((i) => (
                          <Skeleton key={i} className="h-24 w-48 rounded-lg" />
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Vehicle Compliance Table */}
                    <div id="vehicle-compliance-table">
                    <DataTable
                      columns={vehicleColumns}
                      data={complianceFilteredVehicles}
                      getRowId={(row) => row.id ?? row.rfid ?? ''}
                      onRowClick={(row) => navigateToVehicleDetail(row?.id ?? row?.rfid)}
                      searchPlaceholder="Search by vehicle or site..."
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
                    </div>
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
                  </>
                )}
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
                selectedCustomer={selectedCustomer}
                selectedDriverIds={selectedDriverIds}
                companyId={effectiveCompanyIdForLikelihood}
                isSyncing={showContentSkeletons}
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
