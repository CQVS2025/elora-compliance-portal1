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
    const url = new URL(req.url);
    const customerId = url.searchParams.get('customer_id');

    let sites = await callEloraAPI('/sites', {});

    // Filter by customer on our side since API doesn't support filtering
    if (customerId && customerId !== 'all') {
      sites = sites.filter((site: any) => site.customerRef === customerId);
    }

    return new Response(JSON.stringify(sites), {
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