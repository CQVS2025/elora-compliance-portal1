// deno-lint-ignore-file no-explicit-any
import { handleCors, corsHeaders } from '../_shared/cors.ts';
import { createSupabaseClient, createSupabaseAdminClient } from '../_shared/supabase.ts';
import { refreshAccessToken } from '../_shared/marketplaceXero.ts';

/**
 * POST — refresh the stored Xero access_token using the refresh_token.
 *
 * Two call paths:
 *   1. Supabase Cron (service_role key, no user JWT) — runs every ~25 days
 *      to keep the refresh-token rotation alive. Allowed unconditionally.
 *   2. Manual "Refresh now" from a super_admin in the Integrations page.
 *      Requires a super_admin JWT — any lower-privilege caller is rejected.
 */
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    // If a user-scoped JWT is present, verify it's a super_admin. If no
    // JWT is present (cron / service_role invocation), allow the call.
    const authHeader = req.headers.get('Authorization') ?? '';
    if (authHeader && !authHeader.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '__never__')) {
      const supabase = createSupabaseClient(req);
      const { data: superAdminCheck } = await supabase.rpc('is_marketplace_super_admin');
      if (!superAdminCheck) {
        return json({ error: 'Forbidden: Elora super_admin required to refresh the Xero connection' }, 403);
      }
    }

    const admin = createSupabaseAdminClient();
    const { data: row, error } = await admin
      .from('marketplace_xero_credentials')
      .select('refresh_token')
      .eq('id', 1)
      .maybeSingle();
    if (error) throw error;
    if (!row?.refresh_token) {
      return json({ error: 'Xero not connected.' }, 400);
    }

    try {
      const refreshed = await refreshAccessToken(row.refresh_token);
      const expiresAt = new Date(Date.now() + (refreshed.expires_in - 30) * 1000).toISOString();
      await admin
        .from('marketplace_xero_credentials')
        .update({
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token,
          expires_at: expiresAt,
          last_refreshed_at: new Date().toISOString(),
        })
        .eq('id', 1);
      await admin.from('marketplace_xero_sync_log').insert({
        operation: 'refresh_token',
        status: 'success',
      });
      return json({ ok: true, expires_at: expiresAt }, 200);
    } catch (e: any) {
      await admin.from('marketplace_xero_sync_log').insert({
        operation: 'refresh_token',
        status: 'failed',
        error_message: e?.message ?? String(e),
      });
      return json({ error: e?.message ?? 'Refresh failed' }, 500);
    }
  } catch (err: any) {
    return json({ error: err?.message ?? 'Internal error' }, 500);
  }
});

function json(body: any, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
