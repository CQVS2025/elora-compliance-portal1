import React, { createContext, useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabaseClient } from "@/api/supabaseClient";
import { useAuth } from '@/lib/AuthContext';
import { getAccessibleTabs } from '@/lib/permissions';

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
  can_generate_ai_reports: true,
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
  const { data: permissionsData, isLoading, error } = useQuery({
    queryKey: ['userPermissions', email],
    queryFn: async () => {
      if (!email) return DEFAULT_PERMISSIONS;

      try {
        const response = await supabaseClient.permissions.get(email);
        return response?.data ?? DEFAULT_PERMISSIONS;
      } catch (err) {
        console.warn('Failed to fetch permissions, using defaults:', err);
        return DEFAULT_PERMISSIONS;
      }
    },
    enabled: !!email,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
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
      isTechnician: userProfile?.role === 'technician',
      isViewer: userProfile?.role === 'viewer',
      isSiteManager: userProfile?.role === 'site_manager',
      isDriver: userProfile?.role === 'driver',

      // Module permissions from database
      canViewCompliance: perms.can_view_compliance ?? true,
      canViewReports: perms.can_view_reports ?? true,
      canManageSites: perms.can_manage_sites ?? true,
      canManageUsers: perms.can_manage_users ?? false,
      canExportData: perms.can_export_data ?? true,
      canViewCosts: perms.can_view_costs ?? true,
      canGenerateAIReports: perms.can_generate_ai_reports ?? true,

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
 * Filter data based on user permissions
 */
export function useFilteredData(vehicles, sites) {
  const permissions = usePermissions();

  return useMemo(() => {
    // If showing all data, return everything
    if (permissions.showAllData) {
      return { filteredVehicles: vehicles, filteredSites: sites };
    }

    // Admin, manager, viewer - show all data unless restricted
    if (!permissions.user || ['admin', 'manager', 'viewer', 'technician', 'super_admin'].includes(permissions.userProfile?.role)) {
      return { filteredVehicles: vehicles, filteredSites: sites };
    }

    // Site manager - show assigned sites only
    if (permissions.isSiteManager && permissions.assignedSites.length > 0) {
      const filteredSites = sites.filter(s =>
        permissions.assignedSites.includes(s.id)
      );
      const filteredVehicles = vehicles.filter(v =>
        permissions.assignedSites.includes(v.site_id)
      );
      return { filteredVehicles, filteredSites };
    }

    // Driver - show assigned vehicles only
    if (permissions.isDriver && permissions.assignedVehicles.length > 0) {
      const filteredVehicles = vehicles.filter(v =>
        permissions.assignedVehicles.includes(v.id)
      );
      return { filteredVehicles, filteredSites: [] };
    }

    return { filteredVehicles: vehicles, filteredSites: sites };
  }, [vehicles, sites, permissions]);
}

/**
 * Hook to get available tabs based on permissions
 * Uses role-based filtering from permissions.js as fallback
 */
export function useAvailableTabs(allTabs) {
  const permissions = usePermissions();
  const { userProfile } = useAuth();

  return useMemo(() => {
    // First, check database-driven permissions (if set)
    if (permissions.visibleTabs && permissions.visibleTabs.length > 0) {
      return allTabs.filter(tab => permissions.visibleTabs.includes(tab.value));
    }

    if (permissions.hiddenTabs && permissions.hiddenTabs.length > 0) {
      return allTabs.filter(tab => !permissions.hiddenTabs.includes(tab.value));
    }

    // Fallback to role-based filtering from permissions.js
    if (userProfile) {
      const roleBasedTabs = getAccessibleTabs(userProfile);
      if (roleBasedTabs && roleBasedTabs.length > 0) {
        return allTabs.filter(tab => roleBasedTabs.includes(tab.value));
      }
    }

    // Default: show all tabs if no permissions set
    return allTabs;
  }, [allTabs, permissions.visibleTabs, permissions.hiddenTabs, userProfile]);
}

export default PermissionGuard;
