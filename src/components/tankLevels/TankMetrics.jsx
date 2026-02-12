import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  MapPin,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Droplet,
  Activity,
} from 'lucide-react';

export default function TankMetrics({ metrics }) {
  if (!metrics) {
    return null;
  }

  const metricsData = [
    {
      label: 'Total Sites',
      value: metrics.totalSites,
      subtitle: `${metrics.monitoredSites} monitored • ${metrics.pendingSites} pending`,
      icon: MapPin,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    },
    {
      label: 'OK',
      value: metrics.okCount,
      subtitle: '≥ 20% capacity',
      icon: CheckCircle,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-950/30',
    },
    {
      label: 'Warning',
      value: metrics.warningCount,
      subtitle: '10–19% capacity',
      icon: AlertTriangle,
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-50 dark:bg-orange-950/30',
    },
    {
      label: 'Critical',
      value: metrics.criticalCount,
      subtitle: '< 10% — refill needed',
      icon: AlertCircle,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-950/30',
    },
    {
      label: 'Avg Level',
      value: `${Math.round(metrics.avgLevel * 10) / 10}%`,
      subtitle: 'across monitored tanks',
      icon: Droplet,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      label: 'Monitored Tanks',
      value: metrics.totalTanks,
      subtitle: 'ECSR + TW tanks',
      icon: Activity,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-50 dark:bg-purple-950/30',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {metricsData.map((metric, idx) => {
        const Icon = metric.icon;
        return (
          <Card key={idx}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {metric.label}
                </span>
                <div className={`p-1.5 rounded-lg ${metric.bgColor}`}>
                  <Icon className={`w-4 h-4 ${metric.color}`} />
                </div>
              </div>
              <div className={`text-2xl font-bold ${metric.color} mb-1`}>
                {metric.value}
              </div>
              <div className="text-xs text-muted-foreground">
                {metric.subtitle}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
