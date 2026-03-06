import React from 'react';
import { Truck, CheckCircle, Droplet, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

function formatDateRange(dateRange) {
  if (!dateRange?.start || !dateRange?.end) return null;
  try {
    const start = format(new Date(dateRange.start), 'd MMM yyyy');
    const end = format(new Date(dateRange.end), 'd MMM yyyy');
    return `${start} – ${end}`;
  } catch {
    return null;
  }
}

const STAT_CARDS = [
  {
    key: 'totalVehicles',
    label: 'Total Vehicles',
    icon: Truck,
    valueKey: 'totalVehicles',
    format: (v) => (v ?? 0).toLocaleString(),
    accentClass: 'text-muted-foreground',
  },
  {
    key: 'complianceRate',
    label: 'Compliance Rate',
    icon: CheckCircle,
    valueKey: 'complianceRate',
    format: (v) => `${v ?? 0}%`,
    trendLabel: 'vs target 80%',
    accentClass: 'text-primary',
    showLikelihood: true,
  },
  {
    key: 'monthlyWashes',
    label: 'Total Washes',
    icon: Droplet,
    valueKey: 'monthlyWashes',
    format: (v) => (v ?? 0).toLocaleString(),
    accentClass: 'text-blue-600 dark:text-blue-400',
  },
  {
    key: 'activeDrivers',
    label: 'Vehicles with scans',
    subtitle: 'Vehicles that received at least one wash in the selected period',
    icon: Users,
    valueKey: 'activeDrivers',
    format: (v) => (v ?? 0).toLocaleString(),
    accentClass: 'text-violet-600 dark:text-violet-400',
  },
];

/**
 * Stats cards for dashboard-01: Total Vehicles, Compliance Rate, Total Washes, Drivers Scanning?.
 * Stats shape: { totalVehicles, complianceRate, monthlyWashes, activeDrivers, complianceLikelihood }.
 * complianceLikelihood: { onTrackPct, atRiskPct, criticalPct } for the Compliance Rate card breakdown.
 * Optional dateRange shows the period the data refers to beside each card label.
 */
export default function SectionCards({ stats = {}, dateRange = null, className }) {
  const safeStats = {
    totalVehicles: stats.totalVehicles ?? 0,
    complianceRate: stats.complianceRate ?? 0,
    monthlyWashes: stats.monthlyWashes ?? 0,
    activeDrivers: stats.activeDrivers ?? 0,
  };
  const dateRangeStr = formatDateRange(dateRange);

  const likelihood = stats.complianceLikelihood ?? { onTrackPct: 0, atRiskPct: 0, criticalPct: 0 };

  return (
    <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4', className)}>
      {STAT_CARDS.map(({ key, label, subtitle, icon: Icon, valueKey, format: formatValue, trendLabel, accentClass, showLikelihood }) => (
        <Card key={key} className="overflow-hidden">
          <CardContent className="py-2 px-3">
            <div className="flex items-start justify-between gap-1.5">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-primary leading-tight">{label}</p>
                {dateRangeStr && (
                  <p className="text-[11px] text-muted-foreground/90 leading-tight">{dateRangeStr}</p>
                )}
              </div>
              <Icon className={cn('h-3 w-3 shrink-0', accentClass)} aria-hidden />
            </div>
            <p className="mt-0.5 text-lg font-bold tracking-tight leading-tight">
              {formatValue(safeStats[valueKey])}
            </p>
            {subtitle && (
              <p className="text-[11px] text-muted-foreground max-w-[85%] leading-tight">{subtitle}</p>
            )}
            {trendLabel && (
              <p className="text-[11px] text-muted-foreground leading-tight">{trendLabel}</p>
            )}
            {showLikelihood && (
              <div className="mt-1 space-y-0.5">
                <div
                  className="flex h-1 w-full overflow-hidden rounded-full bg-muted/60"
                  role="img"
                  aria-label={`Compliance breakdown: ${likelihood.onTrackPct}% on track, ${likelihood.atRiskPct}% at risk, ${likelihood.criticalPct}% critical`}
                >
                  {likelihood.onTrackPct > 0 && (
                    <div
                      className="bg-emerald-500 shrink-0 transition-[width] duration-300"
                      style={{ width: `${likelihood.onTrackPct}%` }}
                    />
                  )}
                  {likelihood.atRiskPct > 0 && (
                    <div
                      className="bg-amber-500 shrink-0 transition-[width] duration-300"
                      style={{ width: `${likelihood.atRiskPct}%` }}
                    />
                  )}
                  {likelihood.criticalPct > 0 && (
                    <div
                      className="bg-red-500 shrink-0 transition-[width] duration-300"
                      style={{ width: `${likelihood.criticalPct}%` }}
                    />
                  )}
                </div>
                <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] leading-tight">
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                    {likelihood.onTrackPct}% On Track
                  </span>
                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
                    {likelihood.atRiskPct}% At Risk
                  </span>
                  <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" aria-hidden />
                    {likelihood.criticalPct}% Critical
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
