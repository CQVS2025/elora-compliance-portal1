import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Get Favorite Vehicles Function
 * Retrieves a user's favorite vehicles
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { userEmail } = body;

    if (!userEmail) {
      return new Response(JSON.stringify({
        error: 'User email is required',
        data: []
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Fetch favorites from database
    const favorites = await base44.asServiceRole.entities.FavoriteVehicle.filter({
      user_email: userEmail
    });

    return new Response(JSON.stringify({
      success: true,
      data: favorites || []
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message,
      data: []
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
