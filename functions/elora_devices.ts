Deno.serve(async (req) => {
  try {
    const apiKey = Deno.env.get('ELORA_API_KEY');
    
    if (!apiKey) {
      return Response.json({ error: 'API key not configured' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const status = body.status || 'active';
    const customerRef = body.customer_id;
    const siteRef = body.site_id;

    const params = new URLSearchParams();
    params.append('status', status);
    if (customerRef && customerRef !== 'all') params.append('customer', customerRef);
    if (siteRef && siteRef !== 'all') params.append('site', siteRef);

    const response = await fetch(`https://www.elora.com.au/api/devices?${params.toString()}`, {
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