#!/usr/bin/env node
/**
 * Marketplace demo seed.
 *
 * Seeds a small catalogue (3 products + their packaging prices) so an admin
 * can immediately see the marketplace working end-to-end after running the
 * marketplace migrations.
 *
 * The real launch catalogue (10 products + per-customer pricing for the launch
 * buyer) is entered through the admin UI, not this script.
 *
 * Usage:
 *   node scripts/seed-marketplace-demo.mjs           # seed demo data
 *   node scripts/seed-marketplace-demo.mjs --dry-run # show what would happen
 *
 * Requirements:
 *   - .env.local must contain:
 *       VITE_SUPABASE_URL
 *       SUPABASE_SERVICE_ROLE_KEY     ← required (RLS blocks anon for this script)
 *     Falls back to VITE_SUPABASE_ANON_KEY only for diagnostics; the anon key
 *     will fail because RLS scopes packaging_sizes to authenticated and all
 *     marketplace_* writes to is_marketplace_admin().
 *   - Marketplace migrations (foundation + catalog) must be applied first.
 *
 * Idempotent: safe to re-run; products are upserted by slug.
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
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const KEY = SERVICE_ROLE_KEY || ANON_KEY;
const usingAnon = !SERVICE_ROLE_KEY && !!ANON_KEY;

if (!SUPABASE_URL || !KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.');
  console.error('A service-role key is required because the marketplace tables\'');
  console.error('RLS only allows authenticated reads and admin writes — the anon');
  console.error('key cannot see or modify them.');
  process.exit(1);
}

if (usingAnon) {
  console.warn('⚠ Falling back to VITE_SUPABASE_ANON_KEY. RLS will block this script:');
  console.warn('   - packaging_sizes SELECT is restricted TO authenticated');
  console.warn('   - product / price writes require is_marketplace_admin()');
  console.warn('  Add SUPABASE_SERVICE_ROLE_KEY to .env.local and re-run.\n');
}

const dryRun = process.argv.includes('--dry-run');
const supabase = createClient(SUPABASE_URL, KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---- Demo catalogue ---------------------------------------------------------
const PRODUCTS = [
  {
    slug: 'green-acid',
    name: 'Green Acid',
    short_description: 'Industrial-grade green acid for concrete cleaning and metal preparation.',
    long_description: 'Effective on concrete spillage and rust. Always wear PPE; do not mix with bases. Compatible with stainless steel.',
    manufacturer: 'Elora Chemicals',
    classification: 'DG Class 8',
    hazard_class: '8',
    un_number: '1789',
    packing_group: 'II',
    cas_number: '7647-01-0',
    safety_info: 'Corrosive. Avoid skin contact. Use ventilated area. Refer to SDS.',
    badge: 'Bestseller',
    display_order: 10,
    is_active: true,
    pricing: [
      { size: '20L Pail',    price_type: 'per_litre', price_per_litre: 4.20, moq: 1 },
      { size: '200L Drum',   price_type: 'per_litre', price_per_litre: 4.00, moq: 1 },
      { size: '1000L IBC',   price_type: 'per_litre', price_per_litre: 3.65, moq: 1 },
    ],
  },
  {
    slug: 'concrete-release',
    name: 'Concrete Release Agent',
    short_description: 'Bio-degradable form release for concrete moulds.',
    long_description: 'Plant-based, low-VOC release agent. Suitable for steel and timber forms. Ready to use.',
    manufacturer: 'Elora Chemicals',
    classification: 'Non-DG',
    safety_info: 'Use in ventilated area. Avoid prolonged skin contact.',
    display_order: 20,
    is_active: true,
    pricing: [
      { size: '200L Drum', price_type: 'per_litre', price_per_litre: 5.50, moq: 1 },
      { size: '1000L IBC', price_type: 'per_litre', price_per_litre: 4.90, moq: 1 },
    ],
  },
  {
    slug: 'plant-wash',
    name: 'Concrete Plant Wash',
    short_description: 'Heavy-duty alkaline wash for concrete batching plants and mixer trucks.',
    long_description: 'Removes set concrete and oil deposits. Concentrated; dilute per SDS instructions.',
    manufacturer: 'Elora Chemicals',
    classification: 'DG Class 8',
    hazard_class: '8',
    un_number: '1814',
    packing_group: 'II',
    safety_info: 'Strongly alkaline. Wear gloves and eye protection.',
    display_order: 30,
    is_active: true,
    pricing: [
      { size: '20L Pail',  price_type: 'per_litre', price_per_litre: 6.80, moq: 1 },
      { size: '200L Drum', price_type: 'per_litre', price_per_litre: 6.20, moq: 1 },
    ],
  },
];

// ---- Seed -------------------------------------------------------------------
async function main() {
  console.log(`Marketplace demo seed${dryRun ? ' (DRY RUN — no writes)' : ''}\n`);

  // 1. Pull packaging size lookup so we can resolve sizeId by name.
  const { data: sizes, error: sizesErr } = await supabase
    .from('marketplace_packaging_sizes')
    .select('id, name')
    .eq('is_active', true);
  if (sizesErr) throw sizesErr;
  const sizeByName = new Map((sizes ?? []).map((s) => [s.name, s.id]));

  if (sizeByName.size === 0) {
    console.error('No packaging sizes found. Did you run the marketplace foundation migration?');
    process.exit(1);
  }

  for (const product of PRODUCTS) {
    const { pricing, ...productRow } = product;

    if (dryRun) {
      console.log(` • would upsert product "${product.name}" with ${pricing.length} variants`);
      continue;
    }

    // Upsert product.
    const { data: saved, error: pErr } = await supabase
      .from('marketplace_products')
      .upsert(productRow, { onConflict: 'slug' })
      .select()
      .single();
    if (pErr) {
      console.error(`Failed to upsert product "${product.name}":`, pErr.message);
      continue;
    }

    // Wipe existing prices and re-insert (idempotent for re-runs).
    await supabase
      .from('marketplace_product_packaging_prices')
      .delete()
      .eq('product_id', saved.id);

    const priceRows = pricing.map((p) => {
      const sizeId = sizeByName.get(p.size);
      if (!sizeId) {
        console.warn(`   ! unknown packaging size "${p.size}" — skipping`);
        return null;
      }
      return {
        product_id: saved.id,
        packaging_size_id: sizeId,
        price_type: p.price_type,
        price_per_litre: p.price_type === 'per_litre' ? p.price_per_litre : null,
        fixed_price: p.price_type === 'fixed' ? p.fixed_price : null,
        minimum_order_quantity: p.moq ?? 1,
        is_available: true,
      };
    }).filter(Boolean);

    if (priceRows.length > 0) {
      const { error: prErr } = await supabase
        .from('marketplace_product_packaging_prices')
        .insert(priceRows);
      if (prErr) {
        console.error(`Failed to insert prices for "${product.name}":`, prErr.message);
        continue;
      }
    }

    console.log(` ✓ "${product.name}" with ${priceRows.length} packaging variants`);
  }

  console.log('\nDone.');
  console.log('\nNext steps:');
  console.log(' 1. In admin → Marketplace → Customer Access, toggle marketplace ON for at least one buyer company.');
  console.log(' 2. (Optional) In admin → Marketplace → Customer Pricing, set per-customer overrides.');
  console.log(' 3. Log in as a user from that company and visit /marketplace to see the catalog.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
