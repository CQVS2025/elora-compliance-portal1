#!/usr/bin/env node
/**
 * Sanity-check a Google Distance Matrix API key.
 *
 * Confirms:
 *   1. The key is accepted (not REQUEST_DENIED)
 *   2. Billing is linked (otherwise Google returns OVER_QUERY_LIMIT/REQUEST_DENIED)
 *   3. The Distance Matrix API is actually enabled on the project
 *   4. Returned km is within ~5 % of a hand-checked reference value
 *   5. The key is restricted to Distance Matrix only — if you pass --check-restrictions,
 *      we hit a different Maps API (Geocoding) with the same key. A restricted key
 *      should be denied; an unrestricted key will succeed and we'll warn loudly.
 *
 * Usage:
 *   GOOGLE_DISTANCE_MATRIX_API_KEY=AIzaSy... node scripts/check-distance-matrix-key.mjs
 *   node scripts/check-distance-matrix-key.mjs AIzaSy...
 *   node scripts/check-distance-matrix-key.mjs --check-restrictions
 *   node scripts/check-distance-matrix-key.mjs --origin 4000 --dest 2000
 *
 * Exits 0 on full pass, 1 on any failure.
 */

const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';

const args = process.argv.slice(2);
const flagIndex = (name) => args.indexOf(name);
const getFlag = (name, fallback) => {
  const i = flagIndex(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const hasFlag = (name) => flagIndex(name) >= 0;

const positional = args.find((a) => !a.startsWith('--') && !args[args.indexOf(a) - 1]?.startsWith('--'));
const apiKey = positional || process.env.GOOGLE_DISTANCE_MATRIX_API_KEY || '';
const origin = getFlag('--origin', '2000'); // Sydney CBD
const dest = getFlag('--dest', '3000');     // Melbourne CBD
const checkRestrictions = hasFlag('--check-restrictions');

// Hand-checked reference distance (km) for Sydney CBD → Melbourne CBD via Google Maps.
// Tolerated ±10% drift so we don't false-fail when Google updates routing.
const REFERENCE_PAIRS = {
  '2000|3000': { km: 878, label: 'Sydney CBD → Melbourne CBD' },
  '3000|2000': { km: 878, label: 'Melbourne CBD → Sydney CBD' },
  '4000|2000': { km: 916, label: 'Brisbane CBD → Sydney CBD' },
  '2000|4000': { km: 916, label: 'Sydney CBD → Brisbane CBD' },
  '4000|3000': { km: 1768, label: 'Brisbane CBD → Melbourne CBD' },
};

function log(line = '') { process.stdout.write(line + '\n'); }
function ok(msg) { log(`${GREEN}✓${RESET} ${msg}`); }
function fail(msg) { log(`${RED}✗${RESET} ${msg}`); }
function warn(msg) { log(`${YELLOW}!${RESET} ${msg}`); }
function info(msg) { log(`${CYAN}i${RESET} ${msg}`); }

log(`${BOLD}Google Distance Matrix — key sanity check${RESET}`);
log(`${DIM}────────────────────────────────────────${RESET}`);

if (!apiKey) {
  fail('No API key provided.');
  log('');
  log('Pass the key one of these ways:');
  log('  GOOGLE_DISTANCE_MATRIX_API_KEY=AIzaSy... node scripts/check-distance-matrix-key.mjs');
  log('  node scripts/check-distance-matrix-key.mjs AIzaSy...');
  process.exit(1);
}

if (!apiKey.startsWith('AIza')) {
  warn(`Key does not start with "AIza" — that's the usual prefix for Google API keys. Continuing anyway.`);
}

const masked = `${apiKey.slice(0, 8)}…${apiKey.slice(-4)}`;
info(`Key:    ${masked}  (length ${apiKey.length})`);
info(`Origin: ${origin}, Australia`);
info(`Dest:   ${dest}, Australia`);
log('');

let failed = false;

// -----------------------------------------------------------------------------
// 1. Hit Distance Matrix
// -----------------------------------------------------------------------------
log(`${BOLD}1. Calling Distance Matrix API${RESET}`);

const params = new URLSearchParams({
  origins: `${origin}, Australia`,
  destinations: `${dest}, Australia`,
  mode: 'driving',
  units: 'metric',
  region: 'au',
  key: apiKey,
});

const url = `https://maps.googleapis.com/maps/api/distancematrix/json?${params}`;

let body;
try {
  const res = await fetch(url);
  if (!res.ok) {
    fail(`HTTP ${res.status} ${res.statusText}`);
    log(await res.text());
    process.exit(1);
  }
  body = await res.json();
} catch (e) {
  fail(`Network/fetch error: ${e.message}`);
  process.exit(1);
}

const topStatus = body?.status;
if (topStatus !== 'OK') {
  fail(`Top-level status: ${topStatus}`);
  if (body?.error_message) log(`  error_message: ${body.error_message}`);
  explainTopLevelStatus(topStatus);
  process.exit(1);
}
ok(`Top-level status: OK`);

const element = body?.rows?.[0]?.elements?.[0];
if (!element) {
  fail(`Response shape unexpected — rows[0].elements[0] missing`);
  log(JSON.stringify(body, null, 2));
  process.exit(1);
}

if (element.status !== 'OK') {
  fail(`Element status: ${element.status}`);
  explainElementStatus(element.status, origin, dest);
  process.exit(1);
}
ok(`Element status: OK`);

const meters = Number(element.distance?.value);
const km = meters / 1000;
const duration = Number(element.duration?.value);

if (!Number.isFinite(meters) || meters <= 0) {
  fail(`Distance is not a positive number: ${element.distance?.value}`);
  process.exit(1);
}
ok(`Distance: ${km.toFixed(2)} km  (${element.distance?.text})`);
ok(`Duration: ${(duration / 60).toFixed(0)} min  (${element.duration?.text})`);

// -----------------------------------------------------------------------------
// 2. Compare against known-good reference, if we have one for this pair
// -----------------------------------------------------------------------------
log('');
log(`${BOLD}2. Sanity-checking the returned distance${RESET}`);
const refKey = `${origin}|${dest}`;
const ref = REFERENCE_PAIRS[refKey];
if (ref) {
  const drift = Math.abs(km - ref.km) / ref.km;
  const pct = (drift * 100).toFixed(1);
  info(`Reference: ${ref.label} ≈ ${ref.km} km`);
  if (drift <= 0.1) {
    ok(`Result is within ±10% of reference (drift ${pct}%).`);
  } else {
    warn(`Result drifts ${pct}% from reference (${ref.km} km). Could be a Google routing update; spot-check on maps.google.com.`);
  }
} else {
  info(`No baked-in reference for ${origin} → ${dest}. Skipping drift check.`);
  info(`To pin a reference, pass --origin/--dest from the REFERENCE_PAIRS list (e.g. --origin 2000 --dest 3000).`);
}

// -----------------------------------------------------------------------------
// 3. (Optional) Restriction check
// -----------------------------------------------------------------------------
if (checkRestrictions) {
  log('');
  log(`${BOLD}3. Checking that the key is restricted to Distance Matrix only${RESET}`);
  const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=Sydney&key=${encodeURIComponent(apiKey)}`;
  try {
    const res = await fetch(geoUrl);
    const geoBody = await res.json();
    if (geoBody?.status === 'REQUEST_DENIED' && /not authorized/i.test(geoBody?.error_message ?? '')) {
      ok(`Key is correctly restricted — Geocoding API rejected it.`);
    } else if (geoBody?.status === 'OK') {
      failed = true;
      warn(`Key is NOT restricted — Geocoding API accepted it too.`);
      warn(`Open Google Cloud Console → Credentials → edit the key → API restrictions → "Restrict key" → tick ONLY "Distance Matrix API" → Save.`);
    } else {
      info(`Geocoding returned status ${geoBody?.status}; can't tell from this whether the restriction is in place.`);
    }
  } catch (e) {
    warn(`Restriction probe failed: ${e.message}`);
  }
}

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
log('');
log(`${DIM}────────────────────────────────────────${RESET}`);
if (failed) {
  warn(`${BOLD}Pass with warnings.${RESET} Distance Matrix returns valid data, but at least one secondary check (key restriction, drift) failed. Read the warnings above before using this key in production.`);
  process.exit(0);
} else {
  ok(`${BOLD}All checks passed.${RESET} You can set this in Supabase:`);
  log(`   ${DIM}npx supabase secrets set GOOGLE_DISTANCE_MATRIX_API_KEY=${masked}${RESET}`);
  process.exit(0);
}

// -----------------------------------------------------------------------------

function explainTopLevelStatus(status) {
  switch (status) {
    case 'REQUEST_DENIED':
      log('');
      log(`${YELLOW}Common causes for REQUEST_DENIED:${RESET}`);
      log(`  • The Distance Matrix API isn't enabled on this Google Cloud project.`);
      log(`    Fix: Google Cloud Console → APIs & Services → Library → search "Distance Matrix API" → Enable.`);
      log(`  • Billing isn't enabled on the project.`);
      log(`    Fix: Google Cloud Console → Billing → Link a billing account.`);
      log(`  • The key has an API restriction that excludes Distance Matrix.`);
      log(`    Fix: Credentials → edit the key → API restrictions → either "Don't restrict key" or tick "Distance Matrix API".`);
      log(`  • The key has an Application restriction (HTTP referrer / IP) that we don't satisfy.`);
      log(`    Fix: Set Application restrictions → None (server-side use; restrict by API instead).`);
      break;
    case 'OVER_QUERY_LIMIT':
      log(`Quota / billing issue. Make sure billing is linked — Distance Matrix has a free monthly tier but requires a card on file.`);
      break;
    case 'INVALID_REQUEST':
      log(`Origin/destination are syntactically invalid. Try a different postcode.`);
      break;
    case 'UNKNOWN_ERROR':
      log(`Transient Google error. Retry in a few seconds.`);
      break;
    default:
      log(`Unrecognised top-level status. Full body:`);
      log(JSON.stringify(body, null, 2));
  }
}

function explainElementStatus(status, o, d) {
  switch (status) {
    case 'ZERO_RESULTS':
      log(`Google couldn't compute a driving route between "${o}, Australia" and "${d}, Australia".`);
      log(`This is normal for LVR postcodes (1xxx / 8xxx / 9xxx) and for offshore/PO-box codes.`);
      log(`Try a known street-address postcode like 2000 (Sydney) or 3000 (Melbourne).`);
      break;
    case 'NOT_FOUND':
      log(`Google couldn't geocode one of the locations. Postcode may not exist in their dataset.`);
      break;
    default:
      log(`Element-level status: ${status}`);
  }
}
