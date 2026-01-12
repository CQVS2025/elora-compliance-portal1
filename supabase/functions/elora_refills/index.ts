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
    const { fromDate, toDate, customerRef, siteRef } = await req.json();

    // Build query params
    const params: Record<string, string> = { pageSize: '1000' };
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    if (customerRef && customerRef !== 'all') params.customerRef = customerRef;
    if (siteRef && siteRef !== 'all') params.siteRef = siteRef;

    const data = await callEloraAPI('/refills', params);

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error fetching refills:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});