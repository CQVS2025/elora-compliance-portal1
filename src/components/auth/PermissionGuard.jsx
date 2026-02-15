import React, { createContext, useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabaseClient } from "@/api/supabaseClient";
import { useAuth } from '@/lib/AuthContext';
import { getAccessibleTabs } from '@/lib/permissions';
import { roleTabSettingsOptions } from '@/query/options';

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

const ALL_TAB_VALUES = ['compliance', 'costs', 'refills', 'devices', 'sites', 'reports', 'email-reports', 'branding', 'leaderboard', 'ai-insights', 'sms-alerts'];

/**
 * Get tabs allowed by role: Admin Console role override if set, else role default from getAccessibleTabs.
 */
function getRoleTabs(userProfile, roleTabOverrides) {
  const role = userProfile?.role;
  if (!role) return ALL_TAB_VALUES;
  const roleData = roleTabOverrides?.[role];
  const overrideTabs = Array.isArray(roleData) ? roleData : roleData?.visible_tabs;
  if (overrideTabs && overrideTabs.length > 0) return overrideTabs;
  return getAccessibleTabs(userProfile) || ALL_TAB_VALUES;
}

/**
 * Compute effective visible tab values for the current user.
 * 1) User profile first: if user has visible_tabs set, use that (user override wins).
 * 2) Role then: otherwise use tabs allowed by role (Admin Console Tab Visibility or role default).
 */
function getEffectiveVisibleTabValues(perms, userProfile, roleTabOverrides) {
  if (userProfile?.visible_tabs && userProfile.visible_tabs.length > 0) {
    return userProfile.visible_tabs;
  }
  const roleTabs = getRoleTabs(userProfile, roleTabOverrides);
  if (perms.visible_tabs && perms.visible_tabs.length > 0) {
    return perms.visible_tabs.filter((t) => roleTabs.includes(t));
  }
  if (perms.hidden_tabs && perms.hidden_tabs.length > 0) {
    return roleTabs.filter((v) => !perms.hidden_tabs.includes(v));
  }
  return roleTabs;
}

/**
 * Main permissions hook used throughout the app
 */
export function usePermissions() {
  const { user: authUser, userProfile } = useAuth();
  const userEmail = authUser?.email || userProfile?.email;

  const { permissions: dbPermissions, isLoading: permissionsLoading } = useUserPermissions(userEmail);
  const { data: roleTabOverrides = {} } = useQuery(roleTabSettingsOptions());

  const permissions = useMemo(() => {
    const perms = dbPermissions || DEFAULT_PERMISSIONS;
    const effectiveTabs = getEffectiveVisibleTabValues(perms, userProfile, roleTabOverrides);
    // Driver Leaderboard visibility is controlled only by tab visibility (same as other tabs).
    // Default: visible for all roles; Super Admin can turn off per role in Admin Console.
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

      // Tab visibility from database
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
  }, [dbPermissions, authUser, userProfile, permissionsLoading, roleTabOverrides]);

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

    // MANAGER: Their company, only assigned sites
    if (role === 'manager') {
      const assignedSiteIds = permissions.assignedSites || [];
      if (assignedSiteIds.length > 0) {
        const filteredSites = tenantSites.filter(s => assignedSiteIds.includes(s.id));
        const siteIds = filteredSites.map(s => s.id);
        const filteredVehicles = tenantVehicles.filter(v => siteIds.includes(v.site_id));
        return { filteredVehicles, filteredSites };
      }
      return { filteredVehicles: tenantVehicles, filteredSites: tenantSites };
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
 * 1) User profile first: if user has visible_tabs set, use that (user override wins).
 * 2) Role then: otherwise use tabs allowed by role (Admin Console Tab Visibility or role default).
 */
export function useAvailableTabs(allTabs) {
  const permissions = usePermissions();
  const { userProfile } = useAuth();
  const { data: roleTabOverrides = {} } = useQuery(roleTabSettingsOptions());

  return useMemo(() => {
    if (userProfile?.visible_tabs && userProfile.visible_tabs.length > 0) {
      return allTabs.filter((tab) => userProfile.visible_tabs.includes(tab.value));
    }
    const roleTabs = getRoleTabs(userProfile, roleTabOverrides);
    let effectiveTabValues = roleTabs;
    if (permissions.visibleTabs && permissions.visibleTabs.length > 0) {
      effectiveTabValues = permissions.visibleTabs.filter((t) => roleTabs.includes(t));
    } else if (permissions.hiddenTabs && permissions.hiddenTabs.length > 0) {
      effectiveTabValues = roleTabs.filter((t) => !permissions.hiddenTabs.includes(t));
    }
    return allTabs.filter((tab) => effectiveTabValues.includes(tab.value));
  }, [allTabs, permissions.visibleTabs, permissions.hiddenTabs, userProfile, roleTabOverrides]);
}

export default PermissionGuard;
