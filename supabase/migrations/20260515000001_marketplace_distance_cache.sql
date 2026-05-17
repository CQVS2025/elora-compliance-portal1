-- ============================================================================
-- Marketplace · Google Distance Matrix cache
--
-- Background
-- ----------
-- The freight engine resolves road distance per (origin_postcode,
-- destination_postcode). We call Google Distance Matrix to get an accurate
-- road km, then cache the result for 24 hours so repeated checkouts on the
-- same lane don't re-bill Google (and stay snappy under retry storms).
--
-- The cache key is the postcode pair (order-insensitive in real life, but we
-- store it order-sensitive — Brisbane → Sydney and Sydney → Brisbane have
-- the same distance but live as two rows so we don't have to canonicalise).
-- ============================================================================

CREATE TABLE IF NOT EXISTS marketplace_distance_cache (
  origin_postcode      TEXT NOT NULL,
  destination_postcode TEXT NOT NULL,
  distance_km          NUMERIC(10, 3) NOT NULL,
  duration_seconds     INTEGER,
  provider             TEXT NOT NULL DEFAULT 'google_distance_matrix',
  status               TEXT NOT NULL DEFAULT 'ok', -- 'ok' | 'zero_results' | 'fallback'
  cached_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at           TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  PRIMARY KEY (origin_postcode, destination_postcode)
);

CREATE INDEX IF NOT EXISTS idx_marketplace_distance_cache_expires
  ON marketplace_distance_cache(expires_at);

COMMENT ON TABLE marketplace_distance_cache IS
  'Google Distance Matrix lookups keyed by (origin_postcode, destination_postcode). Rows older than expires_at are treated as missing and refreshed on next read.';

-- RLS: only service-role writes; authenticated reads are fine (no PII).
ALTER TABLE marketplace_distance_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketplace_distance_cache: read authenticated"
  ON marketplace_distance_cache FOR SELECT
  TO authenticated
  USING (true);

-- INSERT/UPDATE/DELETE intentionally restricted to service-role; edge
-- functions use the admin client to write here.
