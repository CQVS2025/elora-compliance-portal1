// deno-lint-ignore-file no-explicit-any
import { handleCors, corsHeaders } from '../_shared/cors.ts';
import { createSupabaseClient, createSupabaseAdminClient } from '../_shared/supabase.ts';

/**
 * Freight matrix CSV upload.
 *
 * Two modes:
 *
 * (1) Parse-only (dry run):
 *     POST { csv_text: string }
 *     → returns parsed brackets without writing anything. Used by the admin
 *       UI to preview before applying.
 *
 * (2) Apply:
 *     POST { csv_text: string, rate_sheet_id: uuid, replace: boolean }
 *     → optionally wipes existing brackets on the sheet, then inserts the
 *       parsed rows. Returns the inserted bracket count.
 *
 * CSV format (header row required):
 *   distance_from_km, distance_to_km, rate [, zone_name]
 *
 * - The final bracket can have distance_to_km blank (open-ended).
 * - Rate is parsed leniently: "$0.07", "0.07", "0.07 /L" all become 0.07.
 * - Tab- or comma-delimited (auto-detected from the header row).
 *
 * Admin-only.
 */
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const supabase = createSupabaseClient(req);
    const { data: isAdmin } = await supabase.rpc('is_marketplace_admin');
    if (!isAdmin) return json({ error: 'Forbidden: marketplace admin required' }, 403);

    const body = await req.json();
    const csvText = String(body?.csv_text ?? '').trim();
    if (!csvText) return json({ error: 'csv_text is required' }, 400);

    let parsed: { brackets: ParsedBracket[]; warnings: string[] };
    try {
      parsed = parseFreightCsv(csvText);
    } catch (e: any) {
      return json({ error: `CSV parse failed: ${e?.message ?? String(e)}` }, 400);
    }

    if (!body?.rate_sheet_id) {
      // Dry run — return parsed
      return json({ ok: true, dry_run: true, ...parsed }, 200);
    }

    const rateSheetId = String(body.rate_sheet_id);
    const replace = body.replace === true;

    const admin = createSupabaseAdminClient();

    // Verify the sheet exists
    const { data: sheet, error: sheetErr } = await admin
      .from('marketplace_rate_sheets')
      .select('id')
      .eq('id', rateSheetId)
      .maybeSingle();
    if (sheetErr) throw sheetErr;
    if (!sheet) return json({ error: 'Rate sheet not found' }, 404);

    if (replace) {
      await admin.from('marketplace_rate_sheet_brackets').delete().eq('rate_sheet_id', rateSheetId);
    }

    const rows = parsed.brackets.map((b) => ({
      rate_sheet_id: rateSheetId,
      distance_from_km: b.distance_from_km,
      distance_to_km: b.distance_to_km,
      rate: b.rate,
      zone_name: b.zone_name ?? null,
    }));

    const { error: insErr } = await admin.from('marketplace_rate_sheet_brackets').insert(rows);
    if (insErr) throw insErr;

    return json({ ok: true, inserted: rows.length, warnings: parsed.warnings }, 200);
  } catch (err: any) {
    console.error('marketplace_freight_matrix_upload error', err);
    return json({ error: err?.message ?? 'Internal error' }, 500);
  }
});

// ===========================================================================
// CSV parser
// ===========================================================================

type ParsedBracket = {
  distance_from_km: number;
  distance_to_km: number | null;
  rate: number;
  zone_name?: string | null;
};

function parseFreightCsv(text: string): { brackets: ParsedBracket[]; warnings: string[] } {
  const warnings: string[] = [];
  // Strip BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row');

  const delimiter = (lines[0].match(/\t/) ? '\t' : ',');
  const headerCols = lines[0].split(delimiter).map((c) => c.trim().toLowerCase());

  const fromIdx = headerCols.findIndex((h) => /^(distance_)?from(_km)?$/.test(h) || h === 'min_km' || h === 'from km');
  const toIdx = headerCols.findIndex((h) => /^(distance_)?to(_km)?$/.test(h) || h === 'max_km' || h === 'to km');
  const rateIdx = headerCols.findIndex((h) => h === 'rate' || h === 'price' || h === 'amount' || h.startsWith('rate_'));
  const zoneIdx = headerCols.findIndex((h) => h === 'zone' || h === 'zone_name');

  if (fromIdx < 0) throw new Error('Missing "distance_from_km" (or "from_km") column');
  if (toIdx < 0) throw new Error('Missing "distance_to_km" (or "to_km") column');
  if (rateIdx < 0) throw new Error('Missing "rate" column');

  const brackets: ParsedBracket[] = [];
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(delimiter).map((c) => c.trim());
    const fromStr = row[fromIdx] ?? '';
    const toStr = row[toIdx] ?? '';
    const rateStr = row[rateIdx] ?? '';
    const zoneStr = zoneIdx >= 0 ? row[zoneIdx] ?? '' : '';

    const from = parseDistance(fromStr);
    const to = toStr === '' ? null : parseDistance(toStr);
    const rate = parseMoney(rateStr);

    if (!Number.isFinite(from)) {
      warnings.push(`Row ${i + 1}: invalid distance_from_km "${fromStr}" — skipped`);
      continue;
    }
    if (to !== null && !Number.isFinite(to)) {
      warnings.push(`Row ${i + 1}: invalid distance_to_km "${toStr}" — skipped`);
      continue;
    }
    if (!Number.isFinite(rate)) {
      warnings.push(`Row ${i + 1}: invalid rate "${rateStr}" — skipped`);
      continue;
    }

    brackets.push({
      distance_from_km: from,
      distance_to_km: to,
      rate,
      zone_name: zoneStr || null,
    });
  }

  if (brackets.length === 0) throw new Error('No valid data rows parsed.');

  // Sanity check: bracket coverage starts at 0 and is contiguous
  brackets.sort((a, b) => a.distance_from_km - b.distance_from_km);
  if (brackets[0].distance_from_km > 0) {
    warnings.push(`First bracket starts at ${brackets[0].distance_from_km} km, not 0 — postcodes inside that range will be out-of-range.`);
  }
  for (let i = 1; i < brackets.length; i++) {
    const prev = brackets[i - 1];
    if (prev.distance_to_km !== null && Number(prev.distance_to_km) !== Number(brackets[i].distance_from_km)) {
      warnings.push(`Gap or overlap between brackets: ${prev.distance_from_km}-${prev.distance_to_km} and ${brackets[i].distance_from_km}-${brackets[i].distance_to_km}.`);
    }
  }

  return { brackets, warnings };
}

function parseDistance(s: string): number {
  return parseFloat(s.replace(/[^0-9.\-]/g, ''));
}

function parseMoney(s: string): number {
  // strip currency symbols, commas, anything after a slash ("$0.07/L" → "0.07")
  const cleaned = s.replace(/\/.*$/, '').replace(/[^0-9.\-]/g, '');
  return parseFloat(cleaned);
}

function json(body: any, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
