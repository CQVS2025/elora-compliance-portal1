import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createSupabaseAdminClient } from '../_shared/supabase.ts';

interface DeleteUserRequest {
  user_id: string;
}

async function verifySuperAdmin(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { error: 'Missing authorization header', status: 401 } as const;
  }
  const admin = createSupabaseAdminClient();
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) {
    return { error: 'Invalid or expired token', status: 401 } as const;
  }
  const { data: profile, error: profileError } = await admin
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (profileError || !profile) {
    return { error: 'User profile not found', status: 404 } as const;
  }
  if (profile.role !== 'super_admin') {
    return { error: 'Insufficient permissions. Super Admin role required.', status: 403 } as const;
  }
  return { admin, callerId: user.id } as const;
}

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
    const verification = await verifySuperAdmin(req);
    if ('error' in verification) {
      return jsonResponse({ error: verification.error }, verification.status);
    }
    const { admin, callerId } = verification;

    const body = (await req.json()) as DeleteUserRequest;
    const { user_id } = body;

    if (!user_id) {
      return jsonResponse({ error: 'Missing user_id' }, 400);
    }

    if (user_id === callerId) {
      return jsonResponse({ error: 'You cannot delete your own account.' }, 400);
    }

    const { data: targetProfile, error: profileErr } = await admin
      .from('user_profiles')
      .select('role')
      .eq('id', user_id)
      .single();

    if (profileErr || !targetProfile) {
      return jsonResponse({ error: 'User not found.' }, 404);
    }

    const { count } = await admin
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'super_admin');

    if (targetProfile.role === 'super_admin' && (count ?? 0) <= 1) {
      return jsonResponse({ error: 'Cannot delete the last Super Admin.' }, 400);
    }

    const { error: deleteAuthError } = await admin.auth.admin.deleteUser(user_id);
    if (deleteAuthError) {
      return jsonResponse({ error: deleteAuthError.message }, 400);
    }

    return jsonResponse({
      success: true,
      message: 'User deleted successfully.',
    }, 200);
  } catch (e) {
    console.error('adminDeleteUser error:', e);
    return jsonResponse({
      error: e instanceof Error ? e.message : 'Failed to delete user',
    }, 500);
  }
});
