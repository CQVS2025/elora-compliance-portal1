import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createSupabaseAdminClient } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = createSupabaseAdminClient();
    const body = await req.json();
    const { id, customerRef, type, name, target_washes_per_week, applies_to } = body;

    if (!customerRef || !type || !name || !target_washes_per_week) {
      return new Response(JSON.stringify({
        error: 'Missing required fields'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const targetData = {
      customer_ref: customerRef,
      type,
      name,
      target_washes_per_week,
      applies_to: applies_to || 'all',
      updated_date: new Date().toISOString()
    };

    let result;
    if (id) {
      const { data, error } = await supabase
        .from('compliance_targets')
        .update(targetData)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase
        .from('compliance_targets')
        .insert({
          ...targetData,
          created_date: new Date().toISOString()
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
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
