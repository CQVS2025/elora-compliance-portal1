/**
 * Alert display formatters — clean up raw alert data for presentation.
 *
 * Handles:
 *  - Stripping device serial IDs (e.g. 20220929142734S1494)
 *  - Replacing em dashes (—) with regular dashes (-)
 *  - Converting large hour counts to human-readable durations
 *  - Converting "X days" / "X hours" placeholders to actual values from message
 *  - Building friendly entity labels with customer / site context
 */

// Matches ACATC serial-style IDs: 14 digits + S + more digits (e.g. 20220929142734S1494)
const SERIAL_RE = /\s*\(?\d{14}S\d+\)?\s*/g;

// Matches "N hours" patterns inside messages so we can humanise
const HOURS_RE = /(\d+)\s*hours?/gi;

// Matches "N days" patterns
const DAYS_RE = /(\d+)\s*days?/gi;

/**
 * Convert a large hour count into a human-friendly string.
 *   e.g. 3 → "3 hours", 26 → "1 day", 168 → "1 week", 744 → "1 month"
 */
export function humaniseDuration(totalHours) {
  const h = Math.round(Number(totalHours));
  if (Number.isNaN(h) || h < 0) return `${totalHours} hours`;

  if (h < 24) return `${h} hour${h !== 1 ? 's' : ''}`;

  const days = Math.round(h / 24);
  if (days < 7) return `${days} day${days !== 1 ? 's' : ''}`;

  const weeks = Math.round(days / 7);
  if (days < 30) return `${weeks} week${weeks !== 1 ? 's' : ''}`;

  const months = Math.round(days / 30);
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''}`;

  const years = Math.round(months / 12);
  return `${years} year${years !== 1 ? 's' : ''}`;
}

/**
 * Convert a day count to human-friendly.
 */
export function humaniseDays(totalDays) {
  const d = Math.round(Number(totalDays));
  if (Number.isNaN(d) || d < 0) return `${totalDays} days`;
  if (d < 7) return `${d} day${d !== 1 ? 's' : ''}`;
  const weeks = Math.round(d / 7);
  if (d < 30) return `${weeks} week${weeks !== 1 ? 's' : ''}`;
  const months = Math.round(d / 30);
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''}`;
  const years = Math.round(months / 12);
  return `${years} year${years !== 1 ? 's' : ''}`;
}

/**
 * Replace raw hour values in a message with human-friendly durations.
 *   "Device offline for more than 595 hours" → "Device offline for more than 4 weeks"
 */
export function humaniseHoursInText(text) {
  if (!text) return text;
  return text.replace(HOURS_RE, (_match, num) => humaniseDuration(Number(num)));
}

/**
 * Replace raw day values (only when large) in a message with human-friendly durations.
 *   "No delivery for 45 days" → "No delivery for 6 weeks"
 */
export function humaniseDaysInText(text) {
  if (!text) return text;
  return text.replace(DAYS_RE, (_match, num) => {
    const d = Number(num);
    // Only humanise if > 7 days (keep "7+ days" as-is, it's already clear)
    return d > 7 ? humaniseDays(d) : _match;
  });
}

/**
 * Strip ACATC serial IDs from a string.
 */
export function stripSerialIds(text) {
  if (!text) return text;
  return text.replace(SERIAL_RE, ' ').replace(/\s{2,}/g, ' ').trim();
}

/**
 * Replace em dashes (—) with regular dashes (-).
 */
export function replaceEmDashes(text) {
  if (!text) return text;
  return text.replace(/\u2014/g, '-').replace(/\u2013/g, '-');
}

/**
 * Full cleanup pipeline for an alert's display text.
 */
export function cleanAlertText(text) {
  if (!text) return text;
  let result = text;
  result = stripSerialIds(result);
  result = replaceEmDashes(result);
  result = humaniseHoursInText(result);
  result = humaniseDaysInText(result);
  // Clean up any leftover artefacts like "- -" or "( )"
  result = result.replace(/\(\s*\)/g, '').replace(/-\s*-/g, '-').replace(/\s{2,}/g, ' ').trim();
  return result;
}

/**
 * Build a friendly entity label for device alerts.
 * If the alert message or entity_name contains customer / site info, extract it.
 * Otherwise just return the cleaned entity_name.
 */
export function formatDeviceEntityName(alert) {
  const raw = alert.entity_name || '';
  let cleaned = cleanAlertText(raw);

  // If entity_name is just a serial or empty after cleaning, try to extract from message
  if (!cleaned || cleaned.length < 2) {
    cleaned = 'Device';
  }

  return cleaned;
}

/**
 * Format alert message text for display (all alert types).
 */
export function formatAlertMessage(alert) {
  return cleanAlertText(alert.message || '');
}

/**
 * Format entity_name for display (all alert types).
 */
export function formatEntityName(alert) {
  if (!alert.entity_name) return null;

  const isDevice = alert.category === 'devices' ||
    ['DEVICE_OFFLINE', 'DEVICE_BACK_ONLINE', 'DEVICE_OFFLINE_EXTENDED'].includes(alert.type);

  if (isDevice) return formatDeviceEntityName(alert);
  return cleanAlertText(alert.entity_name);
}
