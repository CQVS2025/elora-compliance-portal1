import React, { useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { cn } from '@/lib/utils';

const TIME_RANGES = [
  { value: '7d', label: '7 days' },
  { value: '14d', label: '14 days' },
  { value: '30d', label: '30 days' },
  { value: '60d', label: '60 days' },
  { value: '90d', label: '90 days' },
  { value: 'all', label: 'All' },
];

/**
 * Interactive area chart for wash frequency trends.
 * data: [{ date, washes }] (e.g. from dashboard washTrendsData).
 * Period selector filters displayed points (last N days or all).
 */
export default function ChartAreaInteractive({ data = [], className }) {
  const [range, setRange] = useState('30d');

  const chartData = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return [];
    if (range === 'all') return data;
    const days = { '7d': 7, '14d': 14, '30d': 30, '60d': 60, '90d': 90 }[range] ?? 30;
    // Detect if data is monthly (e.g. "7/2021", "1/2022") vs daily (e.g. "Jan 15", "Feb 12")
    const firstDate = data[0]?.date ?? '';
    const isMonthly = /^\d{1,2}\/\d{2,4}$/.test(String(firstDate).trim());
    const n = isMonthly ? Math.max(1, Math.ceil(days / 30)) : days;
    return data.slice(-n);
  }, [data, range]);

  const config = useMemo(
    () => ({
      washes: {
        label: 'Washes',
        color: 'hsl(var(--primary))',
      },
    }),
    []
  );

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2">
        <div>
          <CardTitle className="text-base font-medium">Wash Frequency</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Washes per day/month in selected period</p>
        </div>
        <ToggleGroup
          type="single"
          value={range}
          onValueChange={(v) => v && setRange(v)}
          variant="outline"
          size="sm"
          className="flex flex-wrap justify-end"
        >
          {TIME_RANGES.map((r) => (
            <ToggleGroupItem key={r.value} value={r.value} aria-label={r.label}>
              {r.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[280px] w-full">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={12}
            />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
            <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
            <Area
              type="monotone"
              dataKey="washes"
              stroke="var(--color-washes)"
              fill="var(--color-washes)"
              fillOpacity={0.3}
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
