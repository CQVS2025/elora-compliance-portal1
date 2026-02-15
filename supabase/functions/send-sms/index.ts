import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createSupabaseAdminClient } from '../_shared/supabase.ts';

/**
 * Send SMS via Twilio for wash compliance reminders.
 *
 * Required Supabase secrets:
 * - TWILIO_ACCOUNT_SID
 * - TWILIO_AUTH_TOKEN
 * - TWILIO_PHONE_NUMBER (or MESSAGING_SERVICE_SID)
 *
 * Request body:
 * - template_id: 1 | 2 | 3 (Friendly / Direct / Data-Focused)
 * - Single: { vehicle_ref, vehicle_name, driver_phone, site_name, washes_remaining, weekly_target, washes_completed, optimal_window, company_id }
 * - Bulk: { reminders: [...], company_id, template_id }
 */

const TWILIO_API_BASE = 'https://api.twilio.com/2010-04-01';

const SMS_TEMPLATES: Record<number, string> = {
  1: `Hi, your vehicle {{VEHICLE_ID}} at {{SITE}} has not hit its wash target yet. A quick wash before end of day keeps you on track. Wash bays are quietest between {{OPTIMAL_WINDOW}}. - ELORA`,
  2: `Wash reminder: {{VEHICLE_ID}} is due at {{SITE}}.
You're {{WASHES_REMAINING}} wash(es) short of your target.
Best time to go: {{OPTIMAL_WINDOW}}.
Let's get it done today — ELORA`,
  3: `{{VEHICLE_ID}} wash due at {{SITE}}.
Target: {{WEEKLY_TARGET}} | Done: {{WASHES_COMPLETED}}.
Recommended window: {{OPTIMAL_WINDOW}}.
— ELORA`,
};

function replacePlaceholders(
  template: string,
  data: {
    vehicle_id: string;
    site: string;
    washes_remaining: number;
    weekly_target: number;
    washes_completed: number;
    optimal_window: string;
  }
): string {
  return template
    .replace(/\{\{VEHICLE_ID\}\}/g, data.vehicle_id || 'Your vehicle')
    .replace(/\{\{SITE\}\}/g, data.site || 'your site')
    .replace(/\{\{WASHES_REMAINING\}\}/g, String(data.washes_remaining ?? 0))
    .replace(/\{\{WEEKLY_TARGET\}\}/g, String(data.weekly_target ?? 0))
    .replace(/\{\{WASHES_COMPLETED\}\}/g, String(data.washes_completed ?? 0))
    .replace(/\{\{OPTIMAL_WINDOW\}\}/g, data.optimal_window || '6-8am');
}

function buildMessage(
  templateId: number,
  item: {
    vehicle_name?: string | null;
    vehicle_ref?: string;
    site_name?: string | null;
    site_ref?: string | null;
    current_week_washes?: number | null;
    target_washes?: number | null;
    optimal_window?: string | null;
  }
): string {
  // Same target logic as Compliance page: protocolNumber ?? washesPerWeek ?? 12
  const template = SMS_TEMPLATES[templateId] ?? SMS_TEMPLATES[2];
  const target = Number(item.target_washes ?? 12);
  const completed = Number(item.current_week_washes ?? 0);
  const remaining = Math.max(0, target - completed);
  const data = {
    vehicle_id: item.vehicle_name || item.vehicle_ref || 'Your vehicle',
    site: item.site_name || item.site_ref || 'your site',
    washes_remaining: remaining,
    weekly_target: target,
    washes_completed: completed,
    optimal_window: (item.optimal_window || '6-8am').trim(),
  };
  return replacePlaceholders(template, data);
}

async function sendTwilioSms(to: string, body: string, fromOrMessagingSid: string): Promise<{ sid: string; status: string }> {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');

  if (!accountSid || !authToken) {
    throw new Error('Twilio not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in Supabase secrets.');
  }

  const url = `${TWILIO_API_BASE}/Accounts/${accountSid}/Messages.json`;
  const params: Record<string, string> = {
    To: to.replace(/\s/g, ''),
    Body: body,
  };
  if (fromOrMessagingSid.startsWith('MG')) {
    params.MessagingServiceSid = fromOrMessagingSid;
  } else {
    params.From = fromOrMessagingSid;
  }
  const formBody = new URLSearchParams(params);

  const auth = btoa(`${accountSid}:${authToken}`);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${auth}`,
    },
    body: formBody.toString(),
  });

  const json = await response.json();
  if (!response.ok) {
    const errMsg = json.message || json.error_message || response.statusText;
    throw new Error(`Twilio error: ${errMsg}`);
  }

  return { sid: json.sid, status: json.status };
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = await req.json().catch(() => ({}));
    const { vehicle_ref, vehicle_name, driver_name, driver_phone, risk_level, company_id, reminders, template_id } = body;

    const templateId = [1, 2, 3].includes(Number(template_id)) ? Number(template_id) : 2;

    const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER') || Deno.env.get('TWILIO_MESSAGING_SERVICE_SID');
    if (!fromNumber) {
      return new Response(
        JSON.stringify({ error: 'Twilio phone number not configured. Set TWILIO_PHONE_NUMBER in Supabase secrets.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createSupabaseAdminClient();

    const items = Array.isArray(reminders) && reminders.length > 0
      ? reminders
      : vehicle_ref && driver_phone
        ? [{ vehicle_ref, vehicle_name, driver_name, driver_phone, risk_level, site_name: body.site_name, site_ref: body.site_ref, current_week_washes: body.current_week_washes, target_washes: body.target_washes, optimal_window: body.optimal_window }]
        : [];

    if (items.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Provide vehicle_ref and driver_phone, or reminders array with driver_phone for each.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: { vehicle_ref: string; status: string; sid?: string; error?: string }[] = [];
    const companyId = company_id || body.company_id;

    for (const item of items) {
      const phone = (item.driver_phone || '').trim();
      if (!phone) {
        results.push({ vehicle_ref: item.vehicle_ref, status: 'skipped', error: 'No phone number' });
        continue;
      }

      const message = buildMessage(templateId, item);

      try {
        const twilioResult = await sendTwilioSms(phone, message, fromNumber);

        await supabase.from('sms_reminders').insert({
          company_id: companyId || null,
          vehicle_ref: item.vehicle_ref,
          vehicle_name: item.vehicle_name || null,
          driver_name: item.driver_name || null,
          driver_phone: phone,
          message,
          risk_level: item.risk_level || null,
          status: 'sent',
          sent_at: new Date().toISOString(),
          twilio_message_sid: twilioResult.sid,
        });

        results.push({ vehicle_ref: item.vehicle_ref, status: 'sent', sid: twilioResult.sid });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);

        await supabase.from('sms_reminders').insert({
          company_id: companyId || null,
          vehicle_ref: item.vehicle_ref,
          vehicle_name: item.vehicle_name || null,
          driver_name: item.driver_name || null,
          driver_phone: phone,
          message,
          risk_level: item.risk_level || null,
          status: 'failed',
          error_message: errMsg,
        });

        results.push({ vehicle_ref: item.vehicle_ref, status: 'failed', error: errMsg });
      }
    }

    const sent = results.filter((r) => r.status === 'sent').length;
    const failed = results.filter((r) => r.status === 'failed').length;

    return new Response(
      JSON.stringify({
        sent,
        failed,
        total: results.length,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('send-sms error:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
