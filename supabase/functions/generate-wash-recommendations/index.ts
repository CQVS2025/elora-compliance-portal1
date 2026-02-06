import { createSupabaseAdminClient } from '../_shared/supabase.ts';
import { corsHeaders } from '../_shared/cors.ts';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.32.1';

const SYSTEM_PROMPT = `You are an AI assistant for ELORA Fleet Compliance Portal, a vehicle wash compliance system for concrete mixer trucks. Analyze wash patterns and recommend optimal wash times. Consider MPA load ratings, delivery frequency, driver behavior. Respond only in valid JSON.`;

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
      recent_wash_times = '',
      mpa_rating = 'Standard',
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
    const prompt = `Generate wash recommendations for this vehicle.

Vehicle: ${vehicle_name || vehicle_ref}
Site: ${site_name || site_ref || 'Unknown'}
Driver: ${driver_name || 'Unknown'}
MPA Rating: ${mpa_rating}
Weekly Target: ${target_washes} washes
Current Week: ${current_week_washes} washes
${recent_wash_times ? `Recent wash times: ${recent_wash_times}` : ''}

Respond in JSON only:
{
  "recommendations": [
    {
      "type": "wash_schedule|frequency_increase|reminder_timing|pattern_alert",
      "priority": "critical|high|medium|low",
      "title": "short title",
      "description": "detailed explanation",
      "suggested_action": "optional",
      "suggested_time": "HH:MM or null",
      "confidence_score": 0-100,
      "potential_compliance_gain": 0-100
    }
  ]
}`;

    const message = await anthropic.messages.create({
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content?.[0]?.type === 'text' ? (message.content[0] as { text: string }).text : '';
    const parsed = parseJsonFromContent(text);
    const recommendations = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];

    for (const r of recommendations) {
      await supabase.from('ai_recommendations').insert({
        company_id: company_id || null,
        vehicle_ref,
        vehicle_name: vehicle_name || null,
        driver_name: driver_name || null,
        site_ref: site_ref || null,
        site_name: site_name || null,
        recommendation_type: r.type || 'wash_schedule',
        priority: r.priority || 'medium',
        title: r.title || 'Recommendation',
        description: r.description || '',
        suggested_action: r.suggested_action || null,
        suggested_time: r.suggested_time || null,
        confidence_score: r.confidence_score ?? null,
        potential_compliance_gain: r.potential_compliance_gain ?? null,
        status: 'pending',
      });
    }

    return new Response(JSON.stringify({ count: recommendations.length, recommendations }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    console.error('generate-wash-recommendations error:', err);
    return new Response(
      JSON.stringify({ error: err?.message ?? 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
