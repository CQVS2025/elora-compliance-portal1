import { supabase, callEdgeFunction } from '@/lib/supabase';

/**
 * Supabase API Client
 * Provides easy access to Supabase Edge Functions
 */

export const supabaseClient = {
  // Elora API Functions (External API integrations)
  elora: {
    vehicles: (params = {}) => callEdgeFunction('elora_vehicles', params),
    customers: (params = {}) => callEdgeFunction('elora_customers', params),
    sites: (params = {}) => callEdgeFunction('elora_sites', params),
    devices: (params = {}) => callEdgeFunction('elora_devices', params),
    scans: (params = {}) => callEdgeFunction('elora_scans', params),
    refills: (params = {}) => callEdgeFunction('elora_refills', params),
    dashboard: (params = {}) => callEdgeFunction('elora_dashboard', params),
    recentActivity: (params = {}) => callEdgeFunction('elora_recent_activity', params),
  },

  // Favorites
  favorites: {
    get: (userEmail) => callEdgeFunction('elora_get_favorites', { userEmail }),
    toggle: (params) => callEdgeFunction('elora_toggle_favorite', params),
  },

  // Compliance Targets
  compliance: {
    getTargets: (params) => callEdgeFunction('elora_get_compliance_targets', params),
    saveTarget: (params) => callEdgeFunction('elora_save_compliance_target', params),
    deleteTarget: (targetId) => callEdgeFunction('elora_delete_compliance_target', { id: targetId }),
  },

  // Email Digest Preferences
  digest: {
    getPreferences: (userEmail) => callEdgeFunction('elora_get_digest_preferences', { userEmail }),
    savePreferences: (params) => callEdgeFunction('elora_save_digest_preferences', params),
  },

  // Notifications
  notifications: {
    check: (userEmail) => callEdgeFunction('checkNotifications', { userEmail }),
  },

  // Email Reports
  reports: {
    send: (params) => callEdgeFunction('sendEmailReport', params),
    sendScheduled: () => callEdgeFunction('sendScheduledReports', {}),
  },

  // Database Tables (direct access)
  tables: {
    userProfiles: supabase.from('user_profiles'),
    favorites: supabase.from('favorite_vehicles'),
    complianceTargets: supabase.from('compliance_targets'),
    notifications: supabase.from('notifications'),
    notificationPreferences: supabase.from('notification_preferences'),
    emailDigestPreferences: supabase.from('email_digest_preferences'),
    emailReportPreferences: supabase.from('email_report_preferences'),
    maintenanceRecords: supabase.from('maintenance_records'),
    clientBranding: supabase.from('client_branding'),
    companies: supabase.from('companies'),
  },
};

export default supabaseClient;
