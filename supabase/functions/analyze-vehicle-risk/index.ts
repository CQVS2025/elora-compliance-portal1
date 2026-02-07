import { createSupabaseAdminClient } from '../_shared/supabase.ts';
import { corsHeaders } from '../_shared/cors.ts';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.32.1';

const SYSTEM_PROMPT = `You are an AI assistant for ELORA Fleet Compliance Portal, a vehicle wash compliance monitoring system for concrete mixer trucks. Your role is to analyze wash data and provide actionable risk insights. Each vehicle has a weekly wash target (typically 6 washes/week). Respond only in valid JSON.`;

function parseJsonFromContent(text) {
  const trimmed = text.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}') + 1;
  if (start === -1 || end <= start) throw new Error('No JSON object in response');
  return JSON.parse(trimmed.slice(start, end));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const {
      vehicle_ref,
      vehicle_name,
      site_ref,
      site_name,
      driver_name,
      company_id,
      current_week_washes = 0,
      target_washes = 6,
      days_remaining = 0,
      wash_history_summary = '',
    } = body;

    if (!vehicle_ref) {
      return new Response(
        JSON.stringify({ error: 'vehicle_ref is required' }),
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

    const anthropic = new Anthropic({ apiKey });
    const prompt = `Analyze this vehicle's wash compliance risk.

VEHICLE: ${vehicle_name || vehicle_ref}
Driver: ${driver_name || 'Unknown'}
Site: ${site_name || site_ref || 'Unknown'}
Weekly Target: ${target_washes} washes
Current Week Washes: ${current_week_washes}
Days Remaining in Week: ${days_remaining}
${wash_history_summary ? `Wash History Summary: ${wash_history_summary}` : ''}

Respond in JSON only, no markdown:
{
  "risk_level": "critical|high|medium|low",
  "risk_score": 0-100,
  "hours_until_risk": number or null,
  "confidence_score": 0-100,
  "reasoning": "short explanation",
  "recommended_action": "specific action"
}`;

    const message = await anthropic.messages.create({
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content?.[0]?.type === 'text' ? (message.content[0] as { text: string }).text : '';
    const analysis = parseJsonFromContent(text);

    const predictionDate = new Date().toISOString().split('T')[0];
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { error: insertError } = await supabase.from('ai_predictions').insert({
      company_id: company_id || null,
      vehicle_ref,
      vehicle_name: vehicle_name || null,
      site_ref: site_ref || null,
      site_name: site_name || null,
      driver_name: driver_name || null,
      prediction_date: predictionDate,
      risk_level: analysis.risk_level || 'medium',
      risk_score: Math.min(100, Math.max(0, Number(analysis.risk_score) || 50)),
      hours_until_risk: analysis.hours_until_risk ?? null,
      confidence_score: analysis.confidence_score ?? null,
      reasoning: analysis.reasoning ?? null,
      recommended_action: analysis.recommended_action ?? null,
      expires_at: expiresAt,
    });

    if (insertError) {
      console.error('ai_predictions insert error:', insertError);
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    console.error('analyze-vehicle-risk error:', err);
    return new Response(
      JSON.stringify({ error: err?.message ?? 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
