import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Site Compliance Chart Component
 * Horizontal bar chart showing WES average by site
 * 
 * @param {Array} data - Array of {site, wesAvg, percentage} objects
 * @param {string} title - Chart title
 * @param {string} className - Additional CSS classes
 */
export default function SiteComplianceChart({ data, title = 'Site Compliance', className }) {
  const getBarColor = (percentage) => {
    if (percentage >= 90) return 'bg-primary';
    if (percentage >= 80) return 'bg-chart-low';
    if (percentage >= 70) return 'bg-chart-medium';
    if (percentage >= 60) return 'bg-chart-high';
    return 'bg-chart-critical';
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">WES average by site</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((item, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">{item.site}</span>
                <span className="font-bold text-foreground">{item.wesAvg}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', getBarColor(item.percentage))}
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
