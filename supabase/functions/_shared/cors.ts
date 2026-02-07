// Match Supabase official CORS setup: https://supabase.com/docs/guides/functions/cors
// Use request origin when present so preflight passes with Authorization header (browsers may reject * with credentials).
function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const allowOrigin =
    origin && (origin.startsWith('http://') || origin.startsWith('https://'))
      ? origin
      : '*';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  };
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

/** Call this with the request to get headers that reflect Origin (use in handleCors and in responses). */
export function corsHeadersForRequest(req: Request): Record<string, string> {
  return getCorsHeaders(req);
}

export function handleCors(req: Request) {
  if (req.method === 'OPTIONS') {
    const headers = {
      ...getCorsHeaders(req),
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Max-Age': '86400',
    };
    return new Response(null, {
      status: 204,
      headers,
    });
  }
  return null;
}
