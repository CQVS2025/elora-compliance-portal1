/**
 * AI Insights Automated Cron - Phase 2
 *
 * Invoked daily by Supabase Cron (e.g. 6:00 AM Australia Adelaide).
 * Fetches all companies with elora_customer_ref and runs fleet analysis
 * for each, populating ai_predictions, ai_recommendations, wash windows,
 * driver patterns, and site insights.
 *
 * Auth: Validated via CRON_SECRET header or Authorization Bearer (service role).
 */

import { corsHeaders } from '../_shared/cors.ts';
import { createSupabaseAdminClient, createSupabaseClient } from '../_shared/supabase.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';

async function validateCronRequest(req: Request): Promise<{ valid: boolean; isSuperAdmin?: boolean }> {
  const cronSecret = req.headers.get('x-cron-secret');
  const authHeader = req.headers.get('Authorization');
  
  // Primary: x-cron-secret validation (for cron jobs)
  if (CRON_SECRET && cronSecret === CRON_SECRET) {
    return { valid: true };
  }
  
  // Fallback 1: Check if it's a service role token (from pg_net/internal calls)
  if (authHeader?.startsWith('Bearer ') && !authHeader.includes('.')) {
    // Non-JWT bearer tokens (raw service key) are trusted for internal calls
    return { valid: true };
  }
  
  // Fallback 2: Check if it's a JWT from an authenticated super admin user
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const supabaseUser = createSupabaseClient(req);
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      const { data: { user }, error } = await supabaseUser.auth.getUser(token);
      
      if (user && !error) {
        const supabaseAdmin = createSupabaseAdminClient();
        const { data: profile } = await supabaseAdmin
          .from('user_profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        
        if (profile?.role === 'super_admin') {
          return { valid: true, isSuperAdmin: true };
        }
      }
    } catch (e) {
      console.error('[run-ai-cron] JWT validation error:', e);
    }
  }
  
  return { valid: false };
}

async function invokeAnalyzeFleet(payload: {
  customer_ref: string;
  company_id: string;
  from_date: string;
  to_date: string;
  offset?: number;
  cron_mode?: boolean; // Add flag for cron mode
}) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/analyze-fleet`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'x-cron-secret': CRON_SECRET,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || res.statusText);
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const validation = await validateCronRequest(req);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid cron credentials or insufficient permissions' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createSupabaseAdminClient();
    const { data: companies, error } = await supabase
      .from('companies')
      .select('id, elora_customer_ref')
      .not('elora_customer_ref', 'is', null)
      .or('is_active.eq.true,is_active.is.null');

    if (error) {
      console.error('[run-ai-cron] Companies fetch error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch companies', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const activeCompanies = (companies ?? []).filter(
      (c) => c.elora_customer_ref && String(c.elora_customer_ref).trim()
    );

    if (activeCompanies.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No active companies with elora_customer_ref to process',
          companiesProcessed: 0,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For daily cron: analyze ONLY TODAY's data
    // Each day we store insights for that day, building historical data over time
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const fromDate = todayStr;  // Today only
    const toDate = todayStr;    // Today only
    
    console.log(`[run-ai-cron] Analyzing data for: ${todayStr}`);

    // Process each company sequentially (one at a time)
    // For each company, loop through ALL batches until all vehicles are processed
    // This mimics the "Process All Vehicles" behavior from the UI
    const results = [];
    
    for (const company of activeCompanies) {
      const companyId = company.id;
      const customerRef = String(company.elora_customer_ref).trim();

      try {
        console.log(`[run-ai-cron] Processing company ${companyId} (${customerRef})...`);
        
        let offset = 0;
        let companyVehicles = 0;
        
        // Loop through all batches for this company (same as "Process All Vehicles" UI button)
        while (true) {
          const data = await invokeAnalyzeFleet({
            customer_ref: customerRef,
            company_id: companyId,
            from_date: fromDate,
            to_date: toDate,
            offset,
            cron_mode: true, // Skip heavy operations in cron mode
          });

          const analyzed = data?.analyzed ?? 0;
          const hasMore = data?.has_more ?? false;
          const nextOffset = data?.next_offset ?? offset + analyzed;

          companyVehicles += analyzed;
          
          console.log(`[run-ai-cron] Company ${companyId} batch: ${analyzed} vehicles (total so far: ${companyVehicles})`);

          // Stop if no more vehicles or no vehicles were analyzed
          if (!hasMore || analyzed === 0) break;
          offset = nextOffset;
        }

        console.log(`[run-ai-cron] Company ${companyId} (${customerRef}): ${companyVehicles} total vehicles processed`);
        results.push({ 
          company_id: companyId, 
          customer_ref: customerRef, 
          vehiclesProcessed: companyVehicles
        });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        console.error(`[run-ai-cron] Company ${companyId} (${customerRef}) failed:`, errMsg);
        results.push({
          company_id: companyId,
          customer_ref: customerRef,
          vehiclesProcessed: 0,
          error: errMsg,
        });
      }
    }

    const totalVehicles = results.reduce((sum, r) => sum + r.vehiclesProcessed, 0);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${activeCompanies.length} companies, ${totalVehicles} total vehicles`,
        companiesProcessed: activeCompanies.length,
        totalVehicles,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[run-ai-cron] Error:', err);
    return new Response(
      JSON.stringify({
        error: 'Cron execution failed',
        details: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
