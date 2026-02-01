import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createSupabaseAdminClient, createSupabaseClient } from '../_shared/supabase.ts';

/**
 * Save Client Branding Function
 * Creates or updates branding settings for a company
 * 
 * Access Control:
 * - Super Admins: Can manage branding for ANY company
 * - Admins: Can ONLY manage branding for THEIR OWN company
 */

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Verify authentication and get user profile
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({
        error: 'Missing authorization header',
        success: false
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseClient = createSupabaseClient(req);
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({
        error: 'Invalid or expired token',
        success: false
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get user profile to check role and company
    const supabase = createSupabaseAdminClient();
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role, company_id')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return new Response(JSON.stringify({
        error: 'User profile not found',
        success: false
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const {
      id,
      company_id,
      client_email_domain,
      company_name,
      logo_url,
      primary_color,
      secondary_color,
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

    // Access Control: Enforce company restrictions
    const isSuperAdmin = userProfile.role === 'super_admin';
    const isAdmin = userProfile.role === 'admin';

    if (!isSuperAdmin && !isAdmin) {
      return new Response(JSON.stringify({
        error: 'Insufficient permissions. Only admins can manage branding.',
        success: false
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Admins can ONLY manage their own company's branding
    if (isAdmin && userProfile.company_id !== company_id) {
      return new Response(JSON.stringify({
        error: 'Access denied. You can only manage branding for your own company.',
        success: false
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!client_email_domain && !id) {
      return new Response(JSON.stringify({
        error: 'Client email domain is required for new branding',
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Only include fields that exist in the client_branding table schema
    const brandingData: Record<string, any> = {
      company_id,
      company_name: company_name || 'ELORA Fleet',
      logo_url: logo_url || null,
      primary_color: primary_color || '#7CB342',
      secondary_color: secondary_color || '#9CCC65',
    };

    let result;

    if (id) {
      // Update existing
      const { data, error } = await supabase
        .from('client_branding')
        .update(brandingData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Insert new - requires client_email_domain
      brandingData.client_email_domain = client_email_domain;

      const { data, error } = await supabase
        .from('client_branding')
        .insert(brandingData)
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    // Also update the companies table to keep branding in sync
    // This ensures company cards and other UI elements use the latest branding
    const { error: companyUpdateError } = await supabase
      .from('companies')
      .update({
        name: company_name || null,
        logo_url: logo_url || null,
        primary_color: primary_color || null,
        secondary_color: secondary_color || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', company_id);

    if (companyUpdateError) {
      console.warn('Failed to update companies table:', companyUpdateError);
      // Don't fail the request if company update fails, just log it
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
