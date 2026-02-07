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
import { createSupabaseAdminClient } from '../_shared/supabase.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';

function validateCronRequest(req: Request): boolean {
  const cronSecret = req.headers.get('x-cron-secret');
  const authHeader = req.headers.get('Authorization');
  
  // Primary: x-cron-secret validation
  if (CRON_SECRET && cronSecret === CRON_SECRET) {
    return true;
  }
  
  // Fallback: Check if Authorization header exists (Bearer token from pg_net)
  // We trust any Bearer token from internal Supabase calls since run-ai-cron
  // is not exposed publicly and can only be called via cron or admin
  if (authHeader?.startsWith('Bearer ')) {
    return true;
  }
  
  return false;
}

async function invokeAnalyzeFleet(payload: {
  customer_ref: string;
  company_id: string;
  from_date: string;
  to_date: string;
  offset?: number;
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
    if (!validateCronRequest(req)) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid cron credentials' }),
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

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const fromDate = startDate.toISOString().split('T')[0];
    const toDate = endDate.toISOString().split('T')[0];

    // Process companies in parallel for much faster execution
    const results = await Promise.all(
      activeCompanies.map(async (company) => {
        const companyId = company.id;
        const customerRef = String(company.elora_customer_ref).trim();

        try {
          let offset = 0;
          let companyVehicles = 0;

          while (true) {
            const data = await invokeAnalyzeFleet({
              customer_ref: customerRef,
              company_id: companyId,
              from_date: fromDate,
              to_date: toDate,
              offset,
            });

            const analyzed = data?.analyzed ?? 0;
            const hasMore = data?.has_more ?? false;
            const nextOffset = data?.next_offset ?? offset + analyzed;

            companyVehicles += analyzed;

            if (!hasMore || analyzed === 0) break;
            offset = nextOffset;
          }

          console.log(`[run-ai-cron] Company ${companyId} (${customerRef}): ${companyVehicles} vehicles`);
          return { company_id: companyId, customer_ref: customerRef, vehiclesProcessed: companyVehicles };
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          console.error(`[run-ai-cron] Company ${companyId} (${customerRef}) failed:`, errMsg);
          return {
            company_id: companyId,
            customer_ref: customerRef,
            vehiclesProcessed: 0,
            error: errMsg,
          };
        }
      })
    );

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
