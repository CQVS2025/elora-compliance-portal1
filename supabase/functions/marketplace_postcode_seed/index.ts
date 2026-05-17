// deno-lint-ignore-file no-explicit-any
import { handleCors, corsHeaders } from '../_shared/cors.ts';
import { createSupabaseClient, createSupabaseAdminClient } from '../_shared/supabase.ts';

/**
 * One-shot AusPost postcode seeder.
 *
 * POST { rows: [{ postcode, locality?, state?, latitude, longitude }] }
 *
 * Admin-only. Upserts rows into marketplace_postcodes in batches of 500
 * (Supabase REST insert limit). Safe to re-run; existing rows are
 * overwritten.
 *
 * The dataset is publicly available from Australia Post; a curated copy can
 * be POSTed to this function. We also include a small embedded "common
 * postcodes" seed below as a fallback for demo / smoke tests.
 */
const COMMON_POSTCODES: Array<{ postcode: string; locality: string; state: string; latitude: number; longitude: number }> = [
  // QLD
  { postcode: '4000', locality: 'Brisbane', state: 'QLD', latitude: -27.4705, longitude: 153.0260 },
  { postcode: '4014', locality: 'Pinkenba', state: 'QLD', latitude: -27.4280, longitude: 153.1170 },
  { postcode: '4101', locality: 'South Brisbane', state: 'QLD', latitude: -27.4810, longitude: 153.0220 },
  { postcode: '4170', locality: 'Morningside', state: 'QLD', latitude: -27.4660, longitude: 153.0790 },
  { postcode: '4220', locality: 'Burleigh Heads', state: 'QLD', latitude: -28.1010, longitude: 153.4500 },
  { postcode: '4350', locality: 'Toowoomba', state: 'QLD', latitude: -27.5598, longitude: 151.9507 },
  { postcode: '4670', locality: 'Bundaberg', state: 'QLD', latitude: -24.8661, longitude: 152.3489 },
  { postcode: '4810', locality: 'Townsville', state: 'QLD', latitude: -19.2589, longitude: 146.8169 },
  { postcode: '4870', locality: 'Cairns', state: 'QLD', latitude: -16.9203, longitude: 145.7710 },
  // NSW
  { postcode: '2000', locality: 'Sydney', state: 'NSW', latitude: -33.8688, longitude: 151.2093 },
  { postcode: '2114', locality: 'West Ryde', state: 'NSW', latitude: -33.8067, longitude: 151.0858 },
  { postcode: '2148', locality: 'Blacktown', state: 'NSW', latitude: -33.7681, longitude: 150.9061 },
  { postcode: '2170', locality: 'Liverpool', state: 'NSW', latitude: -33.9216, longitude: 150.9239 },
  { postcode: '2250', locality: 'Gosford', state: 'NSW', latitude: -33.4259, longitude: 151.3416 },
  { postcode: '2300', locality: 'Newcastle', state: 'NSW', latitude: -32.9283, longitude: 151.7817 },
  { postcode: '2500', locality: 'Wollongong', state: 'NSW', latitude: -34.4278, longitude: 150.8931 },
  { postcode: '2640', locality: 'Albury', state: 'NSW', latitude: -36.0737, longitude: 146.9135 },
  { postcode: '2800', locality: 'Orange', state: 'NSW', latitude: -33.2839, longitude: 149.0996 },
  // VIC
  { postcode: '3000', locality: 'Melbourne', state: 'VIC', latitude: -37.8136, longitude: 144.9631 },
  { postcode: '3030', locality: 'Werribee', state: 'VIC', latitude: -37.8993, longitude: 144.6606 },
  { postcode: '3150', locality: 'Glen Waverley', state: 'VIC', latitude: -37.8767, longitude: 145.1665 },
  { postcode: '3175', locality: 'Dandenong', state: 'VIC', latitude: -37.9886, longitude: 145.2148 },
  { postcode: '3220', locality: 'Geelong', state: 'VIC', latitude: -38.1499, longitude: 144.3617 },
  { postcode: '3350', locality: 'Ballarat', state: 'VIC', latitude: -37.5622, longitude: 143.8503 },
  { postcode: '3550', locality: 'Bendigo', state: 'VIC', latitude: -36.7570, longitude: 144.2794 },
  // SA
  { postcode: '5000', locality: 'Adelaide', state: 'SA', latitude: -34.9285, longitude: 138.6007 },
  { postcode: '5008', locality: 'Croydon Park', state: 'SA', latitude: -34.8910, longitude: 138.5640 },
  { postcode: '5290', locality: 'Mount Gambier', state: 'SA', latitude: -37.8311, longitude: 140.7811 },
  // WA
  { postcode: '6000', locality: 'Perth', state: 'WA', latitude: -31.9505, longitude: 115.8605 },
  { postcode: '6105', locality: 'Cloverdale', state: 'WA', latitude: -31.9648, longitude: 115.9419 },
  { postcode: '6230', locality: 'Bunbury', state: 'WA', latitude: -33.3267, longitude: 115.6411 },
  { postcode: '6430', locality: 'Kalgoorlie', state: 'WA', latitude: -30.7490, longitude: 121.4658 },
  // TAS
  { postcode: '7000', locality: 'Hobart', state: 'TAS', latitude: -42.8821, longitude: 147.3272 },
  { postcode: '7250', locality: 'Launceston', state: 'TAS', latitude: -41.4391, longitude: 147.1358 },
  // NT
  { postcode: '0800', locality: 'Darwin', state: 'NT', latitude: -12.4634, longitude: 130.8456 },
  { postcode: '0870', locality: 'Alice Springs', state: 'NT', latitude: -23.6980, longitude: 133.8807 },
  // ACT
  { postcode: '2600', locality: 'Canberra', state: 'ACT', latitude: -35.2809, longitude: 149.1300 },
  { postcode: '2900', locality: 'Tuggeranong', state: 'ACT', latitude: -35.4220, longitude: 149.0833 },
];

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    // Admin gate
    const supabase = createSupabaseClient(req);
    const { data: adminCheck } = await supabase.rpc('is_marketplace_admin');
    if (!adminCheck) {
      return json({ error: 'Forbidden: marketplace admin required' }, 403);
    }

    let rows: any[] = [];
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        rows = Array.isArray(body?.rows) ? body.rows : [];
      } catch {
        // No body — fall back to embedded seed
      }
    }

    if (rows.length === 0) {
      rows = COMMON_POSTCODES;
    }

    // Validate / normalise
    const normalised = rows
      .map((r) => ({
        postcode: String(r.postcode ?? '').trim(),
        locality: r.locality ?? null,
        state: r.state ?? null,
        latitude: Number(r.latitude),
        longitude: Number(r.longitude),
      }))
      .filter((r) => r.postcode && Number.isFinite(r.latitude) && Number.isFinite(r.longitude));

    if (normalised.length === 0) {
      return json({ error: 'No valid rows in request' }, 400);
    }

    // Service-role for the bulk upsert (RLS allows admin write but the
    // service-role client is faster for large batches).
    const admin = createSupabaseAdminClient();

    // Chunk in 500s
    const batches: any[][] = [];
    for (let i = 0; i < normalised.length; i += 500) {
      batches.push(normalised.slice(i, i + 500));
    }

    let inserted = 0;
    for (const batch of batches) {
      const { error } = await admin
        .from('marketplace_postcodes')
        .upsert(batch, { onConflict: 'postcode' });
      if (error) {
        console.error('marketplace_postcode_seed batch error', error);
        return json({ error: error.message, inserted_so_far: inserted }, 500);
      }
      inserted += batch.length;
    }

    return json({ ok: true, inserted }, 200);
  } catch (err: any) {
    console.error('marketplace_postcode_seed error', err);
    return json({ error: err?.message ?? 'Internal error' }, 500);
  }
});

function json(body: any, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
