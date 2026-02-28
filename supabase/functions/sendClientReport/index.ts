import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createSupabaseAdminClient } from '../_shared/supabase.ts';
import { callEloraAPI } from '../_shared/elora-api.ts';
import { computeReportData, type ReportData } from '../_shared/reportCostUtils.ts';

/**
 * Send Client-Facing Cost Report (Reports → Email Reports → Client Usage Cost Report tab).
 * - Normal: body has recipients, reportHtml, customerName, reportMonthLabel; sends that HTML.
 * - Cron: body has cronMode: true, companyId, dateRange; fetches company + recipients, fetches scans/vehicles/pricing,
 *   computes report data (same as 2nd tab), builds full HTML with metrics, sends.
 *
 * Required Supabase secrets: MAILGUN_API_KEY, MAILGUN_DOMAIN (optional: MAILGUN_BASE_URL), ELORA_API_KEY (for cron)
 */

async function sendViaMailgun(
  to: string,
  subject: string,
  html: string,
  from: string
): Promise<{ id?: string; message?: string }> {
  const apiKey = Deno.env.get('MAILGUN_API_KEY');
  const domain = Deno.env.get('MAILGUN_DOMAIN');
  const baseUrl = Deno.env.get('MAILGUN_BASE_URL') || 'https://api.mailgun.net';

  if (!apiKey || !domain) {
    throw new Error('MAILGUN_API_KEY and MAILGUN_DOMAIN must be set as Supabase secrets');
  }

  const url = `${baseUrl.replace(/\/$/, '')}/v3/${domain}/messages`;
  const formData = new FormData();
  formData.append('from', from);
  formData.append('to', to);
  formData.append('subject', subject);
  formData.append('html', html);

  const auth = btoa(`api:${apiKey}`);
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}` },
    body: formData,
  });

  const text = await response.text();
  let json: { id?: string; message?: string; error?: string };
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Mailgun error: ${response.status} ${text}`);
  }
  if (!response.ok) {
    throw new Error(json.message || json.error || text);
  }
  return json;
}

function isMailgunUnauthorizedRecipientError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  return (
    lower.includes('authorized recipients') ||
    lower.includes('free accounts') ||
    lower.includes('sandbox') ||
    lower.includes('add the address to your authorized')
  );
}

const ELORA_LOGO_URL = 'https://yyqspdpk0yebvddv.public.blob.vercel-storage.com/233633501.png';

function formatReportCompanyName(name: string): string {
  if (!name || typeof name !== 'string') return name || '';
  return name
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/** Build full report HTML for cron (same header/footer as UI; body has usage cost data per company). */
function buildFullCronReportHtml(
  companyName: string,
  reportMonthLabel: string,
  dateRangeLabel: string,
  reportData: ReportData,
  siteLabel: string
): string {
  const reportCompanyName = formatReportCompanyName(companyName);
  const {
    totalFleetSize,
    activeSites,
    totalWashes,
    avgCostPerTruck,
    avgCostPerWash,
    totalProgramCost,
    complianceRate,
  } = reportData;

  const valueStatement =
    totalFleetSize === 0 && totalWashes === 0
      ? 'No wash activity in the selected period. Select a customer and date range to see your fleet wash program summary.'
      : `Your wash program protected ${totalFleetSize} vehicles this month at an average cost of $${avgCostPerTruck.toFixed(2)} per truck. Industry estimates place concrete damage repair costs at $800–$2,500 per incident. With ${totalWashes} washes completed, your program is delivering significant protection against fleet deterioration and maintaining vehicle resale value.`;

  const tableRows = [
    ['Total Fleet Size', `${totalFleetSize} vehicles`],
    ['Active Sites', String(activeSites)],
    ['Total Washes', String(totalWashes)],
    ['Average Cost Per Truck', `$${avgCostPerTruck.toFixed(2)}`],
    ['Average Cost Per Wash', `$${avgCostPerWash.toFixed(2)}`],
    ['Total Program Cost', `$${totalProgramCost.toFixed(2)}`],
  ];

  const tableHtml = `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:#f9fafb;">
          <th style="padding:10px 12px;font-size:11px;color:#6b7280;text-align:left;text-transform:uppercase;">METRIC</th>
          <th style="padding:10px 12px;font-size:11px;color:#6b7280;text-align:left;text-transform:uppercase;">VALUE</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows.map(([metric, value], i) => `<tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'};"><td style="padding:10px 12px;font-size:12px;color:#0f172a;border-bottom:1px solid #e5e7eb;">${metric}</td><td style="padding:10px 12px;font-size:12px;color:#374151;border-bottom:1px solid #e5e7eb;">${value}</td></tr>`).join('')}
      </tbody>
    </table>
  `;

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>Fleet Wash Program Report</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:820px;margin:28px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.12);">
    <header style="background:linear-gradient(160deg,#004E2B 0%,#003d22 50%,#002a17 100%);padding:28px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <td style="width:28%;vertical-align:middle;text-align:center;">
            <span style="color:rgba(255,255,255,0.98);font-size:18px;font-weight:700;letter-spacing:0.02em;">${reportCompanyName}</span>
          </td>
          <td style="width:44%;vertical-align:middle;text-align:center;">
            <h1 style="color:rgba(255,255,255,0.98);margin:0;font-size:22px;font-weight:800;">Fleet Wash Program Report</h1>
            <p style="color:rgba(255,255,255,0.8);margin:6px 0 0 0;font-size:13px;">${reportCompanyName}</p>
            <p style="color:rgba(255,255,255,0.7);margin:2px 0 0 0;font-size:12px;">${reportMonthLabel} · ${siteLabel}</p>
          </td>
          <td style="width:28%;vertical-align:middle;text-align:center;">
  <div style="display:inline-block;text-align:center;">
    <div style="margin-bottom:6px;">
      <img src="${ELORA_LOGO_URL}" alt="ELORA" style="height:32px;width:auto;object-fit:contain;display:block;margin:0 auto;"/>
    </div>
    <div style="color:rgba(255,255,255,0.85);font-size:11px;">Prepared by ELORA</div>
  </div>
</td>
        </tr>
      </table>
      <div style="height:3px;background:linear-gradient(90deg,#00DD39,#7cc43e);margin-top:12px;"></div>
    </header>
    <main style="padding:32px 40px;">
      <div style="display:table;width:100%;border-collapse:separate;border-spacing:16px 0;margin-bottom:24px;">
        <div style="display:table-cell;width:48%;vertical-align:top;">
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;">
            <div style="color:#166534;font-size:11px;font-weight:600;text-transform:uppercase;margin-bottom:4px;">Compliance Rate</div>
            <div style="color:#15803d;font-size:28px;font-weight:800;">${complianceRate != null ? complianceRate + '%' : '—'}</div>
            <div style="color:#166534;font-size:12px;">Based on wash scans in period</div>
            ${dateRangeLabel ? `<div style="color:#166534;font-size:11px;margin-top:4px;">${dateRangeLabel}</div>` : ''}
          </div>
        </div>
        <div style="display:table-cell;width:48%;vertical-align:top;">
          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px;">
            <div style="color:#1e40af;font-size:11px;font-weight:600;text-transform:uppercase;margin-bottom:4px;">Total Washes</div>
            <div style="color:#1d4ed8;font-size:28px;font-weight:800;">${totalWashes}</div>
            <div style="color:#1e40af;font-size:12px;">Across ${activeSites} sites</div>
            ${dateRangeLabel ? `<div style="color:#1e40af;font-size:11px;margin-top:4px;">${dateRangeLabel}</div>` : ''}
          </div>
        </div>
      </div>
      <h2 style="color:#0f172a;font-size:14px;font-weight:700;margin:0 0 12px 10px;">Monthly Cost Summary · ${dateRangeLabel}</h2>
      ${tableHtml}
      <h2 style="color:#16a34a;font-size:14px;font-weight:700;margin:24px 0 8px 10px;">Value Statement</h2>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;">
        <p style="color:#166534;font-size:13px;line-height:1.6;margin:0;">${valueStatement}</p>
      </div>
    </main>
    <footer style="background:#f8fafc;padding:16px 24px;border-top:1px solid #e2e8f0;">
      <p style="color:#64748b;font-size:11px;margin:0;">Report generated by ELORA Fleet Compliance Portal · elora.com.au</p>
    </footer>
  </div>
</body>
</html>
  `.trim();
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = await req.json();
    const cronMode = body.cronMode === true && body.companyId && body.dateRange?.start != null && body.dateRange?.end != null;

    let validEmails: string[];
    let reportHtml: string;
    let customerName: string;
    let reportMonthLabel: string;

    if (cronMode) {
      const supabase = createSupabaseAdminClient();
      const { companyId, dateRange } = body;
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('id, name, logo_url, elora_customer_ref')
        .eq('id', companyId)
        .eq('is_active', true)
        .single();

      if (companyError || !company) {
        return new Response(
          JSON.stringify({ error: 'Company not found or inactive' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: prefs } = await supabase
        .from('email_report_preferences')
        .select('user_email, recipients')
        .eq('company_id', companyId)
        .eq('enabled', true);

      const emails = new Set<string>();
      if (prefs) {
        for (const p of prefs) {
          if (p.user_email) emails.add(p.user_email);
          const extra = Array.isArray(p.recipients) ? p.recipients : [];
          extra.forEach((e: unknown) => { if (typeof e === 'string' && e.includes('@')) emails.add(e); });
        }
      }
      validEmails = [...emails];
      if (validEmails.length === 0) {
        return new Response(
          JSON.stringify({ error: 'No recipients found for this company (email_report_preferences)' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const start = body.dateRange.start as string;
      const end = body.dateRange.end as string;
      const startDate = new Date(start);
      reportMonthLabel = startDate.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
      if (start !== end) reportMonthLabel += ` (${start} – ${end})`;
      customerName = company.name || 'Client';

      const dateRangeLabel = start === end ? start : `${start} – ${end}`;
      const siteLabel = 'All Sites';

      let reportData: ReportData;
      try {
        const customerRef = (company as { elora_customer_ref?: string }).elora_customer_ref;
        const scanParams: Record<string, string> = {
          fromDate: start,
          toDate: end,
          status: 'success,exceeded',
          export: 'true',
        };
        if (customerRef && customerRef !== 'all') scanParams.customer = customerRef;

        const scansRaw = await callEloraAPI('/scans', scanParams);
        const scans = Array.isArray(scansRaw) ? scansRaw : (scansRaw?.data ?? []);

        const vehicleParams: Record<string, string> = { status: '1' };
        if (customerRef && customerRef !== 'all') vehicleParams.customer = customerRef;
        const vehiclesRaw = await callEloraAPI('/vehicles', vehicleParams);
        const vehicles = Array.isArray(vehiclesRaw) ? vehiclesRaw : (vehiclesRaw?.data ?? []);

        const [tankRes, productsRes] = await Promise.all([
          supabase.from('tank_configurations').select('site_ref, device_ref, device_serial, product_type, calibration_rate_per_60s').eq('active', true),
          supabase.from('products').select('name, price_cents, status').eq('status', 'active'),
        ]);
        const tankConfigs = tankRes.data ?? [];
        const products = productsRes.data ?? [];

        reportData = computeReportData(scans, vehicles, tankConfigs, products);
      } catch (fetchErr) {
        console.error('Cron report data fetch error:', fetchErr);
        return new Response(
          JSON.stringify({ error: fetchErr instanceof Error ? fetchErr.message : 'Failed to fetch report data' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      reportHtml = buildFullCronReportHtml(customerName, reportMonthLabel, dateRangeLabel, reportData, siteLabel);
    } else {
      const {
        recipients = [],
        reportHtml: html,
        customerName: name = 'Client',
        reportMonthLabel: monthLabel = '',
      } = body;

      if (!html || typeof html !== 'string') {
        return new Response(
          JSON.stringify({ error: 'reportHtml (string) is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const toList = Array.isArray(recipients) ? recipients : [recipients];
      validEmails = toList.filter((e: unknown) => typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e as string));

      if (validEmails.length === 0) {
        return new Response(
          JSON.stringify({ error: 'At least one valid recipient email is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      reportHtml = html;
      customerName = name;
      reportMonthLabel = monthLabel;
    }

    const mailgunDomain = Deno.env.get('MAILGUN_DOMAIN') || 'sandbox.mailgun.org';
    const fromAddr = `ELORA Compliance <postmaster@${mailgunDomain}>`;
    const subject = `Fleet Wash Program Report – ${customerName}${reportMonthLabel ? ` – ${reportMonthLabel}` : ''}`;

    const sentTo: string[] = [];
    const skipped: string[] = [];

    for (const to of validEmails) {
      try {
        await sendViaMailgun(to, subject, reportHtml, fromAddr);
        sentTo.push(to);
      } catch (err) {
        if (isMailgunUnauthorizedRecipientError(err)) {
          console.warn(`Skipping recipient ${to} (Mailgun sandbox/authorized list):`, err instanceof Error ? err.message : err);
          skipped.push(to);
        } else {
          throw err;
        }
      }
    }

    if (sentTo.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'Could not send to any recipient. All may be outside Mailgun authorized list (sandbox).',
          skipped,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: sentTo.length === validEmails.length
          ? 'Client report sent successfully'
          : `Sent to ${sentTo.length} recipient(s); ${skipped.length} skipped.`,
        sentTo,
        skipped: skipped.length ? skipped : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('sendClientReport error:', error);
    const err = error instanceof Error ? error : new Error(String(error));
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
