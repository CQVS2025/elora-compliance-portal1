#!/usr/bin/env node
/**
 * Generic Tank Level Verification Script
 *
 * Purpose:
 * - Recompute tank levels for a given customer + site using (almost) the same
 *   rules as the Tank Levels UI.
 * - Print out: last refill, scan count since refill, total consumption,
 *   current litres, percentage, daily usage, days to empty.
 *
 * This is designed to help debug cases like:
 *   BORAL - QLD / Coopers Plains / device BRL-QLD-COOP
 *
 * Usage examples:
 *   node scripts/verify-tank-levels-generic.mjs --customer "BORAL - QLD" --site "Coopers Plains"
 *   node scripts/verify-tank-levels-generic.mjs --customer "GUNLAKE" --site "Prestons"
 *
 * Environment:
 *   VITE_SUPABASE_URL or SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * NOTE: This script is read-only; it only fetches data and logs to stdout.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

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

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TARGET_CUSTOMER = process.argv.includes('--customer')
  ? process.argv[process.argv.indexOf('--customer') + 1]
  : '';
const TARGET_SITE = process.argv.includes('--site')
  ? process.argv[process.argv.indexOf('--site') + 1]
  : '';

if (!TARGET_CUSTOMER || !TARGET_SITE) {
  console.log('Usage: node scripts/verify-tank-levels-generic.mjs --customer "BORAL - QLD" --site "Coopers Plains"');
}

// --- Helpers copied/aligned with tankLevels.js logic ---

function parseRefillDate(refill) {
  const raw = refill.deliveredAt ?? refill.dateTime ?? refill.date;
  if (!raw) return { date: new Date(0), dateOnly: '' };
  const s = String(raw).trim();
  // Already YYYY-MM-DD or ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const date = new Date(s);
    const dateOnly = s.slice(0, 10);
    return { date: Number.isFinite(date.getTime()) ? date : new Date(0), dateOnly };
  }
  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    const dateOnly = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    return { date, dateOnly };
  }
  const date = new Date(s);
  const dateOnly = Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : '';
  return { date: Number.isFinite(date.getTime()) ? date : new Date(0), dateOnly };
}

function calculateConsumption(washTimeSeconds, calibrationRate) {
  if (!washTimeSeconds || washTimeSeconds <= 0 || washTimeSeconds <= 15) {
    // Exclude 0s and ≤15s scans (drive-through, no actual wash)
    return 0;
  }
  const rate = typeof calibrationRate === 'string' ? parseFloat(calibrationRate) : calibrationRate;
  if (isNaN(rate) || rate <= 0) return 0;
  return (washTimeSeconds / 60) * rate;
}

function getWashTimeSecondsFromScan(scan) {
  if (!scan) return 0;
  const raw =
    scan.washTime != null
      ? Number(scan.washTime)
      : scan.washDurationSeconds != null
        ? Number(scan.washDurationSeconds)
        : scan.durationSeconds != null
          ? Number(scan.durationSeconds)
          : scan.washTimeSeconds != null
            ? Number(scan.washTimeSeconds)
            : null;
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return raw;
}

function calculateAvgDailyConsumption(scans, calibrationRate, daysToAnalyze = 7) {
  if (!scans || scans.length === 0) return 0;
  const now = new Date();
  const cutoffDate = new Date(now.getTime() - daysToAnalyze * 24 * 60 * 60 * 1000);
  const recentScans = scans.filter(scan => {
    const scanDate = new Date(scan.createdAt ?? scan.created_at);
    return scanDate >= cutoffDate;
  });
  if (recentScans.length === 0) return 0;
  const totalConsumed = recentScans.reduce((sum, scan) => {
    const washTime = getWashTimeSecondsFromScan(scan);
    return sum + calculateConsumption(washTime, calibrationRate);
  }, 0);
  const oldestScan = new Date(Math.min(...recentScans.map(s => new Date(s.createdAt ?? s.created_at))));
  const daysSpanned = Math.max(1, (now - oldestScan) / (24 * 60 * 60 * 1000));
  return totalConsumed / daysSpanned;
}

function productMatchesRefill(productType, rProduct) {
  const p = (rProduct || '').toUpperCase();
  const hasEcsr =
    (productType === 'ECSR' || productType === 'CONC') &&
    (p.includes('ECSR') ||
      p.includes('CONCRETE SAFE') ||
      p.includes('CONC') ||
      p.includes('ELORA-GAR') ||
      p.includes(' GAR ') ||
      p.includes('GAR)'));
  const hasFoam =
    productType === 'FOAM' &&
    (p.includes('FOAM') || p.includes('ELORA-GAR') || p.includes(' GAR ') || p.includes('GAR)'));
  const hasTw =
    productType === 'TW' &&
    (p.includes('TRUCK WASH') || p.includes(' ETW') || p.includes('TW-'));
  const hasGel = productType === 'GEL' && p.includes('GEL');
  return hasEcsr || hasFoam || hasTw || hasGel;
}

function normalize(str) {
  return (str ?? '').toString().trim().toUpperCase();
}

async function invokeEdge(name, body) {
  const url = `${SUPABASE_URL}/functions/v1/${name}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`${name} ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env/.env.local');
    process.exit(1);
  }

  const toDate = new Date().toISOString().split('T')[0];
  const fromDateScans = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  // For refills, use a long history so old refills are still used as baseline (matches Tank Levels UI behaviour).
  const fromDateRefills = '2019-01-01';

  console.log(`=== Tank level verification: ${TARGET_CUSTOMER || '(any customer)'} / ${TARGET_SITE || '(any site)'} ===\n`);
  console.log('Fetching data (same sources as Tank Levels UI)...');

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const [configRes, refillsRaw, scansRaw, devicesRaw, sitesRaw] = await Promise.all([
    supabase.from('tank_configurations').select('*').eq('active', true),
    invokeEdge('elora_refills', { fromDate: fromDateRefills, toDate }),
    invokeEdge('elora_scans', { fromDate: fromDateScans, toDate, status: 'success,exceeded', export: true }),
    invokeEdge('elora_devices', { status: 'active' }),
    invokeEdge('elora_sites', {}),
  ]);

  if (configRes.error) {
    throw new Error('tank_configurations: ' + configRes.error.message);
  }

  let configs = configRes.data || [];
  if (TARGET_SITE) {
    const targetSiteNorm = normalize(TARGET_SITE);
    configs = configs.filter(c => {
      const ref = normalize(c.site_ref);
      return ref === targetSiteNorm || ref.endsWith(targetSiteNorm);
    });
  }

  let refills = Array.isArray(refillsRaw) ? refillsRaw : refillsRaw?.data ?? refillsRaw?.refills ?? [];
  if (!Array.isArray(refills)) refills = [];
  if (TARGET_CUSTOMER) {
    const custNorm = normalize(TARGET_CUSTOMER);
    refills = refills.filter(r => {
      const cust = normalize(r.customer ?? r.customerName);
      return !custNorm || cust.includes(custNorm);
    });
  }
  // Only confirmed/delivered
  refills = refills.filter(r => {
    const s = (r.status ?? r.statusLabel ?? '').toString().toLowerCase();
    const id = r.statusId ?? r.status_id;
    if (id != null) return id === 2 || id === 3;
    return s === 'confirmed' || s === 'delivered';
  });

  let scans = Array.isArray(scansRaw) ? scansRaw : scansRaw?.data ?? [];
  if (!Array.isArray(scans)) scans = [];
  if (TARGET_CUSTOMER) {
    const custNorm = normalize(TARGET_CUSTOMER);
    scans = scans.filter(s => {
      const cust = normalize(s.customerName ?? s.customer);
      if (custNorm && !cust.includes(custNorm)) return false;
      const rfid = (s.rfid ?? '').toString().toLowerCase();
      const statusLabel = (s.statusLabel ?? s.status ?? '').toString().toLowerCase();
      if (rfid === 'auto' || statusLabel === 'auto') return false;
      return true;
    });
  }

  const devices = Array.isArray(devicesRaw) ? devicesRaw : devicesRaw?.data ?? [];
  const sites = Array.isArray(sitesRaw) ? sitesRaw : sitesRaw?.data ?? [];

  if (TARGET_CUSTOMER) {
    const custNorm = normalize(TARGET_CUSTOMER);
    configs = configs.filter(c => {
      const dev = devices.find(d => {
        const serial = (d.computerSerialId ?? d.computerSerial ?? d.serial ?? '').toString().trim();
        const cfgSerial = (c.device_serial || '').toString().trim();
        if (!serial || !cfgSerial || serial !== cfgSerial) return false;
        const dc = normalize(d.customerName ?? d.customer);
        return !custNorm || dc.includes(custNorm);
      });
      return !!dev;
    });
  }

  if (configs.length === 0) {
    console.log('No tank_configurations found for this customer/site. Nothing to verify.');
    return;
  }

  console.log(`Found ${configs.length} tank configuration(s) to check.\n`);

  const results = [];

  for (const config of configs) {
    const cfgSerial = (config.device_serial || '').toString().trim();
    const device = devices.find(d => {
      const serial = (d.computerSerialId ?? d.computerSerial ?? d.serial ?? '').toString().trim();
      return serial && cfgSerial && serial === cfgSerial;
    });

    if (!device) {
      results.push({
        config,
        error: `No active device found for device_serial=${config.device_serial}`,
      });
      continue;
    }

    const deviceName = device.computerName || device.computer_name || device.deviceName || device.device_name || device.genie;
    const deviceRef = device.deviceRef || device.ref;

    const siteFromDeviceRef = device.siteRef || device.site_ref;
    const siteFromDeviceName = device.siteName || device.site_name;
    const siteRecord = sites.find(s => {
      const sRef = s.ref ?? s.siteRef;
      const sName = s.siteName ?? s.name;
      if (siteFromDeviceRef && sRef && sRef === siteFromDeviceRef) return true;
      if (siteFromDeviceName && sName && sName === siteFromDeviceName) return true;
      return false;
    });

    const siteName = siteRecord?.siteName ?? siteRecord?.name ?? siteFromDeviceName ?? config.site_ref;
    const productType = (config.product_type || '').toUpperCase();

    // --- Find last refill matching this site + product for this customer ---
    const siteNameTrim = (siteName || '').toString().trim();
    const refillsForTank = refills
      .filter(r => {
        const rSite = (r.site ?? r.siteName ?? '').toString().trim();
        const sameSite =
          (rSite === siteNameTrim) ||
          (!!siteNameTrim && !!rSite && (rSite.endsWith(siteNameTrim) || rSite.includes(' - ' + siteNameTrim)));
        if (!sameSite) return false;
        const rProduct = r.productName ?? r.product;
        return productMatchesRefill(productType, rProduct);
      })
      .sort((a, b) => {
        const aD = parseRefillDate(a).date;
        const bD = parseRefillDate(b).date;
        return bD - aD;
      });

    const lastRefill = refillsForTank[0];
    if (!lastRefill) {
      results.push({
        config,
        device,
        siteName,
        error: 'No matching Confirmed/Delivered refill found for this tank',
      });
      continue;
    }

    const refillParsed = parseRefillDate(lastRefill);
    const refillDateTime = refillParsed.date;

    // --- Scans since refill: match by device (ref/serial/name), not site; all BORAL sites still count ---
    const cfgDeviceRef = (config.device_ref || '').toString().trim();
    const deviceSerialId = cfgSerial;
    const deviceComputerName = (deviceName || '').toString().trim();

    const scansSinceRefill = scans.filter(scan => {
      const scanDate = new Date(scan.createdAt || scan.created_at);
      if (scanDate < refillDateTime) return false;

      const scanDeviceRef = (scan.deviceRef ?? scan.device_ref ?? '').toString().trim();
      const scanSerial = (scan.deviceSerial ?? scan.device_serial ?? scan.computerSerialId ?? '').toString().trim();
      const scanDeviceName = (scan.computerName ?? scan.computer_name ?? scan.deviceName ?? scan.device_name ?? scan.genie ?? '').toString().trim();

      const matchesDevice =
        (cfgDeviceRef && scanDeviceRef && cfgDeviceRef === scanDeviceRef) ||
        (deviceRef && scanDeviceRef && deviceRef === scanDeviceRef) ||
        (deviceSerialId && scanSerial && deviceSerialId === scanSerial) ||
        (deviceComputerName && scanDeviceName && deviceComputerName === scanDeviceName);

      if (!matchesDevice) return false;
      return true;
    });

    const totalConsumed = scansSinceRefill.reduce((sum, scan) => {
      const washTime = getWashTimeSecondsFromScan(scan);
      return sum + calculateConsumption(washTime, config.calibration_rate_per_60s);
    }, 0);

    const maxCapConfig = Number(config.max_capacity_litres) || 0;
    const startingLevel =
      lastRefill.newTotalLitres ??
      lastRefill.new_total_litres ??
      lastRefill.deliveredLitres ??
      lastRefill.delivered_litres ??
      maxCapConfig;

    const totalConsumedNum = Number.isFinite(totalConsumed) ? totalConsumed : 0;
    const startLevelNum = Number(startingLevel) || maxCapConfig || 0;
    // Effective capacity: follow refills (same as UI) – max of config capacity and last refill level.
    const effectiveCapacity = startLevelNum > 0 ? Math.max(maxCapConfig, startLevelNum) : maxCapConfig;
    const currentLitresRaw = Math.max(0, startLevelNum - totalConsumedNum);
    const currentLitres =
      effectiveCapacity > 0
        ? Math.min(effectiveCapacity, Math.max(0, currentLitresRaw))
        : Math.max(0, currentLitresRaw);
    const percentage = effectiveCapacity > 0 && Number.isFinite(currentLitres)
      ? (currentLitres / effectiveCapacity) * 100
      : null;

    const now = new Date();
    const daysSinceRefill = Math.round((now - refillDateTime) / (24 * 60 * 60 * 1000));

    const avgDailyLitres = calculateAvgDailyConsumption(scansSinceRefill, config.calibration_rate_per_60s);
    const daysToEmpty =
      avgDailyLitres > 0 && Number.isFinite(currentLitres) ? currentLitres / avgDailyLitres : null;
    const dailyWashes =
      daysSinceRefill > 0 ? scansSinceRefill.length / daysSinceRefill : scansSinceRefill.length;

    results.push({
      config,
      device,
      siteName,
      lastRefill: {
        date: refillParsed.dateOnly || lastRefill.date,
        newTotal: startingLevel,
        product: lastRefill.productName ?? lastRefill.product,
        status: lastRefill.status ?? lastRefill.statusLabel,
      },
      scansSinceRefill: scansSinceRefill.length,
      totalConsumed: Math.round(totalConsumedNum * 10) / 10,
      startLevel: startLevelNum,
      currentLitres: Math.round(currentLitres),
      percentage: percentage != null ? Math.round(percentage * 10) / 10 : null,
      maxCap: effectiveCapacity || maxCapConfig,
      daysSinceRefill,
      avgDailyLitres: Math.round(avgDailyLitres * 10) / 10,
      daysToEmpty: daysToEmpty != null ? Math.round(daysToEmpty * 10) / 10 : null,
      dailyWashes: Math.round(dailyWashes * 10) / 10,
    });
  }

  // --- Report ---
  console.log('');
  for (const r of results) {
    const cfg = r.config;

    if (r.error) {
      console.log(
        `Tank ${cfg?.tank_number ?? '?'} (${cfg?.product_type ?? '?'}) – device_serial=${cfg?.device_serial}: ERROR – ${r.error}`,
      );
      console.log('');
      continue;
    }

    const label =
      'Tank ' +
      (cfg.tank_number ?? '?') +
      ' – ' +
      (cfg.product_type === 'TW'
        ? 'TW'
        : cfg.product_type === 'GEL'
        ? 'GEL'
        : 'ECSR');

    console.log(
      `--- ${label} | site_ref="${cfg.site_ref}" | siteName="${r.siteName}" | device_serial="${cfg.device_serial}" ---`,
    );
    console.log(
      `  Last refill: ${r.lastRefill.date} | ${r.lastRefill.product} | ${r.lastRefill.status} | New total: ${r.lastRefill.newTotal} L`,
    );
    console.log(`  Scans since refill (matched to this device): ${r.scansSinceRefill}`);
    console.log(
      `  Start level: ${r.startLevel} L | Consumed: ${r.totalConsumed} L | Current: ${r.currentLitres} L / ${r.maxCap} L (${r.percentage}% )`,
    );
    console.log(
      `  Since refill: ${r.daysSinceRefill} days | Daily usage: ~${r.avgDailyLitres} L/d | Days to empty: ${
        r.daysToEmpty != null ? r.daysToEmpty + ' days' : '—'
      }`,
    );
    console.log(`  Daily washes: ${r.dailyWashes}`);
    console.log('');
  }
}

main().catch((err) => {
  console.error('ERROR:', err);
  process.exit(1);
});

