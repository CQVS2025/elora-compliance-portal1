// deno-lint-ignore-file no-explicit-any
/**
 * Shared email rendering + sending for marketplace transactional emails.
 *
 * Provider: Mailgun — the rest of the Elora portal already uses Mailgun for
 * transactional email (see sendOrderStatusNotification, sendEmailReport, etc.).
 * Credentials are read from Supabase project secrets:
 *   - MAILGUN_API_KEY
 *   - MAILGUN_DOMAIN
 *   - MAILGUN_BASE_URL (optional, defaults to https://api.mailgun.net)
 *   - MARKETPLACE_EMAIL_FROM (optional From: header; falls back to
 *       'Elora Marketplace <postmaster@${MAILGUN_DOMAIN}>')
 *
 * Every send writes a marketplace_integration_log row with integration='email',
 * the event_type, the order_id (when known), and the provider response. This
 * gives admin a complete audit trail of every email leaving the system.
 *
 * All 8 marketplace template names are defined as constants below. The
 * render() functions return { subject, html, text } and accept a typed
 * payload. Templates are inline (single file) for now; if the catalogue
 * grows we can split per template.
 */

const MAILGUN_API_KEY = Deno.env.get('MAILGUN_API_KEY') ?? '';
const MAILGUN_DOMAIN = Deno.env.get('MAILGUN_DOMAIN') ?? '';
const MAILGUN_BASE_URL = (Deno.env.get('MAILGUN_BASE_URL') ?? 'https://api.mailgun.net').replace(/\/$/, '');
const FROM_ADDRESS =
  Deno.env.get('MARKETPLACE_EMAIL_FROM') ??
  (MAILGUN_DOMAIN ? `Elora Marketplace <postmaster@${MAILGUN_DOMAIN}>` : 'Elora Marketplace <no-reply@elora.local>');

// ===========================================================================
// Brand palette + shared template scaffolding
// ===========================================================================

const COLORS = {
  primary: '#1e3a8a',      // Elora deep blue
  primaryLight: '#3b82f6',
  text: '#0f172a',
  textMuted: '#64748b',
  border: '#e2e8f0',
  bg: '#f8fafc',
  card: '#ffffff',
  success: '#16a34a',
  warning: '#b45309',
  danger: '#b91c1c',
};

function escapeHtml(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtAUD(n: number | string | null | undefined): string {
  if (n === null || n === undefined) return '$0.00';
  const v = typeof n === 'string' ? parseFloat(n) : n;
  if (!Number.isFinite(v)) return '$0.00';
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2 }).format(v);
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return '';
  try {
    return new Date(s).toLocaleDateString('en-AU', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch { return s; }
}

/** Standard outer template — used by every marketplace email. */
function shell({ title, preheader, bodyHtml }: { title: string; preheader?: string; bodyHtml: string }): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,system-ui,sans-serif;color:${COLORS.text};">
<div style="display:none;max-height:0;overflow:hidden;color:transparent;">${escapeHtml(preheader ?? '')}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.bg};padding:24px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:8px;overflow:hidden;">
        <tr>
          <td style="padding:24px 28px;border-bottom:1px solid ${COLORS.border};">
            <p style="margin:0;font-size:18px;font-weight:600;color:${COLORS.primary};letter-spacing:-0.01em;">ELORA Marketplace</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:18px 28px;border-top:1px solid ${COLORS.border};background:${COLORS.bg};">
            <p style="margin:0;font-size:11px;color:${COLORS.textMuted};line-height:1.5;">
              This email was sent by Elora Marketplace. Need help? Reply to this email and our team will pick it up.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function btn(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:${COLORS.primary};color:#fff;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:6px;font-size:14px;">${escapeHtml(label)}</a>`;
}

function itemRow(item: any): string {
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid ${COLORS.border};font-size:14px;">
      <strong>${escapeHtml(item.product_name)}</strong><br>
      <span style="color:${COLORS.textMuted};font-size:12px;">${escapeHtml(item.packaging_size_name)} × ${escapeHtml(item.quantity)}</span>
    </td>
    <td style="padding:10px 0;border-bottom:1px solid ${COLORS.border};text-align:right;font-size:14px;white-space:nowrap;">${fmtAUD(item.line_subtotal_ex_gst)}</td>
  </tr>`;
}

function totalsBlock(order: any): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;font-size:14px;">
    <tr>
      <td style="padding:4px 0;color:${COLORS.textMuted};">Subtotal (ex-GST)</td>
      <td style="padding:4px 0;text-align:right;">${fmtAUD(order.subtotal_ex_gst)}</td>
    </tr>
    <tr>
      <td style="padding:4px 0;color:${COLORS.textMuted};">Freight (ex-GST)</td>
      <td style="padding:4px 0;text-align:right;">${fmtAUD(order.freight_ex_gst)}</td>
    </tr>
    <tr>
      <td style="padding:4px 0;color:${COLORS.textMuted};">GST (10%)</td>
      <td style="padding:4px 0;text-align:right;">${fmtAUD(order.gst_amount)}</td>
    </tr>
    <tr>
      <td style="padding:8px 0 0;border-top:2px solid ${COLORS.border};font-weight:700;">Total</td>
      <td style="padding:8px 0 0;border-top:2px solid ${COLORS.border};text-align:right;font-weight:700;">${fmtAUD(order.total_amount)}</td>
    </tr>
  </table>`;
}

// ===========================================================================
// Template renderers — 8 canonical marketplace emails
// ===========================================================================

export type EmailTemplate =
  | 'order_placed'
  | 'order_approved'
  | 'order_rejected'
  | 'order_stripe_receipt'
  | 'dispatch_confirmed'
  | 'eta_updated'
  | 'tracking_added'
  | 'admin_new_po_alert';

export const TEMPLATE_NAMES: EmailTemplate[] = [
  'order_placed',
  'order_approved',
  'order_rejected',
  'order_stripe_receipt',
  'dispatch_confirmed',
  'eta_updated',
  'tracking_added',
  'admin_new_po_alert',
];

function renderItemsTable(items: any[]): string {
  if (!items || items.length === 0) return '';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${items.map(itemRow).join('')}</table>`;
}

function deliveryBlock(order: any): string {
  const addr = order.delivery_address ?? {};
  const parts = [
    addr.line1, addr.line2,
    [addr.suburb, addr.state, order.delivery_postcode].filter(Boolean).join(' '),
  ].filter(Boolean);
  return `<p style="margin:0 0 4px;color:${COLORS.textMuted};font-size:12px;text-transform:uppercase;letter-spacing:0.06em;">Delivery to</p>
  <p style="margin:0;font-size:14px;line-height:1.5;">${parts.map(escapeHtml).join('<br>')}</p>`;
}

export function render(template: EmailTemplate, data: any): { subject: string; html: string; text: string } {
  const order = data.order ?? {};
  const items = data.items ?? [];
  const portalBaseUrl = data.portal_base_url ?? Deno.env.get('MARKETPLACE_PORTAL_URL') ?? '';
  const orderUrl = portalBaseUrl ? `${portalBaseUrl}/marketplace/orders/${order.id}` : '';
  const adminOrderUrl = portalBaseUrl ? `${portalBaseUrl}/admin/marketplace/orders/${order.id}` : '';

  switch (template) {
    case 'order_placed': {
      const subject = `Order ${order.order_number} received — under review`;
      const bodyHtml = `
        <h1 style="margin:0 0 8px;font-size:22px;letter-spacing:-0.01em;">Order received</h1>
        <p style="margin:0 0 18px;color:${COLORS.textMuted};font-size:14px;">
          Thanks for placing <strong style="color:${COLORS.text};">${escapeHtml(order.order_number)}</strong>.
          Your purchase order is now under review by the Elora team. We will email you once it is approved.
        </p>
        ${renderItemsTable(items)}
        ${totalsBlock(order)}
        <hr style="border:none;border-top:1px solid ${COLORS.border};margin:24px 0;">
        ${deliveryBlock(order)}
        ${orderUrl ? `<p style="margin-top:24px;">${btn(orderUrl, 'View order')}</p>` : ''}
      `;
      return {
        subject,
        html: shell({ title: subject, preheader: 'Your order is under review.', bodyHtml }),
        text: `Order ${order.order_number} received and is under review. Total: ${fmtAUD(order.total_amount)} inc. GST.`,
      };
    }

    case 'order_approved': {
      const subject = `Order ${order.order_number} approved`;
      const bodyHtml = `
        <h1 style="margin:0 0 8px;font-size:22px;color:${COLORS.success};">Order approved</h1>
        <p style="margin:0 0 18px;color:${COLORS.textMuted};font-size:14px;">
          <strong style="color:${COLORS.text};">${escapeHtml(order.order_number)}</strong> has been approved.
          Our warehouse will dispatch shortly and you will receive a tracking update.
        </p>
        ${renderItemsTable(items)}
        ${totalsBlock(order)}
        <hr style="border:none;border-top:1px solid ${COLORS.border};margin:24px 0;">
        ${deliveryBlock(order)}
        ${orderUrl ? `<p style="margin-top:24px;">${btn(orderUrl, 'View order')}</p>` : ''}
      `;
      return {
        subject,
        html: shell({ title: subject, preheader: 'Your order has been approved.', bodyHtml }),
        text: `Order ${order.order_number} approved. We'll send tracking when it ships.`,
      };
    }

    case 'order_rejected': {
      const subject = `Order ${order.order_number} could not be approved`;
      const bodyHtml = `
        <h1 style="margin:0 0 8px;font-size:22px;color:${COLORS.danger};">Order not approved</h1>
        <p style="margin:0 0 18px;font-size:14px;">
          We were unable to approve <strong>${escapeHtml(order.order_number)}</strong>.
        </p>
        ${order.rejection_reason ? `
        <div style="padding:12px 14px;border:1px solid ${COLORS.border};border-left:4px solid ${COLORS.danger};border-radius:6px;background:${COLORS.bg};">
          <p style="margin:0 0 4px;font-size:12px;color:${COLORS.textMuted};text-transform:uppercase;letter-spacing:0.06em;">Reason</p>
          <p style="margin:0;font-size:14px;white-space:pre-line;">${escapeHtml(order.rejection_reason)}</p>
        </div>` : ''}
        <p style="margin:18px 0 0;font-size:14px;">If you have any questions, just reply to this email and our team will help.</p>
        ${orderUrl ? `<p style="margin-top:24px;">${btn(orderUrl, 'View order')}</p>` : ''}
      `;
      return {
        subject,
        html: shell({ title: subject, preheader: 'Your order was not approved.', bodyHtml }),
        text: `Order ${order.order_number} not approved. ${order.rejection_reason ?? ''}`,
      };
    }

    case 'order_stripe_receipt': {
      const subject = `Payment receipt — order ${order.order_number}`;
      const bodyHtml = `
        <h1 style="margin:0 0 8px;font-size:22px;color:${COLORS.success};">Payment received</h1>
        <p style="margin:0 0 18px;color:${COLORS.textMuted};font-size:14px;">
          Thanks. We have received your card payment for
          <strong style="color:${COLORS.text};">${escapeHtml(order.order_number)}</strong> and the order has been auto-approved.
        </p>
        ${renderItemsTable(items)}
        ${totalsBlock(order)}
        <p style="margin-top:18px;font-size:12px;color:${COLORS.textMuted};">
          A separate Stripe receipt will also be emailed to you for your records.
        </p>
        ${orderUrl ? `<p style="margin-top:24px;">${btn(orderUrl, 'View order')}</p>` : ''}
      `;
      return {
        subject,
        html: shell({ title: subject, preheader: `Payment received for ${order.order_number}.`, bodyHtml }),
        text: `Payment received for ${order.order_number}. Total ${fmtAUD(order.total_amount)} inc. GST.`,
      };
    }

    case 'dispatch_confirmed': {
      const subject = `Order ${order.order_number} dispatched`;
      const bodyHtml = `
        <h1 style="margin:0 0 8px;font-size:22px;">Your order is on the way</h1>
        <p style="margin:0 0 18px;color:${COLORS.textMuted};font-size:14px;">
          <strong style="color:${COLORS.text};">${escapeHtml(order.order_number)}</strong> has been dispatched.
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;">
          ${order.supplier_dispatch_date ? `<tr><td style="padding:6px 0;color:${COLORS.textMuted};width:140px;">Dispatched</td><td>${escapeHtml(fmtDate(order.supplier_dispatch_date))}</td></tr>` : ''}
          ${order.supplier_eta_date ? `<tr><td style="padding:6px 0;color:${COLORS.textMuted};">ETA</td><td>${escapeHtml(fmtDate(order.supplier_eta_date))}</td></tr>` : ''}
          ${order.supplier_tracking_carrier ? `<tr><td style="padding:6px 0;color:${COLORS.textMuted};">Carrier</td><td>${escapeHtml(order.supplier_tracking_carrier)}</td></tr>` : ''}
        </table>
        ${order.supplier_tracking_url ? `<p style="margin-top:16px;">${btn(order.supplier_tracking_url, 'Track shipment')}</p>` : ''}
        ${orderUrl ? `<p style="margin-top:16px;">${btn(orderUrl, 'View order')}</p>` : ''}
      `;
      return {
        subject,
        html: shell({ title: subject, preheader: 'Your order has been dispatched.', bodyHtml }),
        text: `Order ${order.order_number} dispatched.${order.supplier_eta_date ? ' ETA ' + fmtDate(order.supplier_eta_date) + '.' : ''}`,
      };
    }

    case 'eta_updated': {
      const subject = `ETA updated for ${order.order_number}`;
      const bodyHtml = `
        <h1 style="margin:0 0 8px;font-size:22px;">Delivery ETA updated</h1>
        <p style="margin:0 0 18px;font-size:14px;">
          The estimated delivery date for <strong>${escapeHtml(order.order_number)}</strong> has been updated to
          <strong>${escapeHtml(fmtDate(order.supplier_eta_date))}</strong>.
        </p>
        ${orderUrl ? `<p style="margin-top:16px;">${btn(orderUrl, 'View order')}</p>` : ''}
      `;
      return {
        subject,
        html: shell({ title: subject, preheader: 'ETA updated.', bodyHtml }),
        text: `ETA for ${order.order_number}: ${fmtDate(order.supplier_eta_date)}.`,
      };
    }

    case 'tracking_added': {
      const subject = `Tracking added for ${order.order_number}`;
      const bodyHtml = `
        <h1 style="margin:0 0 8px;font-size:22px;">Tracking is now available</h1>
        <p style="margin:0 0 18px;font-size:14px;">
          Tracking has been added for <strong>${escapeHtml(order.order_number)}</strong>${order.supplier_tracking_carrier ? ` via ${escapeHtml(order.supplier_tracking_carrier)}` : ''}.
        </p>
        ${order.supplier_tracking_url ? `<p>${btn(order.supplier_tracking_url, 'Track shipment')}</p>` : ''}
        ${orderUrl ? `<p style="margin-top:16px;">${btn(orderUrl, 'View order')}</p>` : ''}
      `;
      return {
        subject,
        html: shell({ title: subject, preheader: 'Tracking is now available.', bodyHtml }),
        text: `Tracking added for ${order.order_number}. ${order.supplier_tracking_url ?? ''}`,
      };
    }

    case 'admin_new_po_alert': {
      const subject = `New PO order needs review — ${order.order_number}`;
      const bodyHtml = `
        <h1 style="margin:0 0 8px;font-size:22px;color:${COLORS.warning};">New PO order awaiting approval</h1>
        <p style="margin:0 0 18px;font-size:14px;">
          ${escapeHtml(data.buyer_company_name ?? 'A buyer company')} just placed PO order
          <strong>${escapeHtml(order.order_number)}</strong> for ${fmtAUD(order.total_amount)} inc. GST.
        </p>
        ${renderItemsTable(items)}
        ${totalsBlock(order)}
        ${adminOrderUrl ? `<p style="margin-top:24px;">${btn(adminOrderUrl, 'Review order')}</p>` : ''}
      `;
      return {
        subject,
        html: shell({ title: subject, preheader: 'A new PO order needs your review.', bodyHtml }),
        text: `New PO order ${order.order_number} needs review.`,
      };
    }
  }
}

// ===========================================================================
// Send via Mailgun + log to integration_log
// ===========================================================================

export async function sendEmail(opts: {
  to: string | string[];
  template: EmailTemplate;
  data: any;
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any;
  order_id?: string | null;
}): Promise<{ ok: boolean; provider_id?: string; error?: string }> {
  const { to, template, data, supabaseAdmin, order_id } = opts;
  const toList = Array.isArray(to) ? to : [to];

  if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
    const msg = 'MAILGUN_API_KEY and MAILGUN_DOMAIN must be set as Supabase project secrets';
    await supabaseAdmin.from('marketplace_integration_log').insert({
      order_id: order_id ?? null,
      integration: 'email',
      event_type: template,
      status: 'failed',
      error_message: msg,
      payload: { to: toList, template },
    });
    return { ok: false, error: msg };
  }

  let rendered;
  try {
    rendered = render(template, data);
  } catch (e: any) {
    const msg = `Template render failed: ${e?.message ?? String(e)}`;
    await supabaseAdmin.from('marketplace_integration_log').insert({
      order_id: order_id ?? null,
      integration: 'email',
      event_type: template,
      status: 'failed',
      error_message: msg,
      payload: { to: toList, template, data },
    });
    return { ok: false, error: msg };
  }

  try {
    const url = `${MAILGUN_BASE_URL}/v3/${MAILGUN_DOMAIN}/messages`;
    const formData = new FormData();
    formData.append('from', FROM_ADDRESS);
    for (const recipient of toList) formData.append('to', recipient);
    formData.append('subject', rendered.subject);
    formData.append('html', rendered.html);
    formData.append('text', rendered.text);

    const auth = btoa(`api:${MAILGUN_API_KEY}`);
    const resp = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}` },
      body: formData,
    });

    const respText = await resp.text();
    let body: any;
    try { body = JSON.parse(respText); } catch { body = { raw: respText }; }

    if (!resp.ok) {
      const msg = body?.message ?? body?.error ?? `Mailgun returned HTTP ${resp.status}`;
      await supabaseAdmin.from('marketplace_integration_log').insert({
        order_id: order_id ?? null,
        integration: 'email',
        event_type: template,
        status: 'failed',
        error_message: msg,
        payload: { to: toList, template, subject: rendered.subject },
        response: body,
      });
      return { ok: false, error: msg };
    }

    const providerId = body?.id ?? null;
    await supabaseAdmin.from('marketplace_integration_log').insert({
      order_id: order_id ?? null,
      integration: 'email',
      event_type: template,
      status: 'success',
      event_id: providerId,
      payload: { to: toList, template, subject: rendered.subject },
      response: body,
    });
    return { ok: true, provider_id: providerId };
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    await supabaseAdmin.from('marketplace_integration_log').insert({
      order_id: order_id ?? null,
      integration: 'email',
      event_type: template,
      status: 'failed',
      error_message: msg,
      payload: { to: toList, template },
    });
    return { ok: false, error: msg };
  }
}
