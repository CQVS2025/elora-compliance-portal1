/**
 * Query Options Index
 * 
 * Centralized exports for all query options.
 * Import from this file for cleaner code.
 */

// Domain query options
export * from './vehicles';
export * from './customers';
export * from './sites';
export * from './dashboard';
export * from './scans';
export * from './refills';
export * from './devices';

// User-specific options
export * from './favorites';
export * from './compliance';
export * from './preferences';

// System options
export * from './notifications';
export * from './permissions';
export * from './branding';
export * from './siteOverrides';
export * from './vehicleLikelihoodOverrides';
export * from './smsReminders';
export * from './operationsLog';

// Delivery calendar (Notion-synced)
export * from './deliveries';

// Pricing config (tank calibration + product prices → replaces hard-coded PRICING_RULES)
export * from './pricingConfig';

// Parts catalog (Stock & Orders)
export * from './parts';
export * from './partRequests';
export * from './orderRequests';
export * from './agentStock';
export * from './stockTakes';

// Admin options
export * from './users';
export * from './companies';
export * from './roleTabSettings';
export * from './companyTabSettings';
export * from './userPresence';
