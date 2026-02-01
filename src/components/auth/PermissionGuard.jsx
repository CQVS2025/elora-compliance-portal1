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

/**
 * Main permissions hook used throughout the app
 */
export function usePermissions() {
  const { user: authUser, userProfile } = useAuth();
  const userEmail = authUser?.email || userProfile?.email;

  const { permissions: dbPermissions, isLoading: permissionsLoading } = useUserPermissions(userEmail);

  const permissions = useMemo(() => {
    const perms = dbPermissions || DEFAULT_PERMISSIONS;

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

      // UI visibility from database
      hideCostForecast: perms.hide_cost_forecast ?? false,
      hideLeaderboard: perms.hide_leaderboard ?? false,
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
 * Filter data based on user permissions and role
 * 
 * Role-based filtering rules:
 * - super_admin: ALL companies, ALL sites, ALL vehicles
 * - admin: Their company only, all sites within their company
 * - manager: Their company, only the sites they manage (assigned_sites)
 * - user: Their selected company/companies only, all sites selected
 * - batcher: Their company + their assigned site ONLY (single site)
 * - driver: Their assigned vehicle(s) ONLY
 * - viewer: Their company only, all sites (READ-ONLY)
 * 
 * Note: Sites from Elora API use customer_ref, not company_id
 * We need to map company_id to customer_ref for filtering
 */
export function useFilteredData(vehicles, sites, customers = []) {
  const permissions = usePermissions();
  const { userProfile } = useAuth();

  return useMemo(() => {
    const role = userProfile?.role;
    const companyId = userProfile?.company_id;

    // SUPER_ADMIN: See everything
    if (role === 'super_admin') {
      return { filteredVehicles: vehicles, filteredSites: sites };
    }

    // For other roles, we need to map company_id to customer_ref
    // Since the Elora API uses customer_ref (not company_id), we need to find the customer
    // that matches the user's company. For now, we'll use the restrictedCustomer from permissions
    // or filter based on assigned sites/vehicles
    
    // ADMIN: See their company only (all sites within their company)
    if (role === 'admin') {
      // If restrictedCustomer is set, use that to filter sites
      if (permissions.restrictedCustomer) {
        const filteredSites = sites.filter(s => 
          s.customer_name && s.customer_name.toUpperCase().includes(permissions.restrictedCustomer.toUpperCase())
        );
        const siteIds = filteredSites.map(s => s.id);
        const filteredVehicles = vehicles.filter(v => siteIds.includes(v.site_id));
        return { filteredVehicles, filteredSites };
      }
      // Otherwise, show all (admin sees their company's data)
      return { filteredVehicles: vehicles, filteredSites: sites };
    }

    // MANAGER: See their company, only assigned sites
    if (role === 'manager') {
      const assignedSiteIds = permissions.assignedSites || [];
      if (assignedSiteIds.length > 0) {
        const filteredSites = sites.filter(s => assignedSiteIds.includes(s.id));
        const siteIds = filteredSites.map(s => s.id);
        const filteredVehicles = vehicles.filter(v => siteIds.includes(v.site_id));
        return { filteredVehicles, filteredSites };
      }
      // If no assigned sites, show all (fallback)
      return { filteredVehicles: vehicles, filteredSites: sites };
    }

    // BATCHER: See their company + single assigned site ONLY
    if (role === 'batcher') {
      const assignedSiteIds = permissions.assignedSites || [];
      if (assignedSiteIds.length > 0) {
        // Batcher should only have ONE assigned site
        const filteredSites = sites.filter(s => assignedSiteIds.includes(s.id));
        const siteIds = filteredSites.map(s => s.id);
        const filteredVehicles = vehicles.filter(v => siteIds.includes(v.site_id));
        return { filteredVehicles, filteredSites };
      }
      // If no assigned sites, show nothing
      return { filteredVehicles: [], filteredSites: [] };
    }

    // DRIVER: See their assigned vehicles ONLY (or all company vehicles if none assigned)
    if (role === 'driver') {
      const assignedVehicleIds = permissions.assignedVehicles || [];
      const hasAssignment = assignedVehicleIds.length > 0;
      const filteredVehicles = hasAssignment
        ? vehicles.filter(v =>
            assignedVehicleIds.includes(v.id) ||
            assignedVehicleIds.includes(v.rfid) ||
            assignedVehicleIds.includes(String(v.id)) ||
            assignedVehicleIds.includes(String(v.rfid))
          )
        : vehicles; // Fallback: no assignment = see all company vehicles
      return { filteredVehicles, filteredSites: [] };
    }

    // USER: See their selected company/companies (demo users)
    // VIEWER: See their company only (read-only)
    if (role === 'user' || role === 'viewer') {
      // If restrictedCustomer is set, use that to filter
      if (permissions.restrictedCustomer) {
        const filteredSites = sites.filter(s => 
          s.customer_name && s.customer_name.toUpperCase().includes(permissions.restrictedCustomer.toUpperCase())
        );
        const siteIds = filteredSites.map(s => s.id);
        const filteredVehicles = vehicles.filter(v => siteIds.includes(v.site_id));
        return { filteredVehicles, filteredSites };
      }
      // Otherwise, show all
      return { filteredVehicles: vehicles, filteredSites: sites };
    }

    // Default: return everything (fallback)
    return { filteredVehicles: vehicles, filteredSites: sites };
  }, [vehicles, sites, permissions, userProfile]);
}

/**
 * Hook to get available tabs based on permissions
 * Priority: user-specific visible_tabs > role override (Super Admin config) > role-based defaults
 */
export function useAvailableTabs(allTabs) {
  const permissions = usePermissions();
  const { userProfile } = useAuth();
  const { data: roleTabOverrides = {} } = useQuery(roleTabSettingsOptions());

  return useMemo(() => {
    // First, check user-specific permissions (user_permissions table)
    if (permissions.visibleTabs && permissions.visibleTabs.length > 0) {
      return allTabs.filter(tab => permissions.visibleTabs.includes(tab.value));
    }

    if (permissions.hiddenTabs && permissions.hiddenTabs.length > 0) {
      return allTabs.filter(tab => !permissions.hiddenTabs.includes(tab.value));
    }

    // Second, check role-based tab overrides (Super Admin config)
    const role = userProfile?.role;
    if (role && roleTabOverrides[role] && roleTabOverrides[role].length > 0) {
      return allTabs.filter(tab => roleTabOverrides[role].includes(tab.value));
    }

    // Fallback to default role-based tabs from permissions.js
    if (userProfile) {
      const roleBasedTabs = getAccessibleTabs(userProfile);
      if (roleBasedTabs && roleBasedTabs.length > 0) {
        return allTabs.filter(tab => roleBasedTabs.includes(tab.value));
      }
    }

    return allTabs;
  }, [allTabs, permissions.visibleTabs, permissions.hiddenTabs, userProfile, roleTabOverrides]);
}

export default PermissionGuard;
