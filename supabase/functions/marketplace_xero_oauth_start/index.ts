// deno-lint-ignore-file no-explicit-any
import { handleCors, corsHeaders } from '../_shared/cors.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { buildAuthorizeUrl, getXeroEnv } from '../_shared/marketplaceXero.ts';

/**
 * GET / POST  → returns { url: string }
 *
 * Super-admin-only. The Xero connection is a one-time, org-wide credential
 * that controls invoicing/PO posting for every downstream order, so we
 * restrict it more tightly than the rest of the marketplace admin surface.
 * The state encodes the initiating user id; the callback re-verifies that
 * the same uid is still an active super_admin before persisting tokens.
 */
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const supabase = createSupabaseClient(req);
    const { data: superAdminCheck } = await supabase.rpc('is_marketplace_super_admin');
    if (!superAdminCheck) {
      return json({ error: 'Forbidden: Elora super_admin required to manage the Xero connection' }, 403);
    }

    const env = getXeroEnv();
    if (!env.clientId || !env.clientSecret || !env.redirectUri) {
      return json({ error: 'Xero is not configured. Set XERO_CLIENT_ID, XERO_CLIENT_SECRET, XERO_REDIRECT_URI in Supabase project secrets.' }, 500);
    }

    const { data: userData } = await supabase.auth.getUser();
    const state = `${userData?.user?.id ?? 'anon'}.${crypto.randomUUID()}`;

    const url = buildAuthorizeUrl(state);
    return json({ url, state }, 200);
  } catch (err: any) {
    console.error('marketplace_xero_oauth_start error', err);
    return json({ error: err?.message ?? 'Internal error' }, 500);
  }
});

function json(body: any, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
