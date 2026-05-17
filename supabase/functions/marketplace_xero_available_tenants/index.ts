// deno-lint-ignore-file no-explicit-any
import { handleCors, corsHeaders } from '../_shared/cors.ts';
import { createSupabaseClient, createSupabaseAdminClient } from '../_shared/supabase.ts';
import { fetchTenants, getValidXeroCreds } from '../_shared/marketplaceXero.ts';

/**
 * GET → { active_tenant_id, tenants: [{ tenant_id, tenant_name }, …] }
 *
 * Lists every Xero org the current grant can see. Used by the org-picker UI
 * so a super_admin can switch which org receives invoices and POs.
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

    const admin = createSupabaseAdminClient();
    let creds;
    try {
      creds = await getValidXeroCreds(admin);
    } catch {
      return json({ error: 'Xero not connected' }, 404);
    }

    const connections = await fetchTenants(creds.accessToken);
    const orgs = connections.filter((c) => c.tenantType === 'ORGANISATION');

    return json({
      active_tenant_id: creds.tenantId,
      tenants: orgs.map((c) => ({ tenant_id: c.tenantId, tenant_name: c.tenantName })),
    }, 200);
  } catch (err: any) {
    console.error('marketplace_xero_available_tenants error', err);
    return json({ error: err?.message ?? 'Internal error' }, 500);
  }
});

function json(body: any, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
