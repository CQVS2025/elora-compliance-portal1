import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createSupabaseAdminClient } from '../_shared/supabase.ts';

/**
 * Sends an email to the delivery manager (agent) who submitted an order request
 * when a superadmin/manager changes the order status (approved, rejected, ordered, in_transit, delivered).
 * Uses the same theme and Elora logo as other portal emails (sendEmailReport).
 *
 * Body: { orderRequestId: string, newStatus: string, deciderName?: string }
 * Requires: MAILGUN_API_KEY, MAILGUN_DOMAIN
 */

const ELORA_LOGO_URL = 'https://yyqspdpk0yebvddv.public.blob.vercel-storage.com/233633501.png';
const PRIMARY_COLOR = '#003DA5';
const SECONDARY_COLOR = '#00A3E0';
const COMPANY_NAME = 'ELORA Solutions';

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

/** Status-specific colors and styling for the email status block */
function getStatusStyle(status: string): { bg: string; border: string; text: string; label: string } {
  const s = (status || '').toLowerCase();
  if (s === 'approved') return { bg: '#ecfdf5', border: '#059669', text: '#047857', label: 'Approved' };
  if (s === 'rejected') return { bg: '#fef2f2', border: '#dc2626', text: '#b91c1c', label: 'Rejected' };
  if (s === 'ordered') return { bg: '#eff6ff', border: '#2563eb', text: '#1d4ed8', label: 'Ordered' };
  if (s === 'in_transit') return { bg: '#f5f3ff', border: '#7c3aed', text: '#5b21b6', label: 'In transit' };
  if (s === 'delivered') return { bg: '#ecfdf5', border: '#059669', text: '#047857', label: 'Delivered' };
  if (s === 'pending') return { bg: '#fffbeb', border: '#d97706', text: '#b45309', label: 'Pending' };
  return { bg: '#f8fafc', border: '#64748b', text: '#475569', label: status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ') };
}

type CompanyBranding = { name: string; logo_url: string | null; primary_color: string; secondary_color: string } | null;

function buildEmailHtml(
  requesterName: string,
  newStatus: string,
  deciderName: string | null,
  requestDate: string,
  priority: string,
  notes: string | null,
  siteRef: string | null,
  items: Array<{ description: string; qty: number; priceCents: number | null }>,
  company: CompanyBranding
): string {
  const primaryColor = company?.primary_color || PRIMARY_COLOR;
  const secondaryColor = company?.secondary_color || SECONDARY_COLOR;
  const companyName = company?.name || COMPANY_NAME;
  const leftLogoUrl = company?.logo_url?.trim() ? company.logo_url : ELORA_LOGO_URL;
  const leftLogoAlt = company?.logo_url?.trim() ? companyName : 'ELORA';
  const leftLabel = company?.logo_url?.trim() ? companyName : 'Powered by Elora Solutions';
  const statusLabel = newStatus.charAt(0).toUpperCase() + newStatus.slice(1).replace(/_/g, ' ');
  const statusStyle = getStatusStyle(newStatus);
  const deciderText = deciderName ? ` ${deciderName} has` : ' Your request has been';
  const intro =
    newStatus === 'approved'
      ? `${deciderText} approved your order request. It will be processed and you will be notified as it progresses.`
      : newStatus === 'rejected'
        ? `${deciderText} rejected your order request.`
        : `${deciderText} updated the status to: ${statusLabel}.`;

  const rows =
    items.length > 0
      ? items
        .map(
          (i) =>
            `<tr style="background:#fff;"><td style="padding:10px 12px;font-size:12px;color:#0f172a;border-bottom:1px solid #e5e7eb;">${escapeHtml(i.description)}</td><td style="padding:10px 12px;font-size:12px;color:#374151;border-bottom:1px solid #e5e7eb;">${i.qty}</td><td style="padding:10px 12px;font-size:12px;color:#374151;border-bottom:1px solid #e5e7eb;">${i.priceCents != null ? `$${(i.priceCents / 100).toFixed(2)}` : '—'}</td></tr>`
        )
        .join('')
      : '<tr><td colspan="3" style="padding:12px;color:#64748b;font-size:12px;">No items</td></tr>';

  const metaRows = [
    ['Request date', requestDate],
    ['Priority', priority],
    ...(siteRef ? [['Site', siteRef]] : []),
  ].map(([k, v]) => `<tr style="background:#f8fafc;"><td style="padding:8px 12px;font-size:12px;color:#64748b;">${k}</td><td style="padding:8px 12px;font-size:12px;color:#0f172a;">${escapeHtml(v)}</td></tr>`).join('');

  const notesBlock =
    notes && notes.trim()
      ? `<div style="background:#f1f5f9;border-radius:8px;padding:12px;margin:16px 0;"><p style="margin:0;font-size:12px;color:#475569;"><strong>Notes:</strong> ${escapeHtml(notes.trim())}</p></div>`
      : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>Order Request Update</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:680px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,61,165,0.08);">
    <div style="background:linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%);padding:24px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
           <td style="width:28%;vertical-align:middle;text-align:center;">
            <div style="display:inline-block;text-align:center;">
              <div style="margin-bottom:6px;"><img src="${leftLogoUrl}" alt="${escapeHtml(leftLogoAlt)}" style="max-height:36px;max-width:120px;object-fit:contain;display:block;margin:0 auto;${company?.logo_url?.trim() ? '' : 'filter:brightness(0) invert(1);'}"/></div>
              <span style="color:rgba(255,255,255,0.85);font-size:11px;font-weight:600;">${escapeHtml(leftLabel)}</span>
            </div>
          </td>
          <td style="width:44%;vertical-align:middle;text-align:center;">
            <h1 style="color:rgba(255,255,255,0.98);margin:0;font-size:24px;font-weight:700;">Stock &amp; Orders</h1>
            <p style="color:rgba(255,255,255,0.75);margin:4px 0 0 0;font-size:12px;">Order request update</p>
          </td>
          <td style="width:28%;vertical-align:middle;text-align:center;">
            <div style="display:inline-block;text-align:center;">
              <div style="margin-bottom:6px;"><img src="${ELORA_LOGO_URL}" alt="" style="height:32px;width:auto;object-fit:contain;display:block;margin:0 auto;"/></div>
              <span style="color:rgba(255,255,255,0.85);font-size:11px;font-weight:600;">Powered by Elora Solutions</span>
            </div>
          </td>
        </tr>
      </table>
      <div style="height:3px;background:linear-gradient(90deg,rgba(0,221,57,0.6),#7cc43e);margin-top:12px;"></div>
    </div>
    <div style="padding:40px 30px;">
      <p style="color:#475569;font-size:16px;line-height:1.6;margin:0 0 24px 0;">Hi ${escapeHtml(requesterName)},</p>
      <p style="color:#0f172a;font-size:16px;line-height:1.6;margin:0 0 24px 0;">${intro}</p>
      <div style="margin:28px 0 24px 0;background:${statusStyle.bg};border-left:6px solid ${statusStyle.border};border-radius:0 12px 12px 0;padding:20px 24px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <p style="margin:0 0 6px 0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:${statusStyle.text};">Current status</p>
        <p style="margin:0;font-size:22px;font-weight:700;color:${statusStyle.text};">${escapeHtml(statusStyle.label)}</p>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:16px;">
        <thead><tr style="background:#f8fafc;"><th style="padding:10px 12px;font-size:11px;color:#64748b;text-align:left;text-transform:uppercase;">Detail</th><th style="padding:10px 12px;font-size:11px;color:#64748b;text-align:left;">Value</th></tr></thead>
        <tbody>${metaRows}</tbody>
      </table>
      ${notesBlock}
      <h3 style="color:#334155;font-size:14px;font-weight:600;margin:24px 0 8px 0;">Requested items</h3>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <thead><tr style="background:#f8fafc;"><th style="padding:10px 12px;font-size:11px;color:#64748b;text-align:left;">Part</th><th style="padding:10px 12px;font-size:11px;color:#64748b;">Qty</th><th style="padding:10px 12px;font-size:11px;color:#64748b;">Price</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="background:#f8fafc;padding:30px 20px;text-align:center;border-top:2px solid #e2e8f0;">
      <p style="color:#475569;font-size:14px;margin:0;">${escapeHtml(companyName)} Compliance Portal · Stock &amp; Orders</p>
      <p style="color:#64748b;font-size:12px;margin:10px 0 0 0;display:inline-flex;align-items:center;justify-content:center;gap:8px;">
        <img src="${ELORA_LOGO_URL}" alt="" style="height:22px;width:auto;object-fit:contain;"/>
        <span>Powered by ELORA · © ${new Date().getFullYear()}</span>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = await req.json();
    const orderRequestId = body.orderRequestId as string | undefined;
    const newStatus = (body.newStatus as string) || '';
    const deciderName = (body.deciderName as string) || null;

    if (!orderRequestId || !newStatus) {
      return new Response(
        JSON.stringify({ error: 'orderRequestId and newStatus are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createSupabaseAdminClient();

    const { data: order, error: orderError } = await supabase
      .from('order_requests')
      .select('id, requested_by, company_id, priority, notes, site_ref, created_at')
      .eq('id', orderRequestId)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: 'Order request not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let company: CompanyBranding = null;
    if (order.company_id) {
      const { data: companyRow } = await supabase
        .from('companies')
        .select('name, logo_url, primary_color, secondary_color')
        .eq('id', order.company_id)
        .single();
      if (companyRow) {
        company = {
          name: companyRow.name || COMPANY_NAME,
          logo_url: companyRow.logo_url ?? null,
          primary_color: companyRow.primary_color || PRIMARY_COLOR,
          secondary_color: companyRow.secondary_color || SECONDARY_COLOR,
        };
      }
    }

    const { data: requesterProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, email, full_name')
      .eq('id', order.requested_by)
      .single();

    if (profileError || !requesterProfile?.email) {
      return new Response(
        JSON.stringify({ error: 'Requester profile or email not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: items, error: itemsError } = await supabase
      .from('order_request_items')
      .select('part_id, qty_requested, unit_price_cents_snapshot, parts(description)')
      .eq('order_request_id', orderRequestId);

    if (itemsError) {
      return new Response(
        JSON.stringify({ error: 'Failed to load order items' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const itemRows = (items || []).map((row: { parts?: { description?: string } | null; part_id?: string; qty_requested?: number; unit_price_cents_snapshot?: number | null }) => ({
      description: row.parts?.description ?? row.part_id ?? 'Unknown',
      qty: row.qty_requested ?? 0,
      priceCents: row.unit_price_cents_snapshot ?? null,
    }));

    const requestDate = order.created_at
      ? new Date(order.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
      : '';

    const html = buildEmailHtml(
      requesterProfile.full_name || requesterProfile.email || 'there',
      newStatus,
      deciderName,
      requestDate,
      order.priority || 'MEDIUM',
      order.notes,
      order.site_ref,
      itemRows,
      company
    );

    const subject = `${company?.name || COMPANY_NAME} – Order request ${newStatus.replace(/_/g, ' ')}`;
    const mailgunDomain = Deno.env.get('MAILGUN_DOMAIN') || 'sandbox.mailgun.org';
    const fromAddr = `${COMPANY_NAME} <postmaster@${mailgunDomain}>`;

    await sendViaMailgun(requesterProfile.email, subject, html, fromAddr);

    return new Response(
      JSON.stringify({ success: true, message: 'Notification sent', to: requesterProfile.email }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('sendOrderStatusNotification error:', error);
    const err = error instanceof Error ? error : new Error(String(error));
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
