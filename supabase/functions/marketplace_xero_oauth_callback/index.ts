// deno-lint-ignore-file no-explicit-any
import { handleCors, corsHeaders } from '../_shared/cors.ts';
import { createSupabaseAdminClient } from '../_shared/supabase.ts';
import { exchangeCodeForTokens, fetchTenants } from '../_shared/marketplaceXero.ts';

/**
 * Xero OAuth redirect URI.
 *
 * GET ?code=...&state=...
 *
 * Exchanges code for tokens, fetches the connected tenant(s), stores them
 * in marketplace_xero_credentials, and redirects the admin back to the
 * Integrations admin page. If multiple tenants are connected, the first
 * one is selected — admin can change later via SQL or future UI.
 *
 * No CORS gate / no JWT check — Xero redirects the browser here. Authority
 * is re-derived from the `state` parameter, which encodes the uid of the
 * super_admin that initiated the flow in marketplace_xero_oauth_start.
 * We re-check that uid is still an active super_admin before persisting
 * tokens, so a captured/forged callback cannot install Xero credentials.
 */
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state') ?? '';
  const portalBase = Deno.env.get('MARKETPLACE_PORTAL_URL') ?? '';
  const errorParam = url.searchParams.get('error');

  if (errorParam) {
    return redirect(`${portalBase}/admin/marketplace/integrations?xero_error=${encodeURIComponent(errorParam)}`);
  }
  if (!code) {
    return redirect(`${portalBase}/admin/marketplace/integrations?xero_error=missing_code`);
  }

  const admin = createSupabaseAdminClient();

  // Verify the state's initiating uid is still an active super_admin. The
  // state format is `${user_id}.${random_uuid}` (see oauth_start).
  const initiatorUid = state.split('.')[0] ?? '';
  const uidLooksValid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(initiatorUid);
  if (!uidLooksValid) {
    await admin.from('marketplace_xero_sync_log').insert({
      operation: 'oauth_connect',
      status: 'failed',
      error_message: 'Invalid OAuth state — initiator uid missing or malformed',
    });
    return redirect(`${portalBase}/admin/marketplace/integrations?xero_error=invalid_state`);
  }
  const { data: initiator } = await admin
    .from('user_profiles')
    .select('id, role, is_active')
    .eq('id', initiatorUid)
    .maybeSingle();
  if (!initiator || initiator.role !== 'super_admin' || initiator.is_active === false) {
    await admin.from('marketplace_xero_sync_log').insert({
      operation: 'oauth_connect',
      status: 'failed',
      error_message: 'OAuth state initiator is not an active super_admin',
      response_payload: { initiator_uid: initiatorUid },
    });
    return redirect(`${portalBase}/admin/marketplace/integrations?xero_error=forbidden`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const tenants = await fetchTenants(tokens.access_token);
    if (!tenants || tenants.length === 0) {
      throw new Error('No Xero tenants connected.');
    }
    const tenant = tenants[0];
    const expiresAt = new Date(Date.now() + (tokens.expires_in - 30) * 1000).toISOString();

    await admin
      .from('marketplace_xero_credentials')
      .upsert({
        id: 1,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        tenant_id: tenant.tenantId,
        tenant_name: tenant.tenantName,
        connected_at: new Date().toISOString(),
        last_refreshed_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    await admin.from('marketplace_xero_sync_log').insert({
      operation: 'oauth_connect',
      status: 'success',
      response_payload: {
        tenant_id: tenant.tenantId,
        tenant_name: tenant.tenantName,
        org_count: tenants.length,
      },
    });

    // If the grant authorized multiple Xero orgs, send the admin to the
    // org-picker so they can confirm which org should be the active one.
    // First-time connect (initial=1) so the picker shows the right copy.
    if (tenants.length > 1) {
      return redirect(`${portalBase}/admin/marketplace/xero/choose-org?initial=1`);
    }
    return redirect(`${portalBase}/admin/marketplace/integrations?xero_connected=1`);
  } catch (err: any) {
    await admin.from('marketplace_xero_sync_log').insert({
      operation: 'oauth_connect',
      status: 'failed',
      error_message: err?.message ?? String(err),
    });
    return redirect(`${portalBase}/admin/marketplace/integrations?xero_error=${encodeURIComponent(err?.message ?? 'unknown')}`);
  }
});

function redirect(location: string) {
  return new Response(null, {
    status: 302,
    headers: { 'Location': location },
  });
}
