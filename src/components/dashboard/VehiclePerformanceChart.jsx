import React from 'react';
import { BarChart, Bar, XAxis, YAxis, LabelList } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

const chartConfig = { washes: { label: 'Washes', color: 'hsl(var(--primary))' } };

export default function VehiclePerformanceChart({ vehicles }) {
  const data = [...vehicles]
    .sort((a, b) => (b.washes_completed ?? 0) - (a.washes_completed ?? 0))
    .slice(0, 10)
    .map(v => {
      const displayName = [v.name, v.site_name].filter(Boolean).join(' • ') || v.rfid || 'Unknown';
      return {
        name: displayName,
        washes: v.washes_completed ?? 0,
      };
    });

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-6">
        <div className="mb-6">
          <h3 className="text-lg font-bold text-foreground">Vehicle Performance</h3>
          <div className="w-10 h-[3px] bg-primary rounded-full mt-2" />
        </div>

        <ChartContainer config={chartConfig} className="h-[280px] w-full">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="barGradientVpc" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="hsl(var(--primary))" />
                <stop offset="100%" stopColor="hsl(var(--primary) / 0.8)" />
              </linearGradient>
            </defs>
            <XAxis
              type="number"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12 }}
              domain={[0, 'dataMax + 1']}
            />
            <YAxis
              type="category"
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fontWeight: 600 }}
              width={120}
            />
            <ChartTooltip content={<ChartTooltipContent indicator="line" />} cursor={{ fill: 'hsl(var(--primary) / 0.08)' }} />
            <Bar
              dataKey="washes"
              fill="url(#barGradientVpc)"
              radius={[0, 4, 4, 0]}
              barSize={24}
            >
              <LabelList dataKey="washes" position="right" />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}