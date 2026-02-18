import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, AlertTriangle, AlertCircle, Gauge } from 'lucide-react';
import { cn } from '@/lib/utils';

function getSeverityConfig(severity) {
  switch (severity?.toUpperCase()) {
    case 'CRITICAL':
      return {
        badge: 'bg-chart-critical/15 text-chart-critical border-chart-critical/40 dark:bg-chart-critical/25 dark:border-chart-critical/50',
        bar: 'bg-chart-critical',
        icon: AlertTriangle,
        iconColor: 'text-chart-critical',
        scoreColor: 'text-chart-critical',
      };
    case 'HIGH':
      return {
        badge: 'bg-chart-high/15 text-chart-high border-chart-high/40 dark:bg-chart-high/25 dark:border-chart-high/50',
        bar: 'bg-chart-high',
        icon: AlertCircle,
        iconColor: 'text-chart-high',
        scoreColor: 'text-chart-high',
      };
    case 'MEDIUM':
      return {
        badge: 'bg-chart-medium/15 text-chart-medium border-chart-medium/40 dark:bg-chart-medium/25 dark:border-chart-medium/50',
        bar: 'bg-chart-medium',
        icon: AlertCircle,
        iconColor: 'text-chart-medium',
        scoreColor: 'text-chart-medium',
      };
    default:
      return {
        badge: 'bg-muted text-muted-foreground border-border',
        bar: 'bg-muted-foreground/30',
        icon: AlertCircle,
        iconColor: 'text-muted-foreground',
        scoreColor: 'text-muted-foreground',
      };
  }
}

/**
 * Priority Action Card – compact card for one vehicle needing attention
 */
export default function PriorityActionCard({ action, className }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = getSeverityConfig(action.severity);
  const Icon = config.icon;

  return (
    <Card
      className={cn(
        'relative overflow-hidden border border-border bg-card/80 hover:bg-card transition-colors h-full flex flex-col',
        className
      )}
    >
      <div className={cn('absolute left-0 top-0 bottom-0 w-1 rounded-l', config.bar)} aria-hidden />
      <CardContent className="p-0 pl-4 flex-1 flex flex-col min-h-0">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 py-4 pr-4 min-h-[7rem]">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div
              className={cn(
                'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0',
                action.severity === 'CRITICAL' ? 'bg-chart-critical/15' : 'bg-chart-high/15'
              )}
            >
              <Icon className={cn('w-4 h-4', config.iconColor)} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-foreground">{action.vehicleId}</span>
                <Badge variant="outline" className={cn('text-xs font-medium', config.badge)}>
                  {action.severity}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {action.site} · {action.driver}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-muted-foreground" />
              <span className={cn('font-bold tabular-nums', config.scoreColor)}>
                {action.wesScore}/100
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground"
              onClick={() => setIsExpanded(!isExpanded)}
              aria-expanded={isExpanded}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {isExpanded && (
          <div className="border-t border-border pt-4 pb-4 pr-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Issue</p>
              <p className="text-sm text-foreground leading-relaxed">{action.issue}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Recommended action</p>
              <p className="text-sm text-foreground leading-relaxed">{action.recommendation}</p>
            </div>
            {(action.confidence != null || action.anomaly) && (
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-1">
                {action.confidence != null && (
                  <span>Confidence: <strong className="text-foreground">{action.confidence}%</strong></span>
                )}
                {action.anomaly && (
                  <span className="text-muted-foreground">{action.anomaly}</span>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Priority Actions Section – header + grid of action cards
 */
export function PriorityActionsSection({ actions, title = 'Priority Actions Required', className }) {
  if (!actions || actions.length === 0) return null;

  return (
    <Card className={cn('border-border', className)}>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-foreground tracking-tight">{title}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Critical and high-risk vehicles needing immediate attention
            </p>
          </div>
          <Badge
            variant="secondary"
            className={cn(
              'w-fit font-medium',
              'bg-chart-critical/10 text-chart-critical border-chart-critical/30',
              'dark:bg-chart-critical/20 dark:border-chart-critical/40'
            )}
          >
            {actions.length} {actions.length === 1 ? 'vehicle' : 'vehicles'} need attention
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 [&>div]:min-w-0">
          {actions.map((action, index) => (
            <div key={action.vehicleId ?? index} className="relative h-full">
              <PriorityActionCard action={action} className="h-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
