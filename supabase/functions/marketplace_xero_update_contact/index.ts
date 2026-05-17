// deno-lint-ignore-file no-explicit-any
import { handleCors, corsHeaders } from '../_shared/cors.ts';
import { createSupabaseClient, createSupabaseAdminClient } from '../_shared/supabase.ts';
import { getValidXeroCreds, updateContact } from '../_shared/marketplaceXero.ts';

/**
 * POST { company_id, details? } → { ok }
 *
 * Updates the Xero contact for a buyer company that has already been
 * registered (i.e. companies.xero_contact_id is set). Optionally persists
 * a new `details` payload first, then POSTs the rebuilt contact body to
 * Xero (POST /Contacts with ContactID is an upsert in Xero's API).
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

    const admin = createSupabaseAdminClient();

    if (body?.details && typeof body.details === 'object') {
      const { error: dErr } = await admin
        .from('companies')
        .update({ xero_contact_details: body.details })
        .eq('id', companyId);
      if (dErr) throw dErr;
    }

    const { data: company, error: cErr } = await admin
      .from('companies')
      .select('id, name, marketplace_enabled, xero_contact_id, marketplace_invoice_email, marketplace_default_address, xero_contact_details')
      .eq('id', companyId)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!company) return json({ error: 'Company not found' }, 404);
    if (!company.xero_contact_id) {
      return json({ error: 'Company is not yet linked to a Xero contact. Use Register first.' }, 400);
    }
    if (!company.marketplace_enabled) {
      return json({
        error: 'Customer marketplace access is disabled for this company. Re-enable the marketplace toggle to edit Xero details.',
      }, 409);
    }

    let creds;
    try { creds = await getValidXeroCreds(admin); }
    catch { return json({ error: 'Xero not connected. Connect Xero from the Integrations page first.' }, 400); }

    await updateContact(admin, creds, {
      id: company.id,
      name: company.name,
      xero_contact_id: company.xero_contact_id,
      marketplace_invoice_email: company.marketplace_invoice_email ?? null,
      marketplace_default_address: company.marketplace_default_address ?? null,
      xero_contact_details: company.xero_contact_details ?? {},
    });

    return json({ ok: true, tenant_name: creds.tenantName }, 200);
  } catch (err: any) {
    console.error('marketplace_xero_update_contact error', err);
    return json({ error: err?.message ?? 'Internal error' }, 500);
  }
});

function json(body: any, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
