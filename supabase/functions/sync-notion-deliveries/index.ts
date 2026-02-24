/**
 * Sync Notion Deliveries → Supabase
 *
 * Reads the Notion deliveries database and upserts into delivery_deliveries and delivery_drivers.
 * Notion API key must never be exposed to the frontend; run this as Edge Function only.
 *
 * Required Supabase secrets:
 * - NOTION_TOKEN: Notion integration token (secret_... or ntn_...)
 * - NOTION_DELIVERIES_DB_ID: Notion database ID (32-char hex from database URL)
 *
 * Optional: Call with ?full=1 for full sync ignoring incremental cursor.
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createSupabaseAdminClient, createSupabaseClient } from '../_shared/supabase.ts';

const NOTION_VERSION = '2022-06-28';

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function getNotionProp(page: { properties?: Record<string, unknown> }, nameVariants: string[]): unknown {
  const props = page.properties || {};
  for (const name of nameVariants) {
    const key = Object.keys(props).find((k) => k.toLowerCase() === name.toLowerCase());
    if (key) return (props[key] as Record<string, unknown>) ?? null;
  }
  return null;
}

function getTitle(prop: unknown): string {
  if (!prop || typeof prop !== 'object') return '';
  const p = prop as Record<string, unknown>;
  const title = p.title;
  if (Array.isArray(title) && title.length > 0) {
    const t = title[0] as Record<string, unknown>;
    const rt = t?.plain_text;
    return typeof rt === 'string' ? rt : '';
  }
  return '';
}

function getRichText(prop: unknown): string {
  if (!prop || typeof prop !== 'object') return '';
  const p = prop as Record<string, unknown>;
  const rich = p.rich_text;
  if (Array.isArray(rich) && rich.length > 0) {
    const t = rich[0] as Record<string, unknown>;
    const rt = t?.plain_text;
    return typeof rt === 'string' ? rt : '';
  }
  return '';
}

function getSelect(prop: unknown): string {
  if (!prop || typeof prop !== 'object') return '';
  const p = prop as Record<string, unknown>;
  const sel = p.select;
  if (sel && typeof sel === 'object') {
    const name = (sel as Record<string, unknown>).name;
    return typeof name === 'string' ? name : '';
  }
  return '';
}

function getDate(prop: unknown): { start: string; end?: string } | null {
  if (!prop || typeof prop !== 'object') return null;
  const p = prop as Record<string, unknown>;
  const date = p.date;
  if (date && typeof date === 'object') {
    const d = date as Record<string, unknown>;
    const start = d.start;
    const end = d.end;
    return {
      start: typeof start === 'string' ? start : '',
      end: typeof end === 'string' ? end : undefined,
    };
  }
  return null;
}

function getPeople(prop: unknown): string {
  if (!prop || typeof prop !== 'object') return '';
  const p = prop as Record<string, unknown>;
  const people = p.people;
  if (Array.isArray(people) && people.length > 0) {
    const first = people[0] as Record<string, unknown>;
    const name = first?.name;
    return typeof name === 'string' ? name : '';
  }
  return '';
}

function parsePage(page: Record<string, unknown>): {
  notion_page_id: string;
  title: string;
  customer: string;
  site: string;
  status: string;
  driver_name: string;
  date_start: string;
  date_end: string | null;
  last_edited_time: string;
} {
  const id = page.id as string;
  const lastEdited = (page.last_edited_time as string) || '';

  const titleProp = getNotionProp(page as { properties?: Record<string, unknown> }, ['Delivery', 'Name', 'Title', 'delivery']);
  const title = getTitle(titleProp) || getRichText(titleProp);

  const customerProp = getNotionProp(page as { properties?: Record<string, unknown> }, ['Customer', 'customer']);
  const customer = getRichText(customerProp) || getSelect(customerProp);

  const siteProp = getNotionProp(page as { properties?: Record<string, unknown> }, ['Site', 'site']);
  const site = getRichText(siteProp) || getSelect(siteProp);

  const statusProp = getNotionProp(page as { properties?: Record<string, unknown> }, ['Status', 'status']);
  const status = getSelect(statusProp) || getRichText(statusProp);

  const driverProp = getNotionProp(page as { properties?: Record<string, unknown> }, ['Driver', 'driver']);
  const driver_name = getSelect(driverProp) || getPeople(driverProp) || getRichText(driverProp);

  const dateProp = getNotionProp(page as { properties?: Record<string, unknown> }, ['Date', 'date']);
  const dateRange = getDate(dateProp);
  const date_start = dateRange?.start || '';
  const date_end = dateRange?.end || null;

  return {
    notion_page_id: id,
    title: title.trim() || 'Untitled',
    customer: customer.trim(),
    site: site.trim(),
    status: status.trim(),
    driver_name: driver_name.trim(),
    date_start,
    date_end,
    last_edited_time: lastEdited,
  };
}

async function queryNotionDatabase(
  token: string,
  databaseId: string,
  startCursor?: string
): Promise<{ results: Record<string, unknown>[]; next_cursor: string | null; has_more: boolean }> {
  const url = `https://api.notion.com/v1/databases/${databaseId}/query`;
  const body: Record<string, unknown> = { page_size: 100 };
  if (startCursor) body.start_cursor = startCursor;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Notion API ${res.status}: ${text}`);
  }

  let data: { results?: unknown[]; next_cursor?: string | null; has_more?: boolean };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Notion API invalid JSON');
  }

  const results = Array.isArray(data.results) ? data.results : [];
  const next_cursor = data.next_cursor ?? null;
  const has_more = Boolean(data.has_more);

  return {
    results: results as Record<string, unknown>[],
    next_cursor,
    has_more,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCors(req) ?? new Response('ok', { headers: corsHeaders });

  const syncSecret = Deno.env.get('NOTION_SYNC_SECRET');
  const headerSecret = req.headers.get('x-sync-secret');
  const hasValidSyncSecret = Boolean(syncSecret && headerSecret && syncSecret === headerSecret);

  if (!hasValidSyncSecret) {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: provide Authorization Bearer or x-sync-secret' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    try {
      const supabaseUser = createSupabaseClient(req);
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      const { data: { user }, error } = await supabaseUser.auth.getUser(token);
      if (!user || error) {
        return new Response(
          JSON.stringify({ error: 'Invalid token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const supabaseAdmin = createSupabaseAdminClient();
      const { data: profile } = await supabaseAdmin
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      const role = profile?.role;
      if (role !== 'admin' && role !== 'super_admin') {
        return new Response(
          JSON.stringify({ error: 'Only admins can run sync' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (_) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  try {
    const notionToken = Deno.env.get('NOTION_TOKEN');
    const dbIdRaw = Deno.env.get('NOTION_DELIVERIES_DB_ID');
    if (!notionToken) {
      return new Response(
        JSON.stringify({ error: 'NOTION_TOKEN secret is not set' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const databaseId = dbIdRaw?.replace(/^ntn_/, '').trim() || dbIdRaw?.trim();
    if (!databaseId) {
      return new Response(
        JSON.stringify({ error: 'NOTION_DELIVERIES_DB_ID secret is not set' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    let fullSync = url.searchParams.get('full') === '1';
    if (!fullSync && req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}));
        if (body && typeof body === 'object' && body.full === true) fullSync = true;
      } catch (_) {
        // ignore
      }
    }

    const supabase = createSupabaseAdminClient();

    let cursor: string | null = null;
    if (!fullSync) {
      const { data: state } = await supabase
        .from('delivery_sync_state')
        .select('last_cursor')
        .eq('id', 'default')
        .maybeSingle();
      cursor = state?.last_cursor ?? null;
    }

    const allRows: ReturnType<typeof parsePage>[] = [];
    let hasMore = true;
    while (hasMore) {
      const { results, next_cursor, has_more } = await queryNotionDatabase(notionToken, databaseId, cursor ?? undefined);
      for (const page of results) {
        const parsed = parsePage(page);
        if (parsed.date_start) allRows.push(parsed);
      }
      cursor = next_cursor;
      hasMore = has_more;
    }

    const driverNames = new Set<string>();
    for (const row of allRows) {
      if (row.driver_name) driverNames.add(row.driver_name);
    }

    for (const name of driverNames) {
      const slug = slugify(name) || 'no-driver';
      await supabase
        .from('delivery_drivers')
        .upsert(
          { name, slug, updated_at: new Date().toISOString() },
          { onConflict: 'slug', ignoreDuplicates: false }
        );
    }

    const { data: drivers } = await supabase.from('delivery_drivers').select('id, name, slug');
    const driverIdBySlug = new Map<string, string>();
    for (const d of drivers || []) {
      driverIdBySlug.set(d.slug, d.id);
      driverIdBySlug.set(d.name, d.id);
    }

    const deliveriesToUpsert = allRows.map((row) => {
      const driverSlug = slugify(row.driver_name) || 'no-driver';
      const driver_id = driverIdBySlug.get(driverSlug) || driverIdBySlug.get(row.driver_name) || null;
      const dateStart = row.date_start.includes('T') ? row.date_start : `${row.date_start}T00:00:00.000Z`;
      const dateEnd = row.date_end ? (row.date_end.includes('T') ? row.date_end : `${row.date_end}T23:59:59.999Z`) : null;
      return {
        notion_page_id: row.notion_page_id,
        title: row.title,
        customer: row.customer,
        site: row.site,
        status: row.status,
        driver_name: row.driver_name,
        driver_id,
        date_start: dateStart,
        date_end: dateEnd,
        last_edited_time: row.last_edited_time,
        raw_notion: {},
        archived: false,
      };
    });

    if (deliveriesToUpsert.length > 0) {
      const { error } = await supabase
        .from('delivery_deliveries')
        .upsert(deliveriesToUpsert, { onConflict: 'notion_page_id', ignoreDuplicates: false });
      if (error) throw error;
    }

    const lastEdited = allRows.length > 0
      ? allRows.reduce((max, r) => (r.last_edited_time > max ? r.last_edited_time : max), allRows[0].last_edited_time)
      : null;

    await supabase
      .from('delivery_sync_state')
      .upsert(
        {
          id: 'default',
          last_sync_time: new Date().toISOString(),
          last_cursor: cursor,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

    return new Response(
      JSON.stringify({
        success: true,
        synced: deliveriesToUpsert.length,
        drivers: driverNames.size,
        last_sync: lastEdited,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[sync-notion-deliveries]', err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
