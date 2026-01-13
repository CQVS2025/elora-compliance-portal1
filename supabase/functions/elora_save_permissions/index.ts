import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createSupabaseAdminClient } from '../_shared/supabase.ts';

/**
 * Save User Permissions Function
 * Creates or updates permissions for a user or domain
 */

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = createSupabaseAdminClient();
    const body = await req.json();
    const {
      id,
      company_id,
      scope,
      user_email,
      email_domain,
      restricted_customer,
      lock_customer_filter,
      show_all_data,
      default_site,
      visible_tabs,
      hidden_tabs,
      hide_cost_forecast,
      hide_leaderboard,
      hide_usage_costs,
      can_view_compliance,
      can_view_reports,
      can_manage_sites,
      can_manage_users,
      can_export_data,
      can_view_costs,
      can_generate_ai_reports,
      can_edit_vehicles,
      can_edit_sites,
      can_delete_records,
      is_active
    } = body;

    // Validate required fields
    if (!company_id) {
      return new Response(JSON.stringify({
        error: 'Company ID is required',
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!scope || !['user', 'domain'].includes(scope)) {
      return new Response(JSON.stringify({
        error: 'Valid scope (user or domain) is required',
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (scope === 'user' && !user_email) {
      return new Response(JSON.stringify({
        error: 'User email is required for user-scoped permissions',
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (scope === 'domain' && !email_domain) {
      return new Response(JSON.stringify({
        error: 'Email domain is required for domain-scoped permissions',
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const permissionData = {
      company_id,
      scope,
      user_email: scope === 'user' ? user_email : null,
      email_domain: scope === 'domain' ? email_domain : null,
      restricted_customer: restricted_customer || null,
      lock_customer_filter: lock_customer_filter ?? false,
      show_all_data: show_all_data ?? true,
      default_site: default_site || 'all',
      visible_tabs: visible_tabs || null,
      hidden_tabs: hidden_tabs || null,
      hide_cost_forecast: hide_cost_forecast ?? false,
      hide_leaderboard: hide_leaderboard ?? false,
      hide_usage_costs: hide_usage_costs ?? false,
      can_view_compliance: can_view_compliance ?? true,
      can_view_reports: can_view_reports ?? true,
      can_manage_sites: can_manage_sites ?? true,
      can_manage_users: can_manage_users ?? false,
      can_export_data: can_export_data ?? true,
      can_view_costs: can_view_costs ?? true,
      can_generate_ai_reports: can_generate_ai_reports ?? true,
      can_edit_vehicles: can_edit_vehicles ?? true,
      can_edit_sites: can_edit_sites ?? true,
      can_delete_records: can_delete_records ?? false,
      is_active: is_active ?? true,
    };

    let result;

    if (id) {
      // Update existing
      const { data, error } = await supabase
        .from('user_permissions')
        .update(permissionData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Insert new
      const { data, error } = await supabase
        .from('user_permissions')
        .insert(permissionData)
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    return new Response(JSON.stringify({
      success: true,
      data: result
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message,
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
