// deno-lint-ignore-file no-explicit-any
import { handleCors, corsHeaders } from '../_shared/cors.ts';
import { createSupabaseClient, createSupabaseAdminClient } from '../_shared/supabase.ts';
import { getValidXeroCreds, postToXero, logXeroSync } from '../_shared/marketplaceXero.ts';

/**
 * POST { warehouse_id } → { ok, xero_archived, had_xero_link, upstream_error }
 *
 * Archives the warehouse's Xero supplier contact and wipes the local link.
 * Xero soft-deletes via ContactStatus = "ARCHIVED" — no hard delete in the API.
 * The warehouse itself stays — only the Xero link is removed.
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
    const warehouseId = String(body?.warehouse_id ?? '').trim();
    if (!warehouseId) return json({ error: 'warehouse_id is required' }, 400);

    const admin = createSupabaseAdminClient();
    const { data: warehouse, error: wErr } = await admin
      .from('marketplace_warehouses')
      .select('id, name, xero_contact_id')
      .eq('id', warehouseId)
      .maybeSingle();
    if (wErr) throw wErr;
    if (!warehouse) return json({ error: 'Warehouse not found' }, 404);

    let xeroArchived = false;
    let upstreamError: string | null = null;

    if (warehouse.xero_contact_id) {
      try {
        const creds = await getValidXeroCreds(admin);
        const payload = {
          Contacts: [{ ContactID: warehouse.xero_contact_id, ContactStatus: 'ARCHIVED' }],
        };
        const { status, data } = await postToXero(creds.accessToken, creds.tenantId, '/Contacts', payload);
        if (status >= 300) throw new Error(data?.Message ?? `HTTP ${status}`);
        xeroArchived = true;
        await logXeroSync(admin, {
          operation: 'archive_supplier_contact',
          status: 'success',
          http_status: status,
          xero_object_id: warehouse.xero_contact_id,
          request_payload: payload,
          response_payload: data?.Contacts?.[0] ?? data,
        });
      } catch (e: any) {
        upstreamError = e?.message ?? String(e);
        await logXeroSync(admin, {
          operation: 'archive_supplier_contact',
          status: 'failed',
          xero_object_id: warehouse.xero_contact_id,
          error_message: upstreamError,
        });
        // Continue — still clear the local link so admin can re-register cleanly.
      }
    }

    const { error: clearErr } = await admin
      .from('marketplace_warehouses')
      .update({ xero_contact_id: null, xero_contact_details: {} })
      .eq('id', warehouseId);
    if (clearErr) throw clearErr;

    return json({
      ok: true,
      xero_archived: xeroArchived,
      had_xero_link: !!warehouse.xero_contact_id,
      upstream_error: upstreamError,
    }, 200);
  } catch (err: any) {
    console.error('marketplace_xero_archive_warehouse_contact error', err);
    return json({ error: err?.message ?? 'Internal error' }, 500);
  }
});

function json(body: any, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
