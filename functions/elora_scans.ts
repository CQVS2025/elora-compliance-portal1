Deno.serve(async (req) => {
  try {
    const apiKey = Deno.env.get("ELORA_API_KEY");
    
    if (!apiKey) {
      return Response.json({ error: 'API key not configured' }, { status: 500 });
    }

    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const customerId = body.customer_id ?? body.customer ?? url.searchParams.get('customer_id') ?? url.searchParams.get('customer');
    const siteId = body.site_id ?? body.site ?? url.searchParams.get('site_id') ?? url.searchParams.get('site');
    const startDate = body.start_date ?? body.fromDate ?? url.searchParams.get('start_date') ?? url.searchParams.get('fromDate');
    const endDate = body.end_date ?? body.toDate ?? url.searchParams.get('end_date') ?? url.searchParams.get('toDate');

    const params = new URLSearchParams({ 
      export: 'all',
      status: 'success'
    });
    
    if (customerId && customerId !== 'all') params.append('customer', customerId);
    if (siteId && siteId !== 'all') params.append('site', siteId);
    if (startDate) params.append('fromDate', startDate);
    if (endDate) params.append('toDate', endDate);

    const response = await fetch(`https://www.elora.com.au/api/scans?${params.toString()}`, {
      headers: {
        'x-api-key': apiKey
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Elora API error (${response.status}):`, errorText);
      return Response.json({ 
        error: `Elora API error: ${response.status}`,
        details: errorText 
      }, { status: response.status });
    }

    const json = await response.json();
    return Response.json(json?.data ?? json);
    
  } catch (error) {
    console.error('Server error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});
