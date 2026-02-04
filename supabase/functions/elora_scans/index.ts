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
    const fromDate = body.fromDate ?? body.start_date;
    const toDate = body.toDate ?? body.end_date;
    const customerId = body.customerId ?? body.customer_id ?? body.customer;
    const siteId = body.siteId ?? body.site_id ?? body.site;
    const vehicleId = body.vehicleId ?? body.vehicle_id ?? body.vehicle;
    const deviceId = body.deviceId ?? body.device_id ?? body.device;
    const status = body.status;
    const page = body.page;
    const pageSize = body.pageSize;
    const exportAll = body.export;

    const params: Record<string, string> = {};
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    if (customerId && customerId !== 'all') params.customer = customerId;
    if (siteId && siteId !== 'all') params.site = siteId;
    if (vehicleId && vehicleId !== 'all') params.vehicle = vehicleId;
    if (deviceId && deviceId !== 'all') params.device = deviceId;
    if (status != null) params.status = String(status);
    if (page != null) params.page = String(page);
    if (pageSize != null) params.pageSize = String(Math.min(Number(pageSize) || 100, 1000));
    if (exportAll != null && exportAll !== '') params.export = String(exportAll);
    if (!params.export) params.status = params.status ?? 'success';

    const result = await callEloraAPI('/scans', params);

    // Normalize to documented shape { total, page, pageSize, pageCount, data }
    const payload =
      result != null &&
      typeof result === 'object' &&
      Array.isArray(result.data) &&
      'total' in result
        ? result
        : Array.isArray(result)
          ? {
              total: result.length,
              page: page != null ? Number(page) : 1,
              pageSize: pageSize != null ? Math.min(Number(pageSize), 1000) : result.length,
              pageCount: 1,
              data: result,
            }
          : { total: 0, page: 1, pageSize: Number(pageSize) || 100, pageCount: 0, data: [] };

    return new Response(JSON.stringify(payload), {
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