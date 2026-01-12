import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Get Email Digest Preferences Function
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { userEmail } = body;

    if (!userEmail) {
      return new Response(JSON.stringify({
        error: 'User email is required',
        data: null
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const prefs = await base44.asServiceRole.entities.EmailDigestPreference.filter({
      user_email: userEmail
    });

    if (prefs && prefs.length > 0) {
      return new Response(JSON.stringify({
        success: true,
        data: prefs[0]
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
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
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message,
      data: null
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
