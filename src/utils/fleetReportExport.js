/**
 * Fleet Compliance Report — ExcelJS Generator
 *
 * Produces a branded 4-tab .xlsx matching the Heidelberg Materials template.
 * Tabs: Dashboard, Site Summary, Vehicle Breakdown, Compliance Status.
 *
 * Uses ExcelJS for full styling, conditional formatting (DataBars), images, and formulas.
 */
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// ── Brand colours ────────────────────────────────────────────────────────────
const HDR = '00563B';      // dark green header
const ACCENT = '00A651';   // bright green accent
const WHITE = 'FFFFFF';
const TEXT = '1A1A1A';
const GREY = '6B7280';
const BG_ALT = 'F9FAFB';
const HDR_BG = 'F5F5F5';
const KPI_BL = 'E6F4EC';
const KPI_YL = 'FFF8E1';
const COMP_G = 'E6F4EC';   // compliant row bg
const RISK_A = 'FFF7ED';   // at-risk row bg
const ZERO_R = 'FEF2F2';   // zero-wash row bg
const COMP_ST = 'F0FFF4';  // compliant status row bg
const FREQ_Z = 'FEE2E2';
const RED_D = 'D32F2F';
const GRN_D = '006400';
const AMB_D = 'B45309';
const RED_HDR = '991B1B';
const GREEN_T = '16A34A';
const AMBER_T = 'FF8C00';
const GREY_S = '888888';
const DB_GREEN = '00A650';
const DB_AMBER = 'FF8C00';

// ── Helpers ──────────────────────────────────────────────────────────────────
function F(bold = false, sz = 9, col = TEXT, name = 'Arial') {
  return { name, bold, size: sz, color: { argb: 'FF' + col } };
}

function FL(c) {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + c } };
}

function AL(h = 'center', v = 'middle', wrap = false) {
  return { horizontal: h, vertical: v, wrapText: wrap };
}

function BD(bottom = false) {
  const s = { style: 'thin', color: { argb: 'FFD0D0D0' } };
  const n = {};
  return { bottom: bottom ? s : n };
}

function fillRow(ws, row, color, nCols) {
  for (let c = 1; c <= nCols; c++) {
    ws.getRow(row).getCell(c).fill = FL(color);
  }
}

function mc(ws, r1, c1, r2, c2, opts = {}) {
  if (r1 !== r2 || c1 !== c2) {
    ws.mergeCells(r1, c1, r2, c2);
  }
  const cell = ws.getRow(r1).getCell(c1);
  if (opts.value !== undefined) cell.value = opts.value;
  if (opts.font) cell.font = opts.font;
  if (opts.fill) cell.fill = opts.fill;
  if (opts.alignment) cell.alignment = opts.alignment;
  if (opts.border) cell.border = opts.border;
  return cell;
}

function setCell(ws, row, col, value, { font, fill, alignment, border, numFmt } = {}) {
  const cell = ws.getRow(row).getCell(col);
  cell.value = value;
  if (font) cell.font = font;
  if (fill) cell.fill = fill;
  if (alignment) cell.alignment = alignment;
  if (border) cell.border = border;
  if (numFmt) cell.numFmt = numFmt;
  return cell;
}

/**
 * Detect image type from URL path or content-type header.
 * Returns 'svg' for SVGs (need conversion), or the ExcelJS extension.
 */
function detectImageType(url, contentType) {
  const ct = (contentType || '').toLowerCase();
  const path = (url || '').split('?')[0].toLowerCase();
  if (ct.includes('svg') || path.endsWith('.svg')) return 'svg';
  if (ct.includes('jpeg') || ct.includes('jpg') || path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'jpeg';
  if (ct.includes('gif') || path.endsWith('.gif')) return 'gif';
  if (ct.includes('png') || path.endsWith('.png')) return 'png';
  return 'png';
}

/**
 * Convert an SVG string to a PNG ArrayBuffer using an offscreen canvas.
 * Returns ArrayBuffer or null on failure.
 */
function svgToPng(svgText, width = 400, height = 200) {
  return new Promise((resolve) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);

      img.onload = () => {
        // Draw SVG scaled to fit canvas while preserving aspect ratio
        const scale = Math.min(width / img.naturalWidth, height / img.naturalHeight);
        const w = img.naturalWidth * scale;
        const h = img.naturalHeight * scale;
        ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
        URL.revokeObjectURL(blobUrl);
        canvas.toBlob((pngBlob) => {
          if (!pngBlob) { resolve(null); return; }
          pngBlob.arrayBuffer().then(resolve).catch(() => resolve(null));
        }, 'image/png');
      };
      img.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        resolve(null);
      };
      img.src = blobUrl;
    } catch {
      resolve(null);
    }
  });
}

/**
 * Fetch an image as an ArrayBuffer for ExcelJS.
 * SVGs are automatically converted to PNG.
 * Returns { buffer, extension } or null if fetch fails.
 */
async function fetchImageBuffer(url) {
  if (!url) return null;
  try {
    const resp = await fetch(url, { mode: 'cors' });
    if (!resp.ok) return null;
    const contentType = resp.headers.get('content-type') || '';
    const imgType = detectImageType(url, contentType);

    if (imgType === 'svg') {
      // Convert SVG to PNG since Excel doesn't support SVG
      const svgText = await resp.text();
      if (!svgText || svgText.length === 0) return null;
      const pngBuffer = await svgToPng(svgText, 400, 200);
      if (!pngBuffer || pngBuffer.byteLength === 0) return null;
      return { buffer: pngBuffer, extension: 'png' };
    }

    const buffer = await resp.arrayBuffer();
    if (!buffer || buffer.byteLength === 0) return null;
    return { buffer, extension: imgType };
  } catch {
    return null;
  }
}

function writeHeader(wb, ws, title, subtitle, nCols, colWidths, opts = {}) {
  // Grid lines off — do NOT set state:'frozen' with ySplit:0 (causes Excel repair warning)
  const viewOpts = { showGridLines: false };
  if (opts.zoom) viewOpts.zoomScale = opts.zoom;
  ws.views = [viewOpts];

  // Column widths
  colWidths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  // Row 1 — header bar with title (tall enough for logos)
  ws.getRow(1).height = 56;
  fillRow(ws, 1, HDR, nCols);
  mc(ws, 1, 1, 1, nCols, {
    value: title,
    font: F(true, 20, WHITE),
    fill: FL(HDR),
    alignment: AL('center', 'middle'),
  });

  // Logos — generous fixed pixel sizes so no logo gets shrunk.
  // Client logo: 160x42 px (left side) — fits most company logos comfortably.
  // ELORA logo:  38x38 px (right side).
  if (opts.clientLogoBuffer) {
    try {
      const imgId = wb.addImage({ buffer: opts.clientLogoBuffer, extension: opts.clientLogoExt || 'png' });
      ws.addImage(imgId, {
        tl: { col: 0.1, row: 0.1 },
        ext: { width: 160, height: 42 },
        editAs: 'oneCell',
      });
    } catch { /* skip logo */ }
  }

  if (opts.eloraLogoBuffer) {
    try {
      const imgId = wb.addImage({ buffer: opts.eloraLogoBuffer, extension: opts.eloraLogoExt || 'png' });
      ws.addImage(imgId, {
        tl: { col: Math.max(0, nCols - 2) + 0.2, row: 0.1 },
        ext: { width: 38, height: 38 },
        editAs: 'oneCell',
      });
    } catch { /* skip logo */ }
  }

  // Row 2 — thin green spacer
  ws.getRow(2).height = 19.5;
  fillRow(ws, 2, HDR, nCols);
  mc(ws, 2, 1, 2, nCols, { fill: FL(HDR) });

  // Row 3 — subtitle
  ws.getRow(3).height = 18;
  fillRow(ws, 3, HDR_BG, nCols);
  mc(ws, 3, 1, 3, nCols, {
    value: subtitle,
    font: F(false, 9, GREY_S),
    fill: FL(HDR_BG),
    alignment: AL('center', 'middle'),
  });

  // Row 4 — spacer
  ws.getRow(4).height = 7.5;
}

// ── Data aggregation ─────────────────────────────────────────────────────────

/**
 * Build the fleet report data structure from raw API data.
 *
 * @param {Object} params
 * @param {Array} params.vehicles  - from /api/vehicles (ACATC)
 * @param {Array} params.scans     - from /api/scans (ACATC) for the period
 * @param {Object} params.pricingMaps - { byDeviceSerial, bySiteRef, products } from buildSitePricingMaps
 * @param {string} params.customerName - e.g. "Heidelberg Materials"
 * @param {string} params.region    - e.g. "Melb Metro"
 * @param {Object} params.costUtils - cost calculation functions
 * @returns {Object} aggregated data for all 4 tabs
 */
export function buildReportData({
  vehicles = [],
  scans = [],
  entitlementMaps = null,
  pricingMaps = null,
  customerName = '',
  region = '',
  period = '',
  costUtils = null,
}) {
  // Build wash count per vehicle from scans
  const washCountByVehicle = {};
  const lastScanByVehicle = {};

  scans.forEach((scan) => {
    const vName = scan.vehicleName ?? scan.vehicle_name ?? scan.vehicleRef ?? scan.vehicle_ref ?? 'Unknown';
    const vRef = scan.vehicleRef ?? scan.vehicle_ref ?? vName;
    const status = (scan.statusLabel ?? scan.status ?? '').toString().trim().toLowerCase();
    const rfid = (scan.rfid ?? '').toString().trim().toLowerCase();
    // Count billable scans
    if (status !== 'auto' && rfid !== 'auto' && (status === 'success' || status === 'exceeded')) {
      washCountByVehicle[vRef] = (washCountByVehicle[vRef] || 0) + 1;
    }
    // Track last scan
    const ts = scan.createdAt ?? scan.created_at ?? scan.scanTimestamp ?? scan.timestamp;
    if (ts) {
      if (!lastScanByVehicle[vRef] || new Date(ts) > new Date(lastScanByVehicle[vRef])) {
        lastScanByVehicle[vRef] = ts;
      }
    }
  });

  // Build vehicle list with compliance data
  const vehicleList = vehicles.map((v) => {
    const ref = v.vehicleRef ?? v.vehicle_ref ?? v.ref;
    const name = v.vehicleName ?? v.vehicle_name ?? v.name ?? ref;
    const site = v.siteName ?? v.site_name ?? '';
    const target = Number(v.washesPerWeek ?? v.washes_per_week ?? v.washesPerDay ?? v.washes_per_day ?? 6);
    const washes = washCountByVehicle[ref] || 0;
    const compRate = target > 0 ? washes / target : 0;
    const isCompliant = compRate >= 1.0;
    const lastScan = lastScanByVehicle[ref] ?? null;
    const active = washes > 0;

    return {
      vehicle: name,
      site,
      ref,
      washes,
      target: target || 6,
      compRate,
      status: isCompliant ? 'Compliant' : 'Non-Compliant',
      isCompliant,
      lastScan,
      active,
    };
  });

  // Calculate cost per scan using the same logic as the usage costs page
  let totalCost = 0;
  let totalLitres = 0;
  const costBySite = {};
  const costByVehicle = {};

  scans.forEach((scan) => {
    const status = (scan.statusLabel ?? scan.status ?? '').toString().trim().toLowerCase();
    const rfid = (scan.rfid ?? '').toString().trim().toLowerCase();
    if (status === 'auto' || rfid === 'auto') return;
    if (status !== 'success' && status !== 'exceeded') return;

    let cost = 0;
    let litres = 0;

    if (costUtils?.calculateScanCostFromScan) {
      const result = costUtils.calculateScanCostFromScan(scan, entitlementMaps, pricingMaps);
      cost = result.cost || 0;
      litres = result.litresUsed || 0;
    } else {
      // Fallback: simple estimate
      const washTimeSec = Number(scan.washTime ?? scan.wash_time ?? 60);
      litres = (washTimeSec / 60) * 2; // 2 L/min default
      cost = litres * 3.85; // $3.85/L default
    }

    totalCost += cost;
    totalLitres += litres;

    const siteName = scan.siteName ?? scan.site_name ?? '';
    const vRef = scan.vehicleRef ?? scan.vehicle_ref ?? '';
    if (!costBySite[siteName]) costBySite[siteName] = { cost: 0, litres: 0, scans: 0 };
    costBySite[siteName].cost += cost;
    costBySite[siteName].litres += litres;
    costBySite[siteName].scans += 1;
    if (!costByVehicle[vRef]) costByVehicle[vRef] = { cost: 0, litres: 0 };
    costByVehicle[vRef].cost += cost;
    costByVehicle[vRef].litres += litres;
  });

  // Resolve price/litre
  let pricePerLitre = 3.85;
  if (costUtils?.getPricePerLitreFromProducts && pricingMaps?.products) {
    const dbPrice = costUtils.getPricePerLitreFromProducts(pricingMaps.products, customerName);
    if (dbPrice) pricePerLitre = dbPrice;
  }

  // Site aggregation
  const siteMap = {};
  vehicleList.forEach((v) => {
    if (!siteMap[v.site]) siteMap[v.site] = { vehicles: 0, washes: 0, compliant: 0, atRisk: 0 };
    siteMap[v.site].vehicles += 1;
    siteMap[v.site].washes += v.washes;
    if (v.isCompliant) siteMap[v.site].compliant += 1;
    else siteMap[v.site].atRisk += 1;
  });

  const sites = Object.entries(siteMap)
    .map(([name, s]) => ({
      site: name,
      vehicles: s.vehicles,
      washes: s.washes,
      compliant: s.compliant,
      atRisk: s.atRisk,
      cost: costBySite[name]?.cost || 0,
      litres: costBySite[name]?.litres || 0,
      costPerTruck: s.vehicles > 0 ? (costBySite[name]?.cost || 0) / s.vehicles : 0,
      costPerWash: s.washes > 0 ? (costBySite[name]?.cost || 0) / s.washes : 0,
    }))
    .sort((a, b) => b.washes - a.washes);

  // KPIs
  const totalVehicles = vehicleList.length;
  const compliantCount = vehicleList.filter((v) => v.isCompliant).length;
  const totalWashes = vehicleList.reduce((s, v) => s + v.washes, 0);
  const activeVehicles = vehicleList.filter((v) => v.active).length;
  const zeroWash = vehicleList.filter((v) => v.washes === 0).length;
  const compRate = totalVehicles > 0 ? Math.round((compliantCount / totalVehicles) * 100 * 10) / 10 : 0;
  const avgCostPerTruck = totalVehicles > 0 ? totalCost / totalVehicles : 0;
  const avgCostPerWash = totalWashes > 0 ? totalCost / totalWashes : 0;

  // Split vehicles for compliance status tab
  const compliantVehicles = vehicleList.filter((v) => v.isCompliant).sort((a, b) => b.washes - a.washes);
  const atRiskVehicles = vehicleList.filter((v) => !v.isCompliant && v.washes > 0).sort((a, b) => b.washes - a.washes);
  const zeroWashVehicles = vehicleList.filter((v) => v.washes === 0).sort((a, b) => {
    if (a.site < b.site) return -1;
    if (a.site > b.site) return 1;
    return a.vehicle < b.vehicle ? -1 : 1;
  });

  const company = region ? `${customerName} - ${region}` : customerName;

  return {
    company,
    customerName,
    region,
    period,
    kpis: {
      totalVehicles,
      compliantCount,
      atRisk: totalVehicles - compliantCount,
      totalWashes,
      activeVehicles,
      zeroWash,
      compRate,
      totalCost,
      avgCostPerTruck,
      avgCostPerWash,
      totalLitres,
      pricePerLitre,
    },
    sites,
    vehicleList: vehicleList.sort((a, b) => {
      if (a.site < b.site) return -1;
      if (a.site > b.site) return 1;
      return b.washes - a.washes;
    }),
    compliantVehicles,
    atRiskVehicles,
    zeroWashVehicles,
    hasCostData: totalCost > 0,
  };
}

// ── Tab builders ─────────────────────────────────────────────────────────────

function buildDashboard(wb, data, logos) {
  const ws = wb.addWorksheet('Dashboard');
  const CW = [1, 2, 18, 14, 13, 13, 13, 3, 18, 14, 13, 13, 13, 2];
  writeHeader(wb, ws, 'Fleet Compliance Report',
    `${data.company}  -  ${data.period}  -  All Sites`, 14, CW, { zoom: 140, ...logos });

  const { kpis, sites, hasCostData } = data;

  // Row 5 — section labels
  ws.getRow(5).height = 15.75;
  mc(ws, 5, 3, 5, 7, { value: 'PERFORMANCE METRICS', font: F(true, 8, ACCENT), alignment: AL('left') });
  mc(ws, 5, 9, 5, 13, { value: 'COST METRICS', font: F(true, 8, ACCENT), alignment: AL('left') });

  // Row 6 — KPI headers
  ws.getRow(6).height = 15.75;
  const kpiHeaders = [
    [3, 'COMPLIANCE RATE', KPI_BL], [4, 'TOTAL WASHES', KPI_BL], [5, 'COMPLIANT VEHICLES', KPI_BL],
    [6, 'AT RISK', KPI_BL], [7, 'ACTIVE VEHICLES', KPI_BL],
    [9, 'TOTAL PROGRAM COST', KPI_YL], [10, 'AVG COST / TRUCK', KPI_YL],
    [11, 'AVG COST / WASH', KPI_YL], [12, 'TOTAL LITRES', KPI_YL], [13, 'PRICE / LITRE', KPI_YL],
  ];
  kpiHeaders.forEach(([col, lbl, bg]) => {
    setCell(ws, 6, col, lbl, { font: F(true, 7, ACCENT), fill: FL(bg), alignment: AL(), border: BD(true) });
  });

  // Row 7 — KPI values
  ws.getRow(7).height = 30;
  const perfVals = [
    [3, `${kpis.compRate}%`], [4, String(kpis.totalWashes)], [5, String(kpis.compliantCount)],
    [6, String(kpis.atRisk)], [7, String(kpis.activeVehicles)],
  ];
  const costVals = [
    [9, hasCostData ? `$${kpis.totalCost.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'],
    [10, hasCostData ? `$${kpis.avgCostPerTruck.toFixed(2)}` : 'N/A'],
    [11, hasCostData ? `$${kpis.avgCostPerWash.toFixed(2)}` : 'N/A'],
    [12, hasCostData ? `${kpis.totalLitres.toFixed(1)}L` : 'N/A'],
    [13, `$${kpis.pricePerLitre.toFixed(2)}`],
  ];
  [...perfVals, ...costVals].forEach(([col, val]) => {
    const bg = col <= 7 ? KPI_BL : KPI_YL;
    setCell(ws, 7, col, val, { font: F(true, 18, HDR), fill: FL(bg), alignment: AL(), border: BD(true) });
  });

  // Row 8 — sub-labels
  ws.getRow(8).height = 15.75;
  const subs = [
    [3, 'vs 80% target', KPI_BL], [4, 'In period', KPI_BL], [5, 'Meeting 80% target', KPI_BL],
    [6, 'Below target', KPI_BL], [7, 'Washed in period', KPI_BL],
    [9, data.period, KPI_YL], [10, 'Per registered vehicle', KPI_YL], [11, 'Per wash event', KPI_YL],
    [12, 'Chemical dispensed', KPI_YL], [13, 'Current rate', KPI_YL],
  ];
  subs.forEach(([col, sub, bg]) => {
    setCell(ws, 8, col, sub, { font: F(false, 8, GREY), fill: FL(bg), alignment: AL(), border: BD(true) });
  });

  // Spacer
  ws.getRow(9).height = 9.75;

  // Row 10 — section labels for tables
  ws.getRow(10).height = 12;
  mc(ws, 10, 3, 10, 7, { value: 'WASHES BY SITE', font: F(true, 8, ACCENT), alignment: AL('left') });
  mc(ws, 10, 9, 10, 12, { value: 'WASH FREQUENCY DISTRIBUTION', font: F(true, 8, ACCENT), alignment: AL('left') });

  // Row 11 — table headers
  ws.getRow(11).height = 15.75;
  [
    [3, 'Site'], [4, 'Vehicles'], [5, 'Washes'], [6, 'Litres'], [7, 'Total Cost'],
    [9, 'Washes'], [10, 'Vehicles'], [11, '% of Fleet'], [12, 'Status'],
  ].forEach(([col, hdr]) => {
    setCell(ws, 11, col, hdr, { font: F(true, 9, WHITE), fill: FL(HDR), alignment: AL(), border: BD(true) });
  });

  // Wash frequency distribution
  const washCounts = data.vehicleList.map((v) => v.washes);
  const buckets = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  washCounts.forEach((w) => { buckets[Math.min(w, 6)] += 1; });
  const tv = kpis.totalVehicles || 1;
  const freqRows = [
    ['0 wash', buckets[0], buckets[0] / tv, 'No washes', FREQ_Z, RED_D, true],
    ['1 wash', buckets[1], buckets[1] / tv, '- Partial', BG_ALT, TEXT, false],
    ['2 washes', buckets[2], buckets[2] / tv, '- Partial', WHITE, TEXT, false],
    ['3 washes', buckets[3], buckets[3] / tv, '- Partial', BG_ALT, TEXT, false],
    ['4 washes', buckets[4], buckets[4] / tv, '- Partial', WHITE, TEXT, false],
    ['5 washes', buckets[5], buckets[5] / tv, 'On track', COMP_G, GREEN_T, true],
    ['6+ washes', buckets[6], buckets[6] / tv, 'On track', COMP_G, GREEN_T, true],
  ];

  // Site data rows
  const DS = 12;
  sites.forEach((site, i) => {
    const r = DS + i;
    ws.getRow(r).height = 15.0;
    const bg = i % 2 === 0 ? BG_ALT : WHITE;
    setCell(ws, r, 3, site.site, { font: F(true, 9), fill: FL(bg), alignment: AL('left'), border: BD(true) });
    setCell(ws, r, 4, site.vehicles, { font: F(false, 9), fill: FL(bg), alignment: AL(), border: BD(true) });
    setCell(ws, r, 5, site.washes, { font: F(false, 9), fill: FL(bg), alignment: AL(), border: BD(true) });
    setCell(ws, r, 6, site.litres, { font: F(false, 9), fill: FL(bg), alignment: AL(), border: BD(true), numFmt: '0.0"L"' });
    setCell(ws, r, 7, site.cost, { font: F(false, 9), fill: FL(bg), alignment: AL(), border: BD(true), numFmt: '$#,##0.00' });

    // Frequency distribution (right side)
    if (i < freqRows.length) {
      const [label, cnt, pct, status, fbg, fc, bold] = freqRows[i];
      setCell(ws, r, 9, label, { font: F(false, 9), fill: FL(fbg), alignment: AL('left'), border: BD(true) });
      setCell(ws, r, 10, cnt, { font: F(false, 9), fill: FL(fbg), alignment: AL(), border: BD(true) });
      setCell(ws, r, 11, pct, { font: F(false, 9), fill: FL(fbg), alignment: AL(), border: BD(true), numFmt: '0.0%' });
      setCell(ws, r, 12, status, { font: F(bold, 9, fc), fill: FL(fbg), alignment: AL(), border: BD(true) });
    }
  });

  // Totals row
  const TR = DS + sites.length;
  ws.getRow(TR).height = 18;
  setCell(ws, TR, 3, 'TOTAL', { font: F(true, 9, WHITE), fill: FL(HDR), alignment: AL('left'), border: BD(true) });
  setCell(ws, TR, 4, kpis.totalVehicles, { font: F(true, 9, WHITE), fill: FL(HDR), alignment: AL(), border: BD(true) });
  setCell(ws, TR, 5, kpis.totalWashes, { font: F(true, 9, WHITE), fill: FL(HDR), alignment: AL(), border: BD(true) });
  setCell(ws, TR, 6, kpis.totalLitres, { font: F(true, 9, WHITE), fill: FL(HDR), alignment: AL(), border: BD(true), numFmt: '0.0"L"' });
  setCell(ws, TR, 7, kpis.totalCost, { font: F(true, 9, WHITE), fill: FL(HDR), alignment: AL(), border: BD(true), numFmt: '$#,##0.00' });
}

function buildSiteSummary(wb, data, logos) {
  const ws = wb.addWorksheet('Site Summary');
  const CW = [22, 10, 13, 13, 12, 13, 13, 13, 13, 13, 13, 13];
  writeHeader(wb, ws, 'Site Summary', `${data.company}  -  ${data.period}`, 12, CW, logos);

  // Row 5 — headers
  ws.getRow(5).height = 19.5;
  ['Site', 'Vehicles', 'Washes', 'Litres', 'Total Cost', 'Cost/Truck', 'Cost/Wash',
    'Compliant', 'At Risk', 'Comp Rate', '% Washes', '% Cost',
  ].forEach((hdr, i) => {
    setCell(ws, 5, i + 1, hdr, { font: F(true, 9, WHITE), fill: FL(HDR), alignment: AL(), border: BD(true) });
  });

  const { sites, kpis } = data;
  const DS = 6;

  sites.forEach((site, i) => {
    const r = DS + i;
    ws.getRow(r).height = 15.75;
    const bg = i % 2 === 0 ? BG_ALT : WHITE;
    const crDec = site.vehicles > 0 ? site.compliant / site.vehicles : 0;
    const crCol = crDec >= 0.8 ? GREEN_T : crDec > 0 ? AMBER_T : RED_D;
    const washPct = kpis.totalWashes > 0 ? site.washes / kpis.totalWashes : 0;
    const costPct = kpis.totalCost > 0 ? site.cost / kpis.totalCost : 0;

    const vals = [
      [1, site.site, 'left', undefined, false, TEXT],
      [2, site.vehicles, 'center', undefined, false, TEXT],
      [3, site.washes, 'center', undefined, false, TEXT],
      [4, site.litres, 'center', '0.0"L"', false, TEXT],
      [5, site.cost, 'center', '$#,##0.00', false, TEXT],
      [6, site.costPerTruck, 'center', '$#,##0.00', false, TEXT],
      [7, site.costPerWash, 'center', '$#,##0.00', false, TEXT],
      [8, site.compliant, 'center', undefined, false, TEXT],
      [9, site.atRisk, 'center', undefined, false, TEXT],
      [10, crDec, 'center', '0%', true, crCol],
      [11, washPct, 'center', '0.0%', false, TEXT],
      [12, costPct, 'center', '0.0%', false, TEXT],
    ];

    vals.forEach(([col, val, ah, nf, bold, fc]) => {
      setCell(ws, r, col, val, {
        font: F(bold, 9, fc), fill: FL(bg), alignment: AL(ah), border: BD(true),
        ...(nf ? { numFmt: nf } : {}),
      });
    });
  });

  // Totals row
  const TR = DS + sites.length;
  ws.getRow(TR).height = 18;
  const totals = [
    [1, 'TOTAL'], [2, kpis.totalVehicles], [3, kpis.totalWashes],
    [4, kpis.totalLitres], [5, kpis.totalCost], [6, kpis.avgCostPerTruck],
    [7, kpis.avgCostPerWash], [8, kpis.compliantCount], [9, kpis.atRisk],
    [10, `${kpis.compRate}%`], [11, '100%'], [12, '100%'],
  ];
  totals.forEach(([col, val]) => {
    const nf = col === 4 ? '0.0"L"' : [5, 6, 7].includes(col) ? '$#,##0.00' : undefined;
    setCell(ws, TR, col, val, {
      font: F(true, 9, WHITE), fill: FL(HDR),
      alignment: AL(col === 1 ? 'left' : 'center'), border: BD(true),
      ...(nf ? { numFmt: nf } : {}),
    });
  });
}

function buildVehicleBreakdown(wb, data, logos) {
  const ws = wb.addWorksheet('Vehicle Breakdown');
  const CW = [18, 22, 10, 13, 12, 14, 12, 14, 22, 10];
  writeHeader(wb, ws, 'Vehicle Breakdown',
    `${data.company}  -  ${data.period}  -  ${data.kpis.totalVehicles} Vehicles`, 10, CW, logos);

  // Row 5 — headers
  ws.getRow(5).height = 19.5;
  ['Vehicle', 'Site', 'Washes', 'Target', 'Progress', 'Status', 'Comp %', 'Last Scan', 'Active']
    .forEach((hdr, i) => {
      setCell(ws, 5, i + 1, hdr, { font: F(true, 9, WHITE), fill: FL(HDR), alignment: AL(), border: BD(true) });
    });

  const DS = 6;
  data.vehicleList.forEach((v, i) => {
    const r = DS + i;
    ws.getRow(r).height = 12.75;
    const bg = v.isCompliant ? COMP_G : v.washes > 0 ? RISK_A : ZERO_R;
    const stCol = v.isCompliant ? GREEN_T : AMBER_T;
    const lastScan = v.lastScan ? new Date(v.lastScan).toISOString().slice(0, 16).replace('T', ' ') : '';
    const crDisplay = Math.min(v.compRate, 9.99); // cap for display

    setCell(ws, r, 1, v.vehicle, { font: F(false, 9), fill: FL(bg), alignment: AL('left'), border: BD(true) });
    setCell(ws, r, 2, v.site, { font: F(false, 9), fill: FL(bg), alignment: AL('left'), border: BD(true) });
    setCell(ws, r, 3, v.washes, { font: F(false, 9), fill: FL(bg), alignment: AL(), border: BD(true) });
    setCell(ws, r, 4, v.target, { font: F(false, 9), fill: FL(bg), alignment: AL(), border: BD(true) });
    setCell(ws, r, 5, v.compRate, {
      font: F(false, 9), fill: FL(bg), alignment: AL(), border: BD(true), numFmt: '0%',
    });
    setCell(ws, r, 6, v.status, { font: F(true, 9, stCol), fill: FL(bg), alignment: AL(), border: BD(true) });
    setCell(ws, r, 7, v.compRate, {
      font: F(false, 9), fill: FL(bg), alignment: AL(), border: BD(true), numFmt: '0%',
    });
    setCell(ws, r, 8, lastScan, { font: F(false, 9), fill: FL(bg), alignment: AL(), border: BD(true) });
    setCell(ws, r, 9, v.active ? 'Yes' : 'No', { font: F(false, 9), fill: FL(bg), alignment: AL(), border: BD(true) });
  });

  // Add DataBar conditional formatting for Progress column (col 5)
  const lastRow = DS + data.vehicleList.length - 1;
  if (data.vehicleList.length > 0) {
    // ExcelJS DataBar
    ws.addConditionalFormatting({
      ref: `E${DS}:E${lastRow}`,
      rules: [{
        type: 'dataBar',
        minLength: 0,
        maxLength: 100,
        gradient: true,
        cfvo: [{ type: 'num', value: 0 }, { type: 'num', value: 1.5 }],
        color: { argb: 'FF' + DB_GREEN },
      }],
    });
  }
}

function buildComplianceStatus(wb, data, logos) {
  const ws = wb.addWorksheet('Compliance Status');
  const CW = [20, 22, 10, 21.83, 20, 22, 10, 13];
  writeHeader(wb, ws, 'Compliance Status', `${data.company}  -  ${data.period}`, 8, CW, logos);

  const { kpis, compliantVehicles, atRiskVehicles, zeroWashVehicles } = data;

  // Summary stats rows 5-9
  const statsRows = [
    [5, 'Total Fleet', `${kpis.totalVehicles} vehicles`],
    [6, 'Compliant', String(kpis.compliantCount)],
    [7, 'At Risk', String(kpis.atRisk)],
    [8, 'Zero Washes', String(kpis.zeroWash)],
    [9, 'Compliance Rate', `${kpis.compRate}%`],
  ];
  statsRows.forEach(([r, lbl, val]) => {
    ws.getRow(r).height = 15.75;
    setCell(ws, r, 1, lbl, { font: F(false, 9, GREY), alignment: AL('left'), border: BD(true) });
    setCell(ws, r, 2, val, { font: F(true, 9, HDR), alignment: AL(), border: BD(true) });
  });

  // Row 10 spacer, row 11 section headers
  ws.getRow(10).height = 12;
  ws.getRow(11).height = 18;
  mc(ws, 11, 1, 11, 3, {
    value: 'COMPLIANT VEHICLES', font: F(true, 9, WHITE), fill: FL(GRN_D), alignment: AL(),
  });
  mc(ws, 11, 5, 11, 7, {
    value: 'AT RISK VEHICLES', font: F(true, 9, WHITE), fill: FL(AMB_D), alignment: AL(),
  });

  // Row 12 — sub-headers
  ws.getRow(12).height = 15.75;
  [[1, HDR], [2, HDR], [3, HDR], [5, AMBER_T], [6, AMBER_T], [7, AMBER_T]].forEach(([col, bg]) => {
    const labels = { 1: 'Vehicle', 2: 'Site', 3: 'Washes', 5: 'Vehicle', 6: 'Site', 7: 'Washes' };
    setCell(ws, 12, col, labels[col], { font: F(true, 9, WHITE), fill: FL(bg), alignment: AL(), border: BD(true) });
  });

  // Dual tables
  const maxRows = Math.max(compliantVehicles.length, atRiskVehicles.length);
  for (let i = 0; i < maxRows; i++) {
    const r = 13 + i;
    ws.getRow(r).height = 12.75;

    if (i < compliantVehicles.length) {
      const v = compliantVehicles[i];
      const bg = i % 2 === 0 ? COMP_ST : WHITE;
      setCell(ws, r, 1, v.vehicle, { font: F(false, 9), fill: FL(bg), alignment: AL('left'), border: BD(true) });
      setCell(ws, r, 2, v.site, { font: F(false, 9), fill: FL(bg), alignment: AL('left'), border: BD(true) });
      setCell(ws, r, 3, v.washes, { font: F(false, 9), fill: FL(bg), alignment: AL(), border: BD(true) });
    }

    if (i < atRiskVehicles.length) {
      const v = atRiskVehicles[i];
      const bg = i % 2 === 0 ? RISK_A : WHITE;
      setCell(ws, r, 5, v.vehicle, { font: F(false, 9), fill: FL(bg), alignment: AL('left'), border: BD(true) });
      setCell(ws, r, 6, v.site, { font: F(false, 9), fill: FL(bg), alignment: AL('left'), border: BD(true) });
      setCell(ws, r, 7, v.washes, { font: F(false, 9), fill: FL(bg), alignment: AL(), border: BD(true) });
    }
  }

  // Zero-wash section
  if (zeroWashVehicles.length > 0) {
    const zeroStart = 13 + maxRows + 1;
    ws.getRow(zeroStart).height = 18;
    mc(ws, zeroStart, 1, zeroStart, 7, {
      value: `ZERO-WASH VEHICLES - ${zeroWashVehicles.length} vehicles with no washes this period`,
      font: F(true, 9, WHITE), fill: FL(RED_D), alignment: AL('left'),
    });

    const hdrR = zeroStart + 1;
    ws.getRow(hdrR).height = 15.75;
    [['Vehicle', 1], ['Site', 2], ['Target', 3], ['Last Known Scan', 4]].forEach(([lbl, col]) => {
      setCell(ws, hdrR, col, lbl, { font: F(true, 9, WHITE), fill: FL(RED_HDR), alignment: AL(), border: BD(true) });
    });

    zeroWashVehicles.forEach((v, i) => {
      const r = hdrR + 1 + i;
      ws.getRow(r).height = 12.75;
      const bg = i % 2 === 0 ? ZERO_R : WHITE;
      const lastScan = v.lastScan ? new Date(v.lastScan).toISOString().slice(0, 16).replace('T', ' ') : '';
      setCell(ws, r, 1, v.vehicle, { font: F(false, 9), fill: FL(bg), alignment: AL('left'), border: BD(true) });
      setCell(ws, r, 2, v.site, { font: F(false, 9), fill: FL(bg), alignment: AL('left'), border: BD(true) });
      setCell(ws, r, 3, v.target, { font: F(false, 9), fill: FL(bg), alignment: AL(), border: BD(true) });
      setCell(ws, r, 4, lastScan, { font: F(false, 9), fill: FL(bg), alignment: AL(), border: BD(true) });
    });
  }
}

// ── Welcome / Cover Page ─────────────────────────────────────────────────────

function buildWelcomePage(wb, data, logos, opts = {}) {
  const ws = wb.addWorksheet('Welcome');
  const N = 8;

  ws.views = [{ showGridLines: false }];
  const CW = [4, 12, 20, 20, 20, 20, 12, 4];
  CW.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  let R = 0; // running row counter

  // ── Top green bar (2 rows) ────────────────────────────────────────────
  R++; ws.getRow(R).height = 10; fillRow(ws, R, HDR, N); mc(ws, R, 1, R, N, { fill: FL(HDR) });
  R++; ws.getRow(R).height = 10; fillRow(ws, R, HDR, N); mc(ws, R, 1, R, N, { fill: FL(HDR) });

  // ── Spacer ────────────────────────────────────────────────────────────
  R++; ws.getRow(R).height = 20;
  R++; ws.getRow(R).height = 10;

  // ── Client logo (big — 280x75 px with 80px row height) ───────────────
  R++; // row 5
  const logoRow = R;
  ws.getRow(R).height = 80;
  if (logos.clientLogoBuffer) {
    try {
      const imgId = wb.addImage({ buffer: logos.clientLogoBuffer, extension: logos.clientLogoExt || 'png' });
      ws.addImage(imgId, {
        tl: { col: 2.2, row: logoRow - 1 + 0.05 },
        ext: { width: 280, height: 75 },
        editAs: 'oneCell',
      });
    } catch { /* skip */ }
  }

  // ── Spacer below logo ─────────────────────────────────────────────────
  R++; ws.getRow(R).height = 10;

  // ── Company name (always visible — fallback when no logo) ─────────────
  R++; // row 7
  ws.getRow(R).height = 32;
  mc(ws, R, 2, R, 7, {
    value: data.company || data.customerName,
    font: F(true, 22, HDR),
    alignment: AL('center', 'middle'),
  });

  // ── Accent line ───────────────────────────────────────────────────────
  R++; ws.getRow(R).height = 4;
  for (let c = 3; c <= 6; c++) ws.getRow(R).getCell(c).fill = FL(ACCENT);

  // ── Spacer ────────────────────────────────────────────────────────────
  R++; ws.getRow(R).height = 12;

  // ── Report title ──────────────────────────────────────────────────────
  R++;
  ws.getRow(R).height = 28;
  mc(ws, R, 2, R, 7, {
    value: 'Fleet Compliance Report',
    font: F(true, 18, TEXT),
    alignment: AL('center', 'middle'),
  });

  // ── Spacer ────────────────────────────────────────────────────────────
  R++; ws.getRow(R).height = 8;

  // ── Report details (5 rows) ───────────────────────────────────────────
  const selectedSiteNames = opts.selectedSiteNames || [];
  const sitesLabel = selectedSiteNames.length > 0
    ? selectedSiteNames.join(', ')
    : 'All Sites';

  const now = new Date();
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const generatedDate = `${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  const details = [
    ['Prepared for', data.company || data.customerName],
    ['Reporting Period', data.period],
    ['Sites Included', sitesLabel],
    ['Generated on', generatedDate],
    ['Prepared by', 'ELORA'],
  ];

  details.forEach(([label, value]) => {
    R++;
    ws.getRow(R).height = 20;
    setCell(ws, R, 3, label, { font: F(true, 10, GREY), alignment: AL('right', 'middle') });
    setCell(ws, R, 4, value, { font: F(false, 10, TEXT), alignment: AL('left', 'middle') });
    ws.getRow(R).getCell(3).border = BD(true);
    ws.getRow(R).getCell(4).border = BD(true);
    ws.getRow(R).getCell(5).border = BD(true);
  });

  // ── Spacer ────────────────────────────────────────────────────────────
  R++; ws.getRow(R).height = 14;

  // ── At a Glance header ────────────────────────────────────────────────
  R++;
  ws.getRow(R).height = 22;
  mc(ws, R, 2, R, 7, {
    value: 'AT A GLANCE',
    font: F(true, 11, ACCENT),
    alignment: AL('center', 'middle'),
  });

  // ── KPI cards (2 per row, 2 rows) ─────────────────────────────────────
  R++; ws.getRow(R).height = 6; // small spacer

  const { kpis, hasCostData } = data;
  const kpiItems = [
    ['Total Vehicles', String(kpis.totalVehicles), KPI_BL],
    ['Compliance Rate', `${kpis.compRate}%`, kpis.compRate >= 80 ? COMP_G : kpis.compRate > 0 ? KPI_YL : FREQ_Z],
    ['Total Washes', String(kpis.totalWashes), KPI_BL],
    ['Total Program Cost', hasCostData ? `$${kpis.totalCost.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A', KPI_YL],
  ];

  for (let i = 0; i < kpiItems.length; i += 2) {
    R++;
    ws.getRow(R).height = 36;
    for (let j = 0; j < 2 && i + j < kpiItems.length; j++) {
      const [label, value, bg] = kpiItems[i + j];
      const colStart = j === 0 ? 3 : 6;
      setCell(ws, R, colStart, label, {
        font: F(false, 8, GREY), fill: FL(bg), alignment: AL('center', 'top'), border: BD(true),
      });
      setCell(ws, R, colStart + 1, value, {
        font: F(true, 16, HDR), fill: FL(bg), alignment: AL('center', 'middle'), border: BD(true),
      });
    }
  }

  // ── Spacer ────────────────────────────────────────────────────────────
  R++; ws.getRow(R).height = 14;

  // ── Report Contents header ────────────────────────────────────────────
  R++;
  ws.getRow(R).height = 22;
  mc(ws, R, 2, R, 7, {
    value: 'REPORT CONTENTS',
    font: F(true, 11, ACCENT),
    alignment: AL('center', 'middle'),
  });

  // ── Tab descriptions table ────────────────────────────────────────────
  const tabs = [
    ['Dashboard', 'KPIs, performance metrics, cost metrics, washes by site, and wash frequency distribution'],
    ['Site Summary', 'Per-site breakdown with vehicle count, washes, cost per truck, cost per wash, and compliance rate'],
    ['Vehicle Breakdown', 'Every vehicle listed with wash count, target, progress, compliance status, and last scan date'],
    ['Compliance Status', 'Compliant vehicles, at-risk vehicles (partial washes), and zero-wash vehicles with last known scan'],
  ];

  // Table header row
  R++;
  ws.getRow(R).height = 18;
  setCell(ws, R, 3, 'Tab', {
    font: F(true, 9, WHITE), fill: FL(HDR), alignment: AL('center', 'middle'), border: BD(true),
  });
  mc(ws, R, 4, R, 6, {
    value: 'Description',
    font: F(true, 9, WHITE), fill: FL(HDR), alignment: AL('left', 'middle'),
  });
  ws.getRow(R).getCell(4).border = BD(true);

  tabs.forEach(([tab, desc], i) => {
    R++;
    ws.getRow(R).height = 28;
    const bg = i % 2 === 0 ? BG_ALT : WHITE;
    setCell(ws, R, 3, tab, {
      font: F(true, 9, ACCENT), fill: FL(bg), alignment: AL('center', 'middle'), border: BD(true),
    });
    mc(ws, R, 4, R, 6, {
      value: desc,
      font: F(false, 8, GREY), fill: FL(bg), alignment: AL('left', 'middle', true),
    });
    ws.getRow(R).getCell(4).border = BD(true);
  });

  // ── Spacer ────────────────────────────────────────────────────────────
  R++; ws.getRow(R).height = 20;

  // ── Accent line ───────────────────────────────────────────────────────
  R++; ws.getRow(R).height = 8;
  for (let c = 3; c <= 6; c++) ws.getRow(R).getCell(c).fill = FL(ACCENT);

  // ── ELORA branding ────────────────────────────────────────────────────
  R++;
  ws.getRow(R).height = 30;
  if (logos.eloraLogoBuffer) {
    try {
      const imgId = wb.addImage({ buffer: logos.eloraLogoBuffer, extension: logos.eloraLogoExt || 'png' });
      ws.addImage(imgId, {
        tl: { col: 3.8, row: R - 1 + 0.05 },
        ext: { width: 24, height: 24 },
        editAs: 'oneCell',
      });
    } catch { /* skip */ }
  }
  mc(ws, R, 2, R, 7, {
    value: 'Powered by ELORA',
    font: F(true, 10, HDR),
    alignment: AL('center', 'middle'),
  });

  // ── Confidential ──────────────────────────────────────────────────────
  R++;
  ws.getRow(R).height = 14;
  mc(ws, R, 2, R, 7, {
    value: `Confidential - Prepared exclusively for ${data.company || data.customerName}`,
    font: F(false, 7, GREY_S),
    alignment: AL('center', 'middle'),
  });

  // ── Bottom green bar ──────────────────────────────────────────────────
  R++; ws.getRow(R).height = 10; fillRow(ws, R, HDR, N); mc(ws, R, 1, R, N, { fill: FL(HDR) });
  R++; ws.getRow(R).height = 10; fillRow(ws, R, HDR, N); mc(ws, R, 1, R, N, { fill: FL(HDR) });
}

// ── Main export function ─────────────────────────────────────────────────────

/**
 * Generate and download a branded Fleet Compliance Report .xlsx
 *
 * @param {Object} reportData - from buildReportData()
 * @param {Object} opts
 * @param {string} opts.clientLogoUrl  - URL to the customer's logo
 * @param {string} opts.eloraLogoUrl   - URL to the ELORA logo (/eloralogo.png)
 * @param {string} opts.filename       - optional custom filename
 * @param {string[]} opts.selectedSiteNames - site names selected (empty = all)
 */
export async function generateFleetReport(reportData, opts = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ELORA System';
  wb.created = new Date();

  // Fetch logos in parallel — each returns { buffer, extension } or null
  const [clientLogoResult, eloraLogoResult] = await Promise.all([
    fetchImageBuffer(opts.clientLogoUrl),
    fetchImageBuffer(opts.eloraLogoUrl || '/eloralogo.png'),
  ]);

  const logos = {
    clientLogoBuffer: clientLogoResult?.buffer || null,
    clientLogoExt: clientLogoResult?.extension || 'png',
    eloraLogoBuffer: eloraLogoResult?.buffer || null,
    eloraLogoExt: eloraLogoResult?.extension || 'png',
    customerName: reportData.customerName,
  };

  // Build 5 tabs — Welcome page first
  buildWelcomePage(wb, reportData, logos, {
    selectedSiteNames: opts.selectedSiteNames,
  });
  buildDashboard(wb, reportData, logos);
  buildSiteSummary(wb, reportData, logos);
  buildVehicleBreakdown(wb, reportData, logos);
  buildComplianceStatus(wb, reportData, logos);

  // Generate file
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  const filename = opts.filename || generateFilename({
    customerName: reportData.customerName,
    region: reportData.region,
    period: reportData.period,
    dateRange: opts.dateRange,
    selectedSiteNames: opts.selectedSiteNames,
  });
  saveAs(blob, filename);

  return { success: true, filename };
}

/**
 * Generate a descriptive filename.
 *
 * Examples:
 *  - All sites, full month:   "Heidelberg Materials - Melbourne Metro - February - Report.xlsx"
 *  - All sites, date range:   "ACM - March 9th - 16th - Report.xlsx"
 *  - Single site:             "Holcim - VIC - Epping - March - Report.xlsx"
 */
function generateFilename({ customerName, region, period, dateRange, selectedSiteNames }) {
  const parts = [];

  // Customer name
  parts.push(customerName || 'Report');

  // Region (if present)
  if (region) parts.push(region);

  // Site names (if specific sites selected)
  if (selectedSiteNames && selectedSiteNames.length > 0 && selectedSiteNames.length <= 2) {
    parts.push(selectedSiteNames.join(' & '));
  }

  // Date part — human-readable
  if (dateRange && dateRange.start && dateRange.end) {
    const s = new Date(dateRange.start);
    const e = new Date(dateRange.end);
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    const ordinal = (d) => {
      const n = d.getDate();
      const suf = ['th', 'st', 'nd', 'rd'];
      const v = n % 100;
      return n + (suf[(v - 20) % 10] || suf[v] || suf[0]);
    };

    if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
      // Same month
      if (s.getDate() === 1 && e.getDate() === new Date(e.getFullYear(), e.getMonth() + 1, 0).getDate()) {
        // Full month
        parts.push(months[s.getMonth()]);
      } else {
        // Partial month — "March 9th - 16th"
        parts.push(`${months[s.getMonth()]} ${ordinal(s)} - ${ordinal(e)}`);
      }
    } else {
      // Cross-month — "Feb 15th - Mar 10th"
      parts.push(`${months[s.getMonth()].slice(0, 3)} ${ordinal(s)} - ${months[e.getMonth()].slice(0, 3)} ${ordinal(e)}`);
    }
  } else if (period) {
    // Fallback to period string
    parts.push(period);
  }

  // Always end with "Report"
  parts.push('Report');

  const filename = parts.join(' - ') + '.xlsx';
  return filename;
}
