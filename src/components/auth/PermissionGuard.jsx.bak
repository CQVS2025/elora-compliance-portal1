import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from "@/api/base44Client";

// User-specific access configuration - takes precedence over domain config
const USER_SPECIFIC_CONFIG = {
  'jonny@elora.com.au': {
    restrictedCustomer: 'HEIDELBERG MATERIALS', // Customer name to match
    lockCustomerFilter: true, // Prevent changing customer filter
    showAllData: false, // Only show data for restricted customer
    defaultSite: 'all',
    hiddenTabs: ['costs', 'refills', 'devices', 'sites', 'users'],
    visibleTabs: ['compliance', 'reports', 'email-reports'],
    hideCostForecast: true, // Hide cost forecast component
    hideLeaderboard: false, // Hide leaderboard link
    hideUsageCosts: true // Hide usage costs in vehicle profile modal
  }
  // Add more user-specific restrictions as needed
};

// Domain-based access configuration - CUSTOMIZE HERE
const DOMAIN_CONFIG = {
  'elora.com.au': {
    showAllData: true,
    defaultCustomer: 'all', // or specific customer ID/name
    defaultSite: 'all',
    hiddenTabs: [], // e.g., ['users', 'sites'] to hide tabs
    visibleTabs: ['compliance', 'maintenance', 'costs', 'refills', 'devices', 'sites', 'reports', 'email-reports', 'users']
  },
  'heidelberg.com.au': {
    showAllData: true,
    defaultCustomer: 'all',
    defaultSite: 'all',
    hiddenTabs: [],
    visibleTabs: ['compliance', 'maintenance', 'costs', 'refills', 'devices', 'sites', 'reports', 'email-reports', 'users']
  }
  // Add more domains as needed
};

export function getUserSpecificConfig(email) {
  if (!email) return null;
  return USER_SPECIFIC_CONFIG[email] || null;
}

export function getDomainConfig(email) {
  if (!email) return null;
  const domain = email.split('@')[1];
  return DOMAIN_CONFIG[domain] || null;
}

export function getEffectiveConfig(email) {
  // User-specific config takes precedence over domain config
  return getUserSpecificConfig(email) || getDomainConfig(email) || null;
}

export function usePermissions() {
  const { data: user, isLoading: userLoading, error: userError } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      try {
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Auth timeout')), 2000)
        );
        const authPromise = base44.auth.me();
        return await Promise.race([authPromise, timeoutPromise]);
      } catch {
        // Auth is optional, return null if it fails
        return null;
      }
    },
    retry: 0, // Don't retry since auth is optional
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 5 * 60 * 1000,
  });

  const permissions = {
    // Role checks - All public
    isAdmin: true,
    isManager: true,
    isTechnician: true,
    isViewer: true,
    isSiteManager: true,
    isDriver: false,

    // Module permissions - All public
    canViewCompliance: true,
    canViewMaintenance: true,
    canManageSites: true,
    canViewReports: true,
    canManageUsers: true,

    // Data permissions - Edit - All public
    canEditVehicles: true,
    canEditMaintenance: true,
    canEditSites: true,

    // Data permissions - Delete - All public
    canDeleteRecords: true,

    // Data permissions - Export - All public
    canExportData: true,

    // Advanced features - All public
    canGenerateAIReports: true,
    canViewCosts: true,

    user,
    assignedSites: user?.assigned_sites || [],
    assignedVehicles: user?.assigned_vehicles || [],
    isLoading: userLoading,
    error: userError
  };

  return permissions;
}

export function PermissionGuard({ children, require, fallback }) {
  const permissions = usePermissions();

  const hasPermission = typeof require === 'function' 
    ? require(permissions) 
    : permissions[require];

  if (!hasPermission) {
    return fallback || <>{children}</>;
  }

  return <>{children}</>;
}

// Filter data based on user permissions
export function useFilteredData(vehicles, sites) {
  const permissions = usePermissions();

  // Check domain-based configuration
  const domainConfig = getDomainConfig(permissions.user?.email);
  if (domainConfig?.showAllData) {
    return { filteredVehicles: vehicles, filteredSites: sites };
  }

  // Public view, admin, manager - show all data
  if (!permissions.user || ['admin', 'manager', 'viewer', 'technician'].includes(permissions.user?.role)) {
    return { filteredVehicles: vehicles, filteredSites: sites };
  }

  // Site manager - show assigned sites only
  if (permissions.isSiteManager) {
    const filteredSites = sites.filter(s => 
      permissions.assignedSites.includes(s.id)
    );
    const filteredVehicles = vehicles.filter(v => 
      permissions.assignedSites.includes(v.site_id)
    );
    return { filteredVehicles, filteredSites };
  }

  // Driver - show assigned vehicles only
  if (permissions.isDriver) {
    const filteredVehicles = vehicles.filter(v => 
      permissions.assignedVehicles.includes(v.id)
    );
    return { filteredVehicles, filteredSites: [] };
  }

  return { filteredVehicles: [], filteredSites: [] };
}