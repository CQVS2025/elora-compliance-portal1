import { resolveRoadDistanceKm } from './marketplaceDistance.ts';

/**
 * Shared freight-quote logic for the marketplace.
 *
 * Used by both `marketplace_freight_quote` (called from the cart / checkout
 * page to show live freight) and `marketplace_create_order` (called at
 * order submit to snapshot freight onto the order).
 *
 * Inputs:
 *   - lines:           cart-line representations (product_id, packaging_size_id, quantity)
 *   - deliveryPostcode: the buyer's delivery postcode
 *   - supabase:        a Supabase client (authed buyer client is fine; we read public-readable tables)
 *
 * Returns:
 *   {
 *     total_freight_ex_gst,  // grand total of all lines' freight (numeric, 2dp)
 *     warehouse_postcode,    // origin used for the calc
 *     distance_km,           // greatest distance encountered (single-warehouse: same per line)
 *     out_of_range,          // true if any line had no matching bracket
 *     out_of_range_behavior, // 'use_last_bracket' | 'block_order' | 'quote_on_application' (the strictest seen)
 *     blocked,               // true if any line's rate sheet says block_order on OOR
 *     lines: [{ ...input, freight_ex_gst, rate_sheet_id, bracket_id, source }],
 *     notes: string[],       // human-readable warnings
 *   }
 *
 * The calculation rounds to 2 decimal places at the end of each line and
 * sums to a 2dp grand total, matching Xero's invoice-rounding behaviour.
 */

// Deno runtime types are loose; we use plain shapes.
type CartLine = {
  product_id: string;
  packaging_size_id: string;
  quantity: number;
};

type FreightLine = CartLine & {
  freight_ex_gst: number;
  rate_sheet_id: string | null;
  bracket_id: string | null;
  unit_type: string | null;
  source: 'per_litre' | 'flat_per_consignment' | 'per_kg' | 'per_pallet' | 'per_zone' | 'fallback' | 'none';
};

type FreightQuote = {
  total_freight_ex_gst: number;
  warehouse_postcode: string | null;
  distance_km: number | null;
  distance_source: 'cache' | 'google' | 'haversine' | null;
  out_of_range: boolean;
  out_of_range_behavior: string;
  blocked: boolean;
  lines: FreightLine[];
  notes: string[];
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Distance-lookup failures are surfaced to the buyer as the order's blocker
 * message. The default ("contact Elora") is fine for unknown causes, but the
 * three Large Volume Receiver postcode ranges in Australia have a specific
 * cause we can name — they're PO boxes and not routable to a street address.
 */
function distanceLookupFailedMessage(deliveryPostcode: string): string {
  const pc = String(deliveryPostcode ?? '').trim();
  const lvr =
    /^1\d{3}$/.test(pc) ? { region: 'NSW', cbd: '2000 (Sydney CBD)' } :
    /^8\d{3}$/.test(pc) ? { region: 'VIC', cbd: '3000 (Melbourne CBD)' } :
    /^9\d{3}$/.test(pc) ? { region: 'QLD', cbd: '4000 (Brisbane CBD)' } :
    null;
  if (lvr) {
    return `Postcode ${pc} is in the ${lvr.region} Large Volume Receiver range (PO boxes only) and is not deliverable. Please use the buyer's street-address postcode — for example, ${lvr.cbd}.`;
  }
  if (!/^\d{4}$/.test(pc)) {
    return `Postcode ${pc || '(blank)'} is not a valid Australian postcode. Please enter a 4-digit street-address postcode.`;
  }
  return `We couldn't find a delivery route to postcode ${pc}. Please double-check the postcode for the delivery site, or contact Elora to arrange freight manually.`;
}

export async function calculateFreightQuote(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  lines: CartLine[],
  deliveryPostcode: string,
): Promise<FreightQuote> {
  const notes: string[] = [];
  const quote: FreightQuote = {
    total_freight_ex_gst: 0,
    warehouse_postcode: null,
    distance_km: null,
    distance_source: null,
    out_of_range: false,
    out_of_range_behavior: 'use_last_bracket',
    blocked: false,
    lines: [],
    notes,
  };

  if (!lines || lines.length === 0) return quote;

  // Resolve default warehouse + its postcode (single-warehouse launch).
  const { data: settings } = await supabase
    .from('marketplace_settings')
    .select('default_warehouse_id')
    .eq('id', 1)
    .maybeSingle();

  let warehouseId: string | null = settings?.default_warehouse_id ?? null;
  if (!warehouseId) {
    // Fall back to the first active warehouse
    const { data: fallbackWh } = await supabase
      .from('marketplace_warehouses')
      .select('id')
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    warehouseId = fallbackWh?.id ?? null;
  }

  if (!warehouseId) {
    notes.push('No active warehouse configured. Freight cannot be quoted.');
    quote.blocked = true;
    return quote;
  }

  const { data: warehouse } = await supabase
    .from('marketplace_warehouses')
    .select('postcode')
    .eq('id', warehouseId)
    .maybeSingle();

  const warehousePostcode = warehouse?.postcode ?? null;
  quote.warehouse_postcode = warehousePostcode;

  if (!warehousePostcode) {
    notes.push('Warehouse has no postcode configured.');
    quote.blocked = true;
    return quote;
  }

  // Resolve packaging-size lookup (for volume_litres).
  const sizeIds = Array.from(new Set(lines.map((l) => l.packaging_size_id)));
  const { data: sizes } = await supabase
    .from('marketplace_packaging_sizes')
    .select('id, volume_litres')
    .in('id', sizeIds);
  const sizeById = new Map<string, { volume_litres: number | null }>(
    (sizes ?? []).map((s: { id: string; volume_litres: number | null }) => [s.id, s])
  );

  // Resolve product → rate sheet mapping for every line.
  const productIds = Array.from(new Set(lines.map((l) => l.product_id)));
  const { data: mappings } = await supabase
    .from('marketplace_product_rate_sheets')
    .select('product_id, packaging_size_id, rate_sheet_id')
    .in('product_id', productIds);

  const mappingByKey = (productId: string, sizeId: string): string | null => {
    const list = mappings ?? [];
    // Prefer size-specific row, then product default
    const specific = list.find(
      (m: { product_id: string; packaging_size_id: string | null }) =>
        m.product_id === productId && m.packaging_size_id === sizeId,
    );
    if (specific) return specific.rate_sheet_id;
    const fallback = list.find(
      (m: { product_id: string; packaging_size_id: string | null }) =>
        m.product_id === productId && m.packaging_size_id === null,
    );
    return fallback?.rate_sheet_id ?? null;
  };

  // Distance lookup: Google Distance Matrix (cached) → haversine fallback.
  // Postcode-only — same call as scripts/check-distance-matrix-key.mjs.
  let distanceKm: number | null = null;
  let distanceSource: 'cache' | 'google' | 'haversine' | null = null;
  {
    const resolved = await resolveRoadDistanceKm(supabase, warehousePostcode, deliveryPostcode);
    if (resolved) {
      distanceKm = resolved.distance_km;
      distanceSource = resolved.source;
      const label =
        resolved.source === 'google' ? 'Google Distance Matrix (live)' :
        resolved.source === 'cache' ? 'Google Distance Matrix (cached)' :
        'Haversine fallback (× 1.25)';
      notes.push(`Distance: ${distanceKm.toFixed(2)} km via ${label}.`);
      if (resolved.source === 'haversine') {
        notes.push(`Live road-distance lookup unavailable; using straight-line approximation for ${deliveryPostcode}. Expect drift on coastal / mountain / detour routes.`);
      }
    }
  }
  if (distanceKm == null) {
    notes.push(distanceLookupFailedMessage(deliveryPostcode));
    quote.blocked = true;
    distanceKm = 0;
  }
  quote.distance_km = distanceKm;
  quote.distance_source = distanceSource;

  // Resolve a unique set of rate sheets + their brackets
  const sheetIds = Array.from(new Set(lines.map((l) => mappingByKey(l.product_id, l.packaging_size_id)).filter(Boolean) as string[]));

  // deno-lint-ignore no-explicit-any
  const sheetById = new Map<string, any>();
  if (sheetIds.length > 0) {
    const { data: sheets } = await supabase
      .from('marketplace_rate_sheets')
      .select('id, unit_type, min_charge, origin_postcode, out_of_range_behavior, is_active')
      .in('id', sheetIds);
    (sheets ?? []).forEach((s: { id: string }) => sheetById.set(s.id, s));
  }

  const { data: brackets } =
    sheetIds.length > 0
      ? await supabase
          .from('marketplace_rate_sheet_brackets')
          .select('id, rate_sheet_id, distance_from_km, distance_to_km, rate, zone_name')
          .in('rate_sheet_id', sheetIds)
          .order('distance_from_km', { ascending: true })
      : { data: [] };

  // For each line, compute freight
  // Track whether a flat_per_consignment sheet has already been billed
  // (charge it once, not per line).
  const flatChargedSheetIds = new Set<string>();
  // Track strictest OOR behavior
  let strictestOorBehavior = 'use_last_bracket';

  for (const line of lines) {
    const result: FreightLine = {
      ...line,
      freight_ex_gst: 0,
      rate_sheet_id: null,
      bracket_id: null,
      unit_type: null,
      source: 'none',
    };

    const sheetId = mappingByKey(line.product_id, line.packaging_size_id);
    if (!sheetId) {
      notes.push(`No rate sheet mapped for product ${line.product_id} . Freight set to 0.`);
      result.source = 'fallback';
      quote.lines.push(result);
      continue;
    }

    const sheet = sheetById.get(sheetId);
    if (!sheet || !sheet.is_active) {
      notes.push(`Rate sheet ${sheetId} is inactive. Freight set to 0 for this line.`);
      result.source = 'fallback';
      quote.lines.push(result);
      continue;
    }

    result.rate_sheet_id = sheetId;
    result.unit_type = sheet.unit_type;

    // Find applicable bracket
    const sheetBrackets = (brackets ?? []).filter(
      (b: { rate_sheet_id: string }) => b.rate_sheet_id === sheetId,
    );
    let bracket = sheetBrackets.find(
      (b: { distance_from_km: number; distance_to_km: number | null }) =>
        distanceKm! >= Number(b.distance_from_km) &&
        (b.distance_to_km === null || distanceKm! < Number(b.distance_to_km)),
    );

    if (!bracket) {
      // Out of range
      quote.out_of_range = true;
      const beh = sheet.out_of_range_behavior ?? 'use_last_bracket';
      if (beh === 'block_order') {
        quote.blocked = true;
        strictestOorBehavior = 'block_order';
        notes.push(`Postcode ${deliveryPostcode} is out of range for this product. Order blocked.`);
        result.source = sheet.unit_type;
        quote.lines.push(result);
        continue;
      }
      if (beh === 'quote_on_application') {
        if (strictestOorBehavior !== 'block_order') strictestOorBehavior = 'quote_on_application';
        notes.push(`Postcode ${deliveryPostcode} is out of range. Quote on application required.`);
        result.source = sheet.unit_type;
        quote.lines.push(result);
        continue;
      }
      // use_last_bracket
      bracket = sheetBrackets[sheetBrackets.length - 1];
      notes.push(`Postcode ${deliveryPostcode} is out of range. Using last bracket.`);
    }

    if (!bracket) {
      // No brackets at all on this sheet
      notes.push(`Rate sheet ${sheetId} has no brackets configured . Freight set to 0.`);
      result.source = 'fallback';
      quote.lines.push(result);
      continue;
    }

    result.bracket_id = bracket.id;
    const rate = Number(bracket.rate);

    switch (sheet.unit_type) {
      case 'per_litre': {
        const sz = sizeById.get(line.packaging_size_id);
        const litres = sz?.volume_litres ? Number(sz.volume_litres) : null;
        if (!litres) {
          notes.push(`Per-litre rate sheet matched but packaging has no volume. Freight skipped for this line.`);
          result.source = 'per_litre';
          break;
        }
        result.freight_ex_gst = round2(rate * litres * line.quantity);
        result.source = 'per_litre';
        break;
      }
      case 'flat_per_consignment': {
        if (flatChargedSheetIds.has(sheetId)) {
          result.freight_ex_gst = 0;
        } else {
          result.freight_ex_gst = round2(rate);
          flatChargedSheetIds.add(sheetId);
        }
        result.source = 'flat_per_consignment';
        break;
      }
      case 'per_kg': {
        // No weight on packaging in M2; treat 1 L = 1 kg as approximation
        const sz = sizeById.get(line.packaging_size_id);
        const kg = sz?.volume_litres ? Number(sz.volume_litres) : 0;
        result.freight_ex_gst = round2(rate * kg * line.quantity);
        result.source = 'per_kg';
        break;
      }
      case 'per_pallet': {
        // Approximate: assume one pallet per 1000 L (an IBC) or one per pack for bigger
        const sz = sizeById.get(line.packaging_size_id);
        const litres = sz?.volume_litres ? Number(sz.volume_litres) : 0;
        const palletsPerPack = litres >= 1000 ? 1 : Math.max(1, Math.floor(1000 / (litres || 1000)));
        const pallets = Math.ceil(line.quantity / palletsPerPack);
        result.freight_ex_gst = round2(rate * pallets);
        result.source = 'per_pallet';
        break;
      }
      case 'per_zone': {
        result.freight_ex_gst = round2(rate * line.quantity);
        result.source = 'per_zone';
        break;
      }
      default: {
        result.freight_ex_gst = 0;
        result.source = 'fallback';
        break;
      }
    }

    quote.lines.push(result);
  }

  // Apply per-sheet min_charge
  const minChargeBySheet = new Map<string, number>();
  for (const sheetId of sheetIds) {
    const sheet = sheetById.get(sheetId);
    if (sheet?.min_charge && Number(sheet.min_charge) > 0) {
      minChargeBySheet.set(sheetId, Number(sheet.min_charge));
    }
  }

  if (minChargeBySheet.size > 0) {
    for (const [sheetId, minCharge] of minChargeBySheet) {
      const sheetLines = quote.lines.filter((l) => l.rate_sheet_id === sheetId);
      const sheetTotal = sheetLines.reduce((s, l) => s + l.freight_ex_gst, 0);
      if (sheetTotal > 0 && sheetTotal < minCharge && sheetLines.length > 0) {
        const bumpPerLine = round2((minCharge - sheetTotal) / sheetLines.length);
        sheetLines.forEach((l) => { l.freight_ex_gst = round2(l.freight_ex_gst + bumpPerLine); });
        notes.push(`Min charge $${minCharge.toFixed(2)} applied for rate sheet ${sheetId}.`);
      }
    }
  }

  quote.total_freight_ex_gst = round2(quote.lines.reduce((s, l) => s + l.freight_ex_gst, 0));
  quote.out_of_range_behavior = strictestOorBehavior;

  return quote;
}

export type { CartLine, FreightLine, FreightQuote };
