import React, { useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { cn } from '@/lib/utils';

const TIME_RANGES = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
];

/**
 * Interactive area chart for wash frequency trends.
 * data: [{ date, washes }] (e.g. from dashboard washTrendsData).
 * Time range selector filters displayed points (last 7, 30, or 90 entries).
 */
export default function ChartAreaInteractive({ data = [], className }) {
  const [range, setRange] = useState('30d');

  const chartData = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return [];
    const n = range === '7d' ? 7 : range === '30d' ? 30 : 90;
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
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">Wash frequency</CardTitle>
        <ToggleGroup
          type="single"
          value={range}
          onValueChange={(v) => v && setRange(v)}
          variant="outline"
          size="sm"
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
