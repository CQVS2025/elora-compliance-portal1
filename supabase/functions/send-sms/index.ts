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
 * - Single: { vehicle_ref, vehicle_name, driver_name, driver_phone, risk_level, company_id }
 * - Bulk: { reminders: [{ vehicle_ref, vehicle_name, driver_name, driver_phone, risk_level }], company_id }
 */

const TWILIO_API_BASE = 'https://api.twilio.com/2010-04-01';

function buildMessage(vehicleName: string, riskLevel: string): string {
  const name = vehicleName || 'Your vehicle';
  const urgency = riskLevel === 'critical' ? 'URGENT: ' : riskLevel === 'high' ? 'Reminder: ' : '';
  return `${urgency}ELORA Fleet Compliance: ${name} needs a wash to meet compliance targets. Please complete your wash.`;
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
    const { vehicle_ref, vehicle_name, driver_name, driver_phone, risk_level, company_id, reminders } = body;

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
        ? [{ vehicle_ref, vehicle_name, driver_name, driver_phone, risk_level }]
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

      const message = buildMessage(item.vehicle_name || item.vehicle_ref, item.risk_level || 'medium');

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
