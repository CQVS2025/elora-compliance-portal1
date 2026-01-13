import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createSupabaseAdminClient } from '../_shared/supabase.ts';

/**
 * Get Client Branding Function
 * Retrieves branding settings for a company (by domain or company_id)
 */

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = createSupabaseAdminClient();
    const body = await req.json();
    const { company_id, email_domain, custom_domain } = body;

    let query = supabase.from('client_branding').select('*');

    // Priority: custom_domain > company_id > email_domain
    if (custom_domain) {
      query = query.eq('custom_domain', custom_domain);
    } else if (company_id) {
      query = query.eq('company_id', company_id);
    } else if (email_domain) {
      query = query.eq('client_email_domain', email_domain);
    } else {
      return new Response(JSON.stringify({
        error: 'company_id, email_domain, or custom_domain is required',
        data: null
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: branding, error } = await query.single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error;
    }

    // Return default branding if none found
    if (!branding) {
      return new Response(JSON.stringify({
        success: true,
        data: {
          source: 'default',
          company_name: 'ELORA Fleet',
          primary_color: '#7CB342',
          secondary_color: '#9CCC65',
          logo_url: null,
          login_background_url: null,
          login_background_color: '#f8fafc',
          login_tagline: 'Fleet Compliance Portal',
          email_accent_color: '#7CB342',
          email_font_family: 'Arial, sans-serif',
          pdf_accent_color: '#7CB342',
          pdf_include_cover_page: true,
          app_name: 'ELORA Fleet',
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        ...branding,
        source: 'custom'
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
