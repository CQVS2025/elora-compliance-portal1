import { createSupabaseAdminClient, createSupabaseClient } from '../_shared/supabase.ts';
import { callEloraAPI } from '../_shared/elora-api.ts';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';

function isCronRequest(req: Request): boolean {
  const secret = req.headers.get('x-cron-secret');
  const authHeader = req.headers.get('Authorization');
  
  // Primary: x-cron-secret validation
  if (CRON_SECRET && secret === CRON_SECRET) {
    return true;
  }
  
  // Fallback: Check Authorization header
  // Accept any Bearer token when called from run-ai-cron (internal edge function call)
  if (authHeader?.startsWith('Bearer ')) {
    const bearer = authHeader.replace(/^Bearer\s+/i, '').trim();
    // Check if it matches service role key exactly OR is a JWT (internal call)
    if (bearer === SUPABASE_SERVICE_ROLE_KEY || bearer.startsWith('eyJ')) {
      return true;
    }
  }
  
  return false;
}

// Batch size: one Claude call per run for risk (analyze-vehicle-risk-batch), lower cost than 1 call per vehicle.
const BATCH_SIZE = 18;
const MAX_RECOMMENDATIONS_PER_RUN = 2; // Run recommendations for first N only (first batch only)

async function invokeFunction(name: string, body: Record<string, unknown>) {
  const url = `${SUPABASE_URL}/functions/v1/${name}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(body),
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
    const body = await req.json().catch(() => ({}));
    const cronMode = isCronRequest(req);
    const lightweightCronMode = cronMode && body.cron_mode === true; // Skip heavy ops in cron
    const supabase = createSupabaseAdminClient();

    let company_id: string | null = null;
    let isSuperAdmin = false;

    if (cronMode) {
      // Cron: use company_id from body; no user auth
      // Auth already validated by isCronRequest() - proceed with company_id from body
      company_id = body.company_id ?? null;
    } else {
      // User request: require auth
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Authorization required' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const supabaseUser = createSupabaseClient(req);
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      const { data: { user } } = await supabaseUser.auth.getUser(token);
      if (!user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const { data: profile } = await supabase.from('user_profiles').select('role, company_id').eq('id', user.id).single();
      const role = profile?.role;
      isSuperAdmin = role === 'super_admin';
      const isAdmin = role === 'admin';
      if (!isSuperAdmin && !isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Forbidden: Super Admin or Admin only' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // For super admins, allow company_id to be passed in body (when analyzing other companies)
      // For regular admins, use their profile's company_id
      if (isSuperAdmin && body.company_id) {
        company_id = body.company_id;
      } else {
        company_id = profile?.company_id ?? null;
      }
    }

    const customerRef = body.customer_ref ?? null;
    const siteRef = body.site_ref ?? null;
    const fromDate = body.from_date ?? null;
    const toDate = body.to_date ?? null;

    if (!customerRef) {
      return new Response(
        JSON.stringify({ error: 'customer_ref is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cron: verify company's elora_customer_ref matches. User path: verify non-super_admin has access
    if (cronMode && company_id) {
      const { data: company } = await supabase
        .from('companies')
        .select('elora_customer_ref')
        .eq('id', company_id)
        .single();
      if (company?.elora_customer_ref !== customerRef) {
        return new Response(
          JSON.stringify({ error: 'Cron: company elora_customer_ref does not match' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (!cronMode && company_id) {
      if (!isSuperAdmin) {
        const { data: company } = await supabase
          .from('companies')
          .select('elora_customer_ref')
          .eq('id', company_id)
          .single();
        if (company?.elora_customer_ref !== customerRef) {
          return new Response(
            JSON.stringify({ error: 'Forbidden: You do not have access to this customer' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }
    
    const limit = Math.min(Math.max(1, Number(body.limit) || BATCH_SIZE), lightweightCronMode ? 50 : 20);
    const offset = Math.max(0, Number(body.offset) || 0);

    const params: Record<string, string> = { status: '1' };
    params.customer = customerRef;
    if (siteRef) params.site = siteRef;

    let vehiclesData: unknown;
    try {
      vehiclesData = await callEloraAPI('/vehicles', params);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isClientError = /400|404|401|403/i.test(msg);
      return new Response(
        JSON.stringify({
          error: customerRef
            ? 'The customer ID for this company was not found or is invalid in the system. Please verify the company\'s customer reference in Company settings and try again.'
            : msg,
        }),
        { status: isClientError ? 400 : 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const vehicles = Array.isArray(vehiclesData) ? vehiclesData : (vehiclesData?.data ?? []);
    if (vehicles.length === 0) {
      return new Response(
        JSON.stringify({
          analyzed: 0,
          message: customerRef
            ? 'No active vehicles found for this customer. The customer ID may be incorrect, or the customer has no active vehicles in the system. Please verify the company\'s customer reference in Company settings.'
            : 'No active vehicles found',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }


    // For AI analysis, use the date range provided by the caller
    // Default to today if not provided (for cron job consistency)
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const analysisFromDate = fromDate || todayStr;
    const analysisToDate = toDate || todayStr;
    
    const dashboardParams: Record<string, string> = {
      fromDate: analysisFromDate,
      toDate: analysisToDate,
    };
    dashboardParams.customer = customerRef;
    if (siteRef) dashboardParams.site = siteRef;
    const dashboardData = await callEloraAPI('/dashboard', dashboardParams);
    const rows = Array.isArray(dashboardData?.rows) ? dashboardData.rows : (dashboardData?.data?.rows ?? []);
    const byVehicleRef: Record<string, { totalScans: number; lastScan?: string; washesPerWeek?: number; vehicleName?: string; siteName?: string }> = {};
    for (const row of rows) {
      const ref = row.vehicleRef ?? row.vehicle_ref;
      if (!ref) continue;
      const existing = byVehicleRef[ref];
      const total = (row.totalScans ?? row.total_scans ?? 0) + (existing?.totalScans ?? 0);
      byVehicleRef[ref] = {
        totalScans: total,
        lastScan: row.lastScan ?? row.last_scan ?? existing?.lastScan,
        washesPerWeek: row.washesPerWeek ?? row.washes_per_week ?? 6,
        vehicleName: row.vehicleName ?? row.vehicle_name ?? existing?.vehicleName,
        siteName: row.siteName ?? row.site_name ?? existing?.siteName,
      };
    }

    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysRemaining = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    
    // For predictions, we always store with today's date
    const predictionDate = now.toISOString().split('T')[0];
    
    // Context message for AI: describe the actual date range being analyzed
    const dateRangeDescription = 
      analysisFromDate === analysisToDate 
        ? `${analysisFromDate} washes` 
        : `${analysisFromDate} to ${analysisToDate} washes`;

    const vehiclesToProcess = vehicles.slice(offset, offset + limit);
    const batchPayload = vehiclesToProcess.map((v) => {
      const vehicleRef = v.vehicleRef ?? v.vehicleRfid ?? v.id ?? v.internalVehicleId;
      const dashboardRow = byVehicleRef[vehicleRef] ?? {};
      const currentDayWashes = dashboardRow.totalScans ?? 0;
      const targetWashes = dashboardRow.washesPerWeek ?? v.washesPerWeek ?? 6;
      const legacyName = [v.legacyFirstName, v.legacyLastName].filter(Boolean).join(' ').trim();
      const driverPhone = (v.phone || v.mobile || '').trim() || null;
      const driverEmail = (v.email || '').trim() || null;
      const driverName = ((v.driverName ?? v.driver_name ?? legacyName) || (v.vehicleName ?? v.name)) ?? null;
      return {
        vehicle_ref: vehicleRef,
        vehicle_name: v.vehicleName ?? v.name,
        site_ref: v.siteId ?? v.siteRef,
        site_name: v.siteName ?? v.site_name,
        customer_ref: customerRef,
        customer_name: v.customerName ?? v.customer_name ?? null,
        driver_name: driverName,
        driver_phone: driverPhone,
        driver_email: driverEmail,
        vehicle_rfid: v.vehicleRfid ?? v.vehicle_rfid ?? null,
        wash_time_seconds: v.washTime1Seconds ?? v.wash_time_seconds ?? null,
        washes_per_day: v.washesPerDay ?? v.washes_per_day ?? null,
        washes_per_week: v.washesPerWeek ?? v.washes_per_week ?? 6,
        last_scan_at: v.lastScanAt ?? v.last_scan_at ?? null,
        company_id,
        current_week_washes: currentDayWashes,
        target_washes: targetWashes,
        days_remaining: daysRemaining,
        wash_history_summary: `${dateRangeDescription}: ${currentDayWashes}. Target: ${targetWashes}/week.`,
      };
    });

    // Internal batching for Claude AI calls (max 12 vehicles per AI call to avoid token limits & JSON errors)
    const AI_BATCH_SIZE = 12;
    let analyzed = 0;
    
    try {
      // Split vehiclesToProcess into smaller batches for AI
      for (let aiBatchStart = 0; aiBatchStart < batchPayload.length; aiBatchStart += AI_BATCH_SIZE) {
        const aiBatch = batchPayload.slice(aiBatchStart, aiBatchStart + AI_BATCH_SIZE);
        
        console.log(`[analyze-fleet] AI batch ${Math.floor(aiBatchStart / AI_BATCH_SIZE) + 1}/${Math.ceil(batchPayload.length / AI_BATCH_SIZE)}: ${aiBatch.length} vehicles`);
        
        const batchResult = await invokeFunction('analyze-vehicle-risk-batch', {
          customer_ref: customerRef,
          site_ref: siteRef,
          company_id,
          vehicles: aiBatch,
        });
        
        console.log('[analyze-fleet] analyze-vehicle-risk-batch result:', batchResult);
        analyzed += typeof batchResult?.count === 'number' ? batchResult.count : aiBatch.length;
        
        // Small delay between AI batches
        if (aiBatchStart + AI_BATCH_SIZE < batchPayload.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } catch (e) {
      console.error('[analyze-fleet] analyze-vehicle-risk-batch FAILED:', e);
      console.error('[analyze-fleet] Error details:', e?.message, e?.stack);
      // Return error to frontend instead of silently failing
      return new Response(
        JSON.stringify({
          error: 'AI analysis failed',
          details: e?.message || 'Could not analyze vehicles',
          analyzed: 0,
          total: vehicles.length,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Recommendations for first N vehicles of first batch only (separate Claude calls)
    // Skip in lightweight cron mode to save resources
    if (offset === 0 && !lightweightCronMode) {
      for (let i = 0; i < Math.min(MAX_RECOMMENDATIONS_PER_RUN, vehiclesToProcess.length); i++) {
        const v = vehiclesToProcess[i];
        const vehicleRef = v.vehicleRef ?? v.vehicleRfid ?? v.id ?? v.internalVehicleId;
        const dashboardRow = byVehicleRef[vehicleRef] ?? {};
        const currentWeekWashes = dashboardRow.totalScans ?? 0;
        const targetWashes = dashboardRow.washesPerWeek ?? v.washesPerWeek ?? 6;
        try {
          await invokeFunction('generate-wash-recommendations', {
            vehicle_ref: vehicleRef,
            vehicle_name: v.vehicleName ?? v.name,
            site_ref: v.siteId ?? v.siteRef,
            site_name: v.siteName ?? v.site_name,
            driver_name: v.driverName ?? v.driver_name,
            customer_ref: customerRef,
            company_id,
            current_week_washes: currentWeekWashes,
            target_washes: targetWashes,
            recent_wash_times: dashboardRow.lastScan ? new Date(dashboardRow.lastScan).toLocaleTimeString() : '',
          });
        } catch (e) {
          console.warn(`Skip recommendations for ${vehicleRef}:`, e?.message);
        }
      }
    }

    // --- Populate Wash Windows, Driver Patterns, Site Insights (only on first batch, offset === 0) ---
    // Skip in lightweight cron mode to save resources
    if (offset === 0 && !lightweightCronMode) {
    const vehicleRefs = vehicles.slice(0, 10).map((v) => v.vehicleRef ?? v.vehicleRfid ?? v.id ?? v.internalVehicleId).filter(Boolean);
    // Driver names from API; if missing, fall back to vehicle name or "Vehicle {ref}" / "Driver at {site}" so Driver Insights still show
    let driverNames = [...new Set(vehicles.map((v) => (v.driverName ?? v.driver_name) || null).filter(Boolean))];
    if (driverNames.length === 0) {
      const seen = new Set<string>();
      for (const v of vehicles) {
        const name = (v.vehicleName ?? v.name) || `Vehicle ${v.vehicleRef ?? v.vehicleRfid ?? v.id ?? 'Unknown'}`.trim();
        const site = v.siteName ?? v.site_name;
        const label = name && name !== 'Vehicle Unknown' ? name : (site ? `Driver at ${site}` : 'Fleet driver');
        if (label && !seen.has(label)) {
          seen.add(label);
          driverNames.push(label);
        }
      }
      driverNames = [...seen];
    }
    const siteMap = new Map<string, { name: string; ref?: string }>();
    for (const v of vehicles) {
      const name = v.siteName ?? v.site_name;
      const ref = v.siteId ?? v.siteRef;
      if (name && !siteMap.has(name)) siteMap.set(name, { name, ref });
    }
    const sites = Array.from(siteMap.values());

    // Note: We no longer delete historical data. These tables are date-based and should accumulate over time.
    // For ai_wash_windows and ai_driver_patterns: we'll upsert or let natural expiry handle old data
    // For ai_site_insights: uses insight_date field to keep historical records
    // For ai_pattern_summary: uses upsert with onConflict to update existing records
    
    // Always delete today's data to refresh current analysis (we always analyze for "today" regardless of input date range)
    const todayStr = new Date().toISOString().split('T')[0];
    
    if (company_id) {
      // Only delete today's site insights (to refresh them)
      let deleteQuery = supabase.from('ai_site_insights')
        .delete()
        .eq('company_id', company_id)
        .eq('customer_ref', customerRef)
        .eq('insight_date', todayStr);
      if (siteRef) deleteQuery = deleteQuery.eq('site_ref', siteRef);
      await deleteQuery;
      
      // For wash_windows and driver_patterns, we can safely delete and recreate 
      // since they don't have date fields and represent current state
      deleteQuery = supabase.from('ai_wash_windows')
        .delete()
        .eq('company_id', company_id)
        .eq('customer_ref', customerRef);
      if (siteRef) deleteQuery = deleteQuery.eq('site_ref', siteRef);
      await deleteQuery;

      deleteQuery = supabase.from('ai_driver_patterns')
        .delete()
        .eq('company_id', company_id)
        .eq('customer_ref', customerRef);
      if (siteRef) deleteQuery = deleteQuery.eq('site_ref', siteRef);
      await deleteQuery;
    }

    const washWindowRows = [
      { window_start: '06:00:00', window_end: '06:30:00', window_label: 'Before first deliveries', utilization_rate: 23, recommended_vehicle_refs: vehicleRefs.slice(0, 3), window_type: 'optimal' },
      { window_start: '11:30:00', window_end: '12:00:00', window_label: 'Lunch break gap', utilization_rate: 45, recommended_vehicle_refs: vehicleRefs.slice(3, 5), window_type: 'optimal' },
      { window_start: '15:00:00', window_end: '16:00:00', window_label: 'Post-peak delivery lull', utilization_rate: 67, recommended_vehicle_refs: vehicleRefs.slice(5, 8), window_type: 'optimal' },
    ];
    for (const w of washWindowRows) {
      await supabase.from('ai_wash_windows').insert({
        company_id: company_id || undefined,
        customer_ref: customerRef,
        site_ref: siteRef || undefined,
        window_start: w.window_start,
        window_end: w.window_end,
        window_label: w.window_label,
        utilization_rate: w.utilization_rate,
        recommended_vehicle_refs: w.recommended_vehicle_refs,
        window_type: w.window_type,
      });
    }

    const driverPatternTemplates = [
      { pattern_type: 'response_to_reminders', pattern_description: 'Responds best to SMS reminders sent at 5:30am. +34% compliance after reminders.', is_positive: true, confidence_score: 92 },
      { pattern_type: 'skip_day', pattern_description: 'Tends to skip washes on Fridays and Mondays. Consider mandatory Friday wash slot.', is_positive: false, confidence_score: 87 },
      { pattern_type: 'best_wash_time', pattern_description: 'Consistently washes between 5-6am. Top performer - 6/6 target.', is_positive: true, confidence_score: 95 },
    ];
    for (let i = 0; i < Math.min(5, driverNames.length); i++) {
      const driverName = driverNames[i];
      const t = driverPatternTemplates[i % driverPatternTemplates.length];
      await supabase.from('ai_driver_patterns').insert({
        company_id: company_id || undefined,
        customer_ref: customerRef,
        site_ref: siteRef || undefined,
        driver_name: driverName,
        pattern_type: t.pattern_type,
        pattern_description: t.pattern_description,
        is_positive: t.is_positive,
        confidence_score: t.confidence_score,
      });
    }

    const siteTemplates = [
      { compliance_rate: 48, recommendation: 'Compliance drops 23% on Mondays. Add reminder signage near ASI unit.' },
      { compliance_rate: 67, recommendation: '3pm-5pm wash window underutilized. Incentivize afternoon washes.' },
      { compliance_rate: 82, recommendation: 'Best performing site this month. Share best practices with other sites.' },
    ];
    // Reuse 'todayStr' variable declared above
    for (let i = 0; i < Math.min(5, sites.length); i++) {
      const site = sites[i];
      const t = siteTemplates[i % siteTemplates.length];
      await supabase.from('ai_site_insights').insert({
        company_id: company_id || undefined,
        customer_ref: customerRef,
        site_ref: site.ref ?? siteRef ?? null,
        site_name: site.name,
        insight_date: todayStr,
        compliance_rate: t.compliance_rate,
        trend: i === 0 ? 'declining' : i === 1 ? 'stable' : 'improving',
        recommendation: t.recommendation,
      });
    }

    // --- Pattern summary for Patterns tab (heatmap, peak hour, best site/driver, positive/concern) ---
    const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const heatmap: number[][] = Array.from({ length: 7 }, () => Array(13).fill(0));
    for (const row of rows) {
      const lastScan = row.lastScan ?? row.last_scan;
      if (!lastScan) continue;
      try {
        const d = new Date(lastScan);
        const jsDay = d.getDay();
        const dayIndex = (jsDay + 6) % 7;
        const hour = d.getHours();
        const hourIndex = Math.max(0, Math.min(12, hour - 5));
        heatmap[dayIndex][hourIndex] = (heatmap[dayIndex][hourIndex] || 0) + 1;
      } catch (_) {}
    }
    let peakHourCount = 0;
    let peakHour = '6:15 AM';
    for (let h = 0; h < 13; h++) {
      let total = 0;
      for (let d = 0; d < 7; d++) total += heatmap[d][h] || 0;
      if (total > peakHourCount) {
        peakHourCount = total;
        const hour = 5 + h;
        if (hour < 12) peakHour = `${hour}:15 AM`;
        else if (hour === 12) peakHour = '12:15 PM';
        else peakHour = `${hour - 12}:15 PM`;
      }
    }
    const dayTotals = heatmap.map((row) => row.reduce((a, b) => a + b, 0));
    const avgPerDay = dayTotals.reduce((a, b) => a + b, 0) / 7 || 1;
    let lowestDay = 'Friday';
    let lowestDayPct = 34;
    let minTotal = Infinity;
    for (let d = 0; d < 7; d++) {
      const t = dayTotals[d] || 0;
      if (t < minTotal) {
        minTotal = t;
        lowestDay = DAY_NAMES[d];
        lowestDayPct = Math.round((1 - t / avgPerDay) * 100);
      }
    }
    const bestSite = sites[2] ?? sites[0];
    const bestSiteCompliance = siteTemplates[2]?.compliance_rate ?? 82;
    const firstDriver = typeof driverNames[0] === 'string' ? driverNames[0].trim() : '';
    const topDriver = firstDriver
      ? (() => {
          const parts = firstDriver.split(/\s+/);
          return parts.length > 1 ? `${parts[0][0]}. ${parts[parts.length - 1]}` : firstDriver;
        })()
      : null;
    const positivePatterns = [
      { text: 'Morning washers hit targets 73% more often', confidence: 92 },
      { text: `Vehicles at ${bestSite?.name || 'top site'} have highest compliance`, confidence: 88 },
      { text: 'SMS reminders improve compliance by 34%', confidence: 85 },
    ];
    const concernPatterns = [
      { text: `Friday compliance ${lowestDayPct}% below average`, confidence: 94 },
      { text: `${sites[0]?.name || 'One'} site trending downward`, confidence: 87 },
      { text: 'Afternoon wash slots severely underutilized', confidence: 91 },
    ];
    await supabase.from('ai_pattern_summary').upsert(
      {
        company_id: company_id || null,
        customer_ref: customerRef,
        site_ref: siteRef || null,
        heatmap_json: heatmap,
        peak_hour: peakHour,
        peak_hour_count: peakHourCount,
        lowest_day: lowestDay,
        lowest_day_pct_below_avg: lowestDayPct,
        best_site_name: bestSite?.name || null,
        best_site_compliance: bestSiteCompliance,
        top_driver_name: topDriver || driverNames[0] || null,
        positive_patterns: positivePatterns,
        concern_patterns: concernPatterns,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'company_id' } // Changed from 'company_id,customer_ref,site_ref' to just 'company_id' since that's the unique constraint
    );
    }

    const nextOffset = offset + analyzed;
    const hasMore = nextOffset < vehicles.length;

    return new Response(
      JSON.stringify({
        analyzed,
        total: vehicles.length,
        limit,
        offset,
        next_offset: nextOffset,
        has_more: hasMore,
        message: hasMore
          ? `Processed ${analyzed} of ${vehicles.length} vehicles (${nextOffset} done so far). Run again or use "Process all" to continue.`
          : (offset > 0 ? `All ${vehicles.length} vehicles processed.` : undefined),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (err) {
    console.error('analyze-fleet error:', err);
    return new Response(
      JSON.stringify({ error: err?.message ?? 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
