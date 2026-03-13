import {
  addDays,
  addWeeks,
  addMonths,
  addQuarters,
  startOfDay,
  isBefore,
  isToday,
  isWithinInterval,
  format,
} from 'date-fns';

/** Compute next due date from schedule config */
export function getNextDue(schedule) {
  const startRaw = schedule.startingFrom
    ? new Date(schedule.startingFrom + 'T00:00:00')
    : new Date();
  const start = startOfDay(startRaw);
  const sendDay = schedule.sendDay ?? 5;
  const today = startOfDay(new Date());
  const lastSent = schedule.lastSent ? startOfDay(new Date(schedule.lastSent)) : null;

  // The effective "earliest" date is whichever is later: today or startingFrom
  const earliest = isBefore(today, start) ? start : today;

  const freq = schedule.frequency ?? 'weekly';
  let next;

  if (freq === 'daily') {
    if (!lastSent || isBefore(lastSent, today)) {
      next = new Date(earliest);
    } else {
      next = addDays(earliest, 1);
    }
  } else if (freq === 'weekly' || freq === 'fortnightly') {
    // Find the next occurrence of sendDay on or after earliest
    const diff = (sendDay - earliest.getDay() + 7) % 7;
    next = diff === 0 ? new Date(earliest) : addDays(earliest, diff);

    // If today is the send day and already sent today, push to next cycle
    if (diff === 0 && lastSent && lastSent.getTime() === today.getTime()) {
      next = addWeeks(next, freq === 'fortnightly' ? 2 : 1);
    }

    // For fortnightly: align to the cadence from startingFrom
    if (freq === 'fortnightly') {
      // Find the first sendDay on or after start
      const startDiff = (sendDay - start.getDay() + 7) % 7;
      const firstOccurrence = startDiff === 0 ? new Date(start) : addDays(start, startDiff);

      // Calculate weeks between firstOccurrence and next
      const weeksBetween = Math.round((next.getTime() - firstOccurrence.getTime()) / (7 * 24 * 60 * 60 * 1000));
      if (weeksBetween % 2 !== 0) {
        next = addWeeks(next, 1);
      }
    }
  } else if (freq === 'monthly') {
    const dayOfMonth = Math.min(sendDay, 28);
    next = new Date(earliest.getFullYear(), earliest.getMonth(), dayOfMonth);
    // If that day already passed this month (or sent today), go to next month
    if (isBefore(next, earliest) || (next.getTime() === today.getTime() && lastSent && lastSent.getTime() === today.getTime())) {
      next = addMonths(next, 1);
    }
  } else if (freq === 'quarterly') {
    const dayOfMonth = Math.min(sendDay, 28);
    next = new Date(earliest.getFullYear(), earliest.getMonth(), dayOfMonth);
    if (isBefore(next, earliest)) {
      next = addMonths(next, 1);
    }
    // Align to quarterly cadence from start month
    const startMonth = start.getMonth();
    while ((next.getMonth() - startMonth + 12) % 3 !== 0 || isBefore(next, earliest)) {
      next = addMonths(next, 1);
    }
  } else {
    next = new Date(earliest);
  }

  return next;
}

/**
 * Generate all due dates for a schedule within a date range.
 * Returns array of { date, schedule, status }.
 */
export function getDueDatesInRange(schedule, rangeStart, rangeEnd) {
  const results = [];
  const startRaw = schedule.startingFrom
    ? new Date(schedule.startingFrom + 'T00:00:00')
    : new Date();
  const start = startOfDay(startRaw);
  const sendDay = schedule.sendDay ?? 5;
  const freq = schedule.frequency ?? 'weekly';
  const today = startOfDay(new Date());
  const lastSent = schedule.lastSent ? new Date(schedule.lastSent) : null;

  // Generate candidate dates within range
  const candidates = [];

  if (freq === 'daily') {
    let d = new Date(Math.max(startOfDay(rangeStart).getTime(), startOfDay(start).getTime()));
    const end = startOfDay(rangeEnd);
    while (!isBefore(end, d)) {
      candidates.push(new Date(d));
      d = addDays(d, 1);
    }
  } else if (freq === 'weekly' || freq === 'fortnightly') {
    // Find the first occurrence of sendDay on or after start
    let d = new Date(startOfDay(start));
    const dayDiff = (sendDay - d.getDay() + 7) % 7;
    d = addDays(d, dayDiff);

    const step = freq === 'fortnightly' ? 2 : 1;
    // Advance to range start
    while (isBefore(d, startOfDay(rangeStart))) {
      d = addWeeks(d, step);
    }
    const end = startOfDay(rangeEnd);
    while (!isBefore(end, d)) {
      candidates.push(new Date(d));
      d = addWeeks(d, step);
    }
  } else if (freq === 'monthly') {
    const dayOfMonth = Math.min(sendDay, 28);
    let d = new Date(start.getFullYear(), start.getMonth(), dayOfMonth);
    if (isBefore(d, start)) d = addMonths(d, 1);
    while (isBefore(d, startOfDay(rangeStart))) {
      d = addMonths(d, 1);
    }
    const end = startOfDay(rangeEnd);
    while (!isBefore(end, d)) {
      candidates.push(new Date(d));
      d = addMonths(d, 1);
    }
  } else if (freq === 'quarterly') {
    const dayOfMonth = Math.min(sendDay, 28);
    let d = new Date(start.getFullYear(), start.getMonth(), dayOfMonth);
    if (isBefore(d, start)) d = addMonths(d, 3);
    while (isBefore(d, startOfDay(rangeStart))) {
      d = addMonths(d, 3);
    }
    const end = startOfDay(rangeEnd);
    while (!isBefore(end, d)) {
      candidates.push(new Date(d));
      d = addMonths(d, 3);
    }
  }

  candidates.forEach((date) => {
    const dDay = startOfDay(date);
    let status;
    // Check if this date was already "sent" (lastSent is on or after this due date, within the period)
    if (lastSent && !isBefore(startOfDay(lastSent), dDay) && isBefore(dDay, addDays(startOfDay(lastSent), 1))) {
      status = 'sent';
    } else if (isBefore(dDay, today)) {
      status = 'overdue';
    } else if (isToday(dDay)) {
      status = 'due_today';
    } else {
      status = 'upcoming';
    }
    results.push({ date: dDay, schedule, status });
  });

  return results;
}

/** Get status: overdue, due_today, due_this_week, upcoming */
export function getStatus(schedule) {
  const next = getNextDue(schedule);
  const today = startOfDay(new Date());
  const weekEnd = addDays(today, 7);

  if (isBefore(next, today)) return 'overdue';
  if (isToday(next)) return 'due_today';
  if (isWithinInterval(next, { start: today, end: weekEnd })) return 'due_this_week';
  return 'upcoming';
}

/** Format "Overdue 1d", "Due Today", "In 2 Days" etc */
export function formatDueLabel(schedule) {
  const next = getNextDue(schedule);
  const today = startOfDay(new Date());
  const status = getStatus(schedule);

  if (status === 'overdue') {
    const diff = Math.ceil((today - next) / (24 * 60 * 60 * 1000));
    return `Overdue ${diff}d`;
  }
  if (status === 'due_today') return 'Due Today';
  const diff = Math.ceil((next - today) / (24 * 60 * 60 * 1000));
  if (diff === 1) return 'In 1 Day';
  if (diff < 7) return `In ${diff} Days`;
  if (diff < 30) return `In ${Math.floor(diff / 7)} Weeks`;
  return `In ${diff} Days`;
}

export function getInitials(name) {
  if (!name || typeof name !== 'string') return '??';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export const REPORT_TYPE_LABELS = {
  compliance_rate: 'Compliance Rate',
  total_washes: 'Total Washes',
  per_vehicle_breakdown: 'Per Vehicle',
  compliant_vs_non_compliant: 'Non-Compliant',
  last_scan_date: 'Last Scan',
  total_program_cost: 'Total Cost',
  avg_cost_per_truck: 'Avg Cost/Truck',
  avg_cost_per_wash: 'Avg Cost/Wash',
  site_summary: 'Site Summary',
};

export const FREQUENCY_LABELS = {
  daily: 'Daily',
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
};
