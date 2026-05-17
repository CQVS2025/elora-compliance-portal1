// deno-lint-ignore-file no-explicit-any
import { handleCors, corsHeaders } from '../_shared/cors.ts';
import { createSupabaseClient, createSupabaseAdminClient } from '../_shared/supabase.ts';
import { fetchTenants, getValidXeroCreds, switchActiveTenant } from '../_shared/marketplaceXero.ts';

/**
 * POST { tenant_id } → { ok, tenant_id, tenant_name, changed }
 *
 * Switches the active Xero tenant on the singleton credentials row to one
 * of the orgs already authorized under the current OAuth grant. If the
 * tenant actually changes, any per-order xero_invoice_id / xero_po_id
 * values (scoped to the old org) are wiped — see switchActiveTenant().
 *
 * Super-admin-only.
 */
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const supabase = createSupabaseClient(req);
    const { data: superAdminCheck } = await supabase.rpc('is_marketplace_super_admin');
    if (!superAdminCheck) return json({ error: 'Forbidden: Elora super_admin required' }, 403);

    const body = await req.json().catch(() => ({}));
    const tenantId = String(body?.tenant_id ?? '').trim();
    if (!tenantId) return json({ error: 'tenant_id is required' }, 400);

    const admin = createSupabaseAdminClient();
    let creds;
    try { creds = await getValidXeroCreds(admin); }
    catch { return json({ error: 'Xero not connected' }, 404); }

    const connections = await fetchTenants(creds.accessToken);
    const match = connections.find((c) => c.tenantId === tenantId && c.tenantType === 'ORGANISATION');
    if (!match) {
      return json({ error: 'Tenant not authorized for this connection' }, 400);
    }

    const { changed } = await switchActiveTenant(admin, {
      tenantId: match.tenantId,
      tenantName: match.tenantName,
    });

    await admin.from('marketplace_xero_sync_log').insert({
      operation: 'tenant_selected',
      status: 'success',
      response_payload: { tenant_id: match.tenantId, tenant_name: match.tenantName, changed },
    });

    return json({
      ok: true,
      tenant_id: match.tenantId,
      tenant_name: match.tenantName,
      changed,
    }, 200);
  } catch (err: any) {
    console.error('marketplace_xero_select_tenant error', err);
    return json({ error: err?.message ?? 'Internal error' }, 500);
  }
});

function json(body: any, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
