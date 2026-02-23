import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { callEdgeFunction } from '@/lib/supabase';
import { getEloraTenantContext } from '@/lib/eloraTenantContext';
import { queryKeys } from '../keys';

/**
 * Tank Levels Query Options
 *
 * Implements the live "tank level / remaining chemical" indicator per site + product tank (client spec).
 *
 * Objective: "Since the last delivered/confirmed refill, how much product has been used, and how much should be left in the tank right now?"
 *
 * Data flow:
 * - Tank config (DB): product type, max capacity, calibration (L/60s), thresholds, device_ref/serial (serial from CMS).
 * - Refills API: status Delivered/Confirmed only; latest per site+product = baseline; start level = new_total_litres when available, else max_capacity.
 * - Scans API: all wash events; filter scan.created_at >= last_refill_datetime; match to tank by device (device_ref so Foam vs Truck Wash correct).
 * - Consumption: liters_used_per_scan = calibration_rate_per_60s * (wash_time_seconds / 60). Wash time required; missing → 0 and flag.
 * - Remaining = start_level - sum(consumption); clamp [0, max_capacity]; remaining_percent = (remaining / max_capacity) * 100; status from thresholds.
 * - No user date range in UI; internally filter scans from last refill → now.
 */

const UNKNOWN_LOCATION = 'Unknown Location';

/** Normalize site name for comparison (trim, lower case). */
function normalizeSiteName(name) {
  if (name == null || typeof name !== 'string') return '';
  return name.trim().toLowerCase();
}

/**
 * Normalize site location for display. API may return undefined, "undefined, undefined",
 * or use camelCase/snake_case (suburb, stateShort vs state_short). Returns a safe string.
 */
function formatSiteLocation(site) {
  if (!site) return UNKNOWN_LOCATION;
  
  // Check if location field exists and is valid
  const loc = site.location;
  const valid = loc && 
    typeof loc === 'string' && 
    loc !== 'undefined' && 
    loc !== 'null' &&
    !/^(undefined|null),?\s*(undefined|null)$/i.test(loc);
  if (valid) return loc;
  
  // Try to build from suburb and state, filtering out invalid values
  const isValidString = (val) => val && 
    typeof val === 'string' && 
    val !== 'undefined' && 
    val !== 'null' && 
    val.trim() !== '';
  
  const suburb = site.suburb ?? site.addr_suburb ?? site.addressSuburb ?? '';
  const state = site.stateShort ?? site.state_short ?? site.addr_state_short ?? site.state ?? '';
  
  const validSuburb = isValidString(suburb) ? suburb : '';
  const validState = isValidString(state) ? state : '';
  
  if (validSuburb && validState) return `${validSuburb}, ${validState}`;
  if (validSuburb) return validSuburb;
  if (validState) return validState;
  
  return UNKNOWN_LOCATION;
}

/**
 * Get state from site (camelCase or snake_case).
 */
function getSiteState(site) {
  if (!site) return undefined;
  
  const state = site.stateShort ?? site.state_short ?? site.addr_state_short ?? site.state;
  
  // Filter out invalid state values
  if (state && 
      typeof state === 'string' && 
      state !== 'undefined' && 
      state !== 'null' && 
      state.trim() !== '') {
    return state;
  }
  
  return undefined;
}

/**
 * Parse refill date from API (may be YYYY-MM-DD, DD/MM/YYYY, or ISO string).
 * Returns { date: Date, dateOnly: string } with dateOnly as YYYY-MM-DD for consistent "Since refill" display.
 */
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

/**
 * Fetch tank configurations from Supabase (active only - for Tank Levels calculation)
 */
export const tankConfigurationsOptions = () =>
  queryOptions({
    queryKey: queryKeys.global.tankConfigurations(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tank_configurations')
        .select('*')
        .eq('active', true)
        .order('site_ref', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes - config data is relatively static
    gcTime: 30 * 60 * 1000,
  });

/**
 * Fetch all tank configurations including inactive (for admin config page)
 */
export const tankConfigurationsAdminOptions = () =>
  queryOptions({
    queryKey: [...queryKeys.global.tankConfigurations(), 'admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tank_configurations')
        .select('*')
        .order('site_ref', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

/**
 * Calculate litres consumed from a scan
 */
function calculateConsumption(washTimeSeconds, calibrationRate) {
  if (!washTimeSeconds || washTimeSeconds <= 0 || washTimeSeconds <= 15) {
    // Exclude 0s and ≤15s scans (drive-through, no actual wash)
    return 0;
  }
  // Ensure calibrationRate is a number (might be string from DB)
  const rate = typeof calibrationRate === 'string' ? parseFloat(calibrationRate) : calibrationRate;
  if (isNaN(rate) || rate <= 0) return 0;
  
  // Include ≥600s scans but flag them (handled in UI)
  return (washTimeSeconds / 60) * rate;
}

/**
 * Calculate average daily consumption from recent scans
 */
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
    const washTime = scan.washTime ?? scan.wash_time;
    return sum + calculateConsumption(washTime, calibrationRate);
  }, 0);
  
  const oldestScan = new Date(Math.min(...recentScans.map(s => new Date(s.createdAt ?? s.created_at))));
  const daysSpanned = Math.max(1, (now - oldestScan) / (24 * 60 * 60 * 1000));
  
  return totalConsumed / daysSpanned;
}

/**
 * Get status based on percentage
 */
function getTankStatus(percentage, warningThreshold = 20, criticalThreshold = 10) {
  if (percentage == null || !Number.isFinite(percentage)) return 'NO_DATA';
  if (percentage < criticalThreshold) return 'CRITICAL';
  if (percentage < warningThreshold) return 'WARNING';
  return 'OK';
}

/**
 * Validate tank level calculation
 */
function validateTankLevel(currentLitres, maxCapacity, lastRefillDate) {
  const flags = [];
  
  if (currentLitres < 0) {
    flags.push({ type: 'NEGATIVE_LEVEL', message: 'Calculated level is negative - likely missing refill log' });
  }
  
  if (currentLitres > maxCapacity) {
    flags.push({ type: 'ABOVE_CAPACITY', message: 'Level exceeds capacity - probable unlogged refill' });
  }
  
  if (lastRefillDate) {
    const daysSinceRefill = (new Date() - new Date(lastRefillDate)) / (24 * 60 * 60 * 1000);
    if (daysSinceRefill > 90) {
      flags.push({ type: 'STALE_REFILL', message: 'No refill logged in 90+ days' });
    }
  }
  
  return flags;
}

/**
 * Calculate tank level for a single tank
 */
async function calculateTankLevel(config, refills, scans, devices, sites) {
  try {
    // Find matching device by SERIAL NUMBER (not deviceRef)
    // API deviceRef is timestamp-based, but computerSerialId is unique hardware ID
    const device = devices.find(d => 
      d.computerSerialId === config.device_serial ||
      d.computerSerial === config.device_serial ||
      d.serial === config.device_serial
    );
    
    if (!device) {
      // Still return the config data for display purposes
      return {
        ...config,
        status: 'NO_DEVICE',
        currentLitres: null,
        percentage: null,
        daysRemaining: null,
        flags: [{ type: 'NO_DEVICE', message: `Device with serial ${config.device_serial} not found in API` }],
      };
    }

    // Get site info from device (device contains siteRef + siteName)
    // Then enrich with full site data if available
    const deviceSiteRef = device.siteRef || device.site_ref;
    const deviceSiteName = device.siteName || device.site_name;
    const deviceCustomer = device.customerName ?? device.customer ?? device.customer_ref;

    // Find full site record: prefer device's siteRef; when matching by name only, prefer site that matches device's customer so we don't attach ACM's Epping to HEIDELBERG's device
    const normalizeCustomer = (c) => (c ?? '').toString().trim().toLowerCase();
    const apiSite = sites.find(s => {
      const refMatch = deviceSiteRef && (s.ref === deviceSiteRef || s.siteRef === deviceSiteRef);
      if (refMatch) return true;
      const nameMatch = deviceSiteName && (s.siteName === deviceSiteName || (s.name && s.name === deviceSiteName));
      if (!nameMatch) return false;
      // Same site name can exist for multiple customers (e.g. Epping for ACM, HEIDELBERG, HOLCIM) — pick the site record for this device's customer
      const sc = normalizeCustomer(s.customer ?? s.customerName);
      const dc = normalizeCustomer(deviceCustomer);
      return !dc || !sc || sc === dc;
    });

    // Customer always from device so grouping is correct (one card per customer+site, not one card per site name)
    // Include customerRef/siteRef so we can match refills and scans by ID instead of name when API returns refs
    const deviceCustomerRef = device.customerRef || device.customer_ref;
    const site = apiSite ? {
      ...apiSite,
      siteRef: apiSite.ref || apiSite.siteRef || deviceSiteRef,
      siteName: apiSite.siteName || apiSite.name || deviceSiteName,
      customerRef: deviceCustomerRef || apiSite.customerRef || apiSite.customer_ref,
      suburb: apiSite.suburb ?? apiSite.addr_suburb ?? apiSite.addressSuburb,
      stateShort: apiSite.stateShort ?? apiSite.state_short ?? apiSite.addr_state_short ?? apiSite.state,
      location: apiSite.location,
      customer: deviceCustomer || apiSite.customer || apiSite.customerName,
    } : {
      siteRef: deviceSiteRef,
      siteName: deviceSiteName,
      customerRef: deviceCustomerRef,
      customer: deviceCustomer,
      suburb: undefined,
      stateShort: undefined,
      location: undefined,
    };
    
    // Find last refill for this site + product type
    // Prefer matching by siteRef/customerRef (IDs) when API returns them; fall back to site/customer names
    const siteName = (site.siteName || '').trim();
    const productType = (config.product_type || '').toUpperCase(); // ECSR, TW, GEL
    const siteRefills = refills
      .filter(r => {
        const rSiteRef = (r.siteRef ?? r.site_ref ?? '').toString().trim();
        const rCustomerRef = (r.customerRef ?? r.customer_ref ?? '').toString().trim();
        const siteMatchByRef = rSiteRef && site.siteRef && rSiteRef === site.siteRef;
        const customerMatchByRef = !site.customerRef || !rCustomerRef || rCustomerRef === site.customerRef;
        const siteMatch =
          (siteMatchByRef && customerMatchByRef) ||
          (() => {
            const rSite = (r.site ?? r.siteName ?? '').toString().trim();
            return (rSite === siteName || (r.siteName && r.siteName === siteName)) ||
              (siteName && rSite && (rSite.endsWith(siteName) || rSite.includes(' - ' + siteName)));
          })();
        if (!siteMatch) return false;
        // Refills are already requested with customerRef when not super admin, so no need to filter by customer name/ref here
        // Only use refills for this tank's product (CONC/ECSR / FOAM / TW / GEL) so multi-tank sites get correct level per product
        // FOAM tanks at Prestons etc. use refill product "ELORA-GAR - GUNLAKE" (not the word "FOAM"), so match ELORA-GAR / GAR to FOAM.
        if (productType) {
          const rProduct = (r.productName ?? r.product ?? '').toString().toUpperCase();
          const hasEcsr = (productType === 'ECSR' || productType === 'CONC') && (
            rProduct.includes('ECSR') ||
            rProduct.includes('CONCRETE SAFE') ||
            rProduct.includes('CONC') ||
            rProduct.includes('ELORA-GAR') ||
            rProduct.includes(' GAR ') ||
            rProduct.includes(' GAR)')
          );
          const hasFoam = productType === 'FOAM' && (
            rProduct.includes('FOAM') ||
            rProduct.includes('ELORA-GAR') ||
            rProduct.includes(' GAR ') ||
            rProduct.includes('GAR)')
          );
          const hasTw = productType === 'TW' && (rProduct.includes('TRUCK WASH') || rProduct.includes(' ETW') || rProduct.includes('TW-'));
          const hasGel = productType === 'GEL' && rProduct.includes('GEL');
          if (!hasEcsr && !hasFoam && !hasTw && !hasGel) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Latest by date/time (Rule 2: pick the latest Delivered/Confirmed)
        const aParsed = parseRefillDate(a);
        const bParsed = parseRefillDate(b);
        return bParsed.date - aParsed.date;
      });

    const lastRefill = siteRefills[0];
    
    if (!lastRefill) {
      // Edge case: no Delivered/Confirmed refill — show "No refill data" / Unknown (Rule D)
      return {
        ...config,
        device,
        site,
        status: 'NO_DATA',
        currentLitres: null,
        percentage: null,
        daysRemaining: null,
        flags: [{ type: 'NO_REFILL_DATA', message: 'No refill data available' }],
      };
    }

    // Get scans since last refill (Rule 3: scan.created_at >= last_refill_datetime)
    // Use parsed refill date so "Since refill" in UI matches the baseline we use for filtering scans
    const refillParsed = parseRefillDate(lastRefill);
    const refillDateTime = refillParsed.date;
    const deviceSerialId = device.computerSerialId || device.computerSerial || device.serial;
    const deviceRefFromApi = device.deviceRef || device.ref;
    const configDeviceRef = (config.device_ref || '').toString().trim();
    const deviceComputerName = device.computerName || device.computer_name;
    const siteNameNorm = (site.siteName || '').trim().toLowerCase();
    const customerNorm = (site.customer || '').trim().toLowerCase();

    const scanMatchesDevice = (scan) => {
      // Prefer tank config device_ref (source of truth from CMS) — matches scan's deviceRef to this tank (e.g. Foam vs Truck Wash)
      const scanDeviceRef = (scan.deviceRef ?? scan.device_ref ?? '').toString().trim();
      if (configDeviceRef && scanDeviceRef && scanDeviceRef === configDeviceRef) return true;
      if (deviceRefFromApi && scanDeviceRef && scanDeviceRef === deviceRefFromApi) return true;
      const scanSerial = scan.deviceSerial || scan.device_serial || scan.computerSerialId;
      if (scanSerial && deviceSerialId && String(scanSerial).trim() === String(deviceSerialId).trim()) return true;
      const scanDeviceName = scan.computerName || scan.computer_name || scan.deviceName || scan.device_name || scan.genie;
      if (scanDeviceName && deviceComputerName && String(scanDeviceName).trim() === String(deviceComputerName).trim()) return true;
      return false;
    };

    const scanMatchesSiteAndCustomer = (scan) => {
      const scanSiteRef = (scan.siteRef ?? scan.site_ref ?? '').toString().trim();
      const scanCustomerRef = (scan.customerRef ?? scan.customer_ref ?? '').toString().trim();
      if (scanSiteRef && site.siteRef && scanSiteRef === site.siteRef) {
        if (site.customerRef && scanCustomerRef) return scanCustomerRef === site.customerRef;
        return true;
      }
      const scanSite = (scan.siteName || scan.site_name || scan.site || '').trim().toLowerCase();
      const scanCustomer = (scan.customerName || scan.customer || '').trim().toLowerCase();
      if (!siteNameNorm) return true;
      const siteOk = scanSite === siteNameNorm || (scanSite && scanSite.includes(siteNameNorm)) || (siteNameNorm && scanSite.includes(siteNameNorm));
      const customerOk = !customerNorm || !scanCustomer || scanCustomer === customerNorm;
      return siteOk && customerOk;
    };

    const scansSinceRefill = scans.filter(scan => {
      const scanDate = new Date(scan.createdAt || scan.created_at);
      if (scanDate < refillDateTime) return false;
      if (!scanMatchesDevice(scan)) return false;
      if (!scanMatchesSiteAndCustomer(scan)) return false;
      return true;
    });

    // Rule 5: wash time affects consumption. Missing wash time → 0 consumption and flag (Rule D).
    const scansWithMissingWashTime = scansSinceRefill.filter(s => {
      const wt = s.washTime ?? s.wash_time;
      return wt == null || wt === '' || (typeof wt === 'number' && isNaN(wt));
    });

    // Calculate total consumption (API may return washTime or wash_time)
    const totalConsumed = scansSinceRefill.reduce((sum, scan) => {
      const washTime = scan.washTime ?? scan.wash_time;
      return sum + calculateConsumption(washTime, config.calibration_rate_per_60s);
    }, 0);

    // Calculate current level: start from refill newTotalLitres when available, else max capacity. Clamp to [0, max_capacity].
    const startingLevel = lastRefill.newTotalLitres ?? lastRefill.new_total_litres ?? lastRefill.deliveredLitres ?? lastRefill.delivered_litres ?? 0;
    const totalConsumedNum = Number.isFinite(totalConsumed) ? totalConsumed : 0;
    const maxCap = Number(config.max_capacity_litres) || 0;
    const startLevelNum = Number(startingLevel) || maxCap || 0;
    const currentLitresRaw = Math.max(0, startLevelNum - totalConsumedNum);
    const currentLitres = Number.isFinite(currentLitresRaw)
      ? (maxCap > 0 ? Math.min(maxCap, Math.max(0, currentLitresRaw)) : Math.max(0, currentLitresRaw))
      : null;
    const percentage = maxCap > 0 && currentLitres != null && Number.isFinite(currentLitres)
      ? (currentLitres / maxCap) * 100
      : null;

    // Calculate days remaining
    const avgDailyConsumption = calculateAvgDailyConsumption(
      scansSinceRefill,
      config.calibration_rate_per_60s
    );
    const avgDailyNum = Number.isFinite(avgDailyConsumption) ? avgDailyConsumption : 0;
    const daysRemaining = avgDailyNum > 0 && currentLitres != null && Number.isFinite(currentLitres)
      ? currentLitres / avgDailyNum
      : null;

    // Get status
    const status = getTankStatus(
      percentage,
      config.warning_threshold_pct,
      config.critical_threshold_pct
    );

    // Validate
    const flags = validateTankLevel(currentLitres, config.max_capacity_litres, refillParsed.dateOnly || lastRefill.date);

    // Check for device offline and stale data
    if (device.lastScanAt) {
      const hoursSinceLastScan = (new Date() - new Date(device.lastScanAt)) / (60 * 60 * 1000);
      if (hoursSinceLastScan > 48) {
        flags.push({ type: 'DEVICE_OFFLINE', message: `No scans in ${Math.round(hoursSinceLastScan)} hours` });
      }
      const daysSinceLastScan = hoursSinceLastScan / 24;
      if (daysSinceLastScan >= 7) {
        flags.push({ type: 'NO_RECENT_SCANS', message: 'No scans in 7+ days — stale data' });
      }
    }

    // Check for anomalous scans
    const anomalousScans = scansSinceRefill.filter(s => (s.washTime ?? s.wash_time) >= 600);
    if (anomalousScans.length > 0) {
      flags.push({ type: 'WASH_TIME_ANOMALY', message: `${anomalousScans.length} scans with ≥600s wash time` });
    }
    if (scansWithMissingWashTime.length > 0) {
      flags.push({ type: 'MISSING_WASH_TIME', message: `${scansWithMissingWashTime.length} scan(s) with missing wash time (excluded from consumption)` });
    }

    const safeRound = (v) => (v != null && Number.isFinite(v) ? Math.round(v) : null);
    const safeRound1 = (v) => (v != null && Number.isFinite(v) ? Math.round(v * 10) / 10 : null);

    return {
      ...config,
      device,
      site,
      status,
      currentLitres: currentLitres != null ? Math.round(currentLitres) : null,
      percentage: percentage != null && Number.isFinite(percentage) ? Math.round(percentage * 10) / 10 : null,
      daysRemaining: daysRemaining != null && Number.isFinite(daysRemaining) ? Math.round(daysRemaining * 10) / 10 : null,
      lastRefill: {
        date: refillParsed.dateOnly || lastRefill.date,
        amount: lastRefill.newTotalLitres ?? lastRefill.new_total_litres,
        ref: lastRefill.ref,
        productName: lastRefill.productName ?? lastRefill.product ?? null,
      },
      consumption: {
        totalLitres: safeRound(totalConsumedNum),
        scanCount: scansSinceRefill.length,
        avgDailyLitres: safeRound1(avgDailyConsumption),
      },
      flags,
      lastScanAt: device.lastScanAt,
      deviceStatus: device.statusLabel,
    };
  } catch (error) {
    console.error('Error calculating tank level:', error);
    return {
      ...config,
      status: 'ERROR',
      currentLitres: null,
      percentage: null,
      daysRemaining: null,
      flags: [{ type: 'CALCULATION_ERROR', message: error.message }],
    };
  }
}

/**
 * Main tank levels query
 * Fetches all data and calculates levels for all tanks
 */
export const tankLevelsOptions = (companyId, filters = {}) =>
  queryOptions({
    queryKey: queryKeys.tenant.tankLevels(companyId, filters),
    refetchInterval: 5 * 60 * 1000, // 5-minute polling per client confirmation
    queryFn: async ({ signal }) => {
      const tenantContext = getEloraTenantContext();
      
      // Fetch all required data in parallel
      // Refills: only Delivered/Confirmed (Rule 2). Scans: all wash events, export=true. Devices: Active only (CMS source of truth).
      // No user date range — always "live"; internal range last 2 years → today (Rule 1).
      const toDate = new Date().toISOString().split('T')[0];
      const fromDate = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const customerRef = !tenantContext.isSuperAdmin ? tenantContext.companyEloraCustomerRef : undefined;

      const [tankConfigs, refillsResponse, scansResponse, devicesResponse, sitesResponse] = await Promise.all([
        supabase.from('tank_configurations').select('*').eq('active', true),
        callEdgeFunction('elora_refills', {
          customerRef,
          status: 'confirmed,delivered',
          fromDate,
          toDate,
        }),
        callEdgeFunction('elora_scans', {
          customer: customerRef,
          customerId: customerRef,
          customer_id: customerRef,
          fromDate,
          toDate,
          start_date: fromDate,
          end_date: toDate,
          status: 'success,exceeded',
          export: true,
        }),
        callEdgeFunction('elora_devices', {
          status: 'active',
          customer_id: customerRef,
        }),
        callEdgeFunction('elora_sites', {}),
      ]);

      if (tankConfigs.error) throw tankConfigs.error;

      const configs = tankConfigs.data || [];
      let refills = [];
      if (refillsResponse != null && !refillsResponse.error) {
        refills = Array.isArray(refillsResponse)
          ? refillsResponse
          : (refillsResponse?.data ?? refillsResponse?.refills ?? []);
      }
      if (!Array.isArray(refills)) refills = [];
      // Scans: API with export=true may return array directly or { data, total }; avoid using error payload as data
      let scans = [];
      if (scansResponse != null && !scansResponse.error) {
        scans = Array.isArray(scansResponse) ? scansResponse : (scansResponse?.data ?? []);
      }
      if (!Array.isArray(scans)) scans = [];
      const devices = Array.isArray(devicesResponse) ? devicesResponse : (devicesResponse?.data || []);

      // Only confirmed or delivered refills count for tank level "since refill" (exclude scheduled/cancelled)
      // API returns status (e.g. "Scheduled", "Confirmed", "Delivered") and statusId (1=Scheduled, 2=Confirmed, 3=Delivered, 4=Cancelled)
      refills = refills.filter((r) => {
        const s = (r.status ?? r.statusLabel ?? '').toString().toLowerCase();
        const id = r.statusId ?? r.status_id;
        if (id != null) return id === 2 || id === 3; // 2=Confirmed, 3=Delivered
        return s === 'confirmed' || s === 'delivered';
      });

      // Exclude auto check-ins: only real washes (success/exceeded). API is requested with status=success,exceeded; filter again by rfid !== 'auto'
      scans = scans.filter((s) => {
        const rfid = (s.rfid ?? '').toString().toLowerCase();
        const statusLabel = (s.statusLabel ?? s.status ?? '').toString().toLowerCase();
        if (rfid === 'auto') return false;
        if (statusLabel === 'auto') return false;
        return true;
      });

      const sites = Array.isArray(sitesResponse) ? sitesResponse : (sitesResponse?.data || []);

      // Only use active devices for tank levels (cross-reference with CMS; exclude inactive)
      const activeDevices = devices.filter((d) => {
        const label = (d.statusLabel ?? d.status ?? '').toString().toLowerCase();
        const code = d.statusCode ?? d.status_code;
        return label === 'active' || code === 1;
      });

      // Build set of active device serials (all possible API field names) so we only show tanks for devices that exist in the API
      const activeSerials = new Set();
      activeDevices.forEach((d) => {
        const s = d.computerSerialId ?? d.computerSerial ?? d.serial;
        if (s) activeSerials.add(String(s).trim());
      });

      // Only include configs whose device_serial matches an active device — source of truth is /api/devices, not tank_configurations
      const configsForActiveDevices = configs.filter((c) => activeSerials.has(String(c.device_serial || '').trim()));

      // Deduplicate by (device_serial, tank_number) in case DB has duplicates; keep first
      const seenKey = new Set();
      const configsDeduped = configsForActiveDevices.filter((c) => {
        const key = `${(c.device_serial || '').trim()}|${c.tank_number ?? 1}`;
        if (seenKey.has(key)) return false;
        seenKey.add(key);
        return true;
      });

      // Calculate levels only for tanks that belong to an active device
      const tankLevels = await Promise.all(
        configsDeduped.map((config) => calculateTankLevel(config, refills, scans, activeDevices, sites))
      );

      // Exclude NO_DEVICE/ERROR tanks from display
      let tankLevelsToShow = tankLevels.filter(
        (t) => t.status !== 'NO_DEVICE' && t.status !== 'ERROR'
      );

      // Only show a tank when config.site_ref matches the device's current site (by ref or name).
      // Prefer ID: when API device has siteRef and config has a ref-like value, compare refs; else compare normalized names.
      tankLevelsToShow = tankLevelsToShow.filter((t) => {
        if (!t.device) return true;
        const configRef = (t.site_ref ?? '').toString().trim();
        const deviceSiteRef = (t.device.siteRef ?? t.device.site_ref ?? '').toString().trim();
        if (deviceSiteRef && configRef && deviceSiteRef === configRef) return true;
        const configSite = normalizeSiteName(t.site_ref);
        if (!configSite) return true;
        const deviceSite = normalizeSiteName(t.device.siteName ?? t.device.site_name);
        if (!deviceSite) return true;
        return configSite === deviceSite;
      });

      // Group by site for multi-tank sites (only tanks we're displaying).
      // Include customer in key so different customers' sites with same name (e.g. Epping) don't merge into one card.
      const siteMap = new Map();
      tankLevelsToShow.forEach((tank) => {
        const customer = tank.site?.customer ?? tank.device?.customerName ?? '';
        const siteRef = tank.site?.siteRef ?? '';
        const siteName = tank.site?.siteName ?? '';
        const siteKey = [customer, siteRef || siteName || tank.device_ref].filter(Boolean).join('|') || 'unknown';
        
        if (!siteMap.has(siteKey)) {
          const tankSite = tank.site || {};
          
          // Build site object with all possible field names
          const siteData = {
            ...tankSite,
            // Ensure we have these key fields even if API uses different names
            suburb: tankSite.suburb ?? tankSite.addr_suburb ?? tankSite.addressSuburb,
            stateShort: tankSite.stateShort ?? tankSite.state_short ?? tankSite.addr_state_short ?? tankSite.state,
            location: tankSite.location,
          };
          
          siteMap.set(siteKey, {
            siteRef: tankSite.siteRef || siteKey,
            siteName: tankSite.siteName || 'Unknown Site',
            customer: tankSite.customer || tank.device?.customerName || 'Unknown',
            location: formatSiteLocation(siteData),
            state: getSiteState(siteData),
            tanks: [],
            devices: new Set(),
            vehicleCount: tankSite.vehicleCount ?? 0,
            overallStatus: 'OK',
          });
        }
        
        const siteData = siteMap.get(siteKey);
        siteData.tanks.push(tank);
        if (tank.device) {
          const serialId = tank.device.computerSerialId || tank.device.computerSerial || tank.device.serial;
          siteData.devices.add(serialId);
        }
        
        // Overall status is worst tank status
        if (tank.status === 'CRITICAL') siteData.overallStatus = 'CRITICAL';
        else if (tank.status === 'WARNING' && siteData.overallStatus !== 'CRITICAL') {
          siteData.overallStatus = 'WARNING';
        }
      });

      // Convert to array and sort by status (Critical first)
      const sitesWithTanks = Array.from(siteMap.values()).map(site => ({
        ...site,
        deviceCount: site.devices.size,
        devices: undefined, // Remove Set from output
      }));

      // Sort: by customer first (so sites are grouped per customer), then by status (Critical > Warning > OK), then by site name
      const statusOrder = { CRITICAL: 0, WARNING: 1, OK: 2, NO_DATA: 3, NO_DEVICE: 4, ERROR: 5 };
      sitesWithTanks.sort((a, b) => {
        const customerA = (a.customer || '').toLowerCase();
        const customerB = (b.customer || '').toLowerCase();
        if (customerA !== customerB) return customerA.localeCompare(customerB);
        const statusDiff = statusOrder[a.overallStatus] - statusOrder[b.overallStatus];
        if (statusDiff !== 0) return statusDiff;
        return (a.siteName || '').localeCompare(b.siteName || '');
      });

      // Apply filters
      let filtered = sitesWithTanks;
      
      if (filters.status && filters.status !== 'all') {
        filtered = filtered.filter(site => site.overallStatus === filters.status.toUpperCase());
      }
      
      if (filters.customer && filters.customer !== 'all') {
        filtered = filtered.filter(site => site.customer === filters.customer);
      }
      
      if (filters.state && filters.state !== 'all') {
        filtered = filtered.filter(site => site.state === filters.state);
      }
      
      if (filters.search) {
        const query = filters.search.toLowerCase();
        filtered = filtered.filter(site =>
          site.siteName?.toLowerCase().includes(query) ||
          site.customer?.toLowerCase().includes(query) ||
          site.location?.toLowerCase().includes(query)
        );
      }

      // Calculate summary metrics (based on displayed tanks only); exclude NaN from avgLevel
      const tanksWithValidPct = tankLevelsToShow.filter((t) => t.percentage != null && Number.isFinite(t.percentage));
      const avgLevel = tanksWithValidPct.length > 0
        ? tanksWithValidPct.reduce((sum, t) => sum + t.percentage, 0) / tanksWithValidPct.length
        : 0;
      const metrics = {
        totalSites: sitesWithTanks.length,
        monitoredSites: sitesWithTanks.filter((s) => s.overallStatus !== 'NO_DEVICE').length,
        pendingSites: sitesWithTanks.filter((s) => s.overallStatus === 'NO_DEVICE').length,
        criticalCount: sitesWithTanks.filter((s) => s.overallStatus === 'CRITICAL').length,
        warningCount: sitesWithTanks.filter((s) => s.overallStatus === 'WARNING').length,
        okCount: sitesWithTanks.filter((s) => s.overallStatus === 'OK').length,
        totalTanks: tankLevelsToShow.length,
        avgLevel: Number.isFinite(avgLevel) ? avgLevel : 0,
      };

      return {
        sites: filtered,
        allSites: sitesWithTanks,
        metrics,
        lastUpdated: new Date().toISOString(),
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - balance between freshness and API load
    gcTime: 10 * 60 * 1000,
    enabled: !!companyId,
  });

/**
 * Query for sites without devices (pending installation)
 */
export const sitesWithoutDevicesOptions = (companyId) =>
  queryOptions({
    queryKey: queryKeys.tenant.sitesWithoutDevices(companyId),
    queryFn: async () => {
      const tenantContext = getEloraTenantContext();
      
      const [sitesResponse, devicesResponse] = await Promise.all([
        callEdgeFunction('elora_sites', {}),
        callEdgeFunction('elora_devices', {
          status: 'active',
          customer_id: !tenantContext.isSuperAdmin ? tenantContext.companyEloraCustomerRef : undefined,
        }),
      ]);

      const sites = Array.isArray(sitesResponse) ? sitesResponse : (sitesResponse?.data || []);
      const devices = Array.isArray(devicesResponse) ? devicesResponse : (devicesResponse?.data || []);

      const deviceSiteRefs = new Set(devices.map(d => d.siteRef ?? d.site_ref));
      
      const sitesWithoutDevices = sites
        .filter(site => !deviceSiteRefs.has(site.ref ?? site.siteRef))
        .map(site => {
          // Build normalized site object
          const normalizedSite = {
            ...site,
            suburb: site.suburb ?? site.addr_suburb ?? site.addressSuburb,
            stateShort: site.stateShort ?? site.state_short ?? site.addr_state_short ?? site.state,
            location: site.location,
          };
          
          return {
            siteRef: site.ref ?? site.siteRef,
            siteName: site.siteName ?? site.name,
            customer: site.customer ?? site.customerName ?? 'Unknown',
            location: formatSiteLocation(normalizedSite),
            state: getSiteState(normalizedSite),
            vehicleCount: site.vehicleCount ?? 0,
            status: 'NO_DEVICE',
          };
        });

      return sitesWithoutDevices;
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled: !!companyId,
  });
