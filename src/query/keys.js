/**
 * Query Keys Factory
 * 
 * Centralized, type-safe query key generation for multi-tenant architecture.
 * 
 * Key Structure:
 * - Global data: ['resource', params]
 * - Tenant data: ['tenant', companyId, 'resource', params]
 * 
 * Benefits:
 * - Consistent key structure across app
 * - Easy cache invalidation by tenant
 * - Prevents key collisions
 * - Autocomplete support (if using TypeScript)
 */

/**
 * Base keys for different resource types
 */
export const queryKeys = {
  // Tenant-scoped resources (most common)
  tenant: {
    // Root key for tenant
    root: (companyId) => ['tenant', companyId],
    
    // Vehicles
    vehicles: (companyId, filters = {}) => [
      'tenant',
      companyId,
      'vehicles',
      filters,
    ],
    vehicle: (companyId, vehicleId) => [
      'tenant',
      companyId,
      'vehicle',
      vehicleId,
    ],
    
    // Customers
    customers: (companyId) => ['tenant', companyId, 'customers'],
    customer: (companyId, customerId) => [
      'tenant',
      companyId,
      'customer',
      customerId,
    ],
    
    // Sites
    sites: (companyId, filters = {}) => ['tenant', companyId, 'sites', filters],
    site: (companyId, siteId) => ['tenant', companyId, 'site', siteId],
    
    // Devices
    devices: (companyId, filters = {}) => [
      'tenant',
      companyId,
      'devices',
      filters,
    ],
    device: (companyId, deviceId) => [
      'tenant',
      companyId,
      'device',
      deviceId,
    ],
    
    // Scans
    scans: (companyId, filters = {}) => ['tenant', companyId, 'scans', filters],
    
    // Refills
    refills: (companyId, filters = {}) => [
      'tenant',
      companyId,
      'refills',
      filters,
    ],
    
    // Tank Levels
    tankLevels: (companyId, filters = {}) => [
      'tenant',
      companyId,
      'tankLevels',
      filters,
    ],
    sitesWithoutDevices: (companyId) => [
      'tenant',
      companyId,
      'sitesWithoutDevices',
    ],
    
    // Dashboard
    dashboard: (companyId, filters = {}) => [
      'tenant',
      companyId,
      'dashboard',
      filters,
    ],
    recentActivity: (companyId, filters = {}) => [
      'tenant',
      companyId,
      'recentActivity',
      filters,
    ],
    
    // Notifications
    notifications: (companyId, userEmail) => [
      'tenant',
      companyId,
      'notifications',
      userEmail,
    ],
    
    // Issues
    issues: (companyId) => ['tenant', companyId, 'issues'],
    
    // Permissions
    permissions: (companyId, userEmail) => [
      'tenant',
      companyId,
      'permissions',
      userEmail,
    ],
    permissionsList: (companyId) => [
      'tenant',
      companyId,
      'permissions',
      'list',
    ],
    
    // Branding
    branding: (companyId) => ['tenant', companyId, 'branding'],
    brandingByDomain: (domain) => ['branding', 'domain', domain],
    
    // Email Templates
    emailTemplates: (companyId, templateType) => [
      'tenant',
      companyId,
      'emailTemplates',
      templateType,
    ],
    
    // Users (admin)
    users: (companyId) => ['tenant', companyId, 'users'],
    user: (companyId, userId) => ['tenant', companyId, 'user', userId],
    
    // Companies (super admin)
    companies: (companyId) => ['tenant', companyId, 'companies'],

    // Vehicle likelihood overrides (manager-set Green/Orange/Red per vehicle)
    vehicleLikelihoodOverrides: (companyId) => ['tenant', companyId, 'vehicleLikelihoodOverrides'],
    company: (companyId, targetCompanyId) => [
      'tenant',
      companyId,
      'company',
      targetCompanyId,
    ],

    // SMS Alerts (risk prediction sends) – per-org audit
    smsReminders: (companyId, filters = {}) => [
      'tenant',
      companyId,
      'smsReminders',
      filters,
    ],
  },
  
  // User-scoped resources (not tenant-specific)
  user: {
    // Favorites (user-specific, not tenant-specific)
    favorites: (userEmail) => ['user', userEmail, 'favorites'],
    
    // Compliance targets (user-specific)
    complianceTargets: (userEmail, customerRef) => [
      'user',
      userEmail,
      'complianceTargets',
      customerRef,
    ],
    
    // Digest preferences (user-specific)
    digestPreferences: (userEmail) => ['user', userEmail, 'digestPreferences'],
    
    // User profile
    profile: (userId) => ['user', userId, 'profile'],
  },
  
  // Global resources (no tenant/user scope)
  global: {
    // Public branding by custom domain (accessible without auth)
    brandingByCustomDomain: (domain) => ['branding', 'customDomain', domain],
    // Role-based tab visibility overrides (super admin only)
    roleTabSettings: () => ['roleTabSettings'],
    // Site overrides (super admin edits; keyed by site_ref)
    siteOverrides: () => ['siteOverrides'],
    // User presence (last_seen, online status) for admin
    userPresence: () => ['userPresence'],
    // AI Insights (global settings; predictions/recommendations are tenant-scoped)
    aiSettings: () => ['aiSettings'],
    // Tank configurations (global, accessible to all authenticated users)
    tankConfigurations: () => ['tankConfigurations'],
  },
  // AI Insights (tenant-scoped)
  ai: {
    predictions: (companyId, startDate, endDate, customerRef, siteRef) => ['tenant', companyId, 'aiPredictions', startDate, endDate, customerRef, siteRef],
    recommendations: (companyId, customerRef, siteRef, startDate, endDate) => ['tenant', companyId, 'aiRecommendations', customerRef, siteRef, startDate, endDate],
    washWindows: (companyId, customerRef, siteRef, startDate, endDate) => ['tenant', companyId, 'aiWashWindows', customerRef, siteRef, startDate, endDate],
    driverPatterns: (companyId, customerRef, siteRef, startDate, endDate) => ['tenant', companyId, 'aiDriverPatterns', customerRef, siteRef, startDate, endDate],
    siteInsights: (companyId, startDate, endDate, customerRef, siteRef) => ['tenant', companyId, 'aiSiteInsights', startDate, endDate, customerRef, siteRef],
    patternSummary: (companyId, customerRef, siteRef, startDate, endDate) => ['tenant', companyId, 'aiPatternSummary', customerRef, siteRef, startDate, endDate],
  },
};

/**
 * Helper: Get all keys for a tenant (for invalidation)
 */
export function getTenantKeys(companyId) {
  return ['tenant', companyId];
}

/**
 * Helper: Get all keys for a user (for invalidation)
 */
export function getUserKeys(userEmail) {
  return ['user', userEmail];
}

/**
 * Helper: Get keys by resource type (for partial invalidation)
 * 
 * Example: invalidateByResource(queryClient, companyId, 'vehicles')
 */
export function getResourceKeys(companyId, resourceType) {
  return ['tenant', companyId, resourceType];
}
