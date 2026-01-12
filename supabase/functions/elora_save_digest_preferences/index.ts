import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createSupabaseAdminClient } from '../_shared/supabase.ts';

/**
 * Save Email Digest Preferences Function
 */

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = createSupabaseAdminClient();
    const body = await req.json();
    const {
      userEmail,
      enabled,
      frequency,
      sendTime,
      includeCompliance,
      includeMaintenance,
      includeAlerts,
      includeActivity,
      onlyIfChanges
    } = body;

    if (!userEmail) {
      return new Response(JSON.stringify({
        error: 'User email is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if preferences exist
    const { data: existing } = await supabase
      .from('email_digest_preferences')
      .select('*')
      .eq('user_email', userEmail);

    const prefData = {
      user_email: userEmail,
      enabled: enabled !== undefined ? enabled : true,
      frequency: frequency || 'daily',
      send_time: sendTime || '08:00',
      include_compliance: includeCompliance !== undefined ? includeCompliance : true,
      include_maintenance: includeMaintenance !== undefined ? includeMaintenance : true,
      include_alerts: includeAlerts !== undefined ? includeAlerts : true,
      include_activity: includeActivity !== undefined ? includeActivity : true,
      only_if_changes: onlyIfChanges !== undefined ? onlyIfChanges : false,
      updated_date: new Date().toISOString()
    };

    let result;
    if (existing && existing.length > 0) {
      // Update existing
      const { data, error } = await supabase
        .from('email_digest_preferences')
        .update(prefData)
        .eq('id', existing[0].id)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      // Create new
      const { data, error } = await supabase
        .from('email_digest_preferences')
        .insert({
          ...prefData,
          created_date: new Date().toISOString()
        })
        .select()
        .single();
      if (error) throw error;
      result = data;
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Preferences saved successfully',
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
