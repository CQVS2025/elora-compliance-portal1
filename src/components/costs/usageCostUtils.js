/**
 * usageCostUtils.js
 *
 * Pricing hierarchy (highest → lowest priority):
 *
 *  1. DB – tank_configurations  : calibration_rate_per_60s per device/site  (actual hardware)
 *  2. DB – products              : price_cents per chemical product          (actual invoiced rate)
 *  3. PRICING_RULES (fallback)   : hard-coded regional defaults              (kept for sites not yet in DB)
 *
 * Call buildSitePricingMaps(tankConfigs, products) once per component render
 * (from pricingConfigOptions query), then pass the result to calculateScanCostFromScan
 * as the third argument.  When sitePricingMaps is null the function behaves exactly
 * as before (100% backward compatible).
 */

// ---------------------------------------------------------------------------
// Fallback hard-coded rules (used only when DB data is unavailable for a site)
// ---------------------------------------------------------------------------
export const PRICING_RULES = {
  NSW: { litres: 2, pricePerLitre: 3.85 },
  VIC: { litres: 2, pricePerLitre: 3.85 },
  QLD: { litres: 4, pricePerLitre: 3.85 },
  GUNLAKE: { litres: 2, pricePerLitre: 3.95 },
  BORAL_QLD: { litres: 4, pricePerLitre: 3.65 },
};

export const SITE_STATE_MAPPING = {
  'ACM - Clyde': 'VIC', 'ACM - Epping': 'VIC', 'ACM - Rockbank': 'VIC',
  'BORAL - QLD - Archerfield': 'QLD', 'BORAL - QLD - Beenleigh': 'QLD', 'BORAL - QLD - Benowa': 'QLD',
  'BORAL - QLD - Browns Plains': 'QLD', 'BORAL - QLD - Burleigh': 'QLD', 'BORAL - QLD - Caloundra': 'QLD',
  'BORAL - QLD - Capalaba': 'QLD', 'BORAL - QLD - Cleveland': 'QLD', 'BORAL - QLD - Everton Park': 'QLD',
  'BORAL - QLD - Geebung': 'QLD', 'BORAL - QLD - Ipswich': 'QLD', 'BORAL - QLD - Kingston': 'QLD',
  'BORAL - QLD - Labrador': 'QLD', 'BORAL - QLD - Morayfield': 'QLD', 'BORAL - QLD - Murarrie': 'QLD',
  'BORAL - QLD - Narangba': 'QLD', 'BORAL - QLD - Redbank Plains': 'QLD', 'BORAL - QLD - Southport': 'QLD',
  'BORAL - QLD - Wacol': 'QLD', 'CLEARY BROS - Albion Park': 'NSW', 'CLEARY BROS - Wollongong': 'NSW',
  'EASY MIX - Berkley Vale': 'NSW', 'Environex': 'QLD',
  'GUNLAKE - Banksmeadow': 'NSW', 'GUNLAKE - Glendenning': 'NSW', 'GUNLAKE - Prestons': 'NSW',
  'GUNLAKE - Silverwater': 'NSW', 'GUNLAKE - Smeaton Grange': 'NSW',
  'HEIDELBERG MATERIALS - Brooklyn': 'VIC', 'HEIDELBERG MATERIALS - Collingwood': 'VIC',
  'HEIDELBERG MATERIALS - Croydon': 'VIC', 'HEIDELBERG MATERIALS - Dandenong': 'VIC',
  'HEIDELBERG MATERIALS - Dromana': 'VIC', 'HEIDELBERG MATERIALS - Epping': 'VIC',
  'HEIDELBERG MATERIALS - Frankston': 'VIC', 'HEIDELBERG MATERIALS - Geelong': 'VIC',
  'HEIDELBERG MATERIALS - Lysterfield': 'VIC', 'HEIDELBERG MATERIALS - Melton': 'VIC',
  'HEIDELBERG MATERIALS - Port Melbourne': 'VIC', 'HEIDELBERG MATERIALS - Somerton': 'VIC',
  'HEIDELBERG MATERIALS - Sunbury': 'VIC', 'HEIDELBERG MATERIALS - Weriribee': 'VIC',
  'HEIDELBERG MATERIALS - Westall': 'VIC', 'HEIDELBERG MATERIALS - Wollert': 'VIC',
  'HEIDELBERG MATERIALS - NSW - Artarmon': 'NSW', 'HEIDELBERG MATERIALS - NSW - Banksmeadow': 'NSW',
  'HEIDELBERG MATERIALS - NSW - Caringbah': 'NSW', 'HEIDELBERG MATERIALS - NSW - Greenacre': 'NSW',
  'HEIDELBERG MATERIALS - NSW - Pendle Hill': 'NSW', 'HEIDELBERG MATERIALS - NSW - Prestons': 'NSW',
  'HEIDELBERG MATERIALS - NSW - Thornleigh': 'NSW',
  'HOLCIM - Bayswater': 'VIC', 'HOLCIM - Footscray': 'VIC', 'HOLCIM - Laverton': 'VIC',
  'HOLCIM - Melbourne Airport': 'VIC', 'HOLCIM - Oaklands Junction': 'VIC', 'HOLCIM - Prestons': 'VIC',
  'HOLCIM - Camellia': 'NSW', 'HOLCIM - Lidcombe': 'NSW',
  'HUNTER READY MIX - Cessnock': 'NSW', 'HUNTER READY MIX - Gateshead': 'NSW', 'HUNTER READY MIX - Thornton': 'NSW',
  'HYMIX - Belmont': 'NSW', 'HYMIX - Berkley Vale': 'NSW', 'HYMIX - Kincumber': 'NSW',
  'HYMIX - Rutherford': 'NSW', 'HYMIX - Steel River': 'NSW', 'HYMIX - Toronto': 'NSW',
  'MAITLAND READY MIX - Maitland': 'NSW', 'NUCON - Burleigh': 'QLD',
  'REDIMIX - Rockhampton': 'QLD', 'REDIMIX - Tamworth': 'NSW',
  'SUNMIX - Beaudesert': 'QLD', 'SUNMIX - Kingston': 'QLD', 'SUNMIX - Swanbank': 'QLD',
  'WANGERS - Pinkenba': 'QLD', 'WANGERS - Toowoomba': 'QLD',
};

export function getStateFromSite(siteName, customerName = '') {
  if (!siteName) return 'NSW';
  if (SITE_STATE_MAPPING[siteName]) return SITE_STATE_MAPPING[siteName];
  const customerUpper = (customerName || '').toUpperCase();
  if (customerUpper.includes('BORAL') && customerUpper.includes('QLD')) return 'QLD';
  const siteUpper = siteName.toUpperCase();
  const qldSites = ['BURLEIGH', 'ARCHERFIELD', 'BEENLEIGH', 'BENOWA', 'BROWNS PLAINS', 'CALOUNDRA', 'CAPALABA', 'CLEVELAND', 'EVERTON PARK', 'GEEBUNG', 'IPSWICH', 'KINGSTON', 'LABRADOR', 'MORAYFIELD', 'MURARRIE', 'NARANGBA', 'REDBANK PLAINS', 'SOUTHPORT', 'WACOL'];
  if (qldSites.some(site => siteUpper.includes(site))) return 'QLD';
  if (siteUpper.includes('QLD') || siteUpper.includes('BRISBANE') || siteUpper.includes('QUEENSLAND')) return 'QLD';
  if (siteUpper.includes('VIC') || siteUpper.includes('MELBOURNE') || siteUpper.includes('VICTORIA')) return 'VIC';
  if (siteUpper.includes('NSW') || siteUpper.includes('SYDNEY')) return 'NSW';
  return 'NSW';
}

export function calculateCostPerScan(customerName, state, washTimeSeconds) {
  const pricing = PRICING_RULES[state] ?? PRICING_RULES.NSW;
  if (!pricing) return 0;
  const washTimeSec = typeof washTimeSeconds === 'number' && washTimeSeconds > 0 ? washTimeSeconds : 60;
  const litresPerMinute = pricing.litres;
  const litresUsed = (washTimeSec / 60) * litresPerMinute;
  if (!customerName) return litresUsed * pricing.pricePerLitre;
  const customerUpper = customerName.toUpperCase();
  if (customerUpper.includes('GUNLAKE')) {
    const rule = PRICING_RULES.GUNLAKE;
    return ((washTimeSec / 60) * rule.litres) * rule.pricePerLitre;
  }
  if (state === 'QLD' && customerUpper.includes('BORAL')) {
    const rule = PRICING_RULES.BORAL_QLD;
    return ((washTimeSec / 60) * rule.litres) * rule.pricePerLitre;
  }
  return ((washTimeSec / 60) * pricing.litres) * pricing.pricePerLitre;
}

export function getPricingDetails(customerName, state) {
  if (!customerName) return PRICING_RULES[state] ?? PRICING_RULES.NSW;
  const customerUpper = customerName.toUpperCase();
  if (customerUpper.includes('GUNLAKE')) return PRICING_RULES.GUNLAKE;
  if (state === 'QLD' && customerUpper.includes('BORAL')) return PRICING_RULES.BORAL_QLD;
  return PRICING_RULES[state] ?? PRICING_RULES.NSW;
}

// ---------------------------------------------------------------------------
// DB-driven pricing maps (built once from pricingConfigOptions)
// ---------------------------------------------------------------------------

/**
 * Price range for chemical wash products in the products table.
 * Excludes hardware items (e.g. $1,400 spill bunds) and $0 application systems.
 * Chemical products are all between $0.50/L and $20/L.
 */
const CHEMICAL_MIN_CENTS = 50;
const CHEMICAL_MAX_CENTS = 2000;

/**
 * Priority order for customer-specific product matching.
 * Each entry: { keyword in customer name → keyword to find in product name }
 * Tried in order; first match wins.
 */
const CUSTOMER_PRODUCT_KEYWORDS = [
  'BORAL',
  'GUNLAKE',
  'HOLCIM',
  'HEIDELBERG',
];

/**
 * Resolve price per litre for a customer from the products table.
 *
 * Strategy:
 *  1. If customerName contains a known keyword (BORAL, GUNLAKE …), find the
 *     product whose name also contains that keyword.
 *  2. Otherwise fall back to the generic ECSR product (non-customer-specific).
 *  3. If nothing matches, return null → caller uses PRICING_RULES fallback.
 *
 * @param {Array} products  - from pricingConfigOptions (products table rows)
 * @param {string} customerName
 * @returns {number|null}  price per litre, or null when no match found
 */
export function getPricePerLitreFromProducts(products, customerName) {
  if (!Array.isArray(products) || products.length === 0) return null;

  const chemicals = products.filter(
    (p) => p.price_cents >= CHEMICAL_MIN_CENTS && p.price_cents <= CHEMICAL_MAX_CENTS,
  );
  if (chemicals.length === 0) return null;

  const custUpper = (customerName || '').toUpperCase();

  // Customer-specific product (e.g. "ECSR - BORAL", "GAR - GUNLAKE")
  for (const kw of CUSTOMER_PRODUCT_KEYWORDS) {
    if (custUpper.includes(kw)) {
      const match = chemicals.find((p) => p.name.toUpperCase().includes(kw));
      if (match) return match.price_cents / 100;
    }
  }

  // Generic ECSR product (non-customer-specific)
  const ecsr = chemicals.find((p) => {
    const n = p.name.toUpperCase();
    return n.includes('ECSR') && !CUSTOMER_PRODUCT_KEYWORDS.some((kw) => n.includes(kw));
  });
  if (ecsr) return ecsr.price_cents / 100;

  return null;
}

/**
 * Build lookup maps from pricingConfigOptions data (tank_configurations + products).
 *
 * Returns an object used as the `sitePricingMaps` argument to calculateScanCostFromScan.
 *
 * Shape:
 *  {
 *    byDeviceSerial : Record<string, { calibrationRate, siteRef, productType }>
 *    bySiteRef      : Record<string, { calibrationRate, productType }>   (normalised lowercase key)
 *    products       : Array of chemical product rows (for price lookup)
 *  }
 *
 * Priority when a site has multiple tanks (CONC vs FOAM/TW/GEL):
 *  - CONC tank is preferred as it represents the main concrete-safe-remover wash.
 *  - If no CONC tank exists, the first active tank for that device/site is used.
 *
 * @param {Array} tankConfigs  - from tank_configurations table
 * @param {Array} products     - from products table
 * @returns {{ byDeviceSerial: object, bySiteRef: object, products: Array }}
 */
export function buildSitePricingMaps(tankConfigs, products) {
  if (!Array.isArray(tankConfigs) || !Array.isArray(products)) {
    return { byDeviceSerial: {}, bySiteRef: {}, products: [] };
  }

  const byDeviceSerial = {};
  const bySiteRef = {};

  const shouldReplace = (existing, incoming) => {
    if (!existing) return true;
    // CONC tank is the primary wash product; prefer it over FOAM/TW/GEL
    if (incoming.productType === 'CONC' && existing.productType !== 'CONC') return true;
    return false;
  };

  tankConfigs.forEach((config) => {
    const rate = Number(config.calibration_rate_per_60s);
    if (!Number.isFinite(rate) || rate <= 0) return;

    const entry = {
      calibrationRate: rate,
      productType: config.product_type ?? 'CONC',
      siteRef: config.site_ref ?? null,
    };

    if (config.device_serial) {
      const key = String(config.device_serial);
      if (shouldReplace(byDeviceSerial[key], entry)) {
        byDeviceSerial[key] = entry;
      }
    }

    if (config.site_ref) {
      const key = config.site_ref.trim().toLowerCase();
      if (shouldReplace(bySiteRef[key], entry)) {
        bySiteRef[key] = entry;
      }
    }
  });

  const chemicalProducts = products.filter(
    (p) => p.price_cents >= CHEMICAL_MIN_CENTS && p.price_cents <= CHEMICAL_MAX_CENTS,
  );

  return { byDeviceSerial, bySiteRef, products: chemicalProducts };
}

// ---------------------------------------------------------------------------
// Existing helpers (unchanged)
// ---------------------------------------------------------------------------

export function getWashTimeSecondsFromScan(scan) {
  if (!scan) return 60;
  const raw =
    scan.washTime !== undefined && scan.washTime !== null
      ? Number(scan.washTime)
      : scan.wash_time !== undefined && scan.wash_time !== null
        ? Number(scan.wash_time)
        : scan.washTimeSeconds !== undefined && scan.washTimeSeconds !== null
          ? Number(scan.washTimeSeconds)
          : NaN;
  if (Number.isFinite(raw) && raw > 0) return raw;
  return 60;
}

export function buildVehicleWashTimeMaps(vehicles) {
  const byRef = {};
  const byRfid = {};
  if (!Array.isArray(vehicles)) return { byRef, byRfid };
  vehicles.forEach((v) => {
    const ref = v.vehicleRef ?? v.vehicle_ref ?? v.ref ?? null;
    const rfid = v.vehicleRfid ?? v.vehicle_rfid ?? v.rfid ?? null;
    const sec1 =
      typeof v.washTime1Seconds === 'number'
        ? v.washTime1Seconds
        : typeof v.wash_time_1_seconds === 'number'
          ? v.wash_time_1_seconds
          : Number(v.washTime1Seconds ?? v.wash_time_1_seconds);
    const sec2 =
      typeof v.washTime2Seconds === 'number'
        ? v.washTime2Seconds
        : typeof v.wash_time_2_seconds === 'number'
          ? v.wash_time_2_seconds
          : Number(v.washTime2Seconds ?? v.wash_time_2_seconds);
    const sec = Number.isFinite(sec1) && sec1 > 0 ? sec1 : (Number.isFinite(sec2) && sec2 > 0 ? sec2 : NaN);
    if (!Number.isFinite(sec) || sec <= 0) return;
    if (ref) byRef[String(ref)] = sec;
    if (rfid) byRfid[String(rfid)] = sec;
  });
  return { byRef, byRfid };
}

export function getEntitlementWashTimeSeconds(scan, byRef, byRfid) {
  if (!scan) return { washTimeSeconds: 60, configFound: false };
  const ref = scan.vehicleRef ?? scan.vehicle_ref ?? null;
  const rfid = scan.rfid ?? scan.vehicleRfid ?? scan.vehicle_rfid ?? null;
  if (ref && byRef && byRef[String(ref)] != null) {
    const sec = Number(byRef[String(ref)]);
    if (Number.isFinite(sec) && sec > 0) return { washTimeSeconds: sec, configFound: true };
  }
  if (rfid && byRfid && byRfid[String(rfid)] != null) {
    const sec = Number(byRfid[String(rfid)]);
    if (Number.isFinite(sec) && sec > 0) return { washTimeSeconds: sec, configFound: true };
  }
  const fromScan = getWashTimeSecondsFromScan(scan);
  return { washTimeSeconds: fromScan, configFound: false };
}

export function isBillableScan(scan) {
  if (!scan) return false;
  const status = (scan.statusLabel ?? scan.status ?? '').toString().trim().toLowerCase();
  const rfid = (scan.rfid ?? '').toString().trim().toLowerCase();
  if (status === 'auto') return false;
  if (rfid === 'auto') return false;
  return status === 'success' || status === 'exceeded';
}

// ---------------------------------------------------------------------------
// Core cost calculation — now DB-driven when sitePricingMaps is supplied
// ---------------------------------------------------------------------------

/**
 * Calculate cost and litres for a single scan.
 *
 * Parameters
 * ----------
 * scan            – ACATC scan row (must have customerName, siteName, deviceSerial)
 * entitlementMaps – from buildVehicleWashTimeMaps(vehicles); controls wash time per vehicle
 * sitePricingMaps – from buildSitePricingMaps(tankConfigs, products); controls flow rate + price
 *
 * Resolution order
 * ----------------
 * Wash time  : vehicle config (entitlementMaps) → scan.washTime → 60s default
 * Flow rate  : tank_configurations by deviceSerial → by siteName → PRICING_RULES fallback
 * Price / L  : products table by customer keyword → PRICING_RULES fallback
 *
 * Backward compatible: passing null for both extra params reproduces the old behaviour exactly.
 *
 * @returns {{ cost, litresUsed, state, pricePerLitre, litresPerMinute, washTimeSeconds,
 *             configMissing, pricingSource }}
 *   pricingSource: 'db' | 'fallback' — indicates whether DB data was used
 */
export function calculateScanCostFromScan(scan, entitlementMaps = null, sitePricingMaps = null) {
  if (!scan) {
    return {
      cost: 0,
      litresUsed: 0,
      state: 'NSW',
      pricePerLitre: PRICING_RULES.NSW.pricePerLitre,
      litresPerMinute: PRICING_RULES.NSW.litres,
      washTimeSeconds: 60,
      configMissing: false,
      pricingSource: 'fallback',
    };
  }

  const customerName = scan.customerName ?? scan.customer_name ?? '';
  const siteName = scan.siteName ?? scan.site_name ?? '';
  const state = getStateFromSite(siteName, customerName);
  const fallbackPricing = getPricingDetails(customerName, state);

  // ── Wash time (unchanged logic) ──────────────────────────────────────────
  let washTimeSeconds;
  let configMissing = false;

  if (entitlementMaps && (entitlementMaps.byRef || entitlementMaps.byRfid)) {
    const { washTimeSeconds: sec, configFound } = getEntitlementWashTimeSeconds(
      scan,
      entitlementMaps.byRef,
      entitlementMaps.byRfid,
    );
    washTimeSeconds = sec;
    if (!configFound) {
      configMissing = true;
      return {
        cost: 0,
        litresUsed: 0,
        state,
        pricePerLitre: fallbackPricing.pricePerLitre,
        litresPerMinute: fallbackPricing.litres,
        washTimeSeconds: 60,
        configMissing: true,
        pricingSource: 'fallback',
      };
    }
  } else {
    washTimeSeconds = getWashTimeSecondsFromScan(scan);
  }

  // ── Flow rate: DB (tank_configurations) → PRICING_RULES fallback ─────────
  let calibrationRate = null;
  let calibrationSource = 'fallback';

  if (sitePricingMaps) {
    const deviceSerial = scan.deviceSerial ?? scan.device_serial ?? null;
    const siteNameKey = siteName.trim().toLowerCase();

    if (deviceSerial) {
      const entry = sitePricingMaps.byDeviceSerial[String(deviceSerial)];
      if (entry) {
        calibrationRate = entry.calibrationRate;
        calibrationSource = 'db';
      }
    }

    if (calibrationRate == null && siteNameKey) {
      const entry = sitePricingMaps.bySiteRef[siteNameKey];
      if (entry) {
        calibrationRate = entry.calibrationRate;
        calibrationSource = 'db';
      }
    }
  }

  if (calibrationRate == null) {
    calibrationRate = fallbackPricing.litres;
  }

  // ── Price per litre: DB (products) → PRICING_RULES fallback ─────────────
  let pricePerLitre = null;
  let priceSource = 'fallback';

  if (sitePricingMaps?.products?.length) {
    const fromDB = getPricePerLitreFromProducts(sitePricingMaps.products, customerName);
    if (fromDB != null) {
      pricePerLitre = fromDB;
      priceSource = 'db';
    }
  }

  if (pricePerLitre == null) {
    pricePerLitre = fallbackPricing.pricePerLitre;
  }

  // ── Cost calculation ─────────────────────────────────────────────────────
  const litresUsed = (washTimeSeconds / 60) * calibrationRate;
  const cost = litresUsed * pricePerLitre;
  const pricingSource = calibrationSource === 'db' || priceSource === 'db' ? 'db' : 'fallback';

  return {
    cost,
    litresUsed,
    state,
    pricePerLitre,
    litresPerMinute: calibrationRate,
    washTimeSeconds,
    configMissing: false,
    pricingSource,
  };
}

// ---------------------------------------------------------------------------
// Remaining shared utilities (unchanged)
// ---------------------------------------------------------------------------

export const WEEKS_PER_MONTH = 52 / 12;

export function round2(n) {
  return Math.round(n * 100) / 100;
}

export function calcFromParams(washTimeSec, washesPerDay, washesPerWeek, dispensingRate, pricePerLitre, truckCount) {
  const litresPerWash = (washTimeSec / 60) * dispensingRate;
  const maxLitresPerWeekPerTruck = litresPerWash * washesPerWeek;
  const maxLitresPerMonthPerTruck = maxLitresPerWeekPerTruck * WEEKS_PER_MONTH;
  const maxCostPerMonthPerTruck = maxLitresPerMonthPerTruck * pricePerLitre;
  const maxCostPerMonthSite = maxCostPerMonthPerTruck * (truckCount || 1);
  const maxCostPerYearSite = maxCostPerMonthSite * 12;
  return {
    litresPerWash: round2(litresPerWash),
    maxLitresPerWeekPerTruck: round2(maxLitresPerWeekPerTruck),
    maxLitresPerMonthPerTruck: round2(maxLitresPerMonthPerTruck),
    maxCostPerMonthPerTruck: round2(maxCostPerMonthPerTruck),
    maxCostPerMonthSite: round2(maxCostPerMonthSite),
    maxCostPerYearSite: round2(maxCostPerYearSite),
  };
}

export const VS_EXPECTED_NORMAL_THRESHOLD = 15;

export function getVsExpectedLabel(vehicleCost, fleetAvgCost) {
  if (!fleetAvgCost || fleetAvgCost === 0) return { label: 'Normal', variant: 'normal' };
  const pct = ((vehicleCost - fleetAvgCost) / fleetAvgCost) * 100;
  if (pct >= VS_EXPECTED_NORMAL_THRESHOLD) return { label: `+${Math.round(pct)}% Over`, variant: 'over' };
  if (pct <= -VS_EXPECTED_NORMAL_THRESHOLD) return { label: `${Math.round(pct)}% Under`, variant: 'under' };
  return { label: 'Normal', variant: 'normal' };
}
