import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createSupabaseAdminClient } from '../_shared/supabase.ts';

interface UpdatePasswordRequest {
  user_id: string;
  new_password: string;
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
    const { admin } = verification;

    const body = (await req.json()) as UpdatePasswordRequest;
    const { user_id, new_password } = body;

    if (!user_id || !new_password) {
      return jsonResponse({ error: 'Missing user_id or new_password' }, 400);
    }
    if (new_password.length < 6) {
      return jsonResponse({ error: 'Password must be at least 6 characters' }, 400);
    }

    const { error } = await admin.auth.admin.updateUserById(user_id, { password: new_password });
    if (error) {
      return jsonResponse({ error: error.message }, 400);
    }

    return jsonResponse({
      success: true,
      message: 'Password updated successfully.',
    }, 200);
  } catch (e) {
    console.error('adminUpdateUserPassword error:', e);
    return jsonResponse({
      error: e instanceof Error ? e.message : 'Failed to update password',
    }, 500);
  }
});
