#!/usr/bin/env node
/**
 * Scheduled Email Reports - GitHub Actions Cron
 * Sends weekly email reports to users based on their schedule (Australia timezone).
 *
 * Cron runs every 6 hours (00, 06, 12, 18 UTC). For each run:
 * - Fetch enabled schedules where company has scheduled_email_reports_enabled
 * - In user's timezone: is it the scheduled day and has the scheduled time passed?
 * - For weekly: last_sent must be > 6 days ago (or never)
 * - Compute "last week" date range (end = yesterday in user TZ, start = 7 days before)
 * - Invoke sendEmailReport edge function with dateRange
 */

import { createClient } from '@supabase/supabase-js';
import { DateTime } from 'luxon';
import { writeFileSync } from 'fs';

// Polyfill fetch for Node.js < 18
if (typeof globalThis.fetch === 'undefined') {
  const nodeFetch = await import('node-fetch');
  globalThis.fetch = nodeFetch.default;
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const logs = [];
function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  logs.push(line);
}

/**
 * Check if we should send now for this preference.
 * Uses user's timezone; for weekly: scheduled day + time must have passed.
 */
function shouldSendNow(pref) {
  const tz = pref.timezone || 'Australia/Sydney';
  const now = DateTime.now().setZone(tz);
  const lastSent = pref.last_sent ? DateTime.fromISO(pref.last_sent, { zone: tz }) : null;

  const frequency = pref.frequency || 'weekly';
  if (frequency !== 'weekly') return false;

  const scheduledDay = pref.scheduled_day_of_week ?? 1; // 0=Sun, 1=Mon, ...
  const scheduledTime = pref.scheduled_time || '09:00';
  const [h, m] = scheduledTime.split(':').map(Number);

  const today = now.weekday; // luxon: 1=Mon, 7=Sun
  const luxonDow = scheduledDay === 0 ? 7 : scheduledDay; // map Sun 0 -> 7

  if (today !== luxonDow) return false;

  // Is the scheduled time in the past today?
  const scheduledToday = now.set({ hour: h || 0, minute: m || 0, second: 0, millisecond: 0 });
  if (now < scheduledToday) return false;

  // Has at least 30 minutes passed? (avoid sending twice in same cron window)
  const windowStart = scheduledToday.plus({ minutes: 30 });
  if (now < windowStart) return false;

  if (lastSent) {
    const daysSince = now.diff(lastSent, 'days').days;
    if (daysSince < 6.5) return false;
  }

  return true;
}

/**
 * Get last week date range in user's timezone.
 * End = yesterday (inclusive), Start = 7 days before that.
 */
function getLastWeekRange(pref) {
  const tz = pref.timezone || 'Australia/Sydney';
  const now = DateTime.now().setZone(tz);
  const yesterday = now.minus({ days: 1 });
  const start = yesterday.minus({ days: 6 });

  return {
    start: start.toFormat('yyyy-MM-dd'),
    end: yesterday.toFormat('yyyy-MM-dd'),
  };
}

async function run() {
  log('Scheduled Email Reports - Cron started');

  try {
    const { data: prefs, error } = await supabase
      .from('email_report_preferences')
      .select('id, user_email, company_id, enabled, frequency, scheduled_time, scheduled_day_of_week, timezone, report_types, include_charts, last_sent')
      .eq('enabled', true);

    if (error) {
      log(`Failed to fetch preferences: ${error.message}`);
      throw error;
    }

    if (!prefs || prefs.length === 0) {
      log('No enabled email report preferences');
      return { success: true, sent: 0 };
    }

    const companyIds = [...new Set(prefs.map((p) => p.company_id).filter(Boolean))];
    const { data: companies } = await supabase
      .from('companies')
      .select('id, scheduled_email_reports_enabled')
      .in('id', companyIds);

    const companyMap = new Map((companies || []).map((c) => [c.id, c]));

    log(`Found ${prefs.length} enabled preferences`);

    let sent = 0;
    const toProcess = prefs.filter((p) => {
      const company = companyMap.get(p.company_id);
      const enabled = company?.scheduled_email_reports_enabled !== false;
      if (!enabled) {
        log(`Skip ${p.user_email}: company has scheduled emails disabled`);
        return false;
      }
      return shouldSendNow(p);
    });

    log(`${toProcess.length} schedules match (day+time passed, ready to send)`);

    for (const pref of toProcess) {
      try {
        const { start, end } = getLastWeekRange(pref);
        log(`Sending to ${pref.user_email} for ${start} to ${end}`);

        const res = await fetch(`${SUPABASE_URL}/functions/v1/sendEmailReport`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            userEmail: pref.user_email,
            companyId: pref.company_id || undefined,
            reportTypes: pref.report_types || ['compliance', 'costs'],
            includeCharts: pref.include_charts !== false,
            cronMode: true,
            dateRange: { start, end },
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          log(`Send failed ${pref.user_email}: ${res.status} - ${errText}`);
          continue;
        }

        const result = await res.json();
        if (result.error) {
          log(`Send error ${pref.user_email}: ${result.error}`);
          continue;
        }

        await supabase
          .from('email_report_preferences')
          .update({ last_sent: new Date().toISOString() })
          .eq('id', pref.id);

        log(`Sent to ${pref.user_email}`);
        sent++;
      } catch (e) {
        log(`Exception for ${pref.user_email}: ${e.message}`);
      }
    }

    log(`Done. Sent ${sent} reports`);
    writeFileSync('email-cron.log', logs.join('\n'));
    return { success: true, sent };
  } catch (e) {
    log(`Fatal: ${e.message}`);
    writeFileSync('email-cron.log', logs.join('\n'));
    throw e;
  }
}

run()
  .then((r) => process.exit(r.success ? 0 : 1))
  .catch(() => process.exit(1));
