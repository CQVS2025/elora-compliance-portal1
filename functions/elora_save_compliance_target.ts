import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { id, customerRef, type, name, target_washes_per_week, applies_to } = body;

    if (!customerRef || !type || !name || !target_washes_per_week) {
      return new Response(JSON.stringify({
        error: 'Missing required fields'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
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
      result = await base44.asServiceRole.entities.ComplianceTarget.update(id, targetData);
    } else {
      result = await base44.asServiceRole.entities.ComplianceTarget.create({
        ...targetData,
        created_date: new Date().toISOString()
      });
    }

    return new Response(JSON.stringify({
      success: true,
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
