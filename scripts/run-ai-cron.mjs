#!/usr/bin/env node
/**
 * AI Insights Daily Pipeline - GitHub Actions
 * Processes all customers' fleet data and generates AI insights
 * 
 * Run directly in GitHub Actions with full Node.js environment
 * No serverless limitations - can run for hours if needed
 */

import { createClient } from '@supabase/supabase-js';
import { DateTime } from 'luxon';
import { writeFileSync } from 'fs';

const ADELAIDE_ZONE = 'Australia/Adelaide';

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
const ELORA_API_BASE = 'https://www.elora.com.au/api';

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
 * Process a single company's fleet using the analyze-fleet edge function
 * Calls analyze-fleet in a loop to process ALL vehicles (pagination)
 */
async function processCompany(company, fromDate, toDate) {
  const { id: companyId, elora_customer_ref: customerRef } = company;
  
  log(`📊 Processing company: ${companyId} (${customerRef})`);

  try {
    let offset = 0;
    let totalProcessed = 0;
    let totalVehicles = 0;
    
    // Loop until all vehicles are processed
    while (true) {
      log(`  → Calling analyze-fleet (offset: ${offset})...`);
      
      const response = await fetch(`${SUPABASE_URL}/functions/v1/analyze-fleet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'x-cron-secret': process.env.CRON_SECRET || '',
        },
        body: JSON.stringify({
          company_id: companyId,
          customer_ref: customerRef,
          from_date: fromDate,
          to_date: toDate,
          cron_mode: true, // Skip heavy operations in cron mode
          limit: 50, // Process 50 vehicles per call (higher limit for cron)
          offset: offset,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No error body');
        log(`  → analyze-fleet Error: ${response.status} - ${errorText}`);
        throw new Error(`Failed to analyze fleet: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      const analyzed = result.analyzed || 0;
      const hasMore = result.has_more || false;
      totalVehicles = result.total || 0;
      
      totalProcessed += analyzed;
      log(`  ✓ Batch complete: ${totalProcessed}/${totalVehicles} vehicles analyzed`);

      // Break if no more vehicles to process
      if (!hasMore || analyzed === 0) {
        break;
      }

      // Move to next batch
      offset = result.next_offset || (offset + analyzed);
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    log(`  ✅ Company ${customerRef}: ${totalProcessed}/${totalVehicles} vehicles processed`);
    return { 
      companyId, 
      customerRef, 
      vehiclesProcessed: totalProcessed,
      totalVehicles: totalVehicles
    };
    
  } catch (error) {
    log(`  ❌ Company ${companyId} failed: ${error.message}`);
    if (error.stack) {
      log(`  → Stack: ${error.stack}`);
    }
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
  log(`🔧 Environment Check:`);
  log(`   SUPABASE_URL: ${SUPABASE_URL ? '✓ Set' : '✗ Missing'}`);
  log(`   SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY ? '✓ Set' : '✗ Missing'}`);
  log(`   ELORA_API_KEY: ${ELORA_API_KEY ? '✓ Set' : '✗ Missing'}`);
  log(`   ELORA_API_BASE: ${ELORA_API_BASE}`);
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

    // 2. Business day = "yesterday" in Australia/Adelaide (end-of-day processing, no DST issues)
    const processDate = (() => {
      if (process.env.PROCESS_DATE) {
        const d = process.env.PROCESS_DATE.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
      }
      const nowAdelaide = DateTime.now().setZone(ADELAIDE_ZONE);
      const endOfToday = nowAdelaide.startOf('day');
      const startOfYesterday = endOfToday.minus({ days: 1 });
      return startOfYesterday.toFormat('yyyy-MM-dd');
    })();
    log(`📅 Processing data for: ${processDate} (business day = last completed day in ${ADELAIDE_ZONE})`);
    log('=====================================\n');

    // 3. Process each company sequentially
    const results = [];
    for (let i = 0; i < activeCompanies.length; i++) {
      const company = activeCompanies[i];
      log(`\n[${i + 1}/${activeCompanies.length}] ${company.name || company.elora_customer_ref}`);
      
      const result = await processCompany(company, processDate, processDate);
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
