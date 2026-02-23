#!/usr/bin/env node
/**
 * Verify tank level calculations for GUNLAKE Prestons (and optionally other site/customer).
 *
 * Fetches the same data the UI uses (tank config, refills, scans, devices, sites) and
 * recomputes tank levels using the client's rules. Compares results to expected values
 * so we can tell if discrepancies are due to API data or tank configuration.
 *
 * Client rules applied:
 * - Last refill = latest Delivered/Confirmed per site+product; start level = new_total_litres or max_capacity
 * - Scans: only after last refill date; match by device (device_ref/genie) and site
 * - Consumption = calibration_rate_per_60s * (wash_time_seconds / 60)
 * - Remaining = start - used, clamped [0, max_capacity]; % = (remaining / max_capacity) * 100
 *
 * Usage:
 *   node scripts/verify-tank-levels-gunlake-prestons.mjs
 *   node scripts/verify-tank-levels-gunlake-prestons.mjs --customer GUNLAKE --site Prestons
 *
 * Env: VITE_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY (.env.local)
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
  : 'GUNLAKE';
const TARGET_SITE = process.argv.includes('--site')
  ? process.argv[process.argv.indexOf('--site') + 1]
  : 'Prestons';

// Expected values from UI (for comparison) — update when UI changes
const EXPECTED = {
  Tank1: {
    productType: 'FOAM',
    label: 'Tank 1 – ECSR',
    currentLitres: 607,
    percentage: 60.7,
    capacity: 1000,
    sinceRefillDays: 7,
    dailyUsage: 44.6,
    daysToEmpty: 13.6,
    dailyWashes: 12.6,
  },
  Tank2: {
    productType: 'TW',
    label: 'Tank 2 – TW',
    currentLitres: 723,
    percentage: 72.3,
    capacity: 1000,
    sinceRefillDays: 39,
    dailyUsage: 4.6,
    daysToEmpty: 157.1,
    dailyWashes: 2.1,
  },
};

function parseRefillDate(refill) {
  const raw = refill.deliveredAt ?? refill.dateTime ?? refill.date;
  if (!raw) return { date: new Date(0), dateOnly: '' };
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const date = new Date(s);
    return { date: Number.isFinite(date.getTime()) ? date : new Date(0), dateOnly: s.slice(0, 10) };
  }
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
  if (washTimeSeconds == null || washTimeSeconds <= 0 || washTimeSeconds <= 15) return 0;
  const rate = typeof calibrationRate === 'string' ? parseFloat(calibrationRate) : calibrationRate;
  if (isNaN(rate) || rate <= 0) return 0;
  return (washTimeSeconds / 60) * rate;
}

/** Match UI: avg daily consumption from last 7 days of scans (not full period since refill).
 *  UI uses this for "Daily usage" and "Days to empty" = currentLitres / avgDailyLast7. */
function calculateAvgDailyConsumptionLast7Days(scans, calibrationRate, daysToAnalyze = 7) {
  if (!scans || scans.length === 0) return 0;
  const now = new Date();
  const cutoffDate = new Date(now.getTime() - daysToAnalyze * 24 * 60 * 60 * 1000);
  const recentScans = scans.filter(scan => {
    const scanDate = new Date(scan.createdAt ?? scan.created_at);
    return scanDate >= cutoffDate;
  });
  if (recentScans.length === 0) return 0;
  const totalConsumed = recentScans.reduce((sum, scan) => {
    const washTime = scan.washTime ?? scan.wash_time;
    return sum + calculateConsumption(washTime, calibrationRate);
  }, 0);
  const oldestScan = new Date(Math.min(...recentScans.map(s => new Date(s.createdAt ?? s.created_at))));
  const daysSpanned = Math.max(1, (now - oldestScan) / (24 * 60 * 60 * 1000));
  return totalConsumed / daysSpanned;
}

function productMatchesRefill(productType, rProduct) {
  const p = (rProduct || '').toUpperCase();
  const hasEcsr = (productType === 'ECSR' || productType === 'CONC') &&
    (p.includes('ECSR') || p.includes('CONCRETE SAFE') || p.includes('CONC') || p.includes('ELORA-GAR') || p.includes(' GAR ') || p.includes('GAR)'));
  const hasFoam = productType === 'FOAM' && (p.includes('FOAM') || p.includes('ELORA-GAR') || p.includes(' GAR ') || p.includes('GAR)'));
  const hasTw = productType === 'TW' && (p.includes('TRUCK WASH') || p.includes(' ETW') || p.includes('TW-'));
  const hasGel = productType === 'GEL' && p.includes('GEL');
  return hasEcsr || hasFoam || hasTw || hasGel;
}

function siteMatchesRefill(r, siteName, siteRef, customerRef) {
  const rSiteRef = (r.siteRef ?? r.site_ref ?? '').toString().trim();
  const rCustomerRef = (r.customerRef ?? r.customer_ref ?? '').toString().trim();
  if (rSiteRef && siteRef && rSiteRef === siteRef && (!customerRef || !rCustomerRef || rCustomerRef === customerRef)) return true;
  const rSite = (r.site ?? r.siteName ?? '').toString().trim();
  const nameMatch = (rSite === siteName) || (siteName && rSite && (rSite.endsWith(siteName) || rSite.includes(' - ' + siteName)));
  if (!nameMatch) return false;
  return true;
}

async function invoke(name, body) {
  const url = `${SUPABASE_URL}/functions/v1/${name}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${name} ${res.status}: ${await res.text()}`);
  return res.json();
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }

  const toDate = new Date().toISOString().split('T')[0];
  const fromDate = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  console.log('=== Tank level verification: ' + TARGET_CUSTOMER + ' / ' + TARGET_SITE + ' ===\n');
  console.log('Fetching data (same as UI)...');

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const [configRes, refillsRaw, scansPayload, devicesRaw, sitesRaw] = await Promise.all([
    supabase.from('tank_configurations').select('*').eq('active', true).ilike('site_ref', TARGET_SITE),
    invoke('elora_refills', { fromDate, toDate }),
    invoke('elora_scans', { fromDate, toDate, status: 'success,exceeded', export: true }),
    invoke('elora_devices', { status: 'active' }),
    invoke('elora_sites', {}),
  ]);

  if (configRes.error) throw new Error('tank_configurations: ' + configRes.error.message);
  const configs = (configRes.data || []).filter(c => {
    const siteRef = (c.site_ref || '').toString().trim();
    return siteRef === TARGET_SITE || siteRef.toLowerCase() === TARGET_SITE.toLowerCase();
  });

  let refills = Array.isArray(refillsRaw) ? refillsRaw : (refillsRaw?.data ?? refillsRaw?.refills ?? []);
  if (!Array.isArray(refills)) refills = [];
  refills = refills.filter(r => {
    const cust = (r.customer ?? r.customerName ?? '').toString().trim().toUpperCase();
    if (TARGET_CUSTOMER && !cust.includes(TARGET_CUSTOMER.toUpperCase())) return false;
    const s = (r.status ?? r.statusLabel ?? '').toString().toLowerCase();
    const id = r.statusId ?? r.status_id;
    if (id != null) return id === 2 || id === 3;
    return s === 'confirmed' || s === 'delivered';
  });

  let scans = Array.isArray(scansPayload) ? scansPayload : (scansPayload?.data ?? []);
  if (!Array.isArray(scans)) scans = [];
  scans = scans.filter(s => {
    const cust = (s.customerName ?? s.customer ?? '').toString().trim().toUpperCase();
    if (TARGET_CUSTOMER && !cust.includes(TARGET_CUSTOMER.toUpperCase())) return false;
    const rfid = (s.rfid ?? '').toString().toLowerCase();
    const statusLabel = (s.statusLabel ?? s.status ?? '').toString().toLowerCase();
    if (rfid === 'auto' || statusLabel === 'auto') return false;
    return true;
  });

  const devices = Array.isArray(devicesRaw) ? devicesRaw : (devicesRaw?.data ?? []);
  const sites = Array.isArray(sitesRaw) ? sitesRaw : (sitesRaw?.data ?? []);

  // Restrict to this customer's devices so we only get this customer's Prestons tanks
  const customerDevices = devices.filter(d => {
    const cust = (d.customerName ?? d.customer ?? '').toString().trim().toUpperCase();
    return !TARGET_CUSTOMER || cust.includes(TARGET_CUSTOMER.toUpperCase());
  });
  const customerSerials = new Set(customerDevices.map(d => ((d.computerSerialId ?? d.computerSerial ?? d.serial) || '').toString().trim()));
  const configsForCustomer = configs.filter(c => customerSerials.has((c.device_serial || '').toString().trim()));
  const configsToUse = configsForCustomer.length > 0 ? configsForCustomer : configs;

  const siteName = TARGET_SITE.trim();
  const siteNameNorm = siteName.toLowerCase();
  const siteRecord = sites.find(s => {
    const sn = (s.siteName ?? s.name ?? '').toString().trim().toLowerCase();
    const ref = (s.ref ?? s.siteRef ?? '').toString().trim();
    return sn === siteNameNorm || ref === siteName || (sn && sn.includes(siteNameNorm));
  });
  const siteRef = siteRecord ? (siteRecord.ref ?? siteRecord.siteRef ?? '') : '';
  const customerRef = siteRecord ? (siteRecord.customerRef ?? siteRecord.customer_ref ?? '') : '';

  console.log('  Tank configs (site=' + TARGET_SITE + '): ' + configs.length + ' (for customer: ' + configsToUse.length + ')');
  console.log('  Refills (Delivered/Confirmed, customer~' + TARGET_CUSTOMER + '): ' + refills.length);
  console.log('  Scans (success/exceeded, no auto): ' + scans.length);
  console.log('  Devices: ' + devices.length);
  console.log('');

  const results = [];
  for (const config of configsToUse) {
    const productType = (config.product_type || '').toUpperCase();
    const device = customerDevices.find(d =>
      (d.computerSerialId ?? d.computerSerial ?? d.serial) === config.device_serial
    ) || devices.find(d =>
      (d.computerSerialId ?? d.computerSerial ?? d.serial) === config.device_serial
    );
    if (!device) {
      results.push({ config, error: 'No matching device in API for serial ' + config.device_serial });
      continue;
    }

    const deviceSiteRef = device.siteRef || device.site_ref;
    const deviceSiteName = device.siteName || device.site_name;
    const site = {
      siteRef: siteRef || deviceSiteRef,
      siteName: deviceSiteName || siteName,
      customerRef: customerRef || device.customerRef || device.customer_ref,
      customer: device.customerName || device.customer || TARGET_CUSTOMER,
    };

    const siteRefills = refills
      .filter(r => siteMatchesRefill(r, site.siteName, site.siteRef, site.customerRef))
      .filter(r => productMatchesRefill(productType, r.productName ?? r.product))
      .sort((a, b) => parseRefillDate(b).date - parseRefillDate(a).date);

    const lastRefill = siteRefills[0];
    if (!lastRefill) {
      results.push({ config, device, site, error: 'No Delivered/Confirmed refill for this site+product' });
      continue;
    }

    const refillParsed = parseRefillDate(lastRefill);
    const refillDateTime = refillParsed.date;
    const configDeviceRef = (config.device_ref || '').toString().trim();
    const deviceRefFromApi = (device.deviceRef || device.ref || '').toString().trim();
    const deviceSerialId = device.computerSerialId || device.computerSerial || device.serial;
    const deviceComputerName = (device.computerName || device.computer_name || '').toString().trim();
    const customerNorm = (site.customer || '').trim().toLowerCase();

    const scanMatchesDevice = (scan) => {
      const scanDeviceRef = (scan.deviceRef ?? scan.device_ref ?? '').toString().trim();
      if (configDeviceRef && scanDeviceRef && scanDeviceRef === configDeviceRef) return true;
      if (deviceRefFromApi && scanDeviceRef && scanDeviceRef === deviceRefFromApi) return true;
      const scanSerial = (scan.deviceSerial ?? scan.device_serial ?? scan.computerSerialId ?? '').toString().trim();
      if (scanSerial && deviceSerialId && scanSerial === String(deviceSerialId).trim()) return true;
      const scanName = (scan.computerName ?? scan.computer_name ?? scan.deviceName ?? scan.device_name ?? scan.genie ?? '').toString().trim();
      if (scanName && deviceComputerName && scanName === deviceComputerName) return true;
      return false;
    };
    const scanMatchesSite = (scan) => {
      const scanSiteRef = (scan.siteRef ?? scan.site_ref ?? '').toString().trim();
      if (scanSiteRef && site.siteRef && scanSiteRef === site.siteRef) return true;
      const scanSite = (scan.siteName ?? scan.site_name ?? scan.site ?? '').trim().toLowerCase();
      const scanCustomer = (scan.customerName ?? scan.customer ?? '').trim().toLowerCase();
      const siteOk = scanSite === siteNameNorm || (scanSite && scanSite.includes(siteNameNorm)) || (siteNameNorm && scanSite.includes(siteNameNorm));
      const customerOk = !customerNorm || !scanCustomer || scanCustomer === customerNorm;
      return siteOk && customerOk;
    };

    const scansSinceRefill = scans.filter(scan => {
      const scanDate = new Date(scan.createdAt ?? scan.created_at);
      if (scanDate < refillDateTime) return false;
      if (!scanMatchesDevice(scan)) return false;
      if (!scanMatchesSite(scan)) return false;
      return true;
    });

    const totalConsumed = scansSinceRefill.reduce((sum, scan) => {
      const washTime = scan.washTime ?? scan.wash_time;
      return sum + calculateConsumption(washTime, config.calibration_rate_per_60s);
    }, 0);
    const maxCap = Number(config.max_capacity_litres) || 0;
    const startingLevel = lastRefill.newTotalLitres ?? lastRefill.new_total_litres ?? lastRefill.deliveredLitres ?? lastRefill.delivered_litres ?? 0;
    const startLevelNum = Number(startingLevel) || maxCap || 0;
    const currentLitresRaw = Math.max(0, startLevelNum - totalConsumed);
    const currentLitres = maxCap > 0 ? Math.min(maxCap, currentLitresRaw) : currentLitresRaw;
    const percentage = maxCap > 0 ? (currentLitres / maxCap) * 100 : null;

    const now = new Date();
    const daysSinceRefill = refillParsed.dateOnly
      ? Math.floor((now - refillParsed.date) / (24 * 60 * 60 * 1000))
      : null;
    // Match UI: daily usage = avg consumption over last 7 days (not full period); days to empty = current / that rate
    const avgDailyConsumption = calculateAvgDailyConsumptionLast7Days(scansSinceRefill, config.calibration_rate_per_60s);
    const daysToEmpty = avgDailyConsumption > 0 && currentLitres != null ? currentLitres / avgDailyConsumption : null;
    const dailyWashes = daysSinceRefill > 0 && scansSinceRefill.length > 0
      ? (scansSinceRefill.length / daysSinceRefill).toFixed(1)
      : scansSinceRefill.length;

    results.push({
      config,
      device,
      site,
      lastRefill: {
        date: refillParsed.dateOnly || lastRefill.date,
        newTotal: lastRefill.newTotalLitres ?? lastRefill.new_total_litres,
        product: lastRefill.productName ?? lastRefill.product,
        status: lastRefill.status ?? lastRefill.statusLabel,
      },
      scansSinceRefill: scansSinceRefill.length,
      totalConsumed: Math.round(totalConsumed * 10) / 10,
      startLevel: startLevelNum,
      currentLitres: Math.round(currentLitres),
      percentage: percentage != null ? Math.round(percentage * 10) / 10 : null,
      maxCap,
      daysSinceRefill,
      avgDailyLitres: Math.round(avgDailyConsumption * 10) / 10,
      daysToEmpty: daysToEmpty != null ? Math.round(daysToEmpty * 10) / 10 : null,
      dailyWashes,
    });
  }

  // Report
  const tank1 = results.find(r => !r.error && (r.config.product_type || '').toUpperCase() === 'FOAM');
  const tank2 = results.find(r => !r.error && (r.config.product_type || '').toUpperCase() === 'TW');
  const exp1 = EXPECTED.Tank1;
  const exp2 = EXPECTED.Tank2;

  function diff(a, b, tol = 1) {
    if (a == null || b == null) return a !== b;
    return Math.abs(Number(a) - Number(b)) > tol;
  }

  for (const r of results) {
    if (r.error) {
      console.log('Tank ' + (r.config?.tank_number ?? '?') + ' (' + (r.config?.product_type ?? '') + '): ERROR – ' + r.error);
      continue;
    }
    const tankNum = r.config.tank_number;
    const label = 'Tank ' + tankNum + ' – ' + (r.config.product_type === 'TW' ? 'TW' : r.config.product_type === 'GEL' ? 'GEL' : 'ECSR');
    console.log('--- ' + label + ' (device_ref=' + r.config.device_ref + ') ---');
    console.log('  Last refill: ' + r.lastRefill.date + ' | ' + r.lastRefill.product + ' | ' + r.lastRefill.status + ' | New total: ' + r.lastRefill.newTotal + ' L');
    console.log('  Scans since refill: ' + r.scansSinceRefill);
    console.log('  Start level: ' + r.startLevel + ' L | Consumed: ' + r.totalConsumed + ' L');
    console.log('  Current level: ' + r.currentLitres + ' L / ' + r.maxCap + ' L (' + r.percentage + '%)');
    console.log('  Since refill: ' + r.daysSinceRefill + ' days | Daily usage: ~' + r.avgDailyLitres + ' L/d | Days to empty: ' + (r.daysToEmpty != null ? r.daysToEmpty + ' days' : '—'));
    console.log('  Daily washes: ' + r.dailyWashes);
    console.log('');
  }

  console.log('=== Comparison to expected (UI) ===');
  let allPass = true;
  if (tank1) {
    const p = diff(tank1.currentLitres, exp1.currentLitres, 5) || diff(tank1.percentage, exp1.percentage, 1) ||
      diff(tank1.daysSinceRefill, exp1.sinceRefillDays, 1) || diff(tank1.avgDailyLitres, exp1.dailyUsage, 5) ||
      diff(tank1.daysToEmpty, exp1.daysToEmpty, 2) || diff(Number(tank1.dailyWashes), exp1.dailyWashes, 2);
    if (p) allPass = false;
    console.log('Tank 1 (FOAM): ' + (p ? 'FAIL' : 'PASS'));
    if (diff(tank1.currentLitres, exp1.currentLitres, 5)) console.log('  – currentLitres: got ' + tank1.currentLitres + ', expected ~' + exp1.currentLitres);
    if (diff(tank1.percentage, exp1.percentage, 1)) console.log('  – percentage: got ' + tank1.percentage + '%, expected ~' + exp1.percentage + '%');
    if (diff(tank1.daysSinceRefill, exp1.sinceRefillDays, 1)) console.log('  – since refill: got ' + tank1.daysSinceRefill + ' days, expected ~' + exp1.sinceRefillDays);
    if (diff(tank1.avgDailyLitres, exp1.dailyUsage, 5)) console.log('  – daily usage: got ~' + tank1.avgDailyLitres + ' L/d, expected ~' + exp1.dailyUsage);
    if (diff(tank1.daysToEmpty, exp1.daysToEmpty, 2)) console.log('  – days to empty: got ' + tank1.daysToEmpty + ', expected ~' + exp1.daysToEmpty);
    if (diff(Number(tank1.dailyWashes), exp1.dailyWashes, 2)) console.log('  – daily washes: got ' + tank1.dailyWashes + ', expected ~' + exp1.dailyWashes);
  } else {
    console.log('Tank 1 (FOAM): SKIP (no result)');
    allPass = false;
  }
  if (tank2) {
    const p = diff(tank2.currentLitres, exp2.currentLitres, 5) || diff(tank2.percentage, exp2.percentage, 1) ||
      diff(tank2.daysSinceRefill, exp2.sinceRefillDays, 1) || diff(tank2.avgDailyLitres, exp2.dailyUsage, 2) ||
      diff(tank2.daysToEmpty, exp2.daysToEmpty, 5) || diff(Number(tank2.dailyWashes), exp2.dailyWashes, 0.5);
    if (p) allPass = false;
    console.log('Tank 2 (TW): ' + (p ? 'FAIL' : 'PASS'));
    if (diff(tank2.currentLitres, exp2.currentLitres, 5)) console.log('  – currentLitres: got ' + tank2.currentLitres + ', expected ~' + exp2.currentLitres);
    if (diff(tank2.percentage, exp2.percentage, 1)) console.log('  – percentage: got ' + tank2.percentage + '%, expected ~' + exp2.percentage + '%');
    if (diff(tank2.daysSinceRefill, exp2.sinceRefillDays, 1)) console.log('  – since refill: got ' + tank2.daysSinceRefill + ' days, expected ~' + exp2.sinceRefillDays);
    if (diff(tank2.avgDailyLitres, exp2.dailyUsage, 2)) console.log('  – daily usage: got ~' + tank2.avgDailyLitres + ' L/d, expected ~' + exp2.dailyUsage);
    if (diff(tank2.daysToEmpty, exp2.daysToEmpty, 5)) console.log('  – days to empty: got ' + tank2.daysToEmpty + ', expected ~' + exp2.daysToEmpty);
    if (diff(Number(tank2.dailyWashes), exp2.dailyWashes, 0.5)) console.log('  – daily washes: got ' + tank2.dailyWashes + ', expected ~' + exp2.dailyWashes);
  } else {
    console.log('Tank 2 (TW): SKIP (no result)');
    allPass = false;
  }

  console.log('');
  if (allPass) {
    console.log('Overall: PASS — Calculated values match expected (UI). APIs and tank config are consistent.');
  } else {
    console.log('Overall: FAIL or SKIP — If values differ, check: (1) Refills API status/date/product, (2) Scans API device/site/created_at/wash_time, (3) Tank config device_ref/serial/calibration.');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
