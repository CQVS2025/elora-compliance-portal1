#!/usr/bin/env node
/**
 * Update tank_configurations.device_ref from Elora devices API.
 *
 * 1. Fetches devices from the elora_devices edge function (status 1,2 = Active + Inactive).
 * 2. Builds a map: device_serial (normalized) -> deviceRef.
 * 3. Fetches all tank_configurations and updates device_ref where the serial matches.
 *
 * Usage:
 *   node scripts/update-tank-config-device-ref.mjs
 *   node scripts/update-tank-config-device-ref.mjs --dry-run   # log updates only, no DB write
 *
 * Env: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (from .env.local).
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

function loadEnv() {
  const paths = [
    resolve(projectRoot, '.env.local'),
    resolve(projectRoot, '.env'),
  ];
  for (const p of paths) {
    if (existsSync(p)) {
      const content = readFileSync(p, 'utf8');
      for (const line of content.split('\n')) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
      }
      break;
    }
  }
}

loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

/** Normalize device serial for matching (pad to 16 hex chars). */
function normalizeSerial(s) {
  if (s == null) return '';
  const t = String(s).trim().toLowerCase();
  if (t.length >= 16) return t.slice(-16);
  return t.padStart(16, '0');
}

async function fetchEloraDevices() {
  const url = `${SUPABASE_URL}/functions/v1/elora_devices`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ status: '1,2' }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`elora_devices failed ${res.status}: ${text}`);
  }
  const data = await res.json();
  const list = Array.isArray(data) ? data : (data?.data ?? []);
  return list;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) console.log('Dry run — no DB updates will be made.\n');

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  console.log('Fetching devices from Elora API...');
  const devices = await fetchEloraDevices();
  console.log(`Got ${devices.length} devices.`);

  const serialToRef = new Map();
  for (const d of devices) {
    const serial = d.computerSerialId ?? d._raw?.devices_serial ?? '';
    const ref = d.deviceRef ?? d._raw?.devices_ref ?? '';
    if (!serial) continue;
    const norm = normalizeSerial(serial);
    serialToRef.set(norm, ref);
    if (serial !== norm) serialToRef.set(serial, ref);
  }

  console.log('Fetching tank_configurations...');
  const { data: rows, error: fetchError } = await supabase
    .from('tank_configurations')
    .select('id, device_serial, device_ref');
  if (fetchError) {
    console.error('Fetch tank_configurations failed:', fetchError.message);
    process.exit(1);
  }
  console.log(`Got ${rows.length} tank config rows.`);

  let updated = 0;
  let skipped = 0;
  let noMatch = 0;

  for (const row of rows) {
    const norm = normalizeSerial(row.device_serial);
    const newRef = serialToRef.get(norm) ?? serialToRef.get(row.device_serial);
    if (newRef == null) {
      noMatch++;
      continue;
    }
    if (row.device_ref === newRef) {
      skipped++;
      continue;
    }
    if (dryRun) {
      console.log(`  Would set device_ref="${newRef}" for id=${row.id} (serial=${row.device_serial}, current="${row.device_ref}")`);
      updated++;
      continue;
    }
    const { error } = await supabase
      .from('tank_configurations')
      .update({ device_ref: newRef })
      .eq('id', row.id);
    if (error) {
      console.error(`Update failed for id=${row.id}:`, error.message);
      continue;
    }
    updated++;
  }

  console.log('\nDone.');
  console.log(`  Updated: ${updated}`);
  console.log(`  Unchanged (already correct): ${skipped}`);
  console.log(`  No matching device in API: ${noMatch}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
