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
    label: 'Active Drivers',
    icon: Users,
    valueKey: 'activeDrivers',
    format: (v) => (v ?? 0).toLocaleString(),
    accentClass: 'text-violet-600 dark:text-violet-400',
  },
];

/**
 * Stats cards for dashboard-01: Total Vehicles, Compliance Rate, Total Washes, Active Drivers.
 * Uses existing stats shape: { totalVehicles, complianceRate, monthlyWashes, activeDrivers }.
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

  return (
    <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4', className)}>
      {STAT_CARDS.map(({ key, label, icon: Icon, valueKey, format: formatValue, trendLabel, accentClass }) => (
        <Card key={key} className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-primary">{label}</p>
                {dateRangeStr && (
                  <p className="mt-0.5 text-xs text-muted-foreground/90">{dateRangeStr}</p>
                )}
              </div>
              <Icon className={cn('h-4 w-4 shrink-0', accentClass)} aria-hidden />
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight">
              {formatValue(safeStats[valueKey])}
            </p>
            {trendLabel && (
              <p className="mt-1 text-xs text-muted-foreground">{trendLabel}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
