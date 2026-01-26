const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 204, headers: corsHeaders });
  }

  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const body = await req.json();
    const { userEmail } = body;

    if (!userEmail) {
      return new Response(JSON.stringify({
        error: 'User email is required',
        data: null
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const emailDomain = userEmail.split('@')[1];

    // First try to get user-specific permissions
    let { data: permissions, error } = await supabase
      .from('user_permissions')
      .select('*')
      .eq('scope', 'user')
      .eq('user_email', userEmail)
      .eq('is_active', true)
      .single();

    // If no user-specific permissions, try domain-level permissions
    if (!permissions && emailDomain) {
      const domainResult = await supabase
        .from('user_permissions')
        .select('*')
        .eq('scope', 'domain')
        .eq('email_domain', emailDomain)
        .eq('is_active', true)
        .single();

      permissions = domainResult.data;
      error = domainResult.error;
    }

    // If still no permissions, return default (full access)
    if (!permissions) {
      return new Response(JSON.stringify({
        success: true,
        data: {
          source: 'default',
          show_all_data: true,
          restricted_customer: null,
          lock_customer_filter: false,
          default_site: 'all',
          visible_tabs: null,
          hidden_tabs: null,
          hide_cost_forecast: false,
          hide_leaderboard: false,
          hide_usage_costs: false,
          can_view_compliance: true,
          can_view_reports: true,
          can_manage_sites: true,
          can_manage_users: true,
          can_export_data: true,
          can_view_costs: true,
          can_generate_ai_reports: true,
          can_edit_vehicles: true,
          can_edit_sites: true,
          can_delete_records: true,
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        ...permissions,
        source: permissions.scope === 'user' ? 'user' : 'domain'
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message,
      data: null
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
