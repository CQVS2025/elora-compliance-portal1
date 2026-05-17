-- ============================================================================
-- Marketplace · Approximate road distance from haversine
--
-- Background
-- ----------
-- marketplace_postcode_distance_km previously returned raw great-circle
-- (haversine) km between two AusPost postcode centroids. Freight matrices
-- are priced for ROAD km, not bird-flight km, so this systematically
-- under-charged the buyer (smaller bracket → cheaper quote).
--
-- Chem Connect handles this two ways:
--   1. Calls Google Distance Matrix for real road km (when an API key is set)
--   2. Falls back to haversine × 1.25 — empirical multiplier that lines up
--      with road km within ~5 % across Australia
--
-- We adopt the (2) fallback behaviour by default. Elora can later bolt on
-- the Google call if penny-accurate road distance becomes important —
-- this migration won't conflict with that work; the multiplier just moves
-- into the API-fallback branch.
--
-- Net effect on existing quotes
-- -----------------------------
-- Every distance figure grows by 25 %. Quotes that previously sat near a
-- bracket boundary may shift up one bracket. Brisbane → Sydney goes from
-- 732 km → 915 km (701–800 → 901–1000 bracket on the supplier matrix).
-- ============================================================================

CREATE OR REPLACE FUNCTION marketplace_postcode_distance_km(origin TEXT, dest TEXT)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- 1.25× empirical road-distance multiplier (matches Chem Connect's
  -- approximateDistanceKm() fallback in lib/fulfillment/distance.ts).
  SELECT marketplace_haversine_km(o.latitude, o.longitude, d.latitude, d.longitude) * 1.25
  FROM marketplace_postcodes o, marketplace_postcodes d
  WHERE o.postcode = origin AND d.postcode = dest
  LIMIT 1;
$$;

COMMENT ON FUNCTION marketplace_postcode_distance_km IS
  'Returns approximate ROAD km between two AusPost postcodes. Computed as great-circle distance × 1.25 (empirical road/haversine ratio across AU). NULL when either postcode is unknown.';
