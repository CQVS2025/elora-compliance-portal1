/**
 * AI Insights Cron Job - Node.js API Endpoint
 * 
 * This endpoint processes AI insights for all customers daily.
 * Called by GitHub Actions workflow at 6:00 AM Adelaide time.
 * 
 * Benefits over Edge Functions:
 * - More compute resources
 * - No worker limits
 * - Longer execution time allowed
 * - Better error handling and logging
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const ELORA_API_KEY = process.env.ELORA_API_KEY;

// Initialize Supabase admin client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Elora API base URL
const ELORA_API_BASE = 'https://api.eloratrack.com.au/api';

/**
 * Fetch data from Elora API
 */
async function callEloraAPI(endpoint, params = {}) {
  const url = new URL(`${ELORA_API_BASE}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${ELORA_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Elora API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Call Claude AI for risk analysis
 */
async function analyzeVehicleRisk(vehicleData) {
  // This would call your analyze-vehicle-risk-batch Edge Function
  // Or you can implement Claude API call directly here
  const response = await fetch(`${SUPABASE_URL}/functions/v1/analyze-vehicle-risk-batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(vehicleData),
  });

  if (!response.ok) {
    throw new Error(`AI analysis failed: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Process a single company's fleet
 */
async function processCompany(company, fromDate, toDate) {
  const { id: companyId, elora_customer_ref: customerRef } = company;
  
  console.log(`[AI Cron] Processing company: ${companyId} (${customerRef})`);

  try {
    // 1. Fetch vehicles for this customer
    const vehiclesData = await callEloraAPI('/vehicles', {
      customer: customerRef,
      status: '1',
    });

    const vehicles = Array.isArray(vehiclesData) ? vehiclesData : (vehiclesData?.data ?? []);
    
    if (vehicles.length === 0) {
      console.log(`[AI Cron] No vehicles found for ${customerRef}`);
      return { companyId, customerRef, vehiclesProcessed: 0 };
    }

    // 2. Fetch dashboard data for TODAY only
    const dashboardData = await callEloraAPI('/dashboard', {
      customer: customerRef,
      fromDate,
      toDate,
    });

    const rows = Array.isArray(dashboardData?.rows) ? dashboardData.rows : (dashboardData?.data?.rows ?? []);
    
    // 3. Build vehicle stats map
    const byVehicleRef = {};
    for (const row of rows) {
      const ref = row.vehicleRef || row.vehicle_ref;
      if (!ref) continue;
      
      byVehicleRef[ref] = {
        totalScans: (row.totalScans || row.total_scans || 0),
        lastScan: row.lastScan || row.last_scan,
        washesPerWeek: row.washesPerWeek || row.washes_per_week || 6,
        vehicleName: row.vehicleName || row.vehicle_name,
        siteName: row.siteName || row.site_name,
      };
    }

    // 4. Process vehicles in batches
    const BATCH_SIZE = 18;
    let totalProcessed = 0;

    for (let offset = 0; offset < vehicles.length; offset += BATCH_SIZE) {
      const batch = vehicles.slice(offset, offset + BATCH_SIZE);
      
      const batchPayload = batch.map(v => {
        const vehicleRef = v.vehicleRef || v.vehicleRfid || v.id || v.internalVehicleId;
        const stats = byVehicleRef[vehicleRef] || {};
        
        return {
          vehicle_ref: vehicleRef,
          vehicle_name: v.vehicleName || v.name,
          site_ref: v.siteId || v.siteRef,
          site_name: v.siteName || v.site_name,
          driver_name: v.driverName || v.driver_name,
          customer_ref: customerRef,
          company_id: companyId,
          current_week_washes: stats.totalScans || 0,
          target_washes: stats.washesPerWeek || 6,
          days_remaining: 7 - new Date().getDay(),
          wash_history_summary: `Today's washes: ${stats.totalScans || 0}. Target: ${stats.washesPerWeek || 6}/week.`,
        };
      });

      // 5. Analyze this batch with AI
      try {
        await analyzeVehicleRisk({
          customer_ref: customerRef,
          company_id: companyId,
          vehicles: batchPayload,
        });
        
        totalProcessed += batchPayload.length;
        console.log(`[AI Cron] ${customerRef}: Processed ${totalProcessed}/${vehicles.length} vehicles`);
      } catch (error) {
        console.error(`[AI Cron] Batch failed for ${customerRef}:`, error.message);
      }
    }

    return { companyId, customerRef, vehiclesProcessed: totalProcessed };
  } catch (error) {
    console.error(`[AI Cron] Company ${companyId} failed:`, error.message);
    return { companyId, customerRef, vehiclesProcessed: 0, error: error.message };
  }
}

/**
 * Main handler - Vercel serverless function
 */
module.exports = async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify authentication - either cron secret OR super admin user
  const authHeader = req.headers.authorization || '';
  const cronSecret = req.headers['x-cron-secret'] || '';
  
  let isAuthorized = false;
  
  // Check 1: Cron secret (for GitHub Actions)
  if (cronSecret === CRON_SECRET || authHeader.includes(CRON_SECRET)) {
    isAuthorized = true;
  }
  
  // Check 2: Super admin user JWT (for UI button)
  if (!isAuthorized && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (user && !error) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        
        if (profile?.role === 'super_admin') {
          isAuthorized = true;
        }
      }
    } catch (error) {
      console.error('[AI Cron] Auth error:', error);
    }
  }
  
  if (!isAuthorized) {
    return res.status(401).json({ error: 'Unauthorized: Invalid credentials or insufficient permissions' });
  }

  const startTime = Date.now();
  console.log('[AI Cron] Starting daily AI insights processing...');

  try {
    // 1. Fetch all companies with customer refs
    const { data: companies, error } = await supabase
      .from('companies')
      .select('id, elora_customer_ref')
      .not('elora_customer_ref', 'is', null)
      .or('is_active.eq.true,is_active.is.null');

    if (error) {
      throw new Error(`Failed to fetch companies: ${error.message}`);
    }

    const activeCompanies = (companies || []).filter(
      c => c.elora_customer_ref && String(c.elora_customer_ref).trim()
    );

    if (activeCompanies.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No active companies to process',
        companiesProcessed: 0,
        totalVehicles: 0,
      });
    }

    // 2. Process TODAY's data only
    const today = new Date().toISOString().split('T')[0];
    console.log(`[AI Cron] Processing ${activeCompanies.length} companies for date: ${today}`);

    // 3. Process each company sequentially
    const results = [];
    for (const company of activeCompanies) {
      const result = await processCompany(company, today, today);
      results.push(result);
    }

    const totalVehicles = results.reduce((sum, r) => sum + r.vehiclesProcessed, 0);
    const failedCompanies = results.filter(r => r.error).length;
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`[AI Cron] Completed in ${duration}s: ${activeCompanies.length} companies, ${totalVehicles} vehicles`);

    return res.status(200).json({
      success: true,
      message: `Processed ${activeCompanies.length} companies, ${totalVehicles} total vehicles`,
      companiesProcessed: activeCompanies.length,
      totalVehicles,
      failedCompanies,
      duration: `${duration}s`,
      results,
    });
  } catch (error) {
    console.error('[AI Cron] Fatal error:', error);
    return res.status(500).json({
      error: 'Cron execution failed',
      details: error.message,
      duration: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
    });
  }
};
