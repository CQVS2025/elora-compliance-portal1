import React from 'react';
import { cn } from '@/lib/utils';

const STATUS_FILL = {
  CRITICAL: 'bg-red-500 dark:bg-red-600',
  WARNING: 'bg-orange-500 dark:bg-orange-600',
  OK: 'bg-green-500 dark:bg-green-600',
  NO_DEVICE: 'bg-muted',
  NO_DATA: 'bg-muted',
  ERROR: 'bg-red-500 dark:bg-red-600',
};

/**
 * Vertical tank level bar (fill from bottom). Used in cards and table.
 */
export default function TankLevelBar({ percentage, status = 'OK', className, size = 'md' }) {
  const fillClass = STATUS_FILL[status] || STATUS_FILL.OK;
  const pct = percentage != null ? Math.min(100, Math.max(0, percentage)) : 0;
  const isSmall = size === 'sm';

  return (
    <div
      className={cn(
        'relative flex flex-col justify-end rounded-b overflow-hidden bg-muted/40 border border-border',
        isSmall ? 'w-8 h-12' : 'w-12 h-20',
        className
      )}
      role="img"
      aria-label={`Tank level ${pct}%`}
    >
      <div
        className={cn('w-full transition-all', fillClass)}
        style={{ height: `${pct}%`, minHeight: pct > 0 ? (isSmall ? '4px' : '6px') : 0 }}
      />
      {pct > 0 && pct < 100 && (
        <span
          className={cn(
            'absolute left-1/2 -translate-x-1/2 font-semibold text-white drop-shadow',
            isSmall ? 'text-[10px]' : 'text-xs'
          )}
          style={{ bottom: `${pct / 2}%` }}
        >
          {Math.round(pct)}%
        </span>
      )}
      {pct >= 100 && (
        <span
          className={cn(
            'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-semibold text-white drop-shadow',
            isSmall ? 'text-[10px]' : 'text-xs'
          )}
        >
          100%
        </span>
      )}
    </div>
  );
}
