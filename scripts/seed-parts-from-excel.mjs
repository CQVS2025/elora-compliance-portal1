#!/usr/bin/env node
/**
 * Seed parts table from Excel master parts list (e.g. Parts_List_3_with_images.xlsx).
 *
 * Prerequisites:
 * 1. Run migration: supabase db push (or 20260228000001_parts_catalog.sql).
 * 2. Place Excel in project root or pass path: node scripts/seed-parts-from-excel.mjs [path/to/file.xlsx]
 *
 * Usage:
 *   node scripts/seed-parts-from-excel.mjs
 *   node scripts/seed-parts-from-excel.mjs path/to/Parts_List_3_with_images.xlsx
 *   node scripts/seed-parts-from-excel.mjs path/to/file.xlsx --dry-run   # log rows only, no insert
 *   node scripts/seed-parts-from-excel.mjs path/to/file.xlsx --replace   # clear parts then insert
 *
 * Env: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_ANON_KEY if RLS allows).
 */

import xlsx from 'xlsx';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const XLSX = xlsx?.default ?? xlsx;
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

function loadEnv() {
  const paths = [resolve(projectRoot, '.env.local'), resolve(projectRoot, '.env')];
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

// Column indices from typical sheet: #, Part Description, Category, Qty, Unit, Unit Price, Total, Supplier, Status, Image, Product URL
function findColumnIndex(ws, headerRow) {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const index = {};
  const headers = [
    'part_number',
    'description',
    'category',
    'qty',
    'unit',
    'unit_price',
    'total',
    'supplier',
    'status',
    'image',
    'product_url',
  ];
  const aliases = {
    part_number: ['#', 'number', 'no'],
    description: ['part description', 'description', 'part desc'],
    category: ['category'],
    unit: ['unit'],
    unit_price: ['unit price', 'price'],
    supplier: ['supplier'],
    status: ['status'],
    product_url: ['product url', 'url', 'product url'],
  };
  for (let c = range.s.c; c <= Math.min(range.e.c, 20); c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: headerRow, c })];
    const raw = (cell && cell.v != null ? String(cell.v) : '').toLowerCase().trim();
    for (const [key, names] of Object.entries(aliases)) {
      if (names.some((n) => raw.includes(n) || raw === n)) {
        index[key] = c;
        break;
      }
    }
  }
  return index;
}

function getCell(ws, row, col) {
  if (col == null) return null;
  const cell = ws[XLSX.utils.encode_cell({ r: row, c: col })];
  if (!cell || cell.v == null) return null;
  if (cell.t === 'e') return null; // error cell e.g. #VALUE!
  return typeof cell.v === 'number' ? cell.v : String(cell.v).trim();
}

function parsePrice(val) {
  if (val == null || val === '' || String(val).toUpperCase() === '#VALUE!') return null;
  const s = String(val).replace(/\$/g, '').replace(/,/g, '').trim();
  if (!s) return null;
  const n = parseFloat(s);
  if (Number.isNaN(n) || n < 0) return null;
  return Math.round(n * 100);
}

function parseProductUrl(val) {
  if (val == null || val === '') return null;
  const s = String(val).trim();
  if (s.toUpperCase() === '#VALUE!' || s.toLowerCase().startsWith('mailto:')) return null;
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  return null;
}

function parseSupplier(val) {
  if (val == null || val === '') return { name: null, sku: null };
  const s = String(val).trim();
  const match = s.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (match) return { name: match[1].trim(), sku: match[2].trim() };
  return { name: s || null, sku: null };
}

function normalizeUnit(val) {
  if (val == null || val === '') return 'Each';
  const s = String(val).trim().toLowerCase();
  if (s.includes('metre') || s === 'm') return 'Metre';
  return 'Each';
}

function findHeaderRow(ws) {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let r = range.s.r; r <= Math.min(range.e.r, 20); r++) {
    let hasHash = false;
    let hasPartDesc = false;
    for (let c = 0; c <= Math.min(range.e.c, 8); c++) {
      const val = String(getCell(ws, r, c) ?? '').toLowerCase().trim();
      if (val === '#' || val.includes('#')) hasHash = true;
      if (val.includes('part description') || val === 'part desc') hasPartDesc = true;
    }
    if (hasHash && hasPartDesc) return r;
  }
  return 0;
}

function isCategoryOnlyRow(ws, row, colIndex) {
  const num = getCell(ws, row, colIndex.part_number ?? 0);
  const desc = getCell(ws, row, colIndex.description ?? 1);
  if (num != null && String(num).trim() !== '') return false;
  if (desc != null && String(desc).trim().length > 0 && !/^[A-Z\s&]+$/.test(String(desc))) return false;
  return true;
}

function hasDescription(ws, row, colIndex) {
  const desc = getCell(ws, row, colIndex.description ?? 1);
  return desc != null && String(desc).trim().length > 0;
}

function readPartsFromSheet(ws) {
  const headerRow = findHeaderRow(ws);
  const colIndex = findColumnIndex(ws, headerRow);
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const rows = [];
  for (let r = headerRow + 1; r <= range.e.r; r++) {
    if (!hasDescription(ws, r, colIndex)) continue;
    if (isCategoryOnlyRow(ws, r, colIndex)) continue;
    const partNum = getCell(ws, r, colIndex.part_number);
    const description = getCell(ws, r, colIndex.description);
    const category = getCell(ws, r, colIndex.category);
    const unit = normalizeUnit(getCell(ws, r, colIndex.unit));
    const unitPriceRaw = getCell(ws, r, colIndex.unit_price);
    const supplierRaw = getCell(ws, r, colIndex.supplier);
    const status = getCell(ws, r, colIndex.status);
    const productUrl = parseProductUrl(getCell(ws, r, colIndex.product_url));
    const unitPriceCents = parsePrice(unitPriceRaw);
    const { name: supplier_name, sku: supplier_sku } = parseSupplier(supplierRaw);
    if (!description || !category) continue;
    rows.push({
      display_order: rows.length + 1,
      description: String(description).trim(),
      category: String(category).trim(),
      unit,
      unit_price_cents: unitPriceCents,
      supplier_name: supplier_name || null,
      supplier_sku: supplier_sku || null,
      supplier_stock_status: status ? String(status).trim() : null,
      product_url: productUrl,
      image_path: null,
      is_active: true,
    });
  }
  return rows;
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const dryRun = process.argv.includes('--dry-run');
  const defaultPath = resolve(projectRoot, 'Parts_List_3_with_images.xlsx');
  const filePath = args[0] ? resolve(projectRoot, args[0]) : defaultPath;

  if (!existsSync(filePath)) {
    console.error('File not found:', filePath);
    console.error('Usage: node scripts/seed-parts-from-excel.mjs [path/to/file.xlsx] [--dry-run]');
    process.exit(1);
  }

  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const ws = workbook.Sheets[sheetName];
  const parts = readPartsFromSheet(ws);
  console.log('Parsed', parts.length, 'parts from sheet', sheetName);

  if (parts.length === 0) {
    console.log('No parts to insert.');
    process.exit(0);
  }

  if (dryRun) {
    parts.forEach((p, i) => console.log(`${i + 1}. ${p.description} | ${p.category} | ${p.unit_price_cents != null ? '$' + (p.unit_price_cents / 100).toFixed(2) : '—'}`));
    process.exit(0);
  }

  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_ANON_KEY)');
    process.exit(1);
  }

  const supabase = createClient(url, key);

  if (process.argv.includes('--replace')) {
    const { error: delError } = await supabase.from('parts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (delError) {
      console.error('Replace (delete) error:', delError);
      process.exit(1);
    }
    console.log('Cleared existing parts.');
  }

  const BATCH = 50;
  let inserted = 0;
  for (let i = 0; i < parts.length; i += BATCH) {
    const chunk = parts.slice(i, i + BATCH);
    const { error } = await supabase.from('parts').insert(chunk);
    if (error) {
      console.error('Insert error:', error);
      process.exit(1);
    }
    inserted += chunk.length;
    console.log('Inserted', inserted, '/', parts.length);
  }
  console.log('Done. Total rows processed:', parts.length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
