import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { callEloraAPI } from '../_shared/elora-api.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = await req.json().catch(() => ({}));
    const status = body.status || 'active';
    const customerRef = body.customer_id;
    const siteRef = body.site_id;

    const params: Record<string, string> = { status };
    if (customerRef && customerRef !== 'all') params.customer = customerRef;
    if (siteRef && siteRef !== 'all') params.site = siteRef;

    const data = await callEloraAPI('/devices', params);

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Server error:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});