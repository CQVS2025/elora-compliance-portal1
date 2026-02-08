/**
 * AI Insights Cron Job - Vercel Serverless Function
 * Simplified version with better error handling
 */

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-cron-secret');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Lazy load dependencies to avoid initialization errors
    const { createClient } = require('@supabase/supabase-js');
    
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const CRON_SECRET = process.env.CRON_SECRET;
    const ELORA_API_KEY = process.env.ELORA_API_KEY;
    
    // Validate environment variables
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !CRON_SECRET || !ELORA_API_KEY) {
      console.error('[AI Cron] Missing environment variables:', {
        hasUrl: !!SUPABASE_URL,
        hasServiceKey: !!SUPABASE_SERVICE_ROLE_KEY,
        hasCronSecret: !!CRON_SECRET,
        hasEloraKey: !!ELORA_API_KEY,
      });
      return res.status(500).json({ 
        error: 'Server configuration error',
        details: 'Missing required environment variables'
      });
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const ELORA_API_BASE = 'https://api.eloratrack.com.au/api';

    // Verify authentication
    const authHeader = req.headers.authorization || '';
    const cronSecret = req.headers['x-cron-secret'] || '';
    
    let isAuthorized = false;
    
    // Check cron secret
    if (cronSecret === CRON_SECRET) {
      isAuthorized = true;
      console.log('[AI Cron] Authorized via cron secret');
    }
    
    // Check super admin JWT
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
            console.log('[AI Cron] Authorized via super admin JWT');
          }
        }
      } catch (error) {
        console.error('[AI Cron] JWT validation error:', error);
      }
    }
    
    if (!isAuthorized) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const startTime = Date.now();
    console.log('[AI Cron] Starting processing...');

    // Fetch companies
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('id, elora_customer_ref')
      .not('elora_customer_ref', 'is', null)
      .or('is_active.eq.true,is_active.is.null');

    if (companiesError) {
      throw new Error(`Failed to fetch companies: ${companiesError.message}`);
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

    const today = new Date().toISOString().split('T')[0];
    console.log(`[AI Cron] Processing ${activeCompanies.length} companies for ${today}`);

    // Process each company
    const results = [];
    let totalVehicles = 0;

    for (const company of activeCompanies) {
      const { id: companyId, elora_customer_ref: customerRef } = company;
      
      try {
        console.log(`[AI Cron] Processing ${customerRef}...`);
        
        // Fetch vehicles
        const vehiclesUrl = `${ELORA_API_BASE}/vehicles?customer=${customerRef}&status=1`;
        const vehiclesResp = await fetch(vehiclesUrl, {
          headers: { 'Authorization': `Bearer ${ELORA_API_KEY}` },
        });
        
        if (!vehiclesResp.ok) {
          throw new Error(`Vehicles API error: ${vehiclesResp.status}`);
        }
        
        const vehiclesData = await vehiclesResp.json();
        const vehicles = Array.isArray(vehiclesData) ? vehiclesData : (vehiclesData?.data ?? []);
        
        if (vehicles.length === 0) {
          results.push({ companyId, customerRef, vehiclesProcessed: 0 });
          continue;
        }

        // Fetch dashboard data
        const dashUrl = `${ELORA_API_BASE}/dashboard?customer=${customerRef}&fromDate=${today}&toDate=${today}`;
        const dashResp = await fetch(dashUrl, {
          headers: { 'Authorization': `Bearer ${ELORA_API_KEY}` },
        });
        
        if (!dashResp.ok) {
          throw new Error(`Dashboard API error: ${dashResp.status}`);
        }
        
        const dashData = await dashResp.json();
        const rows = Array.isArray(dashData?.rows) ? dashData.rows : (dashData?.data?.rows ?? []);
        
        // Build stats
        const byVehicleRef = {};
        for (const row of rows) {
          const ref = row.vehicleRef || row.vehicle_ref;
          if (ref) {
            byVehicleRef[ref] = {
              totalScans: row.totalScans || row.total_scans || 0,
              washesPerWeek: row.washesPerWeek || row.washes_per_week || 6,
            };
          }
        }

        // Process in batches
        const BATCH_SIZE = 18;
        let processed = 0;

        for (let offset = 0; offset < vehicles.length; offset += BATCH_SIZE) {
          const batch = vehicles.slice(offset, offset + BATCH_SIZE);
          
          const batchPayload = batch.map(v => {
            const vehicleRef = v.vehicleRef || v.vehicleRfid || v.id;
            const stats = byVehicleRef[vehicleRef] || {};
            
            return {
              vehicle_ref: vehicleRef,
              vehicle_name: v.vehicleName || v.name,
              site_ref: v.siteId || v.siteRef,
              site_name: v.siteName,
              driver_name: v.driverName,
              customer_ref: customerRef,
              company_id: companyId,
              current_week_washes: stats.totalScans || 0,
              target_washes: stats.washesPerWeek || 6,
              days_remaining: 7 - new Date().getDay(),
              wash_history_summary: `Today: ${stats.totalScans || 0} washes`,
            };
          });

          // Call AI analysis
          const aiResp = await fetch(`${SUPABASE_URL}/functions/v1/analyze-vehicle-risk-batch`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              customer_ref: customerRef,
              company_id: companyId,
              vehicles: batchPayload,
            }),
          });

          if (aiResp.ok) {
            processed += batchPayload.length;
          }
        }

        totalVehicles += processed;
        results.push({ companyId, customerRef, vehiclesProcessed: processed });
        console.log(`[AI Cron] ${customerRef}: ${processed} vehicles`);
        
      } catch (error) {
        console.error(`[AI Cron] ${customerRef} failed:`, error.message);
        results.push({ companyId, customerRef, vehiclesProcessed: 0, error: error.message });
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const failedCompanies = results.filter(r => r.error).length;

    console.log(`[AI Cron] Completed: ${activeCompanies.length} companies, ${totalVehicles} vehicles, ${duration}s`);

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
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};
