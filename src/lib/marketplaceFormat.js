/**
 * Marketplace formatting helpers — pure functions, safe for both buyer and admin.
 * Pricing is stored ex-GST. Display GST handling is computed at checkout (M2).
 */

/**
 * Resolve effective price for a single line, given the resolved row from
 * v_marketplace_buyer_prices and a quantity (in pack-size units).
 *
 * `volume_litres` is on the packaging size lookup row.
 *
 * Returns: { unitPriceExGst, lineSubtotalExGst } in AUD (numbers, not cents).
 */
export function calculateLineSubtotal({
  priceType,
  pricePerLitre,
  fixedPrice,
  volumeLitres,
  quantity,
}) {
  if (!quantity || quantity < 0) return { unitPriceExGst: 0, lineSubtotalExGst: 0 };

  if (priceType === 'per_litre') {
    if (!volumeLitres || !pricePerLitre) return { unitPriceExGst: 0, lineSubtotalExGst: 0 };
    const unit = Number(pricePerLitre) * Number(volumeLitres);
    return {
      unitPriceExGst: round2(unit),
      lineSubtotalExGst: round2(unit * Number(quantity)),
    };
  }

  // fixed
  if (priceType === 'fixed') {
    const unit = Number(fixedPrice) || 0;
    return {
      unitPriceExGst: round2(unit),
      lineSubtotalExGst: round2(unit * Number(quantity)),
    };
  }

  return { unitPriceExGst: 0, lineSubtotalExGst: 0 };
}

/**
 * Format a number as AUD currency for display.
 */
export function formatAUD(amount) {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
  }).format(Number(amount));
}

/**
 * Short price label for product cards.
 *  per-litre → "$3.65 / L  (×200L = $730.00)"
 *  fixed     → "$70.00 each"
 */
export function formatPriceLabel({ priceType, pricePerLitre, fixedPrice, volumeLitres }) {
  if (priceType === 'per_litre' && pricePerLitre != null) {
    if (volumeLitres) {
      const total = Number(pricePerLitre) * Number(volumeLitres);
      return `${formatAUD(pricePerLitre)} / L  (×${formatLitres(volumeLitres)} = ${formatAUD(total)})`;
    }
    return `${formatAUD(pricePerLitre)} / L`;
  }
  if (priceType === 'fixed' && fixedPrice != null) {
    return `${formatAUD(fixedPrice)} each`;
  }
  return '—';
}

export function formatLitres(litres) {
  if (litres == null) return '—';
  if (Number(litres) >= 1000) return `${(Number(litres) / 1000).toFixed(litres % 1000 === 0 ? 0 : 1)}kL`;
  return `${Number(litres)}L`;
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/**
 * Slugify a product name for the URL slug field.
 * Mirrors common slug rules; safe for db unique constraint.
 */
export function slugify(text) {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
