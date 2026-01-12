import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createSupabaseAdminClient } from '../_shared/supabase.ts';

/**
 * Toggle Favorite Vehicle Function
 * Adds or removes a vehicle from user's favorites
 */

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = createSupabaseAdminClient();
    const body = await req.json();
    const { userEmail, vehicleRef, vehicleName, isFavorite } = body;

    if (!userEmail || !vehicleRef) {
      return new Response(JSON.stringify({
        error: 'User email and vehicle reference are required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (isFavorite) {
      // Add to favorites
      const { data: existing } = await supabase
        .from('favorite_vehicles')
        .select('*')
        .eq('user_email', userEmail)
        .eq('vehicle_ref', vehicleRef);

      if (existing && existing.length > 0) {
        // Already a favorite
        return new Response(JSON.stringify({
          success: true,
          message: 'Already in favorites',
          data: existing[0]
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Create new favorite
      const { data: newFavorite, error } = await supabase
        .from('favorite_vehicles')
        .insert({
          user_email: userEmail,
          vehicle_ref: vehicleRef,
          vehicle_name: vehicleName,
          created_date: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({
        success: true,
        message: 'Added to favorites',
        data: newFavorite
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } else {
      // Remove from favorites
      const { data: existing } = await supabase
        .from('favorite_vehicles')
        .select('*')
        .eq('user_email', userEmail)
        .eq('vehicle_ref', vehicleRef);

      if (existing && existing.length > 0) {
        const { error } = await supabase
          .from('favorite_vehicles')
          .delete()
          .eq('id', existing[0].id);
        if (error) throw error;
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Removed from favorites'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

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
