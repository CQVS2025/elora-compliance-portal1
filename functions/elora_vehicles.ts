Deno.serve(async (req) => {
  try {
    const apiKey = Deno.env.get("ELORA_API_KEY");
    
    if (!apiKey) {
      return Response.json({ error: 'API key not configured' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const customerId = body.customer_id;
    const siteId = body.site_id;

    const params = new URLSearchParams({ status: '1' }); // active only
    if (customerId && customerId !== 'all') {
      params.append('customer', customerId);
    }
    if (siteId && siteId !== 'all') {
      params.append('site', siteId);
    }

    const response = await fetch(`https://www.elora.com.au/api/vehicles?${params.toString()}`, {
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
    return Response.json(json.data || []);
    
  } catch (error) {
    console.error('Server error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});