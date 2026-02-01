/**
 * ACATC /api/devices supports only: status, q (search). No customer/site params.
 * We fetch all devices (with status) and filter by customer/site in this edge.
 */
Deno.serve(async (req) => {
  try {
    const apiKey = Deno.env.get('ELORA_API_KEY');
    
    if (!apiKey) {
      return Response.json({ error: 'API key not configured' }, { status: 500 });
    }

    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    // Get ALL devices (active + inactive) - default is '1,2' per API docs
    const status = body.status || url.searchParams.get('status') || '1,2';
    const customerId = body.customer_id
      ?? body.customer
      ?? url.searchParams.get('customer_id')
      ?? url.searchParams.get('customer');
    const siteId = body.site_id
      ?? body.site
      ?? url.searchParams.get('site_id')
      ?? url.searchParams.get('site');

    const params = new URLSearchParams();
    params.append('status', status);
    // ACATC /api/devices does NOT support customer or site - filter after fetch

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
    let devices = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);

    if (customerId && customerId !== 'all') {
      devices = devices.filter((d: { customerRef?: string; customer_ref?: string }) =>
        (d.customerRef ?? d.customer_ref) === customerId
      );
    }
    if (siteId && siteId !== 'all') {
      devices = devices.filter((d: { siteRef?: string; site_ref?: string }) =>
        (d.siteRef ?? d.site_ref) === siteId
      );
    }

    return Response.json(devices);
  } catch (error) {
    console.error('Server error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});
