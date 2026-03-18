/**
 * Alert Trigger Utility
 *
 * Fire-and-forget calls to the alerts WebSocket server.
 * Used in mutation onSuccess callbacks to trigger real-time alerts
 * when things happen in the app (ops log created, order submitted, etc).
 *
 * Failures are silently logged — alert triggers should never break
 * the primary action the user was performing.
 */

const ALERTS_SERVER_URL = import.meta.env.VITE_ALERTS_WS_URL || 'http://localhost:3001';

async function emitAlert({ type, category, severity = 'info', entity_id, entity_name, message }) {
  try {
    const res = await fetch(`${ALERTS_SERVER_URL}/emit-alert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, category, severity, entity_id, entity_name, message }),
    });
    if (!res.ok) {
      console.warn('[AlertTrigger] Server returned', res.status);
    }
  } catch (err) {
    // Silent fail — don't break the user's action
    console.warn('[AlertTrigger] Could not reach alerts server:', err.message);
  }
}

// ── Operations Log ─────────────────────────────────────────────

export function triggerNewEntryCreated(entry, payload) {
  const title = payload?.title || 'Untitled';
  const brief = payload?.brief || payload?.description?.slice(0, 80) || '';

  emitAlert({
    type: 'NEW_ENTRY_CREATED',
    category: 'operations',
    severity: 'info',
    entity_id: entry?.id,
    entity_name: title,
    message: brief ? `New operations log entry: ${brief}` : 'New operations log entry created',
  });

  // Check for no assignee
  if (!payload?.assigned_to) {
    emitAlert({
      type: 'ENTRY_NO_ASSIGNEE',
      category: 'operations',
      severity: 'warning',
      entity_id: entry?.id,
      entity_name: title,
      message: `Entry created with no assignee: ${title}`,
    });
  }

  // Check for no due date
  if (!payload?.due_date) {
    emitAlert({
      type: 'ENTRY_NO_DUE_DATE',
      category: 'operations',
      severity: 'warning',
      entity_id: entry?.id,
      entity_name: title,
      message: `Entry created with no due date: ${title}`,
    });
  }
}

export function triggerEntryResolved(entry) {
  const title = entry?.title || 'Untitled';
  emitAlert({
    type: 'ENTRY_RESOLVED',
    category: 'operations',
    severity: 'resolved',
    entity_id: entry?.id,
    entity_name: title,
    message: `Operations log entry resolved: ${title}`,
  });
}

// ── Orders ─────────────────────────────────────────────────────

export function triggerOrderRequestSubmitted(order, priority) {
  const alertType = priority === 'high' ? 'ORDER_REQUEST_HIGH_PRIORITY' : 'ORDER_REQUEST_ANY';
  const sev = priority === 'high' ? 'critical' : 'info';

  emitAlert({
    type: alertType,
    category: 'orders',
    severity: sev,
    entity_id: order?.id,
    entity_name: order?.title || order?.description || 'Order Request',
    message: `New order request submitted${priority === 'high' ? ' (HIGH priority)' : ''}: ${order?.description || ''}`.trim(),
  });
}

export function triggerOrderStatusChanged(order, newStatus) {
  emitAlert({
    type: 'ORDER_STATUS_CHANGED',
    category: 'orders',
    severity: 'info',
    entity_id: order?.id,
    entity_name: order?.title || 'Order',
    message: `Order status changed to ${newStatus}`,
  });
}

export function triggerStockTakeSubmitted(stockTake) {
  emitAlert({
    type: 'STOCK_TAKE_SUBMITTED',
    category: 'orders',
    severity: 'info',
    entity_id: stockTake?.id,
    entity_name: stockTake?.site_name || 'Stock Take',
    message: `Stock take submitted by agent`,
  });
}

// ── Security ───────────────────────────────────────────────────

export function triggerFailedLogin(email, attempts = 3) {
  emitAlert({
    type: 'FAILED_LOGIN_ATTEMPTS',
    category: 'security',
    severity: 'security',
    entity_name: email,
    message: `${attempts} failed login attempts on ${email}`,
  });
}

export function triggerNewUserFirstLogin(user) {
  emitAlert({
    type: 'NEW_USER_FIRST_LOGIN',
    category: 'security',
    severity: 'info',
    entity_id: user?.id,
    entity_name: user?.full_name || user?.email || 'Unknown user',
    message: `New user logged in for the first time: ${user?.email || ''}`,
  });
}

// ── Report Scheduling ──────────────────────────────────────────

export function triggerReportScheduleCreated(schedule) {
  emitAlert({
    type: 'NEW_REPORT_SCHEDULE',
    category: 'report_scheduling',
    severity: 'info',
    entity_id: schedule?.id,
    entity_name: schedule?.contact_name || schedule?.company_name || 'Schedule',
    message: `New report schedule created for ${schedule?.contact_name || schedule?.company_name || 'a contact'}`,
  });
}

export function triggerReportScheduleModified(schedule) {
  emitAlert({
    type: 'REPORT_SCHEDULE_MODIFIED',
    category: 'report_scheduling',
    severity: 'info',
    entity_id: schedule?.id,
    entity_name: schedule?.contact_name || schedule?.company_name || 'Schedule',
    message: `Report schedule modified for ${schedule?.contact_name || schedule?.company_name || 'a contact'}`,
  });
}

export function triggerContactAddedToSchedule(schedule, contactName) {
  emitAlert({
    type: 'CONTACT_ADDED_TO_SCHEDULE',
    category: 'report_scheduling',
    severity: 'info',
    entity_id: schedule?.id,
    entity_name: contactName || schedule?.contact_name || 'Contact',
    message: `Contact added to report schedule: ${contactName || 'unknown'}`,
  });
}

export function triggerContactRemovedFromSchedule(schedule, contactName) {
  emitAlert({
    type: 'CONTACT_REMOVED_FROM_SCHEDULE',
    category: 'report_scheduling',
    severity: 'info',
    entity_id: schedule?.id,
    entity_name: contactName || 'Contact',
    message: `Contact removed from report schedule: ${contactName || 'unknown'}`,
  });
}

export function triggerReportMarkedSent(report) {
  emitAlert({
    type: 'REPORT_SENT',
    category: 'report_scheduling',
    severity: 'resolved',
    entity_id: report?.id,
    entity_name: report?.contact_name || report?.company_name || 'Report',
    message: `Report marked as sent/delivered: ${report?.report_name || ''}`,
  });
}
