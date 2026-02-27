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
      const primaryColor = (clientBranding?.primary_color as string) || '#7CB342';
      const secondaryColor = (clientBranding?.secondary_color as string) || '#9CCC65';
      const companyName = (clientBranding?.company_name as string) || 'ELORA Solutions';
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
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:680px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,61,165,0.08);">
    <div style="background:linear-gradient(135deg,${primaryColor} 0%,${secondaryColor} 100%);padding:24px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <td style="width:28%;vertical-align:middle;text-align:left;">
            <div style="display:inline-flex;align-items:center;gap:12px;">
              ${logoUrl ? `<img src="${logoUrl}" alt="" style="max-height:36px;max-width:120px;object-fit:contain;filter:brightness(0) invert(1);" />` : ''}
              <span style="color:rgba(255,255,255,0.98);font-size:14px;font-weight:600;">${companyName}</span>
            </div>
          </td>
          <td style="width:44%;vertical-align:middle;text-align:center;">
            <h1 style="color:rgba(255,255,255,0.98);margin:0;font-size:24px;font-weight:700;">New Proposed Scan Card Parameters</h1>
            <p style="color:rgba(255,255,255,0.75);margin:4px 0 0 0;font-size:12px;">${customer_name} · ${site_name}</p>
            <p style="color:rgba(255,255,255,0.7);margin:2px 0 0 0;font-size:11px;">Submitted by ${row.submitted_by_email}</p>
          </td>
          <td style="width:28%;vertical-align:middle;text-align:center;">
            <div style="display:inline-block;text-align:center;">
              <div style="margin-bottom:6px;"><img src="${eloraLogoUrl}" alt="" style="height:32px;width:auto;object-fit:contain;display:block;margin:0 auto;" /></div>
              <span style="color:rgba(255,255,255,0.85);font-size:11px;font-weight:600;">Powered by Elora Solutions</span>
            </div>
          </td>
        </tr>
      </table>
      <div style="height:3px;width:60px;background:linear-gradient(90deg,${primaryColor} 0%,${secondaryColor} 100%);border-radius:2px;margin-top:12px;"></div>
    </div>
    <div style="padding:40px 30px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;border-collapse:collapse;">
        <tr><td style="padding:16px 20px;">
          <p style="color:#64748b;font-size:12px;margin:0;">Site context</p>
          <p style="color:#0f172a;font-size:14px;font-weight:600;margin:4px 0 0 0;">${row.truck_count} trucks · $${Number(row.price_per_litre).toFixed(2)}/L · ${row.dispensing_rate_l_per_60s}L/60s</p>
          <p style="color:#64748b;font-size:11px;margin:8px 0 0 0;">Customer ref: ${customer_ref} · Site ref: ${site_ref}</p>
        </td></tr>
      </table>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
        <tr><td style="padding:18px 20px;">
          <p style="color:#475569;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 10px 0;">Current parameters</p>
          <p style="color:#0f172a;font-size:14px;margin:0;">Wash time <strong>${row.current_wash_time_sec}s</strong> · Washes/day <strong>${row.current_washes_per_day}</strong> · Washes/week <strong>${row.current_washes_per_week}</strong></p>
        </td></tr>
      </table>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border-radius:10px;border:1px solid #e2e8f0;">
        <tr><td style="padding:18px 20px;">
          <p style="color:#1e40af;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 10px 0;">Proposed parameters</p>
          <p style="color:#0f172a;font-size:14px;margin:0;">Wash time <strong>${row.proposed_wash_time_sec}s</strong> · Washes/day <strong>${row.proposed_washes_per_day}</strong> · Washes/week <strong>${row.proposed_washes_per_week}</strong></p>
        </td></tr>
      </table>
      <p style="color:#94a3b8;font-size:11px;margin:20px 0 0 0;">Proposal ID: ${inserted?.id ?? '—'} · ${createdAt}</p>
    </div>
    <div style="background:#f8fafc;padding:30px 20px;text-align:center;border-top:2px solid #e2e8f0;">
      <p style="color:#64748b;font-size:14px;margin:0 0 10px 0;">This is an automated report from ${companyName} Compliance Portal</p>
      <p style="color:#94a3b8;font-size:12px;margin:0;">© ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
    </div>
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
