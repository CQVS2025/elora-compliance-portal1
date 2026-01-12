import { callEloraAPI } from '../_shared/elora-api.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

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