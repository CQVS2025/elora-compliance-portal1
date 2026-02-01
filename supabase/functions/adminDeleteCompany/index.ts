import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createSupabaseAdminClient } from '../_shared/supabase.ts';

interface DeleteCompanyRequest {
  company_id: string;
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
  return { admin } as const;
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

    const body = (await req.json()) as DeleteCompanyRequest;
    const { company_id } = body;

    if (!company_id) {
      return jsonResponse({ error: 'Missing company_id' }, 400);
    }

    const { data: company, error: companyErr } = await admin
      .from('companies')
      .select('id, name')
      .eq('id', company_id)
      .single();

    if (companyErr || !company) {
      return jsonResponse({ error: 'Company not found.' }, 404);
    }

    const { error: unassignErr } = await admin
      .from('user_profiles')
      .update({ company_id: null, company_name: null, updated_at: new Date().toISOString() })
      .eq('company_id', company_id);

    if (unassignErr) {
      return jsonResponse({ error: `Failed to unassign users: ${unassignErr.message}` }, 500);
    }

    const { error: deleteErr } = await admin
      .from('companies')
      .delete()
      .eq('id', company_id);

    if (deleteErr) {
      return jsonResponse({ error: deleteErr.message }, 500);
    }

    return jsonResponse({
      success: true,
      message: `Company "${company.name}" deleted successfully. Users have been unassigned.`,
    }, 200);
  } catch (e) {
    console.error('adminDeleteCompany error:', e);
    return jsonResponse({
      error: e instanceof Error ? e.message : 'Failed to delete company',
    }, 500);
  }
});
