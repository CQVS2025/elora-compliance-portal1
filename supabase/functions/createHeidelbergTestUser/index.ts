import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createSupabaseClient, createSupabaseAdminClient } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = createSupabaseClient(req);
    const adminSupabase = createSupabaseAdminClient();

    // Verify admin access
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      });
    }

    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('email', user.email)
      .single();

    if (userProfile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden: Admin access required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403
      });
    }

    // Invite test user with Heidelberg email
    const { data: inviteData, error: inviteError } = await adminSupabase.auth.admin.inviteUserByEmail(
      'test@heidelberg.com.au'
    );

    if (inviteError) {
      throw inviteError;
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Test user invited! Check test@heidelberg.com.au inbox for invitation link.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});