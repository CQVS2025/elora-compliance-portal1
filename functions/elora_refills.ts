/**
 * ACATC /api/refills supports: fromDate, toDate, customerRef/customer, siteRef/site, productRef/product, status.
 * status: CSV of names (scheduled, confirmed, delivered, cancelled). Tank levels should use confirmed,delivered only.
 */
const ELORA_API_KEY = Deno.env.get("ELORA_API_KEY");

Deno.serve(async (req) => {
  if (!ELORA_API_KEY) {
    return Response.json({ error: "ELORA_API_KEY not configured" }, { status: 500 });
  }

  const { fromDate, toDate, customerRef, siteRef, status } = await req.json().catch(() => ({}));

  // Build query params - NO PAGINATION LIMITS
  const params = new URLSearchParams();
  if (fromDate) params.append('fromDate', fromDate);
  if (toDate) params.append('toDate', toDate);
  if (customerRef && customerRef !== 'all') params.append('customerRef', customerRef);
  if (siteRef && siteRef !== 'all') params.append('siteRef', siteRef);
  if (status) params.append('status', status);
  // export=true disables pagination and returns all matching rows
  params.append('export', 'true');

  try {
    params.append('api_key', ELORA_API_KEY);
    const response = await fetch(`https://www.elora.com.au/api/refills?${params}`);

    if (!response.ok) {
      const error = await response.text();
      console.error('Elora API Error:', error);
      return Response.json({ error: 'Failed to fetch refills data' }, { status: response.status });
    }

    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    console.error('Error fetching refills:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
