// deno-lint-ignore-file no-explicit-any
import { handleCors, corsHeaders } from '../_shared/cors.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { calculateFreightQuote } from '../_shared/marketplaceFreight.ts';

/**
 * POST { lines: [{product_id, packaging_size_id, quantity}], delivery_postcode: string }
 * Returns the freight quote breakdown for the caller's cart against a
 * specific delivery postcode. Honours per-sheet out-of-range behaviour.
 *
 * Auth: the caller's JWT is used so RLS scopes any product / rate sheet
 * reads to what the buyer is actually allowed to see.
 */
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const body = await req.json();
    const lines = Array.isArray(body?.lines) ? body.lines : [];
    const deliveryPostcode = String(body?.delivery_postcode ?? '').trim();

    if (!deliveryPostcode) {
      return json({ error: 'delivery_postcode is required' }, 400);
    }

    const supabase = createSupabaseClient(req);
    const quote = await calculateFreightQuote(supabase, lines, deliveryPostcode);

    return json(quote, 200);
  } catch (err: any) {
    console.error('marketplace_freight_quote error', err);
    return json({ error: err?.message ?? 'Internal error' }, 500);
  }
});

function json(body: any, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
