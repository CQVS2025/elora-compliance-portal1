// deno-lint-ignore-file no-explicit-any
import { handleCors, corsHeaders } from '../_shared/cors.ts';
import { createSupabaseClient, createSupabaseAdminClient } from '../_shared/supabase.ts';
import {
  deleteXeroConnection,
  fetchTenants,
  getValidXeroCreds,
  switchActiveTenant,
} from '../_shared/marketplaceXero.ts';

/**
 * POST → { ok, state, … }
 *
 * Disconnects the currently active Xero org.
 *
 * Flow (mirrors Chem Connect):
 *   1. Call DELETE /connections/{id} on Xero for the active tenant. Other
 *      orgs authorized under the same OAuth grant stay connected on Xero's
 *      side.
 *   2. Re-query /connections.
 *   3a. If any orgs remain, auto-switch the stored credentials to the first
 *       one (switchActiveTenant clears per-order Xero ids scoped to the
 *       disconnected tenant).
 *   3b. If none remain, clear the credentials row (tokens, tenant_id, etc.)
 *       so the next Connect Xero flow starts fresh.
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
    try { creds = await getValidXeroCreds(admin); }
    catch {
      await admin.from('marketplace_xero_sync_log').insert({
        operation: 'disconnect',
        status: 'success',
        response_payload: { state: 'already_disconnected' },
      });
      return json({ ok: true, state: 'already_disconnected' }, 200);
    }

    const disconnectedTenantId = creds.tenantId;
    let upstreamError: string | null = null;

    // Step 1: revoke the active tenant on Xero's side
    try {
      const connections = await fetchTenants(creds.accessToken);
      const match = connections.find((c) => c.tenantId === creds.tenantId);
      if (match) await deleteXeroConnection(creds.accessToken, match.id);
    } catch (err: any) {
      upstreamError = err?.message ?? 'Unknown error';
      console.error('Xero per-tenant disconnect failed:', upstreamError);
    }

    // Step 2: see what orgs remain authorized under the same grant
    let remainingOrgs: Array<{ id: string; tenantId: string; tenantName: string; tenantType: string }> = [];
    try {
      const after = await fetchTenants(creds.accessToken);
      remainingOrgs = after.filter((c) => c.tenantType === 'ORGANISATION');
    } catch (err) {
      console.error('Failed to re-read /connections after disconnect:', err);
    }

    if (remainingOrgs.length > 0) {
      // Step 3a: auto-switch to the next authorized org
      const next = remainingOrgs[0];
      await switchActiveTenant(admin, { tenantId: next.tenantId, tenantName: next.tenantName });

      await admin.from('marketplace_xero_sync_log').insert({
        operation: 'disconnect',
        status: upstreamError ? 'failed' : 'success',
        error_message: upstreamError,
        response_payload: {
          state: 'switched',
          disconnected_tenant_id: disconnectedTenantId,
          next_tenant_id: next.tenantId,
          next_tenant_name: next.tenantName,
          remaining_count: remainingOrgs.length,
        },
      });

      return json({
        ok: true,
        state: 'switched',
        revoked: !upstreamError,
        tenant_id: next.tenantId,
        tenant_name: next.tenantName,
        remaining_count: remainingOrgs.length,
      }, 200);
    }

    // Step 3b: no orgs left — wipe the credentials row so the next
    // Connect Xero flow is a clean handshake (NOT a delete: keep the
    // singleton row so its RLS-gated id=1 reference stays stable).
    const { error: clearErr } = await admin
      .from('marketplace_xero_credentials')
      .update({
        access_token: null,
        refresh_token: null,
        expires_at: null,
        tenant_id: null,
        tenant_name: null,
        connected_at: null,
        last_refreshed_at: null,
      })
      .eq('id', 1);
    if (clearErr) throw clearErr;

    // Also null any stored xero_invoice_id / xero_po_id on orders — they
    // referenced the disconnected org and won't resolve any more.
    await admin
      .from('marketplace_orders')
      .update({ xero_invoice_id: null, xero_po_id: null })
      .or('xero_invoice_id.not.is.null,xero_po_id.not.is.null');

    await admin.from('marketplace_xero_sync_log').insert({
      operation: 'disconnect',
      status: upstreamError ? 'failed' : 'success',
      error_message: upstreamError,
      response_payload: { state: 'fully_disconnected', disconnected_tenant_id: disconnectedTenantId },
    });

    return json({
      ok: true,
      state: 'fully_disconnected',
      revoked: !upstreamError,
    }, 200);
  } catch (err: any) {
    console.error('marketplace_xero_disconnect error', err);
    return json({ error: err?.message ?? 'Internal error' }, 500);
  }
});

function json(body: any, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
