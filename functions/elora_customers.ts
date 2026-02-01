/**
 * ACATC /api/customers supports: status, q (search). No customer/site (returns list of customers). We pass status only.
 */
Deno.serve(async (req) => {
  try {
    const apiKey = Deno.env.get("ELORA_API_KEY");
    
    if (!apiKey) {
      return Response.json({ error: 'API key not configured' }, { status: 500 });
    }

    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    // Get ALL customers (active + inactive) - default is '1,2' per API docs
    const status = url.searchParams.get('status') || body.status || 'all';

    const response = await fetch(`https://www.elora.com.au/api/customers?status=${status}`, {
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
