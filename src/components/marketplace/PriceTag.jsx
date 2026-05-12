import React from 'react';
import { formatAUD, formatLitres } from '@/lib/marketplaceFormat';

/**
 * Displays the effective price for a (product, packaging_size) row from
 * v_marketplace_buyer_prices. Computes per-pack total when price_type is
 * per_litre (e.g. $3.65/L × 200L = $730.00).
 *
 * Optionally shows a "Negotiated" tag when price_source === 'override'.
 */
export function PriceTag({ priceRow, showSourceTag = false, className = '' }) {
  if (!priceRow) return <span className="text-muted-foreground">Price unavailable</span>;
  const { price_type, price_per_litre, fixed_price, packaging_size, price_source } = priceRow;
  const litres = packaging_size?.volume_litres;

  const isOverride = price_source === 'override';

  if (price_type === 'per_litre') {
    const total = litres ? Number(price_per_litre) * Number(litres) : null;
    return (
      <div className={`flex flex-col ${className}`}>
        <span className="text-base font-semibold">
          {formatAUD(price_per_litre)} <span className="text-xs font-normal text-muted-foreground">/ L</span>
        </span>
        {total != null && (
          <span className="text-xs text-muted-foreground">
            ×{formatLitres(litres)} = {formatAUD(total)}
          </span>
        )}
        {showSourceTag && isOverride && (
          <span className="mt-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-emerald-700">
            • Your price
          </span>
        )}
      </div>
    );
  }

  // fixed
  return (
    <div className={`flex flex-col ${className}`}>
      <span className="text-base font-semibold">{formatAUD(fixed_price)}</span>
      <span className="text-xs text-muted-foreground">each</span>
      {showSourceTag && isOverride && (
        <span className="mt-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-emerald-700">
          • Your price
        </span>
      )}
    </div>
  );
}

export default PriceTag;
