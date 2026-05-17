#!/usr/bin/env node
/**
 * One-shot postcode seeder for the marketplace freight engine.
 *
 * What it does
 * ------------
 * Upserts ~40 Australian capital + major-regional postcodes into
 * `marketplace_postcodes` so `marketplace_postcode_distance_km(origin, dest)`
 * returns real great-circle distances instead of NULL → freight quotes can
 * resolve real distance brackets.
 *
 * Why a script and not the Edge Function
 * --------------------------------------
 * The marketplace_postcode_seed Edge Function is admin-gated (needs a JWT)
 * and not always already deployed. This script connects with the Supabase
 * service-role key from `.env.local` and writes directly — same effect, no
 * dependency on the function being deployed or a logged-in admin session.
 *
 * Usage
 * -----
 *   cd elora-compliance-portal1
 *   node scripts/seed-marketplace-postcodes.mjs
 *
 *   # OR with a custom AusPost CSV (columns: postcode, locality, state, latitude, longitude)
 *   node scripts/seed-marketplace-postcodes.mjs --csv ./auspost.csv
 *
 * Env it reads (from .env.local at the project root):
 *   VITE_SUPABASE_URL              required
 *   SUPABASE_SERVICE_ROLE_KEY      required (RLS blocks anon for this table)
 *
 * Safe to re-run — rows are upserted by `postcode` primary key.
 */

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// ---- Load .env.local --------------------------------------------------------
const envPath = resolve(projectRoot, '.env.local');
try {
  const text = readFileSync(envPath, 'utf8');
  text.split('\n').forEach((line) => {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.+)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
} catch (e) {
  console.warn(`Could not read ${envPath}: ${e.message}`);
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.');
  process.exit(1);
}

// Decode the JWT payload (no signature check — we just want the `role` claim)
// so we can fail fast if the user pasted the anon key into the service-role
// slot. RLS on marketplace_postcodes only bypasses for the service_role role;
// the anon key trips "violates row-level security policy" on every insert.
function rolePeek(jwt) {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString('utf8'));
    return payload?.role ?? null;
  } catch { return null; }
}
const role = rolePeek(SERVICE_ROLE_KEY);
if (role !== 'service_role') {
  console.error(`✗ SUPABASE_SERVICE_ROLE_KEY in .env.local has role="${role ?? 'unknown'}", not "service_role".`);
  console.error('  marketplace_postcodes RLS blocks writes from any other role.');
  console.error('  Get the service-role key from Supabase Dashboard → Project Settings → API → service_role secret.');
  console.error('  Make sure .env.local contains the LONG key with role:"service_role", NOT the anon key.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  },
});

// ---- Optional --csv flag ----------------------------------------------------
const csvArgIdx = process.argv.indexOf('--csv');
const csvPath = csvArgIdx > -1 ? process.argv[csvArgIdx + 1] : null;

// ---- Embedded fallback (mirrors marketplace_postcode_seed Edge Function) ----
const COMMON_POSTCODES = [
  // QLD
  { postcode: '4000', locality: 'Brisbane', state: 'QLD', latitude: -27.4705, longitude: 153.026 },
  { postcode: '4014', locality: 'Pinkenba', state: 'QLD', latitude: -27.428, longitude: 153.117 },
  { postcode: '4101', locality: 'South Brisbane', state: 'QLD', latitude: -27.481, longitude: 153.022 },
  { postcode: '4170', locality: 'Morningside', state: 'QLD', latitude: -27.466, longitude: 153.079 },
  { postcode: '4220', locality: 'Burleigh Heads', state: 'QLD', latitude: -28.101, longitude: 153.45 },
  { postcode: '4350', locality: 'Toowoomba', state: 'QLD', latitude: -27.5598, longitude: 151.9507 },
  { postcode: '4670', locality: 'Bundaberg', state: 'QLD', latitude: -24.8661, longitude: 152.3489 },
  { postcode: '4810', locality: 'Townsville', state: 'QLD', latitude: -19.2589, longitude: 146.8169 },
  { postcode: '4870', locality: 'Cairns', state: 'QLD', latitude: -16.9203, longitude: 145.771 },
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
  { postcode: '3550', locality: 'Bendigo', state: 'VIC', latitude: -36.757, longitude: 144.2794 },
  // SA
  { postcode: '5000', locality: 'Adelaide', state: 'SA', latitude: -34.9285, longitude: 138.6007 },
  { postcode: '5008', locality: 'Croydon Park', state: 'SA', latitude: -34.891, longitude: 138.564 },
  { postcode: '5290', locality: 'Mount Gambier', state: 'SA', latitude: -37.8311, longitude: 140.7811 },
  // WA
  { postcode: '6000', locality: 'Perth', state: 'WA', latitude: -31.9505, longitude: 115.8605 },
  { postcode: '6105', locality: 'Cloverdale', state: 'WA', latitude: -31.9648, longitude: 115.9419 },
  { postcode: '6230', locality: 'Bunbury', state: 'WA', latitude: -33.3267, longitude: 115.6411 },
  { postcode: '6430', locality: 'Kalgoorlie', state: 'WA', latitude: -30.749, longitude: 121.4658 },
  // TAS
  { postcode: '7000', locality: 'Hobart', state: 'TAS', latitude: -42.8821, longitude: 147.3272 },
  { postcode: '7250', locality: 'Launceston', state: 'TAS', latitude: -41.4391, longitude: 147.1358 },
  // NT
  { postcode: '0800', locality: 'Darwin', state: 'NT', latitude: -12.4634, longitude: 130.8456 },
  { postcode: '0870', locality: 'Alice Springs', state: 'NT', latitude: -23.698, longitude: 133.8807 },
  // ACT
  { postcode: '2600', locality: 'Canberra', state: 'ACT', latitude: -35.2809, longitude: 149.13 },
  { postcode: '2900', locality: 'Tuggeranong', state: 'ACT', latitude: -35.422, longitude: 149.0833 },
];

// ---- CSV loader (optional) --------------------------------------------------
function loadCsv(path) {
  const text = readFileSync(path, 'utf8').replace(/^﻿/, '');
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row.');
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const cols = {
    postcode: header.indexOf('postcode'),
    locality: header.indexOf('locality'),
    state: header.indexOf('state'),
    latitude: header.indexOf('latitude'),
    longitude: header.indexOf('longitude'),
  };
  if (cols.postcode < 0 || cols.latitude < 0 || cols.longitude < 0) {
    throw new Error('CSV needs at least: postcode, latitude, longitude (locality, state optional).');
  }
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',').map((x) => x.trim());
    rows.push({
      postcode: c[cols.postcode],
      locality: cols.locality >= 0 ? c[cols.locality] || null : null,
      state: cols.state >= 0 ? c[cols.state] || null : null,
      latitude: Number(c[cols.latitude]),
      longitude: Number(c[cols.longitude]),
    });
  }
  return rows;
}

// ---- Main -------------------------------------------------------------------
async function main() {
  const sourceLabel = csvPath ? `CSV ${csvPath}` : 'embedded common-postcodes seed';
  console.log(`📍 Postcode source: ${sourceLabel}`);

  const raw = csvPath ? loadCsv(csvPath) : COMMON_POSTCODES;
  const normalised = raw
    .map((r) => ({
      postcode: String(r.postcode ?? '').trim().padStart(4, '0'),
      locality: r.locality ?? null,
      state: r.state ?? null,
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
    }))
    .filter((r) => r.postcode && Number.isFinite(r.latitude) && Number.isFinite(r.longitude));
  console.log(`   ${normalised.length} valid rows after validation.`);

  // Batch in 500s — Supabase REST insert/upsert ceiling
  let inserted = 0;
  for (let i = 0; i < normalised.length; i += 500) {
    const batch = normalised.slice(i, i + 500);
    const { error } = await supabase
      .from('marketplace_postcodes')
      .upsert(batch, { onConflict: 'postcode' });
    if (error) {
      console.error(`Batch ${i / 500 + 1} failed:`, error.message);
      process.exit(1);
    }
    inserted += batch.length;
    process.stdout.write(`   ✔ batch ${i / 500 + 1}: ${batch.length} rows (running total ${inserted})\n`);
  }

  // Sanity check + quick distance sample so the user can see it worked
  const { count } = await supabase
    .from('marketplace_postcodes')
    .select('postcode', { count: 'exact', head: true });
  console.log(`\n✅ marketplace_postcodes row count: ${count}`);

  const { data: distRows, error: distErr } = await supabase.rpc('marketplace_postcode_distance_km', {
    origin: '4000',
    dest: '2000',
  });
  if (distErr) {
    console.warn(`⚠ Could not run distance sanity check: ${distErr.message}`);
  } else {
    const km = distRows ?? null;
    console.log(`🧭 Brisbane (4000) → Sydney (2000): ${km == null ? 'NULL' : `${Number(km).toFixed(1)} km`}`);
    if (km == null) {
      console.warn('   That means one or both postcodes aren\'t in the dataset — pass --csv with a wider AusPost file.');
    }
  }
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
