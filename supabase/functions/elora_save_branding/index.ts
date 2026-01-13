import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createSupabaseAdminClient } from '../_shared/supabase.ts';
import { v4 as uuidv4 } from 'https://esm.sh/uuid@9.0.0';

/**
 * Save Client Branding Function
 * Creates or updates branding settings for a company
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
      client_email_domain,
      company_name,
      logo_url,
      primary_color,
      secondary_color,
      // Login branding
      login_background_url,
      login_background_color,
      login_tagline,
      login_custom_css,
      login_logo_position,
      // Email branding
      email_header_html,
      email_footer_html,
      email_accent_color,
      email_font_family,
      email_from_name,
      email_reply_to,
      // Custom domain
      custom_domain,
      // PDF branding
      pdf_logo_url,
      pdf_header_html,
      pdf_footer_html,
      pdf_accent_color,
      pdf_include_cover_page,
      pdf_cover_page_html,
      // Additional
      favicon_url,
      app_name,
      support_email,
      support_phone,
      terms_url,
      privacy_url,
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

    if (!client_email_domain && !id) {
      return new Response(JSON.stringify({
        error: 'Client email domain is required for new branding',
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const brandingData: Record<string, any> = {
      company_id,
      company_name: company_name || 'ELORA Fleet',
      logo_url: logo_url || null,
      primary_color: primary_color || '#7CB342',
      secondary_color: secondary_color || '#9CCC65',
      login_background_url: login_background_url || null,
      login_background_color: login_background_color || '#f8fafc',
      login_tagline: login_tagline || null,
      login_custom_css: login_custom_css || null,
      login_logo_position: login_logo_position || 'center',
      email_header_html: email_header_html || null,
      email_footer_html: email_footer_html || null,
      email_accent_color: email_accent_color || '#7CB342',
      email_font_family: email_font_family || 'Arial, sans-serif',
      email_from_name: email_from_name || null,
      email_reply_to: email_reply_to || null,
      pdf_logo_url: pdf_logo_url || null,
      pdf_header_html: pdf_header_html || null,
      pdf_footer_html: pdf_footer_html || null,
      pdf_accent_color: pdf_accent_color || '#7CB342',
      pdf_include_cover_page: pdf_include_cover_page ?? true,
      pdf_cover_page_html: pdf_cover_page_html || null,
      favicon_url: favicon_url || null,
      app_name: app_name || null,
      support_email: support_email || null,
      support_phone: support_phone || null,
      terms_url: terms_url || null,
      privacy_url: privacy_url || null,
    };

    // Handle custom domain - generate verification token if new domain
    if (custom_domain) {
      brandingData.custom_domain = custom_domain;

      // Check if this is a new domain
      if (!id) {
        brandingData.custom_domain_verified = false;
        brandingData.custom_domain_verification_token = `elora-verify-${uuidv4().split('-')[0]}`;
        brandingData.custom_domain_ssl_status = 'pending';
      }
    }

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
