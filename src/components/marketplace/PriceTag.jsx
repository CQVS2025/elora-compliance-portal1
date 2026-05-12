import React from 'react';
import { formatAUD, formatLitres } from '@/lib/marketplaceFormat';

/**
 * Displays the effective price for a (product, packaging_size) row from
 * v_marketplace_buyer_prices. Computes per-pack total when price_type is
 * per_litre (e.g. $3.65/L × 200L = $730.00).
 *
 * The component intentionally never reveals whether the price is a default
 * or a per-customer override. Every buyer sees the same visual treatment for
 * their own resolved price; there is no "Your price" tag, badge, or accent.
 * Keeping the UI uniform avoids leaking the existence (or absence) of a
 * per-customer override to a buyer.
 */
export function PriceTag({ priceRow, className = '' }) {
  if (!priceRow) return <span className="text-muted-foreground">Price unavailable</span>;
  const { price_type, price_per_litre, fixed_price, packaging_size } = priceRow;
  const litres = packaging_size?.volume_litres;

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
      </div>
    );
  }

  // fixed
  return (
    <div className={`flex flex-col ${className}`}>
      <span className="text-base font-semibold">{formatAUD(fixed_price)}</span>
      <span className="text-xs text-muted-foreground">each</span>
    </div>
  );
}

export default PriceTag;
