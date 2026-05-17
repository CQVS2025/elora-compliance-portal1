// deno-lint-ignore-file no-explicit-any
/**
 * Resolves road distance (km) between two AU postcodes for freight quoting.
 *
 * Postcode-only by design — matches what the
 * scripts/check-distance-matrix-key.mjs sanity-check script does and keeps
 * the cache key simple. The Distance Matrix call sends
 * "<postcode>, Australia" on both ends.
 *
 * Order of preference:
 *   1. Fresh cache row in `marketplace_distance_cache`           (free, ~5 ms)
 *   2. Google Distance Matrix API                                 (paid, ~120 ms)
 *      — needs Deno.env GOOGLE_DISTANCE_MATRIX_API_KEY
 *      — writes the result back into the cache with a 24h TTL
 *   3. Haversine × 1.25 fallback via the existing
 *      marketplace_postcode_distance_km RPC                       (free, geometric)
 *
 * Returns `null` only when every path fails.
 */
import { createSupabaseAdminClient } from './supabase.ts';

const GOOGLE_API = 'https://maps.googleapis.com/maps/api/distancematrix/json';
const CACHE_TTL_HOURS = 24;

export type DistanceResult = {
  distance_km: number;
  duration_seconds: number | null;
  source: 'cache' | 'google' | 'haversine';
};

export async function resolveRoadDistanceKm(
  supabase: any,
  originPostcode: string,
  destPostcode: string,
): Promise<DistanceResult | null> {
  const origin = String(originPostcode || '').trim();
  const dest = String(destPostcode || '').trim();
  if (!origin || !dest) return null;

  // 1. Cache
  const cached = await readCache(supabase, origin, dest);
  if (cached) return cached;

  // 2. Google
  const googleResult = await callGoogleDistanceMatrix(origin, dest);
  if (googleResult) {
    await writeCache(origin, dest, googleResult);
    return { ...googleResult, source: 'google' };
  }

  // 3. Haversine fallback. NOT cached — we want the next request to retry
  // Google in case the previous failure was transient.
  const fallbackKm = await callHaversineRpc(supabase, origin, dest);
  if (fallbackKm != null) {
    return { distance_km: fallbackKm, duration_seconds: null, source: 'haversine' };
  }

  return null;
}

// ---------------------------------------------------------------------------

async function readCache(
  supabase: any,
  origin: string,
  dest: string,
): Promise<DistanceResult | null> {
  const { data } = await supabase
    .from('marketplace_distance_cache')
    .select('distance_km, duration_seconds, expires_at, status')
    .eq('origin_postcode', origin)
    .eq('destination_postcode', dest)
    .maybeSingle();
  if (!data) return null;
  if (data.status !== 'ok') return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return {
    distance_km: Number(data.distance_km),
    duration_seconds: data.duration_seconds == null ? null : Number(data.duration_seconds),
    source: 'cache',
  };
}

async function writeCache(
  origin: string,
  dest: string,
  result: { distance_km: number; duration_seconds: number | null },
): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    const expiresAt = new Date(Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString();
    await admin
      .from('marketplace_distance_cache')
      .upsert(
        {
          origin_postcode: origin,
          destination_postcode: dest,
          distance_km: result.distance_km,
          duration_seconds: result.duration_seconds,
          provider: 'google_distance_matrix',
          status: 'ok',
          cached_at: new Date().toISOString(),
          expires_at: expiresAt,
        },
        { onConflict: 'origin_postcode,destination_postcode' },
      );
  } catch (e) {
    console.warn('marketplace_distance_cache write failed', e);
  }
}

async function callGoogleDistanceMatrix(
  origin: string,
  dest: string,
): Promise<{ distance_km: number; duration_seconds: number | null } | null> {
  const key = Deno.env.get('GOOGLE_DISTANCE_MATRIX_API_KEY');
  if (!key) {
    console.warn('GOOGLE_DISTANCE_MATRIX_API_KEY not set on this edge function — falling back to Haversine.');
    return null;
  }

  // Postcode-only, mirroring the local sanity-check script.
  const params = new URLSearchParams({
    origins: `${origin}, Australia`,
    destinations: `${dest}, Australia`,
    mode: 'driving',
    units: 'metric',
    region: 'au',
    key,
  });

  try {
    const res = await fetch(`${GOOGLE_API}?${params.toString()}`);
    if (!res.ok) {
      console.warn('Distance Matrix HTTP', res.status, await safeText(res));
      return null;
    }
    const body = await res.json();
    if (body?.status !== 'OK') {
      console.warn('Distance Matrix status', body?.status, body?.error_message, 'origin=', origin, 'dest=', dest);
      return null;
    }
    const element = body?.rows?.[0]?.elements?.[0];
    if (!element || element.status !== 'OK') {
      console.warn('Distance Matrix element status', element?.status, 'origin=', origin, 'dest=', dest);
      return null;
    }
    const meters = Number(element.distance?.value);
    if (!Number.isFinite(meters) || meters <= 0) return null;
    const duration = Number(element.duration?.value);
    return {
      distance_km: round3(meters / 1000),
      duration_seconds: Number.isFinite(duration) ? Math.round(duration) : null,
    };
  } catch (e) {
    console.warn('Distance Matrix fetch failed', e);
    return null;
  }
}

async function callHaversineRpc(
  supabase: any,
  origin: string,
  dest: string,
): Promise<number | null> {
  try {
    const { data } = await supabase.rpc('marketplace_postcode_distance_km', {
      origin,
      dest,
    });
    if (data == null) return null;
    return Number(data);
  } catch (e) {
    console.warn('haversine RPC failed', e);
    return null;
  }
}

async function safeText(res: Response): Promise<string> {
  try { return await res.text(); } catch { return ''; }
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
