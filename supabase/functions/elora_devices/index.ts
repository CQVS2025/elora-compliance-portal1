import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const ELORA_API_KEY = Deno.env.get('ELORA_API_KEY')
const ELORA_BASE_URL = 'https://www.elora.com.au/api'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const params = url.searchParams
    
    const eloraUrl = `${ELORA_BASE_URL}/devices?${params.toString()}`
    
    const response = await fetch(eloraUrl, {
      headers: {
        'x-api-key': ELORA_API_KEY || '',
        'Content-Type': 'application/json'
      }
    })
    
    const data = await response.json()
    
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
