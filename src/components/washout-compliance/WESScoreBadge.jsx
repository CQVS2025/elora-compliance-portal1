import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * WES Score Badge Component
 * Displays WES score with color coding based on performance level
 * 
 * @param {number} score - WES score (0-100)
 * @param {string} className - Additional CSS classes
 */
export default function WESScoreBadge({ score, className }) {
  const getScoreColor = (score) => {
    if (score >= 90) return 'bg-primary text-primary-foreground hover:bg-primary/90';
    if (score >= 70) return 'bg-chart-low text-primary-foreground hover:bg-chart-low/90';
    if (score >= 50) return 'bg-chart-medium text-primary-foreground hover:bg-chart-medium/90';
    return 'bg-chart-critical text-destructive-foreground hover:bg-chart-critical/90';
  };

  const getScoreLabel = (score) => {
    if (score >= 90) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 50) return 'Marginal';
    return 'Poor';
  };

  return (
    <Badge className={cn(getScoreColor(score), 'font-semibold', className)}>
      {score}
    </Badge>
  );
}

export function WESScoreStatus({ status, className }) {
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'compliant':
      case 'excellent':
        return 'bg-primary/10 text-primary border-primary/30 dark:bg-primary/20 dark:border-primary/40';
      case 'acceptable':
      case 'good':
        return 'bg-chart-low/10 text-chart-low border-chart-low/30 dark:bg-chart-low/20 dark:border-chart-low/40';
      case 'marginal':
        return 'bg-chart-medium/10 text-chart-medium border-chart-medium/30 dark:bg-chart-medium/20 dark:border-chart-medium/40';
      case 'non-compliant':
      case 'poor':
        return 'bg-chart-critical/10 text-chart-critical border-chart-critical/30 dark:bg-chart-critical/20 dark:border-chart-critical/40';
      case 'critical':
        return 'bg-chart-critical/20 text-chart-critical border-chart-critical/50 dark:bg-chart-critical/30 dark:border-chart-critical/50';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <Badge variant="outline" className={cn(getStatusColor(status), 'font-medium', className)}>
      {status}
    </Badge>
  );
}
