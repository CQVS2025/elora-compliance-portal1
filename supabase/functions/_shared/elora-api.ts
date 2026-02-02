const ELORA_API_BASE = 'https://www.elora.com.au/api';

export async function callEloraAPI(endpoint: string, params?: Record<string, string>) {
  const apiKey = Deno.env.get('ELORA_API_KEY');

  if (!apiKey) {
    throw new Error('ELORA_API_KEY not configured');
  }

  const url = new URL(`${ELORA_API_BASE}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value && value !== 'all') {
        url.searchParams.append(key, value);
      }
    });
  }

  const response = await fetch(url.toString(), {
    headers: {
      'x-api-key': apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Elora API error (${response.status}):`, errorText);
    throw new Error(`Elora API error: ${response.status}`);
  }

  const json = await response.json();
  // Preserve paginated response shape { total, page, pageSize, pageCount, data }
  if (
    json &&
    typeof json === 'object' &&
    Array.isArray(json.data) &&
    ('total' in json || 'page' in json)
  ) {
    return json;
  }
  return json.data ?? json;
}
