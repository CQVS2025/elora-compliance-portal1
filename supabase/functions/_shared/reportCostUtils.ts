/**
 * Server-side report cost calculation for scheduled client report emails.
 * Mirrors usageCostUtils.js logic so cron-built reports match the 2nd tab (Client Usage Cost Report).
 */

const PRICING_RULES: Record<string, { litres: number; pricePerLitre: number }> = {
  NSW: { litres: 2, pricePerLitre: 3.85 },
  VIC: { litres: 2, pricePerLitre: 3.85 },
  QLD: { litres: 4, pricePerLitre: 3.85 },
  GUNLAKE: { litres: 2, pricePerLitre: 3.95 },
  BORAL_QLD: { litres: 4, pricePerLitre: 3.65 },
};

const SITE_STATE_MAPPING: Record<string, string> = {
  'ACM - Clyde': 'VIC', 'ACM - Epping': 'VIC', 'ACM - Rockbank': 'VIC',
  'BORAL - QLD - Archerfield': 'QLD', 'BORAL - QLD - Beenleigh': 'QLD', 'BORAL - QLD - Benowa': 'QLD',
  'BORAL - QLD - Browns Plains': 'QLD', 'BORAL - QLD - Burleigh': 'QLD', 'BORAL - QLD - Caloundra': 'QLD',
  'BORAL - QLD - Capalaba': 'QLD', 'BORAL - QLD - Cleveland': 'QLD', 'BORAL - QLD - Everton Park': 'QLD',
  'BORAL - QLD - Geebung': 'QLD', 'BORAL - QLD - Ipswich': 'QLD', 'BORAL - QLD - Kingston': 'QLD',
  'BORAL - QLD - Labrador': 'QLD', 'BORAL - QLD - Morayfield': 'QLD', 'BORAL - QLD - Murarrie': 'QLD',
  'BORAL - QLD - Narangba': 'QLD', 'BORAL - QLD - Redbank Plains': 'QLD', 'BORAL - QLD - Southport': 'QLD',
  'BORAL - QLD - Wacol': 'QLD', 'CLEARY BROS - Albion Park': 'NSW', 'CLEARY BROS - Wollongong': 'NSW',
  'GUNLAKE - Banksmeadow': 'NSW', 'GUNLAKE - Glendenning': 'NSW', 'GUNLAKE - Prestons': 'NSW',
  'GUNLAKE - Silverwater': 'NSW', 'GUNLAKE - Smeaton Grange': 'NSW',
  'HEIDELBERG MATERIALS - Brooklyn': 'VIC', 'HEIDELBERG MATERIALS - Collingwood': 'VIC',
  'HOLCIM - Bayswater': 'VIC', 'HOLCIM - Footscray': 'VIC', 'HOLCIM - Laverton': 'VIC',
  'HOLCIM - Melbourne Airport': 'VIC', 'HOLCIM - Oaklands Junction': 'VIC', 'HOLCIM - Prestons': 'VIC',
  'HOLCIM - Camellia': 'NSW', 'HOLCIM - Lidcombe': 'NSW',
  'HYMIX - Rutherford': 'NSW', 'HYMIX - Steel River': 'NSW', 'HYMIX - Toronto': 'NSW',
  'NUCON - Burleigh': 'QLD', 'SUNMIX - Kingston': 'QLD', 'WANGERS - Pinkenba': 'QLD',
};

const CHEMICAL_MIN_CENTS = 50;
const CHEMICAL_MAX_CENTS = 2000;
const CUSTOMER_PRODUCT_KEYWORDS = ['BORAL', 'GUNLAKE', 'HOLCIM', 'HEIDELBERG'];

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function getStateFromSite(siteName: string, customerName = ''): string {
  if (!siteName) return 'NSW';
  if (SITE_STATE_MAPPING[siteName]) return SITE_STATE_MAPPING[siteName];
  const customerUpper = (customerName || '').toUpperCase();
  if (customerUpper.includes('BORAL') && customerUpper.includes('QLD')) return 'QLD';
  const siteUpper = siteName.toUpperCase();
  const qldSites = ['BURLEIGH', 'ARCHERFIELD', 'BEENLEIGH', 'BENOWA', 'BROWNS PLAINS', 'CALOUNDRA', 'CAPALABA', 'CLEVELAND', 'EVERTON PARK', 'GEEBUNG', 'IPSWICH', 'KINGSTON', 'LABRADOR', 'MORAYFIELD', 'MURARRIE', 'NARANGBA', 'REDBANK PLAINS', 'SOUTHPORT', 'WACOL'];
  if (qldSites.some((s) => siteUpper.includes(s))) return 'QLD';
  if (siteUpper.includes('QLD') || siteUpper.includes('BRISBANE') || siteUpper.includes('QUEENSLAND')) return 'QLD';
  if (siteUpper.includes('VIC') || siteUpper.includes('MELBOURNE') || siteUpper.includes('VICTORIA')) return 'VIC';
  if (siteUpper.includes('NSW') || siteUpper.includes('SYDNEY')) return 'NSW';
  return 'NSW';
}

function getPricingDetails(customerName: string, state: string): { litres: number; pricePerLitre: number } {
  if (!customerName) return PRICING_RULES[state] ?? PRICING_RULES.NSW;
  const customerUpper = customerName.toUpperCase();
  if (customerUpper.includes('GUNLAKE')) return PRICING_RULES.GUNLAKE;
  if (state === 'QLD' && customerUpper.includes('BORAL')) return PRICING_RULES.BORAL_QLD;
  return PRICING_RULES[state] ?? PRICING_RULES.NSW;
}

interface ProductRow {
  name?: string;
  price_cents?: number;
  status?: string;
}

function getPricePerLitreFromProducts(products: ProductRow[], customerName: string): number | null {
  if (!Array.isArray(products) || products.length === 0) return null;
  const chemicals = products.filter(
    (p) => (p.price_cents ?? 0) >= CHEMICAL_MIN_CENTS && (p.price_cents ?? 0) <= CHEMICAL_MAX_CENTS
  );
  if (chemicals.length === 0) return null;
  const custUpper = (customerName || '').toUpperCase();
  for (const kw of CUSTOMER_PRODUCT_KEYWORDS) {
    if (custUpper.includes(kw)) {
      const match = chemicals.find((p) => (p.name ?? '').toUpperCase().includes(kw));
      if (match) return (match.price_cents ?? 0) / 100;
    }
  }
  const ecsr = chemicals.find((p) => {
    const n = (p.name ?? '').toUpperCase();
    return n.includes('ECSR') && !CUSTOMER_PRODUCT_KEYWORDS.some((kw) => n.includes(kw));
  });
  if (ecsr) return (ecsr.price_cents ?? 0) / 100;
  return null;
}

interface TankConfigRow {
  calibration_rate_per_60s?: number;
  site_ref?: string | null;
  device_serial?: string | null;
  product_type?: string;
}

export function buildSitePricingMaps(
  tankConfigs: TankConfigRow[],
  products: ProductRow[]
): { byDeviceSerial: Record<string, { calibrationRate: number; siteRef: string | null; productType: string }>; bySiteRef: Record<string, { calibrationRate: number; productType: string }>; products: ProductRow[] } {
  const byDeviceSerial: Record<string, { calibrationRate: number; siteRef: string | null; productType: string }> = {};
  const bySiteRef: Record<string, { calibrationRate: number; productType: string }> = {};
  if (!Array.isArray(tankConfigs) || !Array.isArray(products)) {
    return { byDeviceSerial, bySiteRef, products: [] };
  }
  const shouldReplace = (
    existing: { productType: string } | undefined,
    incoming: { productType: string }
  ): boolean => {
    if (!existing) return true;
    if (incoming.productType === 'CONC' && existing.productType !== 'CONC') return true;
    return false;
  };
  tankConfigs.forEach((config) => {
    const rate = Number(config.calibration_rate_per_60s);
    if (!Number.isFinite(rate) || rate <= 0) return;
    const entry = {
      calibrationRate: rate,
      productType: (config.product_type ?? 'CONC') as string,
      siteRef: config.site_ref ?? null,
    };
    if (config.device_serial) {
      const key = String(config.device_serial);
      if (shouldReplace(byDeviceSerial[key], entry)) byDeviceSerial[key] = entry;
    }
    if (config.site_ref) {
      const key = config.site_ref.trim().toLowerCase();
      if (shouldReplace(bySiteRef[key], entry)) bySiteRef[key] = { calibrationRate: rate, productType: entry.productType };
    }
  });
  const chemicalProducts = products.filter(
    (p) => (p.price_cents ?? 0) >= CHEMICAL_MIN_CENTS && (p.price_cents ?? 0) <= CHEMICAL_MAX_CENTS
  );
  return { byDeviceSerial, bySiteRef, products: chemicalProducts };
}

interface VehicleRow {
  vehicleRef?: string;
  vehicle_ref?: string;
  ref?: string;
  vehicleRfid?: string;
  vehicle_rfid?: string;
  rfid?: string;
  washTime1Seconds?: number;
  wash_time_1_seconds?: number;
  washTime2Seconds?: number;
  wash_time_2_seconds?: number;
}

export function buildVehicleWashTimeMaps(vehicles: VehicleRow[]): { byRef: Record<string, number>; byRfid: Record<string, number> } {
  const byRef: Record<string, number> = {};
  const byRfid: Record<string, number> = {};
  if (!Array.isArray(vehicles)) return { byRef, byRfid };
  vehicles.forEach((v) => {
    const ref = v.vehicleRef ?? v.vehicle_ref ?? v.ref ?? null;
    const rfid = v.vehicleRfid ?? v.vehicle_rfid ?? v.rfid ?? null;
    const sec1 = typeof v.washTime1Seconds === 'number' ? v.washTime1Seconds : Number(v.washTime1Seconds ?? v.wash_time_1_seconds);
    const sec2 = typeof v.washTime2Seconds === 'number' ? v.washTime2Seconds : Number(v.washTime2Seconds ?? v.wash_time_2_seconds);
    const sec = Number.isFinite(sec1) && sec1 > 0 ? sec1 : Number.isFinite(sec2) && sec2 > 0 ? sec2 : NaN;
    if (!Number.isFinite(sec) || sec <= 0) return;
    if (ref) byRef[String(ref)] = sec;
    if (rfid) byRfid[String(rfid)] = sec;
  });
  return { byRef, byRfid };
}

function getWashTimeSecondsFromScan(scan: Record<string, unknown>): number {
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

function getEntitlementWashTimeSeconds(
  scan: Record<string, unknown>,
  byRef: Record<string, number>,
  byRfid: Record<string, number>
): { washTimeSeconds: number; configFound: boolean } {
  const ref = (scan.vehicleRef ?? scan.vehicle_ref ?? null) as string | null;
  const rfid = (scan.rfid ?? scan.vehicleRfid ?? scan.vehicle_rfid ?? null) as string | null;
  if (ref && byRef[String(ref)] != null) {
    const sec = Number(byRef[String(ref)]);
    if (Number.isFinite(sec) && sec > 0) return { washTimeSeconds: sec, configFound: true };
  }
  if (rfid && byRfid[String(rfid)] != null) {
    const sec = Number(byRfid[String(rfid)]);
    if (Number.isFinite(sec) && sec > 0) return { washTimeSeconds: sec, configFound: true };
  }
  return { washTimeSeconds: getWashTimeSecondsFromScan(scan), configFound: false };
}

export function isBillableScan(scan: Record<string, unknown>): boolean {
  const status = String(scan.statusLabel ?? scan.status ?? '').trim().toLowerCase();
  const rfid = String(scan.rfid ?? '').trim().toLowerCase();
  if (status === 'auto') return false;
  if (rfid === 'auto') return false;
  return status === 'success' || status === 'exceeded';
}

interface CostResult {
  cost: number;
  configMissing: boolean;
}

export function calculateScanCostFromScan(
  scan: Record<string, unknown>,
  entitlementMaps: { byRef: Record<string, number>; byRfid: Record<string, number> } | null,
  sitePricingMaps: ReturnType<typeof buildSitePricingMaps> | null
): CostResult & { litresUsed?: number; state?: string; pricePerLitre?: number; litresPerMinute?: number; washTimeSeconds?: number; pricingSource?: string } {
  if (!scan) {
    return { cost: 0, configMissing: false };
  }
  const customerName = String(scan.customerName ?? scan.customer_name ?? '');
  const siteName = String(scan.siteName ?? scan.site_name ?? '');
  const state = getStateFromSite(siteName, customerName);
  const fallbackPricing = getPricingDetails(customerName, state);

  let washTimeSeconds: number;
  let configMissing = false;

  if (entitlementMaps && (Object.keys(entitlementMaps.byRef).length > 0 || Object.keys(entitlementMaps.byRfid).length > 0)) {
    const { washTimeSeconds: sec, configFound } = getEntitlementWashTimeSeconds(scan, entitlementMaps.byRef, entitlementMaps.byRfid);
    washTimeSeconds = sec;
    if (!configFound) {
      configMissing = true;
      return { cost: 0, configMissing: true };
    }
  } else {
    washTimeSeconds = getWashTimeSecondsFromScan(scan);
  }

  let calibrationRate: number | null = null;
  if (sitePricingMaps) {
    const deviceSerial = (scan.deviceSerial ?? scan.device_serial ?? null) as string | null;
    const siteNameKey = siteName.trim().toLowerCase();
    if (deviceSerial && sitePricingMaps.byDeviceSerial[String(deviceSerial)]) {
      calibrationRate = sitePricingMaps.byDeviceSerial[String(deviceSerial)].calibrationRate;
    }
    if (calibrationRate == null && siteNameKey && sitePricingMaps.bySiteRef[siteNameKey]) {
      calibrationRate = sitePricingMaps.bySiteRef[siteNameKey].calibrationRate;
    }
  }
  if (calibrationRate == null) calibrationRate = fallbackPricing.litres;

  let pricePerLitre: number | null = null;
  if (sitePricingMaps?.products?.length) {
    pricePerLitre = getPricePerLitreFromProducts(sitePricingMaps.products, customerName);
  }
  if (pricePerLitre == null) pricePerLitre = fallbackPricing.pricePerLitre;

  const litresUsed = (washTimeSeconds / 60) * calibrationRate;
  const cost = litresUsed * pricePerLitre;
  return { cost, configMissing: false, litresUsed, state, pricePerLitre, litresPerMinute: calibrationRate, washTimeSeconds };
}

export interface ReportData {
  totalFleetSize: number;
  activeSites: number;
  totalWashes: number;
  totalProgramCost: number;
  avgCostPerTruck: number;
  avgCostPerWash: number;
  complianceRate: number | null;
}

interface ScanRow {
  customerRef?: string;
  customer_ref?: string;
  siteRef?: string;
  site_ref?: string;
  vehicleRef?: string;
  vehicle_ref?: string;
  statusLabel?: string;
  status?: string;
  [key: string]: unknown;
}

export function computeReportData(
  scans: ScanRow[],
  vehicles: VehicleRow[],
  tankConfigs: TankConfigRow[],
  products: ProductRow[]
): ReportData {
  const entitlementMaps = buildVehicleWashTimeMaps(vehicles);
  const sitePricingMaps = buildSitePricingMaps(tankConfigs, products);
  const billableScans = scans.filter((s) => isBillableScan(s as Record<string, unknown>));

  if (!billableScans.length) {
    const fleetSize = vehicles.length;
    const uniqueSites = new Set(vehicles.map((v) => (v as Record<string, unknown>).siteRef ?? (v as Record<string, unknown>).site_ref).filter(Boolean));
    return {
      totalFleetSize: fleetSize,
      activeSites: uniqueSites.size || 1,
      totalWashes: 0,
      totalProgramCost: 0,
      avgCostPerTruck: 0,
      avgCostPerWash: 0,
      complianceRate: null,
    };
  }

  let totalCost = 0;
  let successCount = 0;
  const vehicleKeys = new Set<string>();
  const siteRefs = new Set<string>();

  for (const scan of billableScans) {
    const pricing = calculateScanCostFromScan(scan as Record<string, unknown>, entitlementMaps, sitePricingMaps);
    if (pricing.configMissing) continue;
    totalCost += pricing.cost;
    const status = String(scan.statusLabel ?? scan.status ?? '').trim().toLowerCase();
    if (status === 'success') successCount++;
    const key = `${scan.customerRef ?? scan.customer_ref ?? ''}_${scan.siteRef ?? scan.site_ref ?? ''}_${scan.vehicleRef ?? scan.vehicle_ref ?? ''}`.replace(/undefined/g, '');
    if (key) vehicleKeys.add(key);
    if (scan.siteRef ?? scan.site_ref) siteRefs.add(String(scan.siteRef ?? scan.site_ref));
  }

  const totalWashes = billableScans.length;
  const fleetSize = vehicleKeys.size || vehicles.length;
  const activeSites = siteRefs.size || 1;
  const totalProgramCost = round2(totalCost);
  const avgCostPerTruck = fleetSize > 0 ? round2(totalProgramCost / fleetSize) : 0;
  const avgCostPerWash = totalWashes > 0 ? round2(totalProgramCost / totalWashes) : 0;
  const complianceRate = totalWashes > 0 ? Math.round((successCount / totalWashes) * 100) : null;

  return {
    totalFleetSize: fleetSize,
    activeSites,
    totalWashes,
    totalProgramCost,
    avgCostPerTruck,
    avgCostPerWash,
    complianceRate,
  };
}
