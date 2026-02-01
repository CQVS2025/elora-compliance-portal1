import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createSupabaseAdminClient, createSupabaseClient } from '../_shared/supabase.ts';

function jsonResponse(body: object, status: number) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
    status,
  });
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    // Verify the user is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization header' }, 401);
    }

    const supabase = createSupabaseClient(req);
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return jsonResponse({ error: 'Invalid or expired token' }, 401);
    }

    // Get user profile to check if they're the last super admin
    const admin = createSupabaseAdminClient();
    const { data: profile, error: profileError } = await admin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return jsonResponse({ error: 'User profile not found' }, 404);
    }

    // Prevent deletion of the last super admin
    if (profile.role === 'super_admin') {
      const { count } = await admin
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'super_admin');

      if ((count ?? 0) <= 1) {
        return jsonResponse({ 
          error: 'Cannot delete the last Super Admin account. Please assign another Super Admin first.' 
        }, 400);
      }
    }

    // Delete the auth user (this will cascade delete the profile via database triggers)
    const { error: deleteAuthError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteAuthError) {
      return jsonResponse({ error: deleteAuthError.message }, 400);
    }

    return jsonResponse({
      success: true,
      message: 'Account deleted successfully.',
    }, 200);
  } catch (e) {
    console.error('deleteMyAccount error:', e);
    return jsonResponse({
      error: e instanceof Error ? e.message : 'Failed to delete account',
    }, 500);
  }
});
