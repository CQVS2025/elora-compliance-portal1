import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * WES Distribution Chart Component
 * Shows distribution of vehicles across WES score ranges
 * 
 * @param {Array} data - Array of {range, count, color} objects
 * @param {string} title - Chart title
 * @param {string} className - Additional CSS classes
 */
export default function WESDistributionChart({ data, title = 'WES Score Distribution', className }) {
  const total = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">All vehicles · This week</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {data.map((item, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn('w-4 h-4 rounded', item.color)} />
                  <span className="text-sm font-medium text-foreground">{item.range}</span>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-foreground">{item.count}</div>
                  <div className="text-xs text-muted-foreground">
                    {((item.count / total) * 100).toFixed(0)}%
                  </div>
                </div>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', item.color)}
                  style={{ width: `${(item.count / total) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
