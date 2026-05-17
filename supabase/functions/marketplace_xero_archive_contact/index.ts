// deno-lint-ignore-file no-explicit-any
import { handleCors, corsHeaders } from '../_shared/cors.ts';
import { createSupabaseClient, createSupabaseAdminClient } from '../_shared/supabase.ts';
import { getValidXeroCreds, postToXero, logXeroSync } from '../_shared/marketplaceXero.ts';

/**
 * POST { company_id } → { ok }
 *
 * Archives the buyer company's contact in Xero (Xero soft-deletes via
 * ContactStatus = "ARCHIVED" — there is no hard delete in the API) AND
 * wipes the local link so the company falls back to "Not in Xero".
 *
 * Local side effects:
 *   - companies.xero_contact_id   → NULL
 *   - companies.xero_invoicing_enabled → false
 *   - companies.xero_contact_details   → '{}'
 *
 * The buyer's marketplace toggle is NOT touched — they can still place
 * orders, just no Xero invoices fire for those orders.
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
    const { data: company, error: cErr } = await admin
      .from('companies')
      .select('id, name, xero_contact_id')
      .eq('id', companyId)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!company) return json({ error: 'Company not found' }, 404);

    let xeroArchived = false;
    let upstreamError: string | null = null;

    if (company.xero_contact_id) {
      try {
        const creds = await getValidXeroCreds(admin);
        const payload = {
          Contacts: [{
            ContactID: company.xero_contact_id,
            ContactStatus: 'ARCHIVED',
          }],
        };
        const { status, data } = await postToXero(creds.accessToken, creds.tenantId, '/Contacts', payload);
        if (status >= 300) {
          throw new Error(data?.Message ?? `HTTP ${status}`);
        }
        xeroArchived = true;
        await logXeroSync(admin, {
          operation: 'archive_contact',
          status: 'success',
          http_status: status,
          xero_object_id: company.xero_contact_id,
          request_payload: payload,
          response_payload: data?.Contacts?.[0] ?? data,
        });
      } catch (e: any) {
        upstreamError = e?.message ?? String(e);
        await logXeroSync(admin, {
          operation: 'archive_contact',
          status: 'failed',
          xero_object_id: company.xero_contact_id,
          error_message: upstreamError,
        });
        // Continue — we still clear the local link so the buyer can be
        // re-registered later. Admin can manually archive on Xero if needed.
      }
    }

    // Always clear the local link, regardless of whether Xero archive
    // succeeded (so the UI returns to "Not in Xero" state).
    const { error: clearErr } = await admin
      .from('companies')
      .update({
        xero_contact_id: null,
        xero_invoicing_enabled: false,
        xero_contact_details: {},
      })
      .eq('id', companyId);
    if (clearErr) throw clearErr;

    return json({
      ok: true,
      xero_archived: xeroArchived,
      had_xero_link: !!company.xero_contact_id,
      upstream_error: upstreamError,
    }, 200);
  } catch (err: any) {
    console.error('marketplace_xero_archive_contact error', err);
    return json({ error: err?.message ?? 'Internal error' }, 500);
  }
});

function json(body: any, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
