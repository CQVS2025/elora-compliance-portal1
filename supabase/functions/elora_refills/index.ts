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

    // Build query params - NO PAGINATION LIMITS
    const params: Record<string, string> = { export: 'all' };
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    if (customerRef && customerRef !== 'all') params.customerRef = customerRef;
    if (siteRef && siteRef !== 'all') params.siteRef = siteRef;

    console.log('🔍 ELORA REFILLS API REQUEST:', {
      endpoint: '/refills',
      params,
      timestamp: new Date().toISOString()
    });

    const data = await callEloraAPI('/refills', params);

    console.log('📊 ELORA REFILLS API RESPONSE:', {
      dataType: typeof data,
      isArray: Array.isArray(data),
      count: Array.isArray(data) ? data.length : 'N/A',
      hasData: !!data,
      firstItem: Array.isArray(data) && data.length > 0 ? data[0] : null,
      lastItem: Array.isArray(data) && data.length > 0 ? data[data.length - 1] : null
    });

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('❌ Error fetching refills:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});