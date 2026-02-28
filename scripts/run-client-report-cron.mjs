#!/usr/bin/env node
/**
 * Monthly Client Report Cron
 * Sends the client-facing cost report to each onboarded company that has
 * scheduled_email_reports_enabled = true.
 *
 * For each company: last month date range is computed; sendClientReport is
 * invoked with cronMode: true, companyId, dateRange. The edge function
 * fetches recipients from email_report_preferences and sends the report.
 *
 * Run monthly (e.g. 1st of month) via GitHub Actions.
 */

import { createClient } from '@supabase/supabase-js';
import { DateTime } from 'luxon';
import { writeFileSync } from 'fs';

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

function getLastMonthRange() {
  const now = DateTime.now().setZone('Australia/Sydney');
  const start = now.minus({ months: 1 }).startOf('month');
  const end = now.minus({ months: 1 }).endOf('month');
  return {
    start: start.toFormat('yyyy-MM-dd'),
    end: end.toFormat('yyyy-MM-dd'),
  };
}

async function run() {
  log('Monthly Client Report Cron started');

  try {
    const { data: companies, error } = await supabase
      .from('companies')
      .select('id, name, scheduled_email_reports_enabled')
      .eq('is_active', true)
      .eq('scheduled_email_reports_enabled', true);

    if (error) {
      log(`Failed to fetch companies: ${error.message}`);
      throw error;
    }

    if (!companies || companies.length === 0) {
      log('No companies with scheduled client reports enabled');
      writeFileSync('client-report-cron.log', logs.join('\n'));
      return { success: true, sent: 0 };
    }

    const { start, end } = getLastMonthRange();
    log(`Date range: ${start} to ${end}`);
    log(`Found ${companies.length} companies to process`);

    let sent = 0;
    for (const company of companies) {
      try {
        log(`Sending client report for ${company.name} (${company.id})`);

        const res = await fetch(`${SUPABASE_URL}/functions/v1/sendClientReport`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            cronMode: true,
            companyId: company.id,
            dateRange: { start, end },
          }),
        });

        const text = await res.text();
        let result;
        try {
          result = JSON.parse(text);
        } catch {
          log(`Send failed ${company.name}: ${res.status} - ${text}`);
          continue;
        }

        if (!res.ok || result.error) {
          log(`Send error ${company.name}: ${result.error || text}`);
          continue;
        }

        log(`Sent to ${company.name}: ${result.sentTo?.length ?? 0} recipient(s)`);
        sent++;
      } catch (e) {
        log(`Exception for ${company.name}: ${e.message}`);
      }
    }

    log(`Done. Sent reports for ${sent} companies`);
    writeFileSync('client-report-cron.log', logs.join('\n'));
    return { success: true, sent };
  } catch (e) {
    log(`Fatal: ${e.message}`);
    writeFileSync('client-report-cron.log', logs.join('\n'));
    throw e;
  }
}

run()
  .then((r) => process.exit(r.success ? 0 : 1))
  .catch(() => process.exit(1));
