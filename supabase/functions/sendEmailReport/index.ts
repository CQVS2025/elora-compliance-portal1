import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createSupabaseAdminClient } from '../_shared/supabase.ts';
import { callEloraAPI } from '../_shared/elora-api.ts';

/**
 * Email Report Generation and Sending Function
 * Uses Emailgun for delivery. Fetches fleet data from Elora API.
 *
 * Required Supabase secrets:
 * - MAILGUN_API_KEY: Your Emailgun API key
 * - MAILGUN_DOMAIN: Your sending domain (e.g. sandboxXXX.mailgun.org for sandbox)
 * - MAILGUN_BASE_URL: (optional) Base URL, default https://api.mailgun.net (use https://api.eu.mailgun.net for EU)
 */

type Attachment = { filename: string; content: string; type?: 'text' | 'base64'; contentType?: string };

async function sendViaEmailgun(
  to: string,
  subject: string,
  html: string,
  from: string,
  attachments?: Attachment[]
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
  if (attachments?.length) {
    for (const a of attachments) {
      const contentType = a.contentType || (a.type === 'base64' ? 'application/octet-stream' : 'text/plain');
      const blob = a.type === 'base64'
        ? new Blob([Uint8Array.from(atob(a.content), (c) => c.charCodeAt(0))], { type: contentType })
        : new Blob([a.content], { type: contentType });
      formData.append('attachment', blob, a.filename);
    }
  }

  const auth = btoa(`api:${apiKey}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
    },
    body: formData,
  });

  const text = await response.text();
  let json: { id?: string; message?: string; error?: string };
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Emailgun error: ${response.status} ${text}`);
  }

  if (!response.ok) {
    throw new Error(json.message || json.error || text);
  }

  return json;
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = createSupabaseAdminClient();

    const body = await req.json();
    const { userEmail, companyId: cronCompanyId, reportTypes, includeCharts, previewOnly, reportData, branding: clientBranding, pdfBase64, pdfFilename, excelBase64, excelFilename, cronMode, dateRange: cronDateRange } = body;

    console.log('sendEmailReport invoked with:', {
      userEmail,
      reportTypes,
      hasReportData: !!reportData,
      hasBranding: !!clientBranding,
      hasPdf: !!pdfBase64,
      hasExcel: !!excelBase64
    });

    if (!userEmail) {
      return new Response(JSON.stringify({ error: 'User email is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let branding: { company_name?: string; logo_url?: string; primary_color?: string; secondary_color?: string } = {
      company_name: 'ELORA Solutions',
      logo_url: undefined,
      primary_color: '#003DA5',
      secondary_color: '#00A3E0'
    };
    if (clientBranding && typeof clientBranding === 'object') {
      branding = {
        company_name: clientBranding.company_name || 'ELORA Solutions',
        logo_url: clientBranding.logo_url ?? undefined,
        primary_color: clientBranding.primary_color || '#003DA5',
        secondary_color: clientBranding.secondary_color || '#00A3E0'
      };
    } else {
      const emailDomain = userEmail.split('@')[1];
      try {
        const { data: brandingResults } = await supabase
          .from('client_branding')
          .select('*')
          .eq('client_email_domain', emailDomain);
        if (brandingResults && brandingResults.length > 0) branding = brandingResults[0];
      } catch (e) {
        console.warn('Branding fetch error:', e);
      }
    }

    const { data: users } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('email', userEmail);
    const user = users && users.length > 0 ? users[0] : null;

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userRole = user.role || 'user';
    const defaultAllowedByRole: Record<string, string[]> = {
      super_admin: ['compliance', 'costs'],
      admin: ['compliance', 'costs'],
      manager: ['compliance', 'costs'],
      user: ['compliance', 'costs'],
      batcher: ['compliance', 'costs'],
      driver: ['compliance'],
      viewer: ['compliance', 'costs'],
    };
    let allowedReportTypes: string[] = defaultAllowedByRole[userRole] ?? ['compliance', 'costs'];
    try {
      const { data: roleSettings } = await supabase
        .from('role_tab_settings')
        .select('visible_email_report_types')
        .eq('role', userRole)
        .single();
      if (roleSettings?.visible_email_report_types && Array.isArray(roleSettings.visible_email_report_types) && roleSettings.visible_email_report_types.length > 0) {
        allowedReportTypes = roleSettings.visible_email_report_types;
      }
    } catch (e) {
      console.warn('Role tab settings fetch error:', e);
    }

    const requestedTypes = Array.isArray(reportTypes) && reportTypes.length > 0 ? reportTypes : allowedReportTypes;
    const filteredReportTypes = requestedTypes.filter((t: string) => allowedReportTypes.includes(t));

    const now = new Date();
    let reports: Record<string, unknown> = {};
    const wantsCompliance = filteredReportTypes.includes('compliance');
    const wantsCosts = filteredReportTypes.includes('costs');
    let vehiclesForEmail: Array<Record<string, unknown>> = [];
    let dateRangeForEmail: { start?: string; end?: string } = {};

    if (reportData?.stats && reportData?.filteredVehicles) {
      const stats = reportData.stats;
      const vehicles = reportData.filteredVehicles || [];
      vehiclesForEmail = vehicles;
      dateRangeForEmail = reportData.dateRange || { start: '', end: '' };
      const dateRange = dateRangeForEmail;
      const dateLabel = dateRange.start && dateRange.end
        ? `${dateRange.start} - ${dateRange.end}`
        : `${now.toLocaleDateString()}`;

      if (wantsCompliance) {
        const compliantCount = vehicles.filter((v: { washes_completed?: number; target?: number }) =>
          (v.washes_completed ?? 0) >= (v.target ?? 12)
        ).length;
        const atRiskCount = vehicles.length - compliantCount;
        reports.compliance = {
          summary: {
            averageCompliance: stats.complianceRate ?? 0,
            totalVehicles: stats.totalVehicles ?? vehicles.length,
            compliantVehicles: compliantCount,
            atRiskVehicles: atRiskCount,
            alerts: atRiskCount > 0 ? [{
              title: 'Low Compliance Alert',
              message: `${atRiskCount} vehicle(s) are below the compliance threshold and require attention.`
            }] : []
          },
          vehicles: (vehicles || []).slice(0, 20).map((v: { name?: string; site_name?: string; washes_completed?: number; target?: number }) => ({
            name: v.name || 'Unknown',
            site: v.site_name || 'N/A',
            complianceRate: (v.target && v.target > 0)
              ? Math.min(100, Math.round(((v.washes_completed ?? 0) / v.target) * 100))
              : 0,
            washesCompleted: v.washes_completed ?? 0,
            targetWashes: v.target ?? 12,
            status: (v.washes_completed ?? 0) >= (v.target ?? 12) ? 'Compliant' : 'At Risk'
          })),
          dateRange: dateLabel
        };
      }

      if (wantsCosts) {
        const totalWashes = stats.monthlyWashes ?? vehicles.reduce((s: number, v: { washes_completed?: number }) => s + (v.washes_completed ?? 0), 0);
        reports.costs = {
          summary: {
            totalCost: 0,
            monthlyAverage: 0,
            recordCount: 0,
            totalWashes,
            washSummary: `Total washes in period: ${totalWashes}`
          },
          dateRange: dateLabel
        };
      }
    } else {
      // Cron mode: use companyId from body when provided (e.g. super_admin scheduling for an org).
      // Manual mode: use user's company_id from profile.
      const effectiveCompanyId = (cronMode && cronCompanyId) ? cronCompanyId : (user.company_id ?? null);
      let eloraCustomerRef: string | undefined;
      if (effectiveCompanyId) {
        const { data: company } = await supabase
          .from('companies')
          .select('elora_customer_ref')
          .eq('id', effectiveCompanyId)
          .single();
        eloraCustomerRef = company?.elora_customer_ref;
      }

      // Cron mode: use provided dateRange (last week). Manual: last 30 days.
      let startStr: string;
      let endStr: string;
      if (cronMode && cronDateRange?.start && cronDateRange?.end) {
        startStr = cronDateRange.start;
        endStr = cronDateRange.end;
      } else {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        startStr = thirtyDaysAgo.toISOString().slice(0, 10);
        endStr = now.toISOString().slice(0, 10);
      }

      let vehicles: Array<Record<string, unknown>> = [];
      let dashboardRows: Array<{ vehicleRef?: string; totalScans?: number; year?: number; month?: number }> = [];

      try {
        const vehiclesParams: Record<string, string> = { status: '1' };
        if (eloraCustomerRef) vehiclesParams.customer = eloraCustomerRef;
        const vehiclesData = await callEloraAPI('/vehicles', vehiclesParams);
        vehicles = Array.isArray(vehiclesData) ? vehiclesData : (vehiclesData?.vehicles || []);
      } catch (e) {
        console.warn('Elora vehicles fetch error:', e);
      }

      try {
        const dashboardData = await callEloraAPI('/dashboard', {
          fromDate: startStr,
          toDate: endStr,
          ...(eloraCustomerRef ? { customer: eloraCustomerRef } : {})
        });
        const rows = dashboardData?.rows || dashboardData?.data?.rows || [];
        dashboardRows = Array.isArray(rows) ? rows : [];
      } catch (e) {
        console.warn('Elora dashboard fetch error:', e);
      }

      const scansByVehicle = new Map<string, number>();
      const startDate = new Date(startStr);
      const endDate = new Date(endStr + 'T23:59:59.999Z');
      dashboardRows.forEach((row) => {
        const rowDate = new Date(row.year ?? 2000, (row.month ?? 1) - 1);
        if (rowDate < startDate || rowDate > endDate) return;
        const ref = row.vehicleRef || '';
        scansByVehicle.set(ref, (scansByVehicle.get(ref) || 0) + (row.totalScans || 0));
      });

      const enrichedVehicles = vehicles.map(v => {
        const ref = (v.vehicleRef || v.id || '') as string;
        const washes = scansByVehicle.get(ref) || 0;
        const target = (v.washesPerWeek as number) || 12;
        const rate = target > 0 ? Math.min(100, Math.round((washes / target) * 100)) : 0;
        return {
          ...v,
          washes_completed: washes,
          target,
          compliance_rate: rate,
          name: v.vehicleName || v.name || 'Unknown',
          site_name: v.siteName
        };
      });

      let userVehicles = enrichedVehicles;
      if (user.role !== 'super_admin' && user.role !== 'admin') {
        if (user.assigned_sites?.length) {
          userVehicles = enrichedVehicles.filter((v: Record<string, unknown>) =>
            user.assigned_sites.includes(v.siteId)
          );
        } else if (user.assigned_vehicles?.length) {
          userVehicles = enrichedVehicles.filter((v: Record<string, unknown>) =>
            user.assigned_vehicles.includes(v.vehicleRef || v.id)
          );
        }
      }

      if (wantsCompliance) {
        reports.compliance = generateComplianceData(userVehicles, startDate);
      }
      if (wantsCosts) {
        const totalWashes = userVehicles.reduce((s: number, v: Record<string, unknown>) =>
          s + ((v.washes_completed as number) || 0), 0
        );
        reports.costs = {
          summary: {
            totalCost: 0,
            monthlyAverage: 0,
            recordCount: 0,
            totalWashes,
            washSummary: `Total washes in period: ${totalWashes}`
          },
          dateRange: `${new Date(startStr).toLocaleDateString()} - ${new Date(endStr).toLocaleDateString()}`
        };
      }
      vehiclesForEmail = userVehicles;
      dateRangeForEmail = { start: startStr, end: endStr };
    }

    const hasCsv = !!(vehiclesForEmail?.length && !excelBase64);
    const hasPdf = !!pdfBase64;
    const hasExcel = !!excelBase64;
    const emailHTML = generateEmailHTML(reports, branding, userEmail, { hasCsv, hasPdf, hasExcel });

    if (previewOnly) {
      return new Response(JSON.stringify({
        success: true,
        preview: true,
        html: emailHTML,
        data: reports
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const mailgunDomain = Deno.env.get('MAILGUN_DOMAIN') || 'sandbox.mailgun.org';
    const fromAddr = `ELORA Compliance <postmaster@${mailgunDomain}>`;

    const attachments: Attachment[] = [];
    // Only attach CSV when client does not send Excel (e.g. scheduled reports); "Email me now" sends Excel instead
    const vehiclesForCsv = (vehiclesForEmail || []).slice(0, 500);
    const csvContent = !excelBase64 && vehiclesForCsv.length
      ? buildVehicleCsv(vehiclesForCsv, dateRangeForEmail)
      : null;
    if (csvContent) {
      attachments.push({ filename: `fleet_compliance_${now.toISOString().slice(0, 10)}.csv`, content: csvContent, type: 'text', contentType: 'text/csv' });
    }
    if (pdfBase64 && pdfFilename) {
      attachments.push({ filename: pdfFilename, content: pdfBase64, type: 'base64', contentType: 'application/pdf' });
    }
    if (excelBase64 && excelFilename) {
      attachments.push({ filename: excelFilename, content: excelBase64, type: 'base64', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }

    const emailResult = await sendViaEmailgun(
      userEmail,
      `${branding.company_name || 'ELORA'} - Fleet Compliance Report`,
      emailHTML,
      fromAddr,
      attachments.length ? attachments : undefined
    );

    try {
      const { data: prefs } = await supabase
        .from('email_report_preferences')
        .select('*')
        .eq('user_email', userEmail);
      if (prefs && prefs.length > 0) {
        await supabase
          .from('email_report_preferences')
          .update({ last_sent: now.toISOString() })
          .eq('id', prefs[0].id);
      }
    } catch (e) {
      console.warn('Update last_sent error:', e);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Email report sent successfully',
      recipient: userEmail,
      id: emailResult.id
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('sendEmailReport error:', error);
    const err = error instanceof Error ? error : new Error(String(error));
    return new Response(JSON.stringify({
      error: err.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function buildVehicleCsv(
  vehicles: Array<{ name?: string; site_name?: string; washes_completed?: number; target?: number; last_scan?: string }>,
  dateRange?: { start?: string; end?: string }
): string {
  const headers = ['Vehicle Name', 'Site', 'Washes Completed', 'Target', 'Compliance %', 'Status', 'Last Wash'];
  const rows = vehicles.map(v => {
    const target = v.target ?? 12;
    const completed = v.washes_completed ?? 0;
    const pct = target > 0 ? Math.min(100, Math.round((completed / target) * 100)) : 0;
    const status = completed >= target ? 'Compliant' : 'At Risk';
    const lastWash = v.last_scan ? new Date(v.last_scan).toLocaleString() : 'Never';
    return [v.name || 'Unknown', v.site_name || 'N/A', completed, target, `${pct}%`, status, lastWash];
  });
  const escape = (s: string) => /[,"\n]/.test(s) ? `"${String(s).replace(/"/g, '""')}"` : s;
  const lines = [headers.map(escape).join(','), ...rows.map(r => r.map(v => escape(String(v))).join(','))];
  const dateLabel = dateRange?.start && dateRange?.end ? `\nPeriod: ${dateRange.start} - ${dateRange.end}` : '';
  return `ELORA Fleet Compliance Report${dateLabel}\n\n${lines.join('\n')}`;
}

function generateComplianceData(
  vehicles: Array<{ washes_completed?: number; target?: number; name?: string; site_name?: string }>,
  startDate: Date
) {
  const targetDefault = 12;
  const compliant = vehicles.filter(v =>
    (v.washes_completed ?? 0) >= (v.target ?? targetDefault)
  );
  const atRisk = vehicles.filter(v =>
    (v.washes_completed ?? 0) < (v.target ?? targetDefault)
  );
  const total = vehicles.length;
  const complianceRate = total > 0 ? Math.round((compliant.length / total) * 100) : 0;

  const alerts: Array<{ title: string; message: string }> = [];
  if (atRisk.length > 0) {
    alerts.push({
      title: 'Low Compliance Alert',
      message: `${atRisk.length} vehicle(s) are below the compliance threshold and require attention.`
    });
  }

  return {
    summary: {
      averageCompliance: complianceRate,
      totalVehicles: total,
      compliantVehicles: compliant.length,
      atRiskVehicles: atRisk.length,
      alerts
    },
    vehicles: vehicles.slice(0, 20).map(v => {
      const target = v.target ?? 12;
      const completed = v.washes_completed ?? 0;
      const pct = target > 0 ? Math.min(100, Math.round((completed / target) * 100)) : 0;
      return {
        name: v.name || 'Unknown',
        site: v.site_name || 'N/A',
        complianceRate: pct,
        washesCompleted: completed,
        targetWashes: target,
        status: completed >= target ? 'Compliant' : 'At Risk'
      };
    }),
    dateRange: `${startDate.toLocaleDateString()} - ${new Date().toLocaleDateString()}`
  };
}

function generateEmailHTML(
  reports: Record<string, unknown>,
  branding: { company_name?: string; logo_url?: string; primary_color?: string; secondary_color?: string },
  _userEmail: string,
  attachments: { hasCsv?: boolean; hasPdf?: boolean; hasExcel?: boolean } = {}
) {
  const primaryColor = branding?.primary_color || '#003DA5';
  const secondaryColor = branding?.secondary_color || '#00A3E0';
  const companyName = branding?.company_name || 'ELORA Solutions';
  const logoUrl = branding?.logo_url;
  const hasCsv = attachments?.hasCsv ?? false;
  const hasPdf = attachments?.hasPdf ?? false;
  const hasExcel = attachments?.hasExcel ?? false;
  const parts: string[] = [];
  if (hasPdf) parts.push('PDF report');
  if (hasExcel) parts.push('Excel file');
  if (hasCsv && !hasExcel) parts.push('CSV file');
  const attachmentLine = parts.length ? ` ${parts.join(' and ')} with vehicle details ${parts.length === 1 ? 'is' : 'are'} attached to this email.` : '';

  let content = `
    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      Here is your fleet compliance report. Below you'll find insights into your fleet's performance.${attachmentLine}
    </p>
  `;

  const c = reports.compliance as { summary?: { averageCompliance?: number; totalVehicles?: number; compliantVehicles?: number; atRiskVehicles?: number; alerts?: Array<{ title: string; message: string }> } } | undefined;
  if (c?.summary) {
    const s = c.summary;
    content += `
      <div style="margin: 40px 0 20px 0;">
        <h2 style="color: #0f172a; font-size: 24px; font-weight: 700; margin: 0;">Compliance Overview</h2>
        <div style="height: 3px; width: 60px; background: linear-gradient(90deg, ${primaryColor} 0%, ${secondaryColor} 100%); border-radius: 2px; margin-top: 12px;"></div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 30px;">
        <div style="background: #f8fafc; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); border-left: 4px solid ${primaryColor};">
          <h3 style="color: #334155; font-size: 14px; font-weight: 600; margin: 0 0 8px 0;">Compliance Rate</h3>
          <p style="color: ${primaryColor}; font-size: 32px; font-weight: 700; margin: 0;">${s.averageCompliance ?? 0}%</p>
          <p style="color: #64748b; font-size: 14px; margin: 0;">% of vehicles meeting target</p>
        </div>
        <div style="background: #f8fafc; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); border-left: 4px solid ${secondaryColor};">
          <h3 style="color: #334155; font-size: 14px; font-weight: 600; margin: 0 0 8px 0;">Total Vehicles</h3>
          <p style="color: ${secondaryColor}; font-size: 32px; font-weight: 700; margin: 0;">${s.totalVehicles ?? 0}</p>
          <p style="color: #64748b; font-size: 14px; margin: 0;">In your fleet</p>
        </div>
      </div>
      ${(s.alerts && s.alerts.length > 0) ? s.alerts.map((a: { title: string; message: string }) => `
        <div style="background: #eff6ff; border-left: 4px solid ${primaryColor}; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h4 style="color: #1e40af; font-size: 16px; font-weight: 600; margin: 0 0 8px 0;">${a.title}</h4>
          <p style="color: #1e3a8a; font-size: 14px; margin: 0;">${a.message}</p>
        </div>
      `).join('') : ''}
    `;
  }

  const costs = reports.costs as { summary?: { totalWashes?: number; washSummary?: string } } | undefined;
  if (costs?.summary) {
    const cs = costs.summary;
    content += `
      <div style="margin: 40px 0 20px 0;">
        <h2 style="color: #0f172a; font-size: 24px; font-weight: 700; margin: 0;">Cost & Usage Summary</h2>
        <div style="height: 3px; width: 60px; background: linear-gradient(90deg, ${primaryColor} 0%, ${secondaryColor} 100%); border-radius: 2px; margin-top: 12px;"></div>
      </div>
      <div style="background: #f8fafc; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); border-left: 4px solid ${primaryColor}; margin-bottom: 30px;">
        <h3 style="color: #334155; font-size: 14px; font-weight: 600; margin: 0 0 8px 0;">Total Washes (Period)</h3>
        <p style="color: ${primaryColor}; font-size: 32px; font-weight: 700; margin: 0;">${cs.totalWashes ?? 0}</p>
        <p style="color: #64748b; font-size: 14px; margin: 0;">${cs.washSummary ?? 'In selected period'}</p>
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Fleet Compliance Report</title>
    </head>
    <body style="margin: 0; padding: 0; background: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="max-width: 680px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,61,165,0.08);">
        <div style="background: linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%); padding: 24px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
            <tr>
              <td style="width: 28%; vertical-align: middle; text-align: left;">
                <div style="display: inline-flex; align-items: center; gap: 12px;">
                  ${logoUrl ? `<img src="${logoUrl}" alt="" style="max-height: 36px; max-width: 120px; object-fit: contain; filter: brightness(0) invert(1);" />` : ''}
                  <span style="color: rgba(255,255,255,0.98); font-size: 14px; font-weight: 600;">${companyName}</span>
                </div>
              </td>
              <td style="width: 44%; vertical-align: middle; text-align: center;">
                <h1 style="color: rgba(255,255,255,0.98); margin: 0; font-size: 24px; font-weight: 700;">Fleet Compliance Report</h1>
                <p style="color: rgba(255,255,255,0.75); margin: 4px 0 0 0; font-size: 12px;">${companyName}</p>
              </td>
              <td style="width: 28%; vertical-align: middle; text-align: center;">
                <div style="display: inline-block; text-align: center;">
                  <div style="margin-bottom: 6px;"><img src="https://yyqspdpk0yebvddv.public.blob.vercel-storage.com/233633501.png" alt="" style="height: 32px; width: auto; object-fit: contain; display: block; margin: 0 auto;" /></div>
                  <span style="color: rgba(255,255,255,0.85); font-size: 11px; font-weight: 600;">Powered by Elora Solutions</span>
                </div>
              </td>
            </tr>
          </table>
          <div style="height: 3px; background: linear-gradient(90deg, rgba(0,221,57,0.6), #7cc43e); margin-top: 12px;"></div>
        </div>
        <div style="padding: 40px 30px;">
          ${content}
        </div>
        <div style="background: #f8fafc; padding: 30px 20px; text-align: center; border-top: 2px solid #e2e8f0;">
          <p style="color: #475569; font-size: 14px; margin: 0;">Report from ${companyName} Compliance Portal</p>
          <p style="color: #64748b; font-size: 12px; margin: 10px 0 0 0; display: inline-flex; align-items: center; flex-wrap: nowrap; justify-content: center; gap: 8px;">
            <img src="https://yyqspdpk0yebvddv.public.blob.vercel-storage.com/233633501.png" alt="" style="height: 22px; width: auto; object-fit: contain; flex-shrink: 0; display: inline-block; vertical-align: middle;" />
            <span style="white-space: nowrap;">Powered by ELORA · © ${new Date().getFullYear()}</span>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}
