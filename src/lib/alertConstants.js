/**
 * Alert system constants – categories, type labels, icons, and severity colors.
 */

export const ALERT_CATEGORIES = {
  operations: { label: 'Operations Log', icon: 'ClipboardList', iconBg: 'bg-blue-100 dark:bg-blue-900/40', iconText: 'text-blue-700 dark:text-blue-400' },
  orders: { label: 'Stock & Orders', icon: 'Package', iconBg: 'bg-amber-100 dark:bg-amber-900/40', iconText: 'text-amber-700 dark:text-amber-400' },
  delivery: { label: 'Delivery / Refills', icon: 'Truck', iconBg: 'bg-green-100 dark:bg-green-900/40', iconText: 'text-green-700 dark:text-green-400' },
  devices: { label: 'Devices', icon: 'Activity', iconBg: 'bg-red-100 dark:bg-red-900/40', iconText: 'text-red-700 dark:text-red-400' },
  chemicals: { label: 'Chemicals', icon: 'Droplets', iconBg: 'bg-purple-100 dark:bg-purple-900/40', iconText: 'text-purple-700 dark:text-purple-400' },
  security: { label: 'Security', icon: 'Shield', iconBg: 'bg-slate-100 dark:bg-slate-800', iconText: 'text-slate-700 dark:text-slate-300' },
  report_scheduling: { label: 'Report Scheduling', icon: 'CalendarClock', iconBg: 'bg-indigo-100 dark:bg-indigo-900/40', iconText: 'text-indigo-700 dark:text-indigo-400' },
};

export const ALERT_TYPE_LABELS = {
  // Operations
  NEW_ENTRY_CREATED: 'New entry created (any)',
  ENTRY_OPEN_5_DAYS: 'Entry open 5+ days with no status change',
  ENTRY_RESOLVED: 'Entry resolved',
  ENTRY_NO_ASSIGNEE: 'Entry created with no assignee',
  ENTRY_NO_DUE_DATE: 'Entry created with no due date',
  // Orders
  ORDER_REQUEST_HIGH_PRIORITY: 'New order request submitted (HIGH priority)',
  ORDER_REQUEST_ANY: 'New order request submitted (any priority)',
  ORDER_PENDING_APPROVAL: 'Order pending approval',
  ORDER_STATUS_CHANGED: 'Order status changed (approved / rejected / in transit)',
  STOCK_TAKE_SUBMITTED: 'Stock take submitted by agent',
  AGENT_PARTS_NO_REQUEST: 'Agent has parts marked "need to order" with no request raised',
  // Delivery
  DELIVERY_SCHEDULED_TODAY: 'Delivery scheduled for today (morning digest)',
  SITE_NO_DELIVERY: 'No delivery recorded at site',
  SITE_APPROACHING_REFILL: 'Site approaching refill threshold',
  SITE_OVERDUE_REFILL: 'Site overdue for refill',
  UNUSUAL_CONSUMPTION: 'Unusually high consumption at a site',
  // Devices
  DEVICE_OFFLINE: 'Device offline',
  DEVICE_BACK_ONLINE: 'Device back online (resolved)',
  DEVICE_OFFLINE_EXTENDED: 'Device offline - extended',
  // Chemicals
  LOW_CHEMICAL_LEVEL: 'Low chemical level warning',
  // Security
  FAILED_LOGIN_ATTEMPTS: 'Failed login attempts (3 failed attempts)',
  NEW_USER_FIRST_LOGIN: 'New user logged in for first time',
  MANAGER_NOT_LOGGED_IN_7_DAYS: 'Area manager has not logged in for 7 days',
  ENTRY_ASSIGNED_INACTIVE_USER: 'Entry assigned to member who has not logged in',
  // Report Scheduling
  REPORT_DUE_TODAY: 'Report due today (for a contact or company)',
  REPORT_DUE_IN_X_DAYS: 'Report due soon (upcoming reminder)',
  REPORT_OVERDUE: 'Report overdue - due date passed, not marked sent',
  REPORT_SENT: 'Report sent / marked as delivered',
  NEW_REPORT_SCHEDULE: 'New report schedule created for a contact',
  REPORT_SCHEDULE_MODIFIED: 'Report schedule modified (frequency, reports, or recipient)',
  CONTACT_ADDED_TO_SCHEDULE: 'Contact added to a report schedule',
  CONTACT_REMOVED_FROM_SCHEDULE: 'Contact removed from a report schedule',
  COMPANY_NO_REPORT_SCHEDULE: 'Company has no report schedule set up',
  SCHEDULE_NO_REPORTS: 'Report schedule has no reports selected',
  WEEKLY_REPORT_DIGEST: 'Recurring report coming up this week (weekly digest)',
};

export const SEVERITY_CONFIG = {
  critical: { label: 'Critical', color: 'bg-red-100 text-red-700 border-red-300', dotColor: 'bg-red-500', badgeBg: 'bg-red-500' },
  warning: { label: 'Warning', color: 'bg-amber-100 text-amber-700 border-amber-300', dotColor: 'bg-amber-500', badgeBg: 'bg-amber-500' },
  info: { label: 'Info', color: 'bg-blue-100 text-blue-700 border-blue-300', dotColor: 'bg-blue-500', badgeBg: 'bg-blue-500' },
  resolved: { label: 'Resolved', color: 'bg-green-100 text-green-700 border-green-300', dotColor: 'bg-green-500', badgeBg: 'bg-green-500' },
  upcoming: { label: 'Upcoming', color: 'bg-purple-100 text-purple-700 border-purple-300', dotColor: 'bg-purple-500', badgeBg: 'bg-purple-500' },
  pending: { label: 'Pending', color: 'bg-orange-100 text-orange-700 border-orange-300', dotColor: 'bg-orange-500', badgeBg: 'bg-orange-500' },
  report: { label: 'Report', color: 'bg-amber-100 text-amber-700 border-amber-300', dotColor: 'bg-amber-500', badgeBg: 'bg-amber-500' },
  ops: { label: 'Ops', color: 'bg-blue-100 text-blue-700 border-blue-300', dotColor: 'bg-blue-500', badgeBg: 'bg-blue-500' },
  security: { label: 'Security', color: 'bg-yellow-100 text-yellow-800 border-yellow-300', dotColor: 'bg-yellow-600', badgeBg: 'bg-yellow-600' },
};

// Priority dot colors for configured alerts list
export const ALERT_PRIORITY_DOTS = {
  // Red dot = critical alerts
  ORDER_REQUEST_HIGH_PRIORITY: 'bg-red-500',
  DEVICE_OFFLINE: 'bg-red-500',
  SITE_OVERDUE_REFILL: 'bg-red-500',
  REPORT_DUE_TODAY: 'bg-red-500',
  REPORT_OVERDUE: 'bg-red-500',
  DEVICE_OFFLINE_EXTENDED: 'bg-red-500',
  // Orange dot = warning
  ENTRY_OPEN_5_DAYS: 'bg-amber-500',
  ORDER_PENDING_APPROVAL: 'bg-amber-500',
  ENTRY_NO_ASSIGNEE: 'bg-amber-500',
  SITE_APPROACHING_REFILL: 'bg-amber-500',
  UNUSUAL_CONSUMPTION: 'bg-amber-500',
  SITE_NO_DELIVERY: 'bg-amber-500',
  COMPANY_NO_REPORT_SCHEDULE: 'bg-amber-500',
  ENTRY_NO_DUE_DATE: 'bg-amber-500',
  // Green dot = resolved / positive
  NEW_ENTRY_CREATED: 'bg-green-500',
  ENTRY_RESOLVED: 'bg-green-500',
  ORDER_STATUS_CHANGED: 'bg-green-500',
  REPORT_SENT: 'bg-green-500',
  DEVICE_BACK_ONLINE: 'bg-green-500',
  // Blue dot = informational
  ORDER_REQUEST_ANY: 'bg-blue-500',
  STOCK_TAKE_SUBMITTED: 'bg-blue-500',
  DELIVERY_SCHEDULED_TODAY: 'bg-blue-500',
  LOW_CHEMICAL_LEVEL: 'bg-blue-500',
  REPORT_DUE_IN_X_DAYS: 'bg-blue-500',
  NEW_REPORT_SCHEDULE: 'bg-blue-500',
  REPORT_SCHEDULE_MODIFIED: 'bg-blue-500',
  CONTACT_ADDED_TO_SCHEDULE: 'bg-blue-500',
  CONTACT_REMOVED_FROM_SCHEDULE: 'bg-blue-500',
  SCHEDULE_NO_REPORTS: 'bg-blue-500',
  WEEKLY_REPORT_DIGEST: 'bg-blue-500',
  AGENT_PARTS_NO_REQUEST: 'bg-red-500',
  NEW_USER_FIRST_LOGIN: 'bg-blue-500',
  FAILED_LOGIN_ATTEMPTS: 'bg-red-500',
  MANAGER_NOT_LOGGED_IN_7_DAYS: 'bg-amber-500',
  ENTRY_ASSIGNED_INACTIVE_USER: 'bg-amber-500',
};

// Category ordering for display
export const CATEGORY_ORDER = [
  'operations',
  'orders',
  'delivery',
  'devices',
  'chemicals',
  'security',
  'report_scheduling',
];
