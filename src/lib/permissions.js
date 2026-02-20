/**
 * Role & Permission Utilities
 * 
 * Centralized permission checking and role hierarchy management.
 * This ensures consistent permission checks across the application.
 */

// Role hierarchy (higher number = more permissions)
export const ROLE_HIERARCHY = {
  super_admin: 100,
  admin: 80,
  manager: 60,
  user: 20,
  batcher: 15,
  driver: 10,
  viewer: 5,
};

// All valid roles in the system
export const ALL_ROLES = Object.keys(ROLE_HIERARCHY);

// Role display configuration
export const ROLE_CONFIG = {
  super_admin: {
    label: 'Super Admin',
    color: 'bg-red-100 text-red-800',
    description: 'Platform-wide administrator with access to all companies',
    icon: '👑',
  },
  admin: {
    label: 'Admin',
    color: 'bg-purple-100 text-purple-800',
    description: 'Company administrator with full access to their company',
    icon: '🔑',
  },
  manager: {
    label: 'Manager',
    color: 'bg-blue-100 text-blue-800',
    description: 'Fleet manager with team oversight',
    icon: '👔',
  },
  user: {
    label: 'User',
    color: 'bg-slate-100 text-slate-800',
    description: 'Standard user with dashboard access',
    icon: '👤',
  },
  batcher: {
    label: 'Batcher',
    color: 'bg-teal-100 text-teal-800',
    description: 'Manages a single assigned site',
    icon: '🏢',
  },
  driver: {
    label: 'Driver',
    color: 'bg-green-100 text-green-800',
    description: 'Vehicle operator with limited access',
    icon: '🚗',
  },
  viewer: {
    label: 'Viewer',
    color: 'bg-gray-100 text-gray-800',
    description: 'Read-only access to dashboards',
    icon: '👁️',
  },
};

/**
 * Check if a user has a specific role
 */
export function hasRole(userProfile, role) {
  if (!userProfile || !userProfile.role) return false;
  return userProfile.role === role;
}

/**
 * Check if a user has any of the specified roles
 */
export function hasAnyRole(userProfile, roles = []) {
  if (!userProfile || !userProfile.role) return false;
  return roles.includes(userProfile.role);
}

/**
 * Check if a user's role is at least as high as the specified role
 */
export function hasRoleOrHigher(userProfile, minimumRole) {
  if (!userProfile || !userProfile.role) return false;
  const userLevel = ROLE_HIERARCHY[userProfile.role] || 0;
  const minimumLevel = ROLE_HIERARCHY[minimumRole] || 0;
  return userLevel >= minimumLevel;
}

/**
 * Check if user is super admin
 */
export function isSuperAdmin(userProfile) {
  return hasRole(userProfile, 'super_admin');
}

/**
 * Check if user is admin (company admin or super admin)
 */
export function isAdmin(userProfile) {
  return hasAnyRole(userProfile, ['super_admin', 'admin']);
}

/**
 * Check if user is manager or above
 */
export function isManager(userProfile) {
  return hasAnyRole(userProfile, ['super_admin', 'admin', 'manager']);
}

/**
 * Check if user can manage users
 * Only super_admin and admin can manage users
 */
export function canManageUsers(userProfile) {
  return isAdmin(userProfile);
}

/**
 * Check if user can manage companies
 * Only super_admin can manage companies
 */
export function canManageCompanies(userProfile) {
  return isSuperAdmin(userProfile);
}

/**
 * Check if user can access admin panel
 */
export function canAccessAdminPanel(userProfile) {
  return isAdmin(userProfile);
}

/**
 * Check if user can view all companies (super admin only)
 */
export function canViewAllCompanies(userProfile) {
  return isSuperAdmin(userProfile);
}

/**
 * Check if user can edit company branding
 * Super admins can edit all companies, admins can edit their own company
 */
export function canEditBranding(userProfile) {
  return isAdmin(userProfile); // Returns true for both super_admin and admin
}

/**
 * Check if user can create/edit compliance targets
 */
export function canManageCompliance(userProfile) {
  return hasRoleOrHigher(userProfile, 'manager');
}

/**
 * Check if user can view reports
 */
export function canViewReports(userProfile) {
  return hasRoleOrHigher(userProfile, 'viewer');
}

/**
 * Check if user can export data
 */
export function canExportData(userProfile) {
  return hasRoleOrHigher(userProfile, 'user');
}

/**
 * Check if user can edit vehicles
 */
export function canEditVehicles(userProfile) {
  return hasRoleOrHigher(userProfile, 'manager');
}

/**
 * Check if user can view costs
 */
export function canViewCosts(userProfile) {
  return hasRoleOrHigher(userProfile, 'user');
}

/**
 * Get user's accessible tabs based on role
 */
export function getAccessibleTabs(userProfile) {
  if (!userProfile) return [];

  const role = userProfile.role;

  // Super admin sees all tabs (Users tab moved to Admin console). SMS Alerts on by default only for super_admin. Edit Operations Log on by default for super_admin.
  if (role === 'super_admin') {
    return ['dashboard', 'compliance', 'operations-log', 'operations-log-edit', 'costs', 'refills', 'devices', 'sites', 'reports', 'email-reports', 'branding', 'leaderboard', 'ai-insights', 'sms-alerts'];
  }

  // Admin and all other roles: SMS Alerts off by default. Edit Operations Log on by default for admin.
  if (role === 'admin') {
    return ['dashboard', 'compliance', 'operations-log', 'operations-log-edit', 'costs', 'refills', 'devices', 'sites', 'reports', 'email-reports', 'branding', 'leaderboard', 'ai-insights'];
  }

  // Manager sees most tabs (limited to assigned sites). Edit Operations Log on by default for manager.
  if (role === 'manager') {
    return ['dashboard', 'compliance', 'operations-log', 'operations-log-edit', 'costs', 'refills', 'devices', 'sites', 'reports', 'email-reports', 'leaderboard', 'ai-insights'];
  }

  // User (demo) sees same as admin but limited to assigned company/companies. No operations-log-edit by default.
  if (role === 'user') {
    return ['dashboard', 'compliance', 'operations-log', 'costs', 'refills', 'devices', 'sites', 'reports', 'email-reports', 'leaderboard', 'ai-insights'];
  }

  // Batcher sees same as admin but locked to a single assigned site. No operations-log-edit by default.
  if (role === 'batcher') {
    return ['dashboard', 'compliance', 'operations-log', 'costs', 'refills', 'devices', 'sites', 'reports', 'email-reports', 'leaderboard', 'ai-insights'];
  }

  // Driver sees only compliance and leaderboard (assigned vehicles only); Operations Log off by default
  if (role === 'driver') {
    return ['dashboard', 'compliance', 'leaderboard'];
  }

  // Viewer sees read-only tabs (no operations-log-edit)
  if (role === 'viewer') {
    return ['dashboard', 'compliance', 'operations-log', 'costs', 'refills', 'devices', 'sites', 'reports', 'email-reports', 'leaderboard', 'ai-insights'];
  }

  return ['dashboard', 'compliance', 'leaderboard'];
}

/**
 * Get default email report types allowed for a role (when no Super Admin override).
 * Roles with email-reports tab get both; driver only gets compliance.
 */
export function getDefaultEmailReportTypes(userProfile) {
  if (!userProfile) return ['compliance', 'costs'];
  const role = userProfile.role;
  const hasEmailReports = getAccessibleTabs(userProfile).includes('email-reports');
  if (!hasEmailReports) return [];
  if (role === 'driver') return ['compliance'];
  return ['compliance', 'costs'];
}

/**
 * Check if user can access a specific tab
 */
export function canAccessTab(userProfile, tabName) {
  const accessibleTabs = getAccessibleTabs(userProfile);
  return accessibleTabs.includes(tabName);
}

/**
 * Get role display info
 */
export function getRoleInfo(role) {
  return ROLE_CONFIG[role] || {
    label: role,
    color: 'bg-gray-100 text-gray-800',
    description: 'Unknown role',
    icon: '❓',
  };
}

/**
 * Format role for display
 */
export function formatRole(role) {
  const info = getRoleInfo(role);
  return info.label;
}

/**
 * Check if user can impersonate other users (login as user feature)
 * Only super_admin can do this
 */
export function canImpersonateUsers(userProfile) {
  return isSuperAdmin(userProfile);
}

/**
 * Get permission summary for a role
 */
export function getRolePermissions(role) {
  const permissions = {
    super_admin: [
      'Access all companies',
      'Manage all users',
      'Manage companies',
      'Configure branding',
      'View all data',
      'Full system access',
    ],
    admin: [
      'Manage company users',
      'Configure company branding',
      'View company data',
      'Manage compliance targets',
      'Export reports',
      'Full company access',
    ],
    manager: [
      'View assigned sites data',
      'Manage compliance targets',
      'Run reports',
      'Export data',
      'Manage team members',
    ],
    user: [
      'View assigned company/companies data',
      'View compliance data',
      'View costs',
      'Run reports',
      'View sites',
    ],
    batcher: [
      'View single assigned site',
      'Manage site vehicles',
      'Run site reports',
      'View compliance data',
      'Locked to one site',
    ],
    driver: [
      'View assigned vehicles only',
      'View compliance status',
      'Limited to compliance tab',
    ],
    viewer: [
      'Read-only dashboard access',
      'View all tabs (read-only)',
      'No editing capabilities',
    ],
  };

  return permissions[role] || [];
}

export default {
  ROLE_HIERARCHY,
  ALL_ROLES,
  ROLE_CONFIG,
  hasRole,
  hasAnyRole,
  hasRoleOrHigher,
  isSuperAdmin,
  isAdmin,
  isManager,
  canManageUsers,
  canManageCompanies,
  canAccessAdminPanel,
  canViewAllCompanies,
  canEditBranding,
  canManageCompliance,
  canViewReports,
  canExportData,
  canEditVehicles,
  canViewCosts,
  getAccessibleTabs,
  canAccessTab,
  getRoleInfo,
  formatRole,
  canImpersonateUsers,
  getRolePermissions,
};

