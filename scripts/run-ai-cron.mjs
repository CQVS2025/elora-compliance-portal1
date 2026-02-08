#!/usr/bin/env node
/**
 * AI Insights Daily Pipeline - GitHub Actions
 * Processes all customers' fleet data and generates AI insights
 * 
 * Run directly in GitHub Actions with full Node.js environment
 * No serverless limitations - can run for hours if needed
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';

// Polyfill fetch for Node.js < 18 or if not available
if (typeof globalThis.fetch === 'undefined') {
  const nodeFetch = await import('node-fetch');
  globalThis.fetch = nodeFetch.default;
  globalThis.Headers = nodeFetch.Headers;
  globalThis.Request = nodeFetch.Request;
  globalThis.Response = nodeFetch.Response;
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ELORA_API_KEY = process.env.ELORA_API_KEY;
const ELORA_API_BASE = 'https://api.eloratrack.com.au/api';

// Validate environment variables
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ELORA_API_KEY) {
  console.error('❌ Missing required environment variables');
  console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ELORA_API_KEY');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Logging
const logs = [];
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  logs.push(logMessage);
}

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
  const response = await fetch(`${SUPABASE_URL}/functions/v1/analyze-vehicle-risk-batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(vehicleData),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AI analysis failed: ${response.status} - ${error}`);
  }

  return await response.json();
}

/**
 * Process a single company's fleet
 */
async function processCompany(company, fromDate, toDate) {
  const { id: companyId, elora_customer_ref: customerRef } = company;
  
  log(`📊 Processing company: ${companyId} (${customerRef})`);

  try {
    // 1. Fetch vehicles for this customer
    log(`  → Fetching vehicles for ${customerRef}...`);
    const vehiclesData = await callEloraAPI('/vehicles', {
      customer: customerRef,
      status: '1',
    });

    const vehicles = Array.isArray(vehiclesData) ? vehiclesData : (vehiclesData?.data ?? []);
    
    if (vehicles.length === 0) {
      log(`  ⚠️  No vehicles found for ${customerRef}`);
      return { companyId, customerRef, vehiclesProcessed: 0 };
    }

    log(`  ✓ Found ${vehicles.length} vehicles`);

    // 2. Fetch dashboard data for TODAY only
    log(`  → Fetching dashboard data for ${fromDate}...`);
    const dashboardData = await callEloraAPI('/dashboard', {
      customer: customerRef,
      fromDate,
      toDate,
    });

    const rows = Array.isArray(dashboardData?.rows) ? dashboardData.rows : (dashboardData?.data?.rows ?? []);
    log(`  ✓ Found ${rows.length} wash records`);
    
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
    const numBatches = Math.ceil(vehicles.length / BATCH_SIZE);

    log(`  → Processing ${vehicles.length} vehicles in ${numBatches} batches...`);

    for (let offset = 0; offset < vehicles.length; offset += BATCH_SIZE) {
      const batchNum = Math.floor(offset / BATCH_SIZE) + 1;
      const batch = vehicles.slice(offset, offset + BATCH_SIZE);
      
      log(`  → Batch ${batchNum}/${numBatches}: ${batch.length} vehicles`);

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
        log(`  ✓ Batch ${batchNum} complete: ${totalProcessed}/${vehicles.length} vehicles analyzed`);
      } catch (error) {
        log(`  ❌ Batch ${batchNum} failed: ${error.message}`);
      }

      // Small delay between batches to avoid overwhelming services
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    log(`  ✅ Company ${customerRef}: ${totalProcessed}/${vehicles.length} vehicles processed`);
    return { companyId, customerRef, vehiclesProcessed: totalProcessed };
    
  } catch (error) {
    log(`  ❌ Company ${companyId} failed: ${error.message}`);
    return { companyId, customerRef, vehiclesProcessed: 0, error: error.message };
  }
}

/**
 * Main pipeline
 */
async function runPipeline() {
  const startTime = Date.now();
  
  log('🚀 Starting AI Insights Daily Pipeline');
  log('=====================================');

  try {
    // 1. Fetch all companies with customer refs
    log('📋 Fetching companies...');
    const { data: companies, error } = await supabase
      .from('companies')
      .select('id, elora_customer_ref, name')
      .not('elora_customer_ref', 'is', null)
      .or('is_active.eq.true,is_active.is.null');

    if (error) {
      throw new Error(`Failed to fetch companies: ${error.message}`);
    }

    const activeCompanies = (companies || []).filter(
      c => c.elora_customer_ref && String(c.elora_customer_ref).trim()
    );

    if (activeCompanies.length === 0) {
      log('⚠️  No active companies to process');
      return { success: true, companiesProcessed: 0, totalVehicles: 0 };
    }

    log(`✓ Found ${activeCompanies.length} companies to process`);

    // 2. Process TODAY's data only
    const today = new Date().toISOString().split('T')[0];
    log(`📅 Processing data for: ${today}`);
    log('=====================================\n');

    // 3. Process each company sequentially
    const results = [];
    for (let i = 0; i < activeCompanies.length; i++) {
      const company = activeCompanies[i];
      log(`\n[${i + 1}/${activeCompanies.length}] ${company.name || company.elora_customer_ref}`);
      
      const result = await processCompany(company, today, today);
      results.push(result);

      // Delay between companies
      if (i < activeCompanies.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    const totalVehicles = results.reduce((sum, r) => sum + r.vehiclesProcessed, 0);
    const failedCompanies = results.filter(r => r.error).length;
    const successCompanies = activeCompanies.length - failedCompanies;
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    log('\n=====================================');
    log('✅ Pipeline Complete!');
    log(`📊 Summary:`);
    log(`   Companies: ${successCompanies}/${activeCompanies.length} succeeded`);
    log(`   Vehicles: ${totalVehicles} total analyzed`);
    log(`   Duration: ${duration}s`);
    log('=====================================');

    // Save logs to file
    writeFileSync('ai-insights-pipeline.log', logs.join('\n'));

    return {
      success: true,
      companiesProcessed: activeCompanies.length,
      successCompanies,
      failedCompanies,
      totalVehicles,
      duration: `${duration}s`,
      results,
    };

  } catch (error) {
    log(`\n❌ Fatal error: ${error.message}`);
    log(error.stack);
    
    writeFileSync('ai-insights-pipeline.log', logs.join('\n'));
    
    return {
      success: false,
      error: error.message,
    };
  }
}

// Run the pipeline
runPipeline()
  .then(result => {
    console.log('\n📄 Results:', JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
