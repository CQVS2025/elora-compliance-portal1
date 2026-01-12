import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createSupabaseAdminClient } from '../_shared/supabase.ts';

/**
 * Get Favorite Vehicles Function
 * Retrieves a user's favorite vehicles
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
        data: []
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch favorites from database
    const { data: favorites, error } = await supabase
      .from('favorite_vehicles')
      .select('*')
      .eq('user_email', userEmail);

    if (error) throw error;

    return new Response(JSON.stringify({
      success: true,
      data: favorites || []
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message,
      data: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
