import { createSupabaseAdminClient } from '../_shared/supabase.ts';
import { corsHeaders } from '../_shared/cors.ts';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.32.1';

const SYSTEM_PROMPT = `You are an AI assistant for ELORA Fleet Compliance Portal, a vehicle wash compliance monitoring system for concrete mixer trucks. Your role is to analyze wash data and provide actionable risk insights. Each vehicle has a weekly wash target (typically 6 washes/week). Respond only in valid JSON.`;

interface VehicleInput {
  vehicle_ref: string;
  vehicle_name?: string | null;
  site_ref?: string | null;
  site_name?: string | null;
  driver_name?: string | null;
  customer_ref?: string | null;
  current_week_washes?: number;
  target_washes?: number;
  days_remaining?: number;
  wash_history_summary?: string;
}

interface VehicleResult {
  vehicle_ref: string;
  risk_level: 'critical' | 'high' | 'medium' | 'low';
  risk_score: number;
  hours_until_risk: number | null;
  confidence_score: number;
  reasoning: string;
  recommended_action: string;
}

function parseJsonFromContent(text: string): { results: VehicleResult[] } {
  const trimmed = text.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}') + 1;
  if (start === -1 || end <= start) throw new Error('No JSON object in response');
  return JSON.parse(trimmed.slice(start, end)) as { results: VehicleResult[] };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { company_id = null, customer_ref = null, site_ref = null, vehicles = [] } = body as { 
      company_id?: string | null; 
      customer_ref?: string | null;
      site_ref?: string | null;
      vehicles?: VehicleInput[] 
    };

    if (!Array.isArray(vehicles) || vehicles.length === 0) {
      return new Response(
        JSON.stringify({ error: 'vehicles array is required and must be non-empty' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createSupabaseAdminClient();
    const { data: settingsRows } = await supabase.from('ai_settings').select('value').eq('key', 'default_ai_model');
    const model = settingsRows?.[0]?.value ?? 'claude-sonnet-4-20250514';

    const vehicleBlocks = vehicles.map(
      (v, i) =>
        `[Vehicle ${i + 1}] vehicle_ref: ${v.vehicle_ref}
  Name: ${v.vehicle_name || v.vehicle_ref}
  Driver: ${v.driver_name || 'Unknown'}
  Site: ${v.site_name || v.site_ref || 'Unknown'}
  Weekly Target: ${v.target_washes ?? 6} washes
  Current Week Washes: ${v.current_week_washes ?? 0}
  Days Remaining in Week: ${v.days_remaining ?? 0}
  ${v.wash_history_summary ? `Summary: ${v.wash_history_summary}` : ''}`
    );

    const prompt = `Analyze wash compliance risk for each of the following vehicles. Return one risk analysis per vehicle in the same order (Vehicle 1, 2, 3...).

${vehicleBlocks.join('\n\n')}

Respond with a single JSON object only, no markdown:
{
  "results": [
    {
      "vehicle_ref": "<exact vehicle_ref from Vehicle 1>",
      "risk_level": "critical|high|medium|low",
      "risk_score": 0-100,
      "hours_until_risk": number or null,
      "confidence_score": 0-100,
      "reasoning": "short explanation",
      "recommended_action": "specific action"
    },
    ... one object per vehicle in the same order
  ]
}`;

    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model,
      max_tokens: 8192, // Increased for larger batches (was 4096)
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content?.[0]?.type === 'text' ? (message.content[0] as { text: string }).text : '';
    const parsed = parseJsonFromContent(text);
    const results: VehicleResult[] = Array.isArray(parsed.results) ? parsed.results : [];

    const predictionDate = new Date().toISOString().split('T')[0];
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    let inserted = 0;
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const input = vehicles[i];
      if (!input?.vehicle_ref) continue;
      const vehicleRef = r.vehicle_ref ?? input.vehicle_ref;
      const riskLevel = ['critical', 'high', 'medium', 'low'].includes(r.risk_level) ? r.risk_level : 'medium';
      const riskScore = Math.min(100, Math.max(0, Number(r.risk_score) ?? 50));

      const { error: insertError } = await supabase.from('ai_predictions').insert({
        company_id: company_id || null,
        customer_ref: input.customer_ref || customer_ref || null,
        vehicle_ref: vehicleRef,
        vehicle_name: input.vehicle_name ?? null,
        site_ref: input.site_ref ?? site_ref ?? null,
        site_name: input.site_name ?? null,
        driver_name: input.driver_name ?? null,
        prediction_date: predictionDate,
        risk_level: riskLevel,
        risk_score: riskScore,
        hours_until_risk: r.hours_until_risk ?? null,
        confidence_score: r.confidence_score ?? null,
        reasoning: r.reasoning ?? null,
        recommended_action: r.recommended_action ?? null,
        expires_at: expiresAt,
      });

      if (!insertError) inserted++;
      else console.warn(`ai_predictions insert skip ${vehicleRef}:`, insertError.message);
    }

    return new Response(
      JSON.stringify({ count: inserted, total: vehicles.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (err) {
    console.error('analyze-vehicle-risk-batch error:', err);
    return new Response(
      JSON.stringify({ error: err?.message ?? 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
