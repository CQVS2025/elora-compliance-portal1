import { corsHeaders, handleCors } from '../_shared/cors.ts';

/**
 * Send Pricing Calculator report email to one recipient (e.g. current user).
 * Body: { to: string, subject?: string, html: string, pdfBase64?: string, pdfFilename?: string }
 * Uses MAILGUN_API_KEY and MAILGUN_DOMAIN.
 */

type Attachment = { filename: string; content: string; type?: 'text' | 'base64'; contentType?: string };

async function sendViaMailgun(
  to: string,
  subject: string,
  html: string,
  from: string,
  attachments?: Attachment[]
): Promise<void> {
  const apiKey = Deno.env.get('MAILGUN_API_KEY');
  const domain = Deno.env.get('MAILGUN_DOMAIN');
  const baseUrl = Deno.env.get('MAILGUN_BASE_URL') || 'https://api.mailgun.net';
  if (!apiKey || !domain) throw new Error('MAILGUN_API_KEY and MAILGUN_DOMAIN must be set');
  const url = `${baseUrl.replace(/\/$/, '')}/v3/${domain}/messages`;
  const formData = new FormData();
  formData.append('from', from);
  formData.append('to', to);
  formData.append('subject', subject);
  formData.append('html', html);
  if (attachments?.length) {
    for (const a of attachments) {
      const contentType = a.contentType || (a.type === 'base64' ? 'application/octet-stream' : 'text/plain');
      const blob = a.type === 'base64'
        ? new Blob([Uint8Array.from(atob(a.content), (c) => c.charCodeAt(0))], { type: contentType })
        : new Blob([a.content], { type: contentType });
      formData.append('attachment', blob, a.filename);
    }
  }
  const auth = btoa(`api:${apiKey}`);
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}` },
    body: formData,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Mailgun: ${text}`);
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = await req.json();
    const { to, subject, html, pdfBase64, pdfFilename } = body;

    if (!to || typeof to !== 'string' || !to.includes('@')) {
      return new Response(JSON.stringify({ error: 'Valid recipient email (to) is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const mailgunDomain = Deno.env.get('MAILGUN_DOMAIN') || 'sandbox.mailgun.org';
    const fromAddr = `ELORA Compliance <postmaster@${mailgunDomain}>`;
    const subj = subject || 'Pricing Calculator Report';
    const attachments: Attachment[] = [];
    if (pdfBase64 && pdfFilename) {
      attachments.push({
        filename: pdfFilename,
        content: pdfBase64,
        type: 'base64',
        contentType: 'application/pdf',
      });
    }

    await sendViaMailgun(to, subj, html || '<p>Pricing Calculator report attached.</p>', fromAddr, attachments.length ? attachments : undefined);

    return new Response(JSON.stringify({
      success: true,
      message: 'Report sent successfully',
      recipient: to,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('sendPricingCalculatorReport error:', err);
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : 'Internal server error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
