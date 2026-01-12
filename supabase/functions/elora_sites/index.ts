import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { callEloraAPI } from '../_shared/elora-api.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

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