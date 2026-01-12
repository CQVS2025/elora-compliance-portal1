import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { customerRef } = body;

    const targets = await base44.asServiceRole.entities.ComplianceTarget.filter({
      customer_ref: customerRef
    });

    return new Response(JSON.stringify({
      success: true,
      data: targets || []
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
