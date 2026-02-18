import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Metric Card Component
 * Displays a metric with icon, value, label, and optional change indicator
 * 
 * @param {string} title - Card title
 * @param {string|number} value - Main metric value
 * @param {string} label - Metric label/description
 * @param {number|string} change - Change value (positive or negative). If string, only arrow direction is derived from changeLabel/changeFormatted; pass changeFormatted for display.
 * @param {string} changeFormatted - Optional formatted display for change (e.g. "$14K"). When provided, shown instead of Math.abs(change). Use with numeric change for correct arrow direction.
 * @param {string} changeLabel - Label for the change (e.g., "vs target 90%")
 * @param {React.Component} icon - Lucide icon component
 * @param {string} iconBgColor - Background color for icon (e.g., "bg-blue-100")
 * @param {string} iconColor - Icon color (e.g., "text-blue-600")
 * @param {string} className - Additional CSS classes
 */
export default function MetricCard({
  title,
  value,
  label,
  change,
  changeLabel,
  changeFormatted,
  icon: Icon,
  iconBgColor = 'bg-primary/10 dark:bg-primary/20',
  iconColor = 'text-primary',
  className
}) {
  const renderChangeIndicator = () => {
    if (change === undefined || change === null) return null;

    const numChange = typeof change === 'number' ? change : Number(change);
    const isValidNumber = !Number.isNaN(numChange);
    const isPositive = isValidNumber && numChange > 0;
    const isNegative = isValidNumber && numChange < 0;
    const isNeutral = isValidNumber && numChange === 0;

    const displayValue = changeFormatted != null
      ? changeFormatted
      : isValidNumber
        ? (typeof change === 'number' && change % 1 !== 0 ? Math.abs(change) : Math.abs(change))
        : null;
    if (displayValue == null && !isPositive && !isNegative && !isNeutral) return null;

    return (
      <div className={cn(
        'flex items-center gap-1 text-sm font-medium',
        isPositive && 'text-primary',
        isNegative && 'text-chart-critical',
        isNeutral && 'text-muted-foreground'
      )}>
        {isPositive && <ArrowUp className="w-4 h-4" />}
        {isNegative && <ArrowDown className="w-4 h-4" />}
        {isNeutral && <Minus className="w-4 h-4" />}
        <span>{displayValue}</span>
      </div>
    );
  };

  return (
    <Card className={cn('hover:shadow-md transition-shadow', className)}>
      <CardContent className="p-6">
        {title && (
          <div className="text-sm text-muted-foreground mb-3 font-medium">
            {title}
          </div>
        )}
        <div className="flex items-start gap-4">
          {Icon && (
            <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0', iconBgColor)}>
              <Icon className={cn('w-6 h-6', iconColor)} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 mb-1">
              <p className="text-3xl font-bold text-foreground truncate">{value}</p>
              {renderChangeIndicator()}
            </div>
            <p className="text-sm text-primary font-semibold">{label}</p>
            {changeLabel && (
              <p className="text-xs text-muted-foreground mt-1">{changeLabel}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Simple Metric Card without icon
 */
export function SimpleMetricCard({ title, value, subtitle, className }) {
  return (
    <Card className={cn('hover:shadow-md transition-shadow', className)}>
      <CardContent className="p-6">
        {title && (
          <div className="text-sm text-muted-foreground mb-2 font-medium">
            {title}
          </div>
        )}
        <div className="text-3xl font-bold text-foreground mb-1">
          {value}
        </div>
        {subtitle && (
          <div className="text-sm text-muted-foreground">
            {subtitle}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
