import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { createSupabaseAdminClient } from '../_shared/supabase.ts';

/**
 * Submit Pricing Calculator proposal: save to DB and email notify address.
 * Supabase secret: PRICING_PROPOSAL_NOTIFY_EMAIL (e.g. smartitservices98@gmail.com)
 * Uses MAILGUN_API_KEY and MAILGUN_DOMAIN for sending.
 */

type Attachment = { filename: string; content: string; type?: 'text' | 'base64'; contentType?: string };

async function sendViaMailgun(
  to: string,
  subject: string,
  html: string,
  from: string,
  attachments?: Attachment[]
): Promise<void> {
  const apiKey = Deno.env.get('MAILGUN_API_KEY');
  const domain = Deno.env.get('MAILGUN_DOMAIN');
  const baseUrl = Deno.env.get('MAILGUN_BASE_URL') || 'https://api.mailgun.net';
  if (!apiKey || !domain) throw new Error('MAILGUN_API_KEY and MAILGUN_DOMAIN must be set');
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
    headers: { Authorization: `Basic ${auth}` },
    body: formData,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Mailgun: ${text}`);
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = await req.json();
    const {
      company_id,
      customer_ref,
      customer_name,
      site_ref,
      site_name,
      current_wash_time_sec,
      current_washes_per_day,
      current_washes_per_week,
      proposed_wash_time_sec,
      proposed_washes_per_day,
      proposed_washes_per_week,
      submitted_by_email,
      dispensing_rate_l_per_60s,
      price_per_litre,
      truck_count,
      branding: clientBranding,
      send_notification = true,
    } = body;

    if (!company_id || !customer_ref || !customer_name || !site_ref || !site_name || submitted_by_email == null) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace(/Bearer\s+/i, '')?.trim();
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabaseUser = createSupabaseClient(req);
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const row = {
      company_id,
      customer_ref,
      customer_name,
      site_ref,
      site_name,
      current_wash_time_sec: Number(current_wash_time_sec) ?? 120,
      current_washes_per_day: Number(current_washes_per_day) ?? 2,
      current_washes_per_week: Number(current_washes_per_week) ?? 3,
      proposed_wash_time_sec: Number(proposed_wash_time_sec) ?? 60,
      proposed_washes_per_day: Number(proposed_washes_per_day) ?? 2,
      proposed_washes_per_week: Number(proposed_washes_per_week) ?? 3,
      submitted_by_user_id: user.id,
      submitted_by_email: String(submitted_by_email).trim(),
      dispensing_rate_l_per_60s: Number(dispensing_rate_l_per_60s) || 5,
      price_per_litre: Number(price_per_litre) || 3.85,
      truck_count: Number(truck_count) || 0,
    };

    const { data: inserted, error: insertError } = await supabaseUser
      .from('pricing_calculator_proposals')
      .insert(row)
      .select('id, created_at')
      .single();

    if (insertError) {
      console.error('submitPricingProposal insert error:', insertError);
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sendNotification = send_notification !== false;

    if (sendNotification) {
      const notifyEmail = Deno.env.get('PRICING_PROPOSAL_NOTIFY_EMAIL') || 'smartitservices98@gmail.com';
      const mailgunDomain = Deno.env.get('MAILGUN_DOMAIN') || 'sandbox.mailgun.org';
      const fromAddr = `ELORA Pricing Calculator <postmaster@${mailgunDomain}>`;
      const subject = `Pricing Calculator Proposal: ${customer_name} · ${site_name}`;
      // Match functions/sendEmailReport.ts theme
      const primaryColor = (clientBranding?.primary_color as string) || '#004E2B';
      const secondaryColor = (clientBranding?.secondary_color as string) || '#00DD39';
      const companyName = (clientBranding?.company_name as string) || 'ELORA System';
      const logoUrl = (clientBranding?.logo_url as string) || null;
      const eloraLogoUrl = 'https://yyqspdpk0yebvddv.public.blob.vercel-storage.com/233633501.png';
      const createdAt = inserted?.created_at ? new Date(inserted.created_at).toLocaleString() : '';

      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pricing Calculator Proposal</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:680px;margin:24px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 6px 20px rgba(15,23,42,0.18);">
    <header style="background:linear-gradient(160deg,#004E2B 0%,#003d22 50%,#002a17 100%);padding:0;">
      <div style="padding:20px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td style="width:28%;vertical-align:middle;text-align:center;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:4px;">
                    ${
                      logoUrl
                        ? `<img src="${logoUrl}" alt="${companyName}" style="height:28px;width:auto;object-fit:contain;display:block;margin:0 auto;" />`
                        : `<div style="height:28px;width:28px;border-radius:999px;background:#ffffff;display:block;margin:0 auto;overflow:hidden;">
                            <table role="presentation" width="100%" height="100%"><tr><td align="center" valign="middle" style="font-size:10px;font-weight:700;color:#004E2B;">${(companyName || 'ELORA').slice(0, 3).toUpperCase()}</td></tr></table>
                           </div>`
                    }
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <span style="color:rgba(255,255,255,0.98);font-size:11px;font-weight:600;">${companyName}</span>
                  </td>
                </tr>
              </table>
            </td>
            <td style="width:44%;vertical-align:middle;text-align:center;">
              <h1 style="color:rgba(255,255,255,0.98);margin:0;font-size:20px;font-weight:800;letter-spacing:-0.4px;">New Proposed Scan Card Parameters</h1>
              <p style="color:rgba(255,255,255,0.74);margin:4px 0 0 0;font-size:12px;">${customer_name} · ${site_name}</p>
              <div style="display:inline-block;margin-top:8px;padding:3px 12px;border-radius:999px;border:1px solid rgba(0,221,57,0.25);background:rgba(0,221,57,0.12);color:#bbf7d0;font-size:10px;font-weight:600;letter-spacing:0.3px;">
                Submitted by ${row.submitted_by_email}
              </div>
            </td>
            <td style="width:28%;vertical-align:middle;text-align:center;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:4px;">
                    <img src="${eloraLogoUrl}" alt="Elora" style="height:28px;width:auto;object-fit:contain;display:block;margin:0 auto;" />
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <span style="color:rgba(255,255,255,0.9);font-size:11px;font-weight:600;letter-spacing:0.3px;">Elora Solutions</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
      <div style="height:3px;background:linear-gradient(90deg,#00DD39,#7cc43e);"></div>
    </header>
    <main style="padding:24px 32px 28px 32px;">
      <p style="color:#475569;font-size:14px;line-height:1.6;margin:5px 0 16px 10px;">
        A new pricing calculator proposal has been submitted for <span style="font-weight:600;color:#0f172a;">${customer_name} · ${site_name}</span>.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px 0;border-collapse:separate;border-spacing:12px 0;">
        <tr>
          <td style="width:50%;vertical-align:top;">
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;">
              <div style="color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;margin:0 0 4px 0;">Site context</div>
              <div style="color:#0f172a;font-size:15px;font-weight:700;margin:0 0 2px 0;">${row.truck_count} trucks</div>
              <div style="color:#94a3b8;font-size:11px;margin:0;">$${Number(row.price_per_litre).toFixed(2)}/L · ${row.dispensing_rate_l_per_60s}L/60s</div>
              <div style="color:#94a3b8;font-size:11px;margin:4px 0 0 0;">Customer ref: ${customer_ref} · Site ref: ${site_ref}</div>
            </div>
          </td>
          <td style="width:50%;vertical-align:top;">
            <div style="background:#ecfdf5;border:1px solid #bbf7d0;border-radius:10px;padding:12px 14px;">
              <div style="color:#16a34a;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;margin:0 0 4px 0;">Change summary</div>
              <div style="color:#166534;font-size:13px;margin:0 0 2px 0;">Wash time: <strong>${row.current_wash_time_sec}s → ${row.proposed_wash_time_sec}s</strong></div>
              <div style="color:#166534;font-size:13px;margin:0 0 2px 0;">Washes/day: <strong>${row.current_washes_per_day} → ${row.proposed_washes_per_day}</strong></div>
              <div style="color:#166534;font-size:13px;margin:0;">Washes/week: <strong>${row.current_washes_per_week} → ${row.proposed_washes_per_week}</strong></div>
            </div>
          </td>
        </tr>
      </table>
      <div style="margin-top:10px;">
        <h2 style="color:#0f172a;font-size:15px;font-weight:700;margin:5px 0 8px 10px;">Parameter details</h2>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:8px 12px;font-size:11px;color:#6b7280;text-align:left;text-transform:uppercase;letter-spacing:0.5px;">Metric</th>
              <th style="padding:8px 12px;font-size:11px;color:#6b7280;text-align:left;text-transform:uppercase;letter-spacing:0.5px;">Current</th>
              <th style="padding:8px 12px;font-size:11px;color:#6b7280;text-align:left;text-transform:uppercase;letter-spacing:0.5px;">Proposed</th>
            </tr>
          </thead>
          <tbody>
            <tr style="background:#ffffff;">
              <td style="padding:8px 12px;font-size:12px;color:#0f172a;border-bottom:1px solid #e5e7eb;">Wash time (seconds)</td>
              <td style="padding:8px 12px;font-size:12px;color:#4b5563;border-bottom:1px solid #e5e7eb;">${row.current_wash_time_sec}s</td>
              <td style="padding:8px 12px;font-size:12px;color:#0f172a;font-weight:600;border-bottom:1px solid #e5e7eb;">${row.proposed_wash_time_sec}s</td>
            </tr>
            <tr style="background:#f9fafb;">
              <td style="padding:8px 12px;font-size:12px;color:#0f172a;border-bottom:1px solid #e5e7eb;">Washes per day</td>
              <td style="padding:8px 12px;font-size:12px;color:#4b5563;border-bottom:1px solid #e5e7eb;">${row.current_washes_per_day}</td>
              <td style="padding:8px 12px;font-size:12px;color:#0f172a;font-weight:600;border-bottom:1px solid #e5e7eb;">${row.proposed_washes_per_day}</td>
            </tr>
            <tr style="background:#ffffff;">
              <td style="padding:8px 12px;font-size:12px;color:#0f172a;border-bottom:1px solid #e5e7eb;">Washes per week</td>
              <td style="padding:8px 12px;font-size:12px;color:#4b5563;border-bottom:1px solid #e5e7eb;">${row.current_washes_per_week}</td>
              <td style="padding:8px 12px;font-size:12px;color:#0f172a;font-weight:600;border-bottom:1px solid #e5e7eb;">${row.proposed_washes_per_week}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p style="color:#94a3b8;font-size:11px;margin:18px 0 0 10px;">Proposal ID: ${inserted?.id ?? '—'} · ${createdAt}</p>
    </main>
    <footer style="background:linear-gradient(180deg,#f7f8fa,#f0faf5);padding:18px 24px;border-top:1px solid #d1e8da;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <td align="left" style="vertical-align:middle;padding:4px 0;">
            <p style="color:#64748b;font-size:12px;margin:0;">This automated email was sent from the ${companyName} Compliance Portal.</p>
          </td>
          <td align="right" style="vertical-align:middle;padding:4px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;display:inline-table;">
              <tr>
                <td style="vertical-align:middle;padding-right:6px;">
                  <img src="${eloraLogoUrl}" alt="Elora" style="height:18px;width:auto;object-fit:contain;display:block;" />
                </td>
                <td style="vertical-align:middle;">
                  <span style="color:#64748b;font-size:11px;font-weight:500;white-space:nowrap;">Powered by ELORA · © ${new Date().getFullYear()}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </footer>
  </div>
</body>
</html>`;

      try {
        await sendViaMailgun(notifyEmail, subject, html, fromAddr);
      } catch (mailErr) {
        console.error('submitPricingProposal email error:', mailErr);
        return new Response(JSON.stringify({
          success: true,
          data: inserted,
          message: 'Proposal saved. Notification email failed to send.',
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: inserted,
      message: sendNotification ? 'Proposal saved and notification sent.' : 'Proposed parameters saved.',
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('submitPricingProposal error:', err);
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : 'Internal server error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
