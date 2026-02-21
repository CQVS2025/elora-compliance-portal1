import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { callEdgeFunction } from '@/lib/supabase';
import { getEloraTenantContext } from '@/lib/eloraTenantContext';
import { queryKeys } from '../keys';

/**
 * Tank Levels Query Options
 * 
 * Calculates real-time tank levels based on:
 * 1. Last refill (newTotalLitres from /api/refills)
 * 2. Consumption since refill (scans × washTime × calibration_rate)
 * 3. Tank configuration (capacity, thresholds)
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
  // Include ≥600s scans but flag them (handled in UI)
  return (washTimeSeconds / 60) * calibrationRate;
}

/**
 * Calculate average daily consumption from recent scans
 */
function calculateAvgDailyConsumption(scans, calibrationRate, daysToAnalyze = 7) {
  if (!scans || scans.length === 0) return 0;
  
  const now = new Date();
  const cutoffDate = new Date(now.getTime() - daysToAnalyze * 24 * 60 * 60 * 1000);
  
  const recentScans = scans.filter(scan => {
    const scanDate = new Date(scan.createdAt);
    return scanDate >= cutoffDate;
  });
  
  if (recentScans.length === 0) return 0;
  
  const totalConsumed = recentScans.reduce((sum, scan) => {
    return sum + calculateConsumption(scan.washTime, calibrationRate);
  }, 0);
  
  // Calculate actual days spanned
  const oldestScan = new Date(Math.min(...recentScans.map(s => new Date(s.createdAt))));
  const daysSpanned = Math.max(1, (now - oldestScan) / (24 * 60 * 60 * 1000));
  
  return totalConsumed / daysSpanned;
}

/**
 * Get status based on percentage
 */
function getTankStatus(percentage, warningThreshold = 20, criticalThreshold = 10) {
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
    const site = apiSite ? {
      ...apiSite,
      siteRef: apiSite.ref || apiSite.siteRef || deviceSiteRef,
      siteName: apiSite.siteName || apiSite.name || deviceSiteName,
      suburb: apiSite.suburb ?? apiSite.addr_suburb ?? apiSite.addressSuburb,
      stateShort: apiSite.stateShort ?? apiSite.state_short ?? apiSite.addr_state_short ?? apiSite.state,
      location: apiSite.location,
      customer: deviceCustomer || apiSite.customer || apiSite.customerName,
    } : {
      siteRef: deviceSiteRef,
      siteName: deviceSiteName,
      customer: deviceCustomer,
      suburb: undefined,
      stateShort: undefined,
      location: undefined,
    };
    
    // Find last refill for this site/product
    // Refills API uses site NAME (not code), so match by name
    const siteRefills = refills
      .filter(r => 
        r.site === site.siteName || 
        r.siteName === site.siteName ||
        r.siteRef === site.siteRef
      )
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const lastRefill = siteRefills[0];
    
    if (!lastRefill) {
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

    // Get scans since last refill
    // Scans API - match by device serial number
    const refillDate = new Date(lastRefill.date);
    const deviceSerialId = device.computerSerialId || device.computerSerial || device.serial;
    
    const scansSinceRefill = scans.filter(scan => {
      const scanDate = new Date(scan.createdAt);
      // Match by device serial (most reliable)
      const scanSerial = scan.deviceSerial || scan.device_serial || scan.computerSerialId;
      const matchesDevice = scanSerial === deviceSerialId ||
                           scan.deviceRef === device.deviceRef; // Fallback to deviceRef
      // Also verify site as sanity check
      const matchesSite = !scan.siteRef || 
                         scan.siteRef === site.siteRef || 
                         scan.siteName === site.siteName;
      return matchesDevice && matchesSite && scanDate >= refillDate;
    });

    // Calculate total consumption
    const totalConsumed = scansSinceRefill.reduce((sum, scan) => {
      return sum + calculateConsumption(scan.washTime, config.calibration_rate_per_60s);
    }, 0);

    // Calculate current level
    const startingLevel = lastRefill.newTotalLitres || lastRefill.deliveredLitres || 0;
    const currentLitres = Math.max(0, startingLevel - totalConsumed);
    const percentage = (currentLitres / config.max_capacity_litres) * 100;

    // Calculate days remaining
    const avgDailyConsumption = calculateAvgDailyConsumption(
      scansSinceRefill,
      config.calibration_rate_per_60s
    );
    const daysRemaining = avgDailyConsumption > 0 ? currentLitres / avgDailyConsumption : null;

    // Get status
    const status = getTankStatus(
      percentage,
      config.warning_threshold_pct,
      config.critical_threshold_pct
    );

    // Validate
    const flags = validateTankLevel(currentLitres, config.max_capacity_litres, lastRefill.date);

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
    const anomalousScans = scansSinceRefill.filter(s => s.washTime >= 600);
    if (anomalousScans.length > 0) {
      flags.push({ type: 'WASH_TIME_ANOMALY', message: `${anomalousScans.length} scans with ≥600s wash time` });
    }

    return {
      ...config,
      device,
      site,
      status,
      currentLitres: Math.round(currentLitres),
      percentage: Math.round(percentage * 10) / 10, // Round to 1 decimal
      daysRemaining: daysRemaining ? Math.round(daysRemaining * 10) / 10 : null,
      lastRefill: {
        date: lastRefill.date,
        amount: lastRefill.newTotalLitres,
        ref: lastRefill.ref,
      },
      consumption: {
        totalLitres: Math.round(totalConsumed),
        scanCount: scansSinceRefill.length,
        avgDailyLitres: Math.round(avgDailyConsumption * 10) / 10,
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
      // Refills: only confirmed and delivered count as actual refills (not scheduled)
      // Scans: only success and exceeded = real washes; exclude auto check-ins
      // Devices: only active devices (cross-reference with CMS)
      const [tankConfigs, refillsResponse, scansResponse, devicesResponse, sitesResponse] = await Promise.all([
        supabase.from('tank_configurations').select('*').eq('active', true),
        callEdgeFunction('elora_refills', {
          customerRef: !tenantContext.isSuperAdmin ? tenantContext.companyEloraCustomerRef : undefined,
          status: 'confirmed,delivered',
        }),
        callEdgeFunction('elora_scans', {
          customerRef: !tenantContext.isSuperAdmin ? tenantContext.companyEloraCustomerRef : undefined,
          export: 'all',
          status: 'success,exceeded',
        }),
        callEdgeFunction('elora_devices', {
          status: 'active',
          customer_id: !tenantContext.isSuperAdmin ? tenantContext.companyEloraCustomerRef : undefined,
        }),
        callEdgeFunction('elora_sites', {}),
      ]);

      if (tankConfigs.error) throw tankConfigs.error;

      const configs = tankConfigs.data || [];
      let refills = Array.isArray(refillsResponse) ? refillsResponse : (refillsResponse?.data || []);
      let scans = Array.isArray(scansResponse) ? scansResponse : (scansResponse?.data || []);
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

      // Only show a tank when config.site_ref matches the device's current site from the API.
      // tank_configurations can have stale rows (device moved or decommissioned); device site is source of truth.
      tankLevelsToShow = tankLevelsToShow.filter((t) => {
        if (!t.device) return true;
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

      // Calculate summary metrics (based on displayed tanks only)
      const metrics = {
        totalSites: sitesWithTanks.length,
        monitoredSites: sitesWithTanks.filter((s) => s.overallStatus !== 'NO_DEVICE').length,
        pendingSites: sitesWithTanks.filter((s) => s.overallStatus === 'NO_DEVICE').length,
        criticalCount: sitesWithTanks.filter((s) => s.overallStatus === 'CRITICAL').length,
        warningCount: sitesWithTanks.filter((s) => s.overallStatus === 'WARNING').length,
        okCount: sitesWithTanks.filter((s) => s.overallStatus === 'OK').length,
        totalTanks: tankLevelsToShow.length,
        avgLevel:
          tankLevelsToShow.filter((t) => t.percentage != null).length > 0
            ? tankLevelsToShow.filter((t) => t.percentage != null).reduce((sum, t) => sum + t.percentage, 0) /
              tankLevelsToShow.filter((t) => t.percentage != null).length
            : 0,
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
