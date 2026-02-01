// Match Supabase official CORS setup: https://supabase.com/docs/guides/functions/cors
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function handleCors(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Max-Age': '86400',
      },
    });
  }
  return null;
}
