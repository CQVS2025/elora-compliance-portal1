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
    const customerId = body.customer_id;
    const siteId = body.site_id;
    const startDate = body.start_date;
    const endDate = body.end_date;

    const params: Record<string, string> = {};
    if (customerId && customerId !== 'all') params.customer = customerId;
    if (siteId && siteId !== 'all') params.site = siteId;
    if (startDate) params.fromDate = startDate;
    if (endDate) params.toDate = endDate;

    const data = await callEloraAPI('/dashboard', params);

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