import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Save Email Digest Preferences Function
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
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
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if preferences exist
    const existing = await base44.asServiceRole.entities.EmailDigestPreference.filter({
      user_email: userEmail
    });

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
      result = await base44.asServiceRole.entities.EmailDigestPreference.update(
        existing[0].id,
        prefData
      );
    } else {
      // Create new
      result = await base44.asServiceRole.entities.EmailDigestPreference.create({
        ...prefData,
        created_date: new Date().toISOString()
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Preferences saved successfully',
      data: result
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

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
