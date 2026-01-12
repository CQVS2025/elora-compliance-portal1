import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createSupabaseAdminClient } from '../_shared/supabase.ts';

/**
 * Get Email Digest Preferences Function
 */

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = createSupabaseAdminClient();
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

    const { data: prefs, error } = await supabase
      .from('email_digest_preferences')
      .select('*')
      .eq('user_email', userEmail);

    if (error) throw error;

    if (prefs && prefs.length > 0) {
      return new Response(JSON.stringify({
        success: true,
        data: prefs[0]
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Return defaults if not found
    return new Response(JSON.stringify({
      success: true,
      data: {
        enabled: true,
        frequency: 'daily',
        send_time: '08:00',
        include_compliance: true,
        include_maintenance: true,
        include_alerts: true,
        include_activity: true,
        only_if_changes: false
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
