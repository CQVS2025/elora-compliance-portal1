import React, { createContext, useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabaseClient } from "@/api/supabaseClient";
import { useAuth } from '@/lib/AuthContext';
import { getAccessibleTabs, COST_SUBTAB_IDS, EMAIL_REPORT_SUBTAB_IDS, getDefaultCostSubtabs, getDefaultEmailReportSubtabs, getDefaultEmailReportTypes } from '@/lib/permissions';

/**
 * Database-Driven Permission System
 *
 * Permissions are now stored in the user_permissions table and fetched at runtime.
 * This replaces the hardcoded USER_SPECIFIC_CONFIG and DOMAIN_CONFIG objects.
 *
 * Permission scopes:
 * - 'user': Specific user by email
 * - 'domain': All users with a given email domain
 *
 * Priority: User-specific > Domain-level > Default (full access)
 */

// Default permissions (used when no database permissions exist)
const DEFAULT_PERMISSIONS = {
  source: 'default',
  show_all_data: true,
  restricted_customer: null,
  lock_customer_filter: false,
  default_site: 'all',
  visible_tabs: null,
  hidden_tabs: null,
  hide_cost_forecast: false,
  hide_leaderboard: false,
  hide_usage_costs: false,
  can_view_compliance: true,
  can_view_reports: true,
  can_manage_sites: true,
  can_manage_users: true,
  can_export_data: true,
  can_view_costs: true,
  can_edit_vehicles: true,
  can_edit_sites: true,
  can_delete_records: true,
};

// Permission context for app-wide access
const PermissionContext = createContext(null);

/**
 * Hook to fetch and use user permissions from database
 */
export function useUserPermissions(email) {
  // TEMPORARILY DISABLED: Edge function has CORS issues
  // Will use default permissions until edge function is fixed
  const { data: permissionsData, isLoading, error } = useQuery({
    queryKey: ['userPermissions', email],
    queryFn: async () => {
      // Temporarily return defaults without calling edge function
      return DEFAULT_PERMISSIONS;
      
      // Original code (disabled):
      // if (!email) return DEFAULT_PERMISSIONS;
      // try {
      //   const response = await supabaseClient.permissions.get(email);
      //   return response?.data ?? DEFAULT_PERMISSIONS;
      // } catch (err) {
      //   console.warn('Failed to fetch permissions, using defaults:', err);
      //   return DEFAULT_PERMISSIONS;
      // }
    },
    enabled: !!email,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 0, // Don't retry since we're not calling the API
  });

  return {
    permissions: permissionsData ?? DEFAULT_PERMISSIONS,
    isLoading,
    error,
  };
}

/**
 * Get user-specific config (for backward compatibility)
 * Now fetches from database instead of hardcoded config
 */
export function getUserSpecificConfig(email) {
  // This function is now deprecated - use useUserPermissions hook instead
  // Keeping for backward compatibility but returns null
  // The actual permissions are fetched via React Query in components
  return null;
}

/**
 * Get domain config (for backward compatibility)
 * Now fetches from database instead of hardcoded config
 */
export function getDomainConfig(email) {
  // This function is now deprecated - use useUserPermissions hook instead
  return null;
}

/**
 * Get effective config (for backward compatibility)
 */
export function getEffectiveConfig(email) {
  // This function is now deprecated - use useUserPermissions hook instead
  return null;
}

const ALL_TAB_VALUES = ['dashboard', 'compliance', 'vehicle-image-log', 'operations-log', 'operations-log-edit', 'operations-log-products', 'delivery-calendar', 'report-schedules', 'stock-orders', 'costs', 'refills', 'devices', 'sites', 'reports', 'email-reports', 'branding', 'leaderboard', 'ai-insights', 'sms-alerts'];

/**
 * Compute effective visible tab values for the current user.
 * Uses role defaults from getAccessibleTabs, then applies individual user override if set.
 */
function getEffectiveVisibleTabValues(perms, userProfile) {
  const role = userProfile?.role;
  const roleTabs = role ? (getAccessibleTabs(userProfile) || ALL_TAB_VALUES) : ALL_TAB_VALUES;
  // Individual user override: only allow tabs that are within the role's defaults
  if (userProfile?.visible_tabs != null && Array.isArray(userProfile.visible_tabs)) {
    return userProfile.visible_tabs.filter((t) => roleTabs.includes(t));
  }
  if (perms.visible_tabs && perms.visible_tabs.length > 0) {
    return perms.visible_tabs.filter((t) => roleTabs.includes(t));
  }
  if (perms.hidden_tabs && perms.hidden_tabs.length > 0) {
    return roleTabs.filter((v) => !perms.hidden_tabs.includes(v));
  }
  return roleTabs;
}

/** Effective Usage Costs sub-tabs: defaults then individual user override. */
function getEffectiveCostSubtabs(userProfile) {
  let list = getDefaultCostSubtabs();
  if (userProfile?.visible_cost_subtabs != null) {
    list = userProfile.visible_cost_subtabs.length === 0 ? [] : list.filter((t) => userProfile.visible_cost_subtabs.includes(t));
  }
  return list;
}

/** Effective Email Reports sub-tabs: defaults then individual user override. */
function getEffectiveEmailReportSubtabs(userProfile) {
  let list = getDefaultEmailReportSubtabs();
  if (userProfile?.visible_email_report_subtabs != null) {
    list = userProfile.visible_email_report_subtabs.length === 0 ? [] : list.filter((t) => userProfile.visible_email_report_subtabs.includes(t));
  }
  return list;
}

/** Effective Email Report Types (compliance, costs): role default then individual user override. */
function getEffectiveEmailReportTypes(userProfile) {
  const defaults = getDefaultEmailReportTypes(userProfile);
  if (userProfile?.visible_email_report_types != null && Array.isArray(userProfile.visible_email_report_types)) {
    return userProfile.visible_email_report_types;
  }
  return defaults;
}

/**
 * Main permissions hook used throughout the app
 */
export function usePermissions() {
  const { user: authUser, userProfile } = useAuth();
  const userEmail = authUser?.email || userProfile?.email;

  const { permissions: dbPermissions, isLoading: permissionsLoading } = useUserPermissions(userEmail);

  const permissions = useMemo(() => {
    const perms = dbPermissions || DEFAULT_PERMISSIONS;
    const effectiveTabs = getEffectiveVisibleTabValues(perms, userProfile);
    const effectiveCostSubtabs = getEffectiveCostSubtabs(userProfile);
    const effectiveEmailReportSubtabs = getEffectiveEmailReportSubtabs(userProfile);
    const effectiveEmailReportTypes = getEffectiveEmailReportTypes(userProfile);
    const hideLeaderboard = !effectiveTabs.includes('leaderboard');

    return {
      // Role checks based on user profile
      isAdmin: userProfile?.role === 'admin' || userProfile?.role === 'super_admin',
      isSuperAdmin: userProfile?.role === 'super_admin',
      isManager: ['admin', 'manager', 'super_admin'].includes(userProfile?.role),
      isViewer: userProfile?.role === 'viewer',
      isBatcher: userProfile?.role === 'batcher',
      isDriver: userProfile?.role === 'driver',
      isUser: userProfile?.role === 'user',

      // Module permissions from database
      canViewCompliance: perms.can_view_compliance ?? true,
      canViewReports: perms.can_view_reports ?? true,
      canManageSites: perms.can_manage_sites ?? true,
      canManageUsers: perms.can_manage_users ?? false,
      canExportData: perms.can_export_data ?? true,
      canViewCosts: perms.can_view_costs ?? true,

      // Data edit permissions from database
      canEditVehicles: perms.can_edit_vehicles ?? true,
      canEditSites: perms.can_edit_sites ?? true,
      canDeleteRecords: perms.can_delete_records ?? false,

      // UI visibility from database (leaderboard driven by tab visibility when not user-overridden)
      hideCostForecast: perms.hide_cost_forecast ?? false,
      hideLeaderboard,
      hideUsageCosts: perms.hide_usage_costs ?? false,

      // Data restrictions from database
      restrictedCustomer: perms.restricted_customer,
      lockCustomerFilter: perms.lock_customer_filter ?? false,
      showAllData: perms.show_all_data ?? true,
      defaultSite: perms.default_site ?? 'all',

      // Tab visibility: role defaults + individual user override
      effectiveTabValues: effectiveTabs,
      effectiveCostSubtabs,
      effectiveEmailReportSubtabs,
      effectiveEmailReportTypes,
      canEditOperationsLog: effectiveTabs.includes('operations-log-edit'),
      showProductsInOpsLogEntry: effectiveTabs.includes('operations-log-products'),
      visibleTabs: perms.visible_tabs,
      hiddenTabs: perms.hidden_tabs,

      // User info
      user: authUser,
      userProfile,
      userEmail,
      assignedSites: userProfile?.assigned_sites || [],
      assignedVehicles: userProfile?.assigned_vehicles || [],

      // Loading state
      isLoading: permissionsLoading,

      // Raw permissions data
      _raw: perms,
    };
  }, [dbPermissions, authUser, userProfile, permissionsLoading]);

  return permissions;
}

/**
 * Permission Guard component
 * Conditionally renders children based on permission check
 */
export function PermissionGuard({ children, require, fallback = null }) {
  const permissions = usePermissions();

  const hasPermission = useMemo(() => {
    if (typeof require === 'function') {
      return require(permissions);
    }
    return permissions[require] ?? true;
  }, [permissions, require]);

  if (permissions.isLoading) {
    return fallback;
  }

  if (!hasPermission) {
    return fallback;
  }

  return <>{children}</>;
}

/**
 * Filter data based on user permissions and role.
 * Tenant isolation: non-super_admin users only see data for their company's ACATC customer ref
 * (companies.elora_customer_ref, e.g. "20191002210559S12659"). Super admin sees all.
 *
 * Role-based filtering (applied after tenant filter):
 * - super_admin: ALL companies, ALL sites, ALL vehicles
 * - admin: Their company only (filtered by company_elora_customer_ref)
 * - manager: Their company, only assigned sites
 * - batcher: Their company + single assigned site ONLY
 * - driver: Their assigned vehicle(s) ONLY
 * - user/viewer: Their company only (filtered by company_elora_customer_ref)
 */
export function useFilteredData(vehicles, sites, customers = []) {
  const permissions = usePermissions();
  const { userProfile } = useAuth();

  return useMemo(() => {
    const role = userProfile?.role;
    const companyCustomerRef = userProfile?.company_elora_customer_ref?.trim() || null;

    // SUPER_ADMIN: See everything (no tenant filter)
    if (role === 'super_admin') {
      return { filteredVehicles: vehicles, filteredSites: sites };
    }

    // Non-super_admin: restrict to company's ACATC customer ref first (tenant isolation)
    let tenantVehicles = vehicles;
    let tenantSites = sites;
    let tenantCustomers = customers;
    if (companyCustomerRef) {
      tenantSites = sites.filter(s => (s.customer_ref || s.customerRef) === companyCustomerRef);
      tenantVehicles = vehicles.filter(v => (v.customer_ref || v.customerId) === companyCustomerRef);
      tenantCustomers = customers.filter(c => (c.id || c.ref) === companyCustomerRef);
    } else {
      // Company has no ACATC ref set: show no data so admin must set it
      tenantSites = [];
      tenantVehicles = [];
      tenantCustomers = [];
    }

    // ADMIN: Their company only (already restricted by tenant above)
    if (role === 'admin') {
      if (permissions.restrictedCustomer) {
        const filteredSites = tenantSites.filter(s =>
          s.customer_name && s.customer_name.toUpperCase().includes(permissions.restrictedCustomer.toUpperCase())
        );
        const siteIds = filteredSites.map(s => s.id);
        const filteredVehicles = tenantVehicles.filter(v => siteIds.includes(v.site_id));
        return { filteredVehicles, filteredSites };
      }
      return { filteredVehicles: tenantVehicles, filteredSites: tenantSites };
    }

    // MANAGER: Their company, only assigned sites. No assigned sites = no data (super admin must set assigned_sites in Edit User).
    if (role === 'manager') {
      const assignedSiteIds = permissions.assignedSites || [];
      if (assignedSiteIds.length > 0) {
        const filteredSites = tenantSites.filter(s => assignedSiteIds.includes(s.id));
        const siteIds = filteredSites.map(s => s.id);
        const filteredVehicles = tenantVehicles.filter(v => siteIds.includes(v.site_id));
        return { filteredVehicles, filteredSites };
      }
      return { filteredVehicles: [], filteredSites: [] };
    }

    // BATCHER: Their company + single assigned site ONLY
    if (role === 'batcher') {
      const assignedSiteIds = permissions.assignedSites || [];
      if (assignedSiteIds.length > 0) {
        const filteredSites = tenantSites.filter(s => assignedSiteIds.includes(s.id));
        const siteIds = filteredSites.map(s => s.id);
        const filteredVehicles = tenantVehicles.filter(v => siteIds.includes(v.site_id));
        return { filteredVehicles, filteredSites };
      }
      return { filteredVehicles: [], filteredSites: [] };
    }

    // DRIVER: Their assigned vehicles ONLY (within tenant)
    if (role === 'driver') {
      const assignedVehicleIds = permissions.assignedVehicles || [];
      const hasAssignment = assignedVehicleIds.length > 0;
      const filteredVehicles = hasAssignment
        ? tenantVehicles.filter(v =>
            assignedVehicleIds.includes(v.id) ||
            assignedVehicleIds.includes(v.rfid) ||
            assignedVehicleIds.includes(String(v.id)) ||
            assignedVehicleIds.includes(String(v.rfid))
          )
        : tenantVehicles;
      return { filteredVehicles, filteredSites: [] };
    }

    // USER / VIEWER: Their company only (already restricted by tenant above)
    if (role === 'user' || role === 'viewer') {
      if (permissions.restrictedCustomer) {
        const filteredSites = tenantSites.filter(s =>
          s.customer_name && s.customer_name.toUpperCase().includes(permissions.restrictedCustomer.toUpperCase())
        );
        const siteIds = filteredSites.map(s => s.id);
        const filteredVehicles = tenantVehicles.filter(v => siteIds.includes(v.site_id));
        return { filteredVehicles, filteredSites };
      }
      return { filteredVehicles: tenantVehicles, filteredSites: tenantSites };
    }

    return { filteredVehicles: tenantVehicles, filteredSites: tenantSites };
  }, [vehicles, sites, customers, permissions, userProfile]);
}

/**
 * Hook to get available tabs based on permissions.
 * Uses effective tab values (role defaults + individual user override).
 */
export function useAvailableTabs(allTabs) {
  const permissions = usePermissions();
  const effectiveTabValues = permissions.effectiveTabValues || [];

  return useMemo(() => {
    return allTabs.filter((tab) => effectiveTabValues.includes(tab.value));
  }, [allTabs, effectiveTabValues]);
}

/** Tab value to path in nav order (used for first accessible redirect). */
const TAB_VALUE_TO_PATH = [
  ['dashboard', '/'],
  ['compliance', '/compliance'],
  ['vehicle-image-log', '/vehicle-image-log'],
  ['operations-log', '/operations-log'],
  ['delivery-calendar', '/delivery-calendar'],
  ['report-schedules', '/report-schedules'],
  ['stock-orders', '/stock-orders'],
  ['costs', '/usage-costs'],
  ['refills', '/tank-levels'],
  ['devices', '/device-health'],
  ['sites', '/sites'],
  ['reports', '/reports'],
  ['email-reports', '/email-reports'],
  ['branding', '/branding'],
  ['leaderboard', '/leaderboard'],
  ['ai-insights', '/ai-insights'],
  ['sms-alerts', '/sms-alerts'],
];

/**
 * Returns first path the user is allowed to access, whether they have dashboard,
 * and whether they have no tabs (and are not admin) so they should see the no-access page.
 */
export function useFirstAccessiblePath() {
  const permissions = usePermissions();
  const effectiveTabValues = permissions.effectiveTabValues || [];
  const isAdmin = permissions.isAdmin;

  return useMemo(() => {
    const hasDashboard = effectiveTabValues.includes('dashboard');
    let firstPath = null;
    for (const [value, path] of TAB_VALUE_TO_PATH) {
      if (effectiveTabValues.includes(value)) {
        firstPath = path;
        break;
      }
    }
    const hasNoAccess = firstPath == null && !isAdmin;
    if (firstPath == null && isAdmin) firstPath = '/admin';
    return { firstPath: firstPath ?? '/', hasDashboard, hasNoAccess };
  }, [effectiveTabValues, isAdmin]);
}

export default PermissionGuard;
