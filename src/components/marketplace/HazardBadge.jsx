import React from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

/**
 * Visual classification chip for products. "Non-DG" uses a calm green;
 * any DG class uses an amber warning style.
 */
export function HazardBadge({ classification = 'Non-DG', className = '' }) {
  const isDG = classification && classification !== 'Non-DG';
  if (isDG) {
    return (
      <Badge
        variant="outline"
        className={`gap-1 border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 ${className}`}
      >
        <AlertTriangle className="w-3 h-3" />
        {classification}
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className={`gap-1 border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 ${className}`}
    >
      <ShieldCheck className="w-3 h-3" />
      Non-DG
    </Badge>
  );
}

export default HazardBadge;
