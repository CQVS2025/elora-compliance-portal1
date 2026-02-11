#!/usr/bin/env node
/**
 * Seed tank_configurations from Excel "Sites & Tanks" sheet (Sheet 2).
 *
 * Prerequisites:
 * 1. Run migration so the table exists: supabase db push (or run 20260210_create_tank_configurations.sql).
 * 2. Place your Excel file (e.g. ELORA_Portal_Data_Complete.xlsx) in project root or pass path.
 *
 * Usage:
 *   node scripts/seed-tank-config-from-excel.mjs [path/to/file.xlsx]
 *   node scripts/seed-tank-config-from-excel.mjs path/to/file.xlsx --output-sql   # write seed.sql instead of inserting
 *
 * Env (for insert mode): VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_ANON_KEY if RLS allows).
 * For --output-sql no env needed.
 */

import xlsx from 'xlsx';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const XLSX = xlsx?.default ?? xlsx;
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

// Load .env.local into process.env (simple parse, no dotenv dep)
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

const SITES_AND_TANKS_SHEET_INDEX = 1; // 0-based: Sheet1=0, Sheet2=1

// Possible Excel header names (case-insensitive, trim) -> our DB column
const HEADER_MAP = {
  'site name': 'site_ref',
  'site name *': 'site_ref',
  'device ref': 'device_ref',
  'device ref *': 'device_ref',
  'serial id': 'device_serial',
  'serial': 'device_serial',
  'product type': 'product_type',
  'product type *': 'product_type',
  'tank #': 'tank_number',
  'tank # *': 'tank_number',
  'tank number': 'tank_number',
  'tank max (l)': 'max_capacity_litres',
  'tank max (l) *': 'max_capacity_litres',
  'max capacity': 'max_capacity_litres',
  'litres / 60s': 'calibration_rate_per_60s',
  'litres/60s': 'calibration_rate_per_60s',
  'calibration': 'calibration_rate_per_60s',
  'warning %': 'warning_threshold_pct',
  'warning': 'warning_threshold_pct',
  'critical %': 'critical_threshold_pct',
  'critical': 'critical_threshold_pct',
  'alert contact': 'alert_contact',
  'active?': 'active',
  'active': 'active',
  'notes': 'notes',
};

function normalizeHeader(str) {
  if (str == null) return '';
  return String(str).toLowerCase().replace(/\s+/g, ' ').trim();
}

function findHeaderRow(ws) {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let r = range.s.r; r <= Math.min(range.e.r, 20); r++) {
    const cell = ws[XLSX.utils.encode_cell({ r, c: 0 })];
    const val = cell && (cell.v != null) ? String(cell.v).toLowerCase() : '';
    if (val.includes('site') && (val.includes('name') || val.includes('ref'))) return r;
  }
  return 0;
}

function buildColumnIndex(ws, headerRow) {
  const index = {};
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: headerRow, c })];
    const raw = cell && cell.v != null ? String(cell.v) : '';
    const key = normalizeHeader(raw);
    const mapped = HEADER_MAP[key] || HEADER_MAP[key.replace(/\s*\*$/, '')];
    if (mapped) index[mapped] = c;
  }
  return index;
}

function getCell(ws, row, col) {
  if (col == null) return undefined;
  const cell = ws[XLSX.utils.encode_cell({ r: row, c: col })];
  if (!cell || cell.v == null) return undefined;
  if (typeof cell.v === 'number' && cell.v.toString().length > 10) return String(cell.v); // avoid scientific notation for serials
  return cell.v;
}

function parseRow(ws, row, colIndex) {
  const raw = {};
  for (const [k, c] of Object.entries(colIndex)) raw[k] = getCell(ws, row, c);

  const deviceSerial = raw.device_serial != null ? String(raw.device_serial).trim().replace(/\.0+$/, '') : '';
  if (!deviceSerial) return null;

  const productType = (raw.product_type != null ? String(raw.product_type).toUpperCase().trim() : 'CONC').replace(/\s.*/, '');
  const validProduct = ['CONC', 'FOAM', 'TW', 'GEL'].includes(productType) ? productType : 'CONC';

  let tankNumber = 1;
  if (raw.tank_number != null) {
    const n = parseInt(raw.tank_number, 10);
    if (n === 1 || n === 2) tankNumber = n;
  }

  let maxCapacity = 1000;
  if (raw.max_capacity_litres != null) {
    const n = parseInt(raw.max_capacity_litres, 10);
    if (Number.isFinite(n) && n > 0) maxCapacity = n;
  }

  let calibration = 5.0;
  if (raw.calibration_rate_per_60s != null) {
    const n = parseFloat(String(raw.calibration_rate_per_60s).replace(',', '.'));
    if (Number.isFinite(n) && n > 0) calibration = n;
  }

  let warningPct = 20;
  if (raw.warning_threshold_pct != null) {
    const n = parseInt(raw.warning_threshold_pct, 10);
    if (Number.isFinite(n)) warningPct = n;
  }

  let criticalPct = 10;
  if (raw.critical_threshold_pct != null) {
    const n = parseInt(raw.critical_threshold_pct, 10);
    if (Number.isFinite(n)) criticalPct = n;
  }

  const activeVal = raw.active;
  const active = activeVal === false || (typeof activeVal === 'string' && /^(no|false|0|n)$/i.test(activeVal.trim())) ? false : true;

  return {
    site_ref: raw.site_ref != null ? String(raw.site_ref).trim() : null,
    device_ref: raw.device_ref != null ? String(raw.device_ref).trim() : null,
    device_serial: deviceSerial,
    product_type: validProduct,
    tank_number: tankNumber,
    max_capacity_litres: maxCapacity,
    calibration_rate_per_60s: calibration,
    warning_threshold_pct: warningPct,
    critical_threshold_pct: criticalPct,
    active,
    alert_contact: raw.alert_contact != null && String(raw.alert_contact).trim() ? String(raw.alert_contact).trim() : null,
    notes: raw.notes != null && String(raw.notes).trim() ? String(raw.notes).trim() : null,
  };
}

function readRowsFromExcel(filePath) {
  const wb = XLSX.readFile(filePath, { type: 'file', cellDates: true });
  const sheetName = wb.SheetNames[SITES_AND_TANKS_SHEET_INDEX] || wb.SheetNames[1];
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`Sheet at index ${SITES_AND_TANKS_SHEET_INDEX} not found. Sheet names: ${wb.SheetNames.join(', ')}`);

  const headerRow = findHeaderRow(ws);
  const colIndex = buildColumnIndex(ws, headerRow);
  if (!colIndex.device_serial) throw new Error('Could not find "Serial ID" (or "Serial") column in the Sites & Tanks sheet. Check the Excel header row.');

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const rows = [];
  for (let r = headerRow + 1; r <= range.e.r; r++) {
    const row = parseRow(ws, r, colIndex);
    if (row) rows.push(row);
  }
  return rows;
}

function rowsToSql(rows) {
  const vals = rows.map((r) => {
    const site = (r.site_ref || '').replace(/'/g, "''");
    const devRef = (r.device_ref || '').replace(/'/g, "''");
    const serial = (r.device_serial || '').replace(/'/g, "''");
    const alert = (r.alert_contact || '').replace(/'/g, "''");
    const notes = (r.notes || '').replace(/'/g, "''");
    return `('${site}', '${devRef}', '${serial}', '${r.product_type}', ${r.tank_number}, ${r.max_capacity_litres}, ${r.calibration_rate_per_60s}, ${r.warning_threshold_pct}, ${r.critical_threshold_pct}, ${r.active}, ${alert ? `'${alert}'` : 'NULL'}, ${notes ? `'${notes}'` : 'NULL'})`;
  });
  return `-- Generated from Excel "Sites & Tanks" sheet\nTRUNCATE public.tank_configurations;\n\nINSERT INTO public.tank_configurations (site_ref, device_ref, device_serial, product_type, tank_number, max_capacity_litres, calibration_rate_per_60s, warning_threshold_pct, critical_threshold_pct, active, alert_contact, notes)\nVALUES\n${vals.join(',\n')};\n`;
}

async function main() {
  const args = process.argv.slice(2);
  const outputSql = args.includes('--output-sql');
  const fileArg = args.filter((a) => !a.startsWith('--'))[0];

  const defaultPaths = [
    resolve(projectRoot, 'ELORA_Portal_Data_Complete.xlsx'),
    resolve(projectRoot, 'ELORA_Portal_Data_Complete'), // no extension
    resolve(projectRoot, 'data', 'ELORA_Portal_Data_Complete.xlsx'),
    resolve(projectRoot, 'ELORA_Portal_Data.xlsx'),
  ];
  const filePath = fileArg ? resolve(process.cwd(), fileArg) : defaultPaths.find((p) => existsSync(p));

  if (!filePath || !existsSync(filePath)) {
    console.error('Usage: node scripts/seed-tank-config-from-excel.mjs [path/to/ELORA_Portal_Data_Complete.xlsx] [--output-sql]');
    console.error('Excel file not found. Tried:', fileArg || defaultPaths.join(', '));
    process.exit(1);
  }

  console.log('Reading:', filePath);
  const rows = readRowsFromExcel(filePath);
  console.log('Parsed', rows.length, 'tank configuration rows from "Sites & Tanks" sheet.');

  if (rows.length === 0) {
    console.error('No rows with Serial ID found. Check the sheet has data and a header row with "Serial ID" (or "Serial").');
    process.exit(1);
  }

  if (outputSql) {
    const sql = rowsToSql(rows);
    const outPath = resolve(projectRoot, 'scripts', 'seed-tank-config-generated.sql');
    writeFileSync(outPath, sql);
    console.log('Wrote SQL to', outPath);
    console.log('Run this in Supabase SQL Editor or: psql $DATABASE_URL -f', outPath);
    return;
  }

  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_ANON_KEY) in .env.local for insert mode.');
    console.error('Or use --output-sql to generate seed-tank-config-generated.sql and run it in Supabase SQL Editor.');
    process.exit(1);
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(url, key);

  const insertRows = rows.map((r) => ({
    site_ref: r.site_ref,
    device_ref: r.device_ref,
    device_serial: r.device_serial,
    product_type: r.product_type,
    tank_number: r.tank_number,
    max_capacity_litres: r.max_capacity_litres,
    calibration_rate_per_60s: r.calibration_rate_per_60s,
    warning_threshold_pct: r.warning_threshold_pct,
    critical_threshold_pct: r.critical_threshold_pct,
    active: r.active,
    alert_contact: r.alert_contact,
    notes: r.notes,
  }));

  const batchSize = 50;
  let upserted = 0;
  for (let i = 0; i < insertRows.length; i += batchSize) {
    const batch = insertRows.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('tank_configurations')
      .upsert(batch, { onConflict: 'device_serial,tank_number', ignoreDuplicates: false })
      .select('id');
    if (error) {
      console.error('Upsert error:', error.message);
      if (error.details) console.error(error.details);
      process.exit(1);
    }
    upserted += (data || []).length;
  }
  console.log('Upserted', upserted, 'rows into tank_configurations.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
