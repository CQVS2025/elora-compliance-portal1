// deno-lint-ignore-file no-explicit-any
import { handleCors, corsHeaders } from '../_shared/cors.ts';
import { createSupabaseClient, createSupabaseAdminClient } from '../_shared/supabase.ts';

/**
 * POST {
 *   warehouse_id: uuid,
 *   sheets: [{
 *     name, unit_type, is_active?, origin_postcode?, min_charge?,
 *     out_of_range_behavior?,
 *     brackets: [{ distance_from_km, distance_to_km, rate }]
 *   }, ...]
 * }
 *
 * Multi-column freight matrix bulk import. Mirrors Chem Connect's
 * /api/supplier/rate-sheets/bulk-import. The FE parses the supplier's CSV
 * client-side (one rate column → one rate sheet) and POSTs all the sheets
 * here. We insert each rate sheet + its brackets, rolling back every
 * already-created sheet on the first failure so an admin never ends up
 * with a half-imported matrix.
 *
 * Marketplace-admin only.
 */
const VALID_UNIT_TYPES = new Set([
  'per_litre',
  'flat_per_consignment',
  'per_kg',
  'per_pallet',
  'per_zone',
]);
const VALID_OOR = new Set(['use_last_bracket', 'block_order', 'quote_on_application']);

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const supabase = createSupabaseClient(req);
    const { data: adminCheck } = await supabase.rpc('is_marketplace_admin');
    if (!adminCheck) return json({ error: 'Forbidden: marketplace admin required' }, 403);

    const body = await req.json().catch(() => ({}));
    const warehouseId = String(body?.warehouse_id ?? '').trim();
    const sheets = Array.isArray(body?.sheets) ? body.sheets : null;
    if (!warehouseId || !sheets || sheets.length === 0) {
      return json({ error: 'warehouse_id and a non-empty sheets[] array are required' }, 400);
    }

    // ---------- Validate -----------------------------------------------------
    for (let i = 0; i < sheets.length; i++) {
      const s = sheets[i];
      if (!s?.name || typeof s.name !== 'string') {
        return json({ error: `sheets[${i}].name is required` }, 400);
      }
      if (!VALID_UNIT_TYPES.has(s.unit_type)) {
        return json({ error: `sheets[${i}].unit_type must be one of: ${[...VALID_UNIT_TYPES].join(', ')}` }, 400);
      }
      if (s.out_of_range_behavior && !VALID_OOR.has(s.out_of_range_behavior)) {
        return json({ error: `sheets[${i}].out_of_range_behavior must be one of: ${[...VALID_OOR].join(', ')}` }, 400);
      }
      if (!Array.isArray(s.brackets) || s.brackets.length === 0) {
        return json({ error: `sheets[${i}] ("${s.name}"): at least one bracket is required` }, 400);
      }
      for (let bIdx = 0; bIdx < s.brackets.length; bIdx++) {
        const b = s.brackets[bIdx];
        if (
          !Number.isFinite(b?.distance_from_km) ||
          !Number.isFinite(b?.distance_to_km) ||
          !Number.isFinite(b?.rate) ||
          b.distance_to_km <= b.distance_from_km
        ) {
          return json({
            error: `sheets[${i}] ("${s.name}"): bracket ${bIdx + 1} is malformed (need from < to and a numeric rate)`,
          }, 400);
        }
      }
    }

    // ---------- Insert with manual rollback ---------------------------------
    // Supabase JS doesn't expose transactions across multiple calls; we
    // settle for "delete created on failure" — same approach Chem Connect uses.
    const admin = createSupabaseAdminClient();
    const created: string[] = [];

    for (const s of sheets) {
      const { data: sheet, error: sheetErr } = await admin
        .from('marketplace_rate_sheets')
        .insert({
          warehouse_id: warehouseId,
          name: s.name,
          unit_type: s.unit_type,
          is_active: s.is_active ?? true,
          origin_postcode: s.origin_postcode ?? null,
          min_charge: s.min_charge ?? 0,
          out_of_range_behavior: s.out_of_range_behavior ?? 'use_last_bracket',
          notes: s.notes ?? null,
        })
        .select('id')
        .single();
      if (sheetErr || !sheet) {
        await rollback(admin, created);
        return json({
          error: `Failed to create rate sheet "${s.name}": ${sheetErr?.message ?? 'unknown error'}`,
          rolled_back: created.length,
        }, 500);
      }
      created.push(sheet.id);

      const { error: bracketsErr } = await admin
        .from('marketplace_rate_sheet_brackets')
        .insert(
          s.brackets.map((b: any) => ({
            rate_sheet_id: sheet.id,
            distance_from_km: b.distance_from_km,
            distance_to_km: b.distance_to_km,
            rate: b.rate,
          })),
        );
      if (bracketsErr) {
        await rollback(admin, created);
        return json({
          error: `Failed to create brackets for "${s.name}": ${bracketsErr.message}`,
          rolled_back: created.length,
        }, 500);
      }
    }

    return json({ ok: true, created: created.length, rate_sheet_ids: created }, 201);
  } catch (err: any) {
    console.error('marketplace_freight_matrix_bulk_import error', err);
    return json({ error: err?.message ?? 'Internal error' }, 500);
  }
});

async function rollback(admin: any, ids: string[]) {
  if (ids.length === 0) return;
  await admin.from('marketplace_rate_sheets').delete().in('id', ids);
}

function json(body: any, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
