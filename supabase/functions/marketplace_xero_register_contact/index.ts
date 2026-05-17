// deno-lint-ignore-file no-explicit-any
import { handleCors, corsHeaders } from '../_shared/cors.ts';
import { createSupabaseClient, createSupabaseAdminClient } from '../_shared/supabase.ts';
import { getValidXeroCreds, upsertContact } from '../_shared/marketplaceXero.ts';

/**
 * POST { company_id, enabled? } → { ok, xero_contact_id, tenant_name }
 *
 * Registers a buyer company as a Xero Contact and stores the resulting
 * ContactID on companies.xero_contact_id. Flips companies.xero_invoicing_enabled
 * so PO approvals for this company start generating Xero invoices.
 *
 * Re-running this for an already-registered company is a no-op
 * (upsertContact short-circuits when xero_contact_id is set).
 *
 * Pass `{ enabled: false }` to disable invoicing without unlinking the
 * Xero contact (so re-enabling later doesn't duplicate the contact).
 *
 * Super-admin only.
 */
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const supabase = createSupabaseClient(req);
    const { data: superAdminCheck } = await supabase.rpc('is_marketplace_super_admin');
    if (!superAdminCheck) {
      return json({ error: 'Forbidden: Elora super_admin required' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const companyId = String(body?.company_id ?? '').trim();
    if (!companyId) return json({ error: 'company_id is required' }, 400);

    // Disable path — quick exit, no Xero call.
    if (body?.enabled === false) {
      const admin = createSupabaseAdminClient();
      const { error } = await admin
        .from('companies')
        .update({ xero_invoicing_enabled: false })
        .eq('id', companyId);
      if (error) throw error;
      return json({ ok: true, enabled: false }, 200);
    }

    // Enable path — persist details (if provided), upsert contact in Xero,
    // then mark invoicing enabled.
    const admin = createSupabaseAdminClient();

    // 1. Persist xero_contact_details from the request (optional). The
    //    caller can pre-fill the rich Xero fields from the admin UI dialog.
    if (body?.details && typeof body.details === 'object') {
      const { error: detailsErr } = await admin
        .from('companies')
        .update({ xero_contact_details: body.details })
        .eq('id', companyId);
      if (detailsErr) throw detailsErr;
    }

    // 2. Re-read with the persisted details so the Xero payload is current.
    const { data: company, error: companyErr } = await admin
      .from('companies')
      .select('id, name, marketplace_enabled, xero_contact_id, marketplace_invoice_email, marketplace_default_address, xero_contact_details')
      .eq('id', companyId)
      .maybeSingle();
    if (companyErr) throw companyErr;
    if (!company) return json({ error: 'Company not found' }, 404);
    if (!company.name) return json({ error: 'Company has no name — cannot register in Xero' }, 400);
    if (!company.marketplace_enabled) {
      return json({
        error: 'Customer marketplace access must be enabled before registering this company in Xero. Toggle "Marketplace access" on the Companies page first.',
      }, 409);
    }

    let creds;
    try { creds = await getValidXeroCreds(admin); }
    catch { return json({ error: 'Xero not connected. Connect Xero from the Integrations page first.' }, 400); }

    const xeroContactId = await upsertContact(admin, creds, {
      id: company.id,
      name: company.name,
      xero_contact_id: company.xero_contact_id ?? null,
      marketplace_invoice_email: company.marketplace_invoice_email ?? null,
      marketplace_default_address: company.marketplace_default_address ?? null,
      xero_contact_details: company.xero_contact_details ?? {},
    });

    // 3. Mark invoicing enabled (xero_contact_id is written by upsertContact)
    await admin
      .from('companies')
      .update({ xero_invoicing_enabled: true })
      .eq('id', companyId);

    return json({
      ok: true,
      xero_contact_id: xeroContactId,
      tenant_name: creds.tenantName,
      reused: !!company.xero_contact_id,
    }, 200);
  } catch (err: any) {
    console.error('marketplace_xero_register_contact error', err);
    return json({ error: err?.message ?? 'Internal error' }, 500);
  }
});

function json(body: any, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
