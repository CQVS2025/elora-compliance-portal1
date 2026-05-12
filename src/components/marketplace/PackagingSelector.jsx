import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Pill-style selector across available packaging variants for a product.
 * `prices` is the resolved buyer-prices array (rows from v_marketplace_buyer_prices,
 * each enriched with a `packaging_size` object).
 */
export function PackagingSelector({ prices = [], selectedSizeId, onChange, className = '' }) {
  if (!prices || prices.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No packaging available right now.</p>
    );
  }
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {prices.map((row) => {
        const size = row.packaging_size;
        if (!size) return null;
        const active = size.id === selectedSizeId;
        return (
          <button
            type="button"
            key={size.id}
            onClick={() => onChange?.(size.id)}
            className={cn(
              'px-3 py-2 rounded-md border text-sm transition-colors',
              active
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-background hover:bg-muted border-border'
            )}
          >
            <span className="font-medium">{size.name}</span>
            {size.volume_litres ? (
              <span className="ml-1 text-xs opacity-75">
                {Number(size.volume_litres) >= 1000
                  ? `${(Number(size.volume_litres) / 1000).toFixed(0)}kL`
                  : `${Number(size.volume_litres)}L`}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export default PackagingSelector;
