// deno-lint-ignore-file no-explicit-any
import { handleCors, corsHeaders } from '../_shared/cors.ts';
import { createSupabaseAdminClient } from '../_shared/supabase.ts';
import { sendEmail, TEMPLATE_NAMES, type EmailTemplate } from '../_shared/marketplaceEmail.ts';

/**
 * POST { order_id: uuid, template: 'order_placed' | ... | 'admin_new_po_alert', to?: string | string[] }
 *
 * Renders and sends a marketplace transactional email. The order_id is used
 * to load the order header + items + buyer profile, which are passed to the
 * template renderer. If `to` is omitted, the recipient is resolved:
 *   - admin_new_po_alert -> all super_admins + admins on the seller company
 *   - everything else    -> the buyer's profile email
 *
 * Called via service-role (admin) only. Other Edge Functions (e.g.
 * marketplace_approve_order, marketplace_stripe_webhook) invoke this
 * function with the service-role key.
 */
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const body = await req.json();
    const { order_id, template, to } = body ?? {};

    if (!order_id) return json({ error: 'order_id is required' }, 400);
    if (!template || !TEMPLATE_NAMES.includes(template as EmailTemplate)) {
      return json({ error: `template must be one of: ${TEMPLATE_NAMES.join(', ')}` }, 400);
    }

    const admin = createSupabaseAdminClient();

    const { data: order, error: orderErr } = await admin
      .from('marketplace_orders')
      .select(`
        *,
        buyer_company:companies!buyer_company_id ( id, name, marketplace_invoice_email )
      `)
      .eq('id', order_id)
      .maybeSingle();
    if (orderErr) throw orderErr;
    if (!order) return json({ error: 'Order not found' }, 404);

    const { data: items } = await admin
      .from('marketplace_order_items')
      .select('*')
      .eq('order_id', order_id)
      .order('created_at', { ascending: true });

    // Resolve recipient
    let recipients: string[] = [];
    if (to) {
      recipients = Array.isArray(to) ? to : [to];
    } else if (template === 'admin_new_po_alert') {
      // All super_admins + admins from the seller company
      const { data: settings } = await admin
        .from('marketplace_settings')
        .select('seller_company_id')
        .eq('id', 1)
        .maybeSingle();
      const sellerCompanyId = settings?.seller_company_id ?? null;

      const { data: admins } = await admin
        .from('user_profiles')
        .select('id, email, role, company_id, is_active')
        .in('role', ['super_admin', 'admin'])
        .eq('is_active', true);
      recipients = (admins ?? [])
        .filter((u: any) => u.role === 'super_admin' || (sellerCompanyId && u.company_id === sellerCompanyId))
        .map((u: any) => u.email)
        .filter(Boolean);
    } else {
      // Buyer's profile email (or fall back to company's invoice email)
      const { data: buyer } = await admin
        .from('user_profiles')
        .select('email')
        .eq('id', order.buyer_user_id)
        .maybeSingle();
      const buyerEmail = buyer?.email ?? null;
      const invoiceEmail = order.buyer_company?.marketplace_invoice_email ?? null;
      if (buyerEmail) recipients.push(buyerEmail);
      if (invoiceEmail && invoiceEmail !== buyerEmail) recipients.push(invoiceEmail);
    }

    if (recipients.length === 0) {
      const msg = 'No recipient email available for this order.';
      await admin.from('marketplace_integration_log').insert({
        order_id,
        integration: 'email',
        event_type: template,
        status: 'failed',
        error_message: msg,
      });
      return json({ ok: false, error: msg }, 400);
    }

    const portalBase = Deno.env.get('MARKETPLACE_PORTAL_URL') ?? '';
    const result = await sendEmail({
      to: recipients,
      template: template as EmailTemplate,
      data: {
        order,
        items: items ?? [],
        buyer_company_name: order.buyer_company?.name,
        portal_base_url: portalBase,
      },
      supabaseAdmin: admin,
      order_id,
    });

    return json(result, result.ok ? 200 : 500);
  } catch (err: any) {
    console.error('marketplace_send_order_email error', err);
    return json({ error: err?.message ?? 'Internal error' }, 500);
  }
});

function json(body: any, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
