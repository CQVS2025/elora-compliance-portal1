import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createSupabaseAdminClient } from '../_shared/supabase.ts';

/**
 * Save Email Template Function
 * Creates or updates an email template for a company
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
      template_type,
      template_name,
      subject_template,
      body_html_template,
      body_text_template,
      available_variables,
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

    if (!template_type) {
      return new Response(JSON.stringify({
        error: 'Template type is required',
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!subject_template || !body_html_template) {
      return new Response(JSON.stringify({
        error: 'Subject and body HTML templates are required',
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const templateData = {
      company_id,
      template_type,
      template_name: template_name || `${template_type} Template`,
      subject_template,
      body_html_template,
      body_text_template: body_text_template || null,
      available_variables: available_variables || {},
      is_active: is_active ?? true,
    };

    let result;

    if (id) {
      // Update existing
      const { data, error } = await supabase
        .from('email_templates')
        .update(templateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Upsert - update if template_type exists for company, otherwise insert
      const { data, error } = await supabase
        .from('email_templates')
        .upsert(templateData, {
          onConflict: 'company_id,template_type',
          ignoreDuplicates: false
        })
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
