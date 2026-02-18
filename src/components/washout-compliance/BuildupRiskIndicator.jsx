import React from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Buildup Risk Indicator Component
 * Visual indicator for vehicle buildup risk level
 * 
 * @param {string} risk - Risk level: 'Low', 'Med', 'High', 'Critical'
 * @param {boolean} showIcon - Whether to show icon
 * @param {string} className - Additional CSS classes
 */
export default function BuildupRiskIndicator({ risk, showIcon = true, className }) {
  const getRiskConfig = (risk) => {
    const riskLower = risk?.toLowerCase();
    
    switch (riskLower) {
      case 'low':
        return {
          color: 'bg-chart-low/10 text-chart-low border-chart-low/30 dark:bg-chart-low/20 dark:border-chart-low/40',
          icon: CheckCircle,
          label: 'Low'
        };
      case 'med':
      case 'medium':
        return {
          color: 'bg-chart-medium/10 text-chart-medium border-chart-medium/30 dark:bg-chart-medium/20 dark:border-chart-medium/40',
          icon: AlertCircle,
          label: 'Medium'
        };
      case 'high':
        return {
          color: 'bg-chart-high/10 text-chart-high border-chart-high/30 dark:bg-chart-high/20 dark:border-chart-high/40',
          icon: AlertTriangle,
          label: 'High'
        };
      case 'critical':
        return {
          color: 'bg-chart-critical/10 text-chart-critical border-chart-critical/30 dark:bg-chart-critical/20 dark:border-chart-critical/40',
          icon: XCircle,
          label: 'Critical'
        };
      default:
        return {
          color: 'bg-muted text-muted-foreground border-border',
          icon: AlertCircle,
          label: risk || 'Unknown'
        };
    }
  };

  const config = getRiskConfig(risk);
  const Icon = config.icon;

  return (
    <Badge 
      variant="outline" 
      className={cn(
        config.color,
        'font-medium border',
        className
      )}
    >
      {showIcon && <Icon className="w-3 h-3 mr-1" />}
      {config.label}
    </Badge>
  );
}

/**
 * Detailed Risk Card with description
 */
export function RiskCard({ risk, dedagETA, estimatedCost, className }) {
  const getRiskColor = (risk) => {
    const riskLower = risk?.toLowerCase();
    if (riskLower === 'critical') return 'border-chart-critical bg-chart-critical/10 dark:bg-chart-critical/20';
    if (riskLower === 'high') return 'border-chart-high bg-chart-high/10 dark:bg-chart-high/20';
    if (riskLower === 'med' || riskLower === 'medium') return 'border-chart-medium bg-chart-medium/10 dark:bg-chart-medium/20';
    return 'border-chart-low bg-chart-low/10 dark:bg-chart-low/20';
  };

  return (
    <div className={cn('border-l-4 p-4 rounded-r-lg', getRiskColor(risk), className)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-foreground">Buildup Risk:</span>
          <BuildupRiskIndicator risk={risk} />
        </div>
      </div>
      {dedagETA && (
        <div className="text-sm text-muted-foreground">
          <span className="font-medium">Predicted Dedagging:</span> {dedagETA}
        </div>
      )}
      {estimatedCost && (
        <div className="text-sm text-muted-foreground mt-1">
          <span className="font-medium">Estimated Cost:</span> ${estimatedCost.toLocaleString()}
        </div>
      )}
    </div>
  );
}
