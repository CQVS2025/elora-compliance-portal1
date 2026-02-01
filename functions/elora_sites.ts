/**
 * ACATC /api/sites does NOT accept filters. We fetch all sites and filter by customer in this edge.
 */
Deno.serve(async (req) => {
  try {
    const apiKey = Deno.env.get("ELORA_API_KEY");
    
    if (!apiKey) {
      return Response.json({ error: 'API key not configured' }, { status: 500 });
    }

    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const customerId = url.searchParams.get('customer_id') || body.customer_id;

    const response = await fetch('https://www.elora.com.au/api/sites', {
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
    let sites = Array.isArray(json?.data) ? json.data : json;
    
    // Filter by customer on our side since API doesn't support filtering
    if (customerId && customerId !== 'all') {
      sites = sites.filter(site => site.customerRef === customerId);
    }
    
    return Response.json(sites);
    
  } catch (error) {
    console.error('Server error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});
