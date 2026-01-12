import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Toggle Favorite Vehicle Function
 * Adds or removes a vehicle from user's favorites
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { userEmail, vehicleRef, vehicleName, isFavorite } = body;

    if (!userEmail || !vehicleRef) {
      return new Response(JSON.stringify({
        error: 'User email and vehicle reference are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (isFavorite) {
      // Add to favorites
      const existing = await base44.asServiceRole.entities.FavoriteVehicle.filter({
        user_email: userEmail,
        vehicle_ref: vehicleRef
      });

      if (existing && existing.length > 0) {
        // Already a favorite
        return new Response(JSON.stringify({
          success: true,
          message: 'Already in favorites',
          data: existing[0]
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Create new favorite
      const newFavorite = await base44.asServiceRole.entities.FavoriteVehicle.create({
        user_email: userEmail,
        vehicle_ref: vehicleRef,
        vehicle_name: vehicleName,
        created_date: new Date().toISOString()
      });

      return new Response(JSON.stringify({
        success: true,
        message: 'Added to favorites',
        data: newFavorite
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } else {
      // Remove from favorites
      const existing = await base44.asServiceRole.entities.FavoriteVehicle.filter({
        user_email: userEmail,
        vehicle_ref: vehicleRef
      });

      if (existing && existing.length > 0) {
        await base44.asServiceRole.entities.FavoriteVehicle.delete(existing[0].id);
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Removed from favorites'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
