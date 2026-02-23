import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, LabelList, Cell } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { getDefaultLikelihood } from '@/components/dashboard/VehicleLikelihoodCell';

const chartConfig = { washes: { label: 'Washes', color: 'hsl(var(--primary))' } };

const BAR_HEIGHT = 28;
const MIN_CHART_HEIGHT = 200;
const MAX_VISIBLE_HEIGHT = 480;

// Colors aligned with On Target / Partial / Below Target (and likelihood green / orange / red)
const COLOR_ON_TARGET = 'hsl(142 76% 36%)';   // green
const COLOR_PARTIAL = 'hsl(38 92% 50%)';     // amber
const COLOR_BELOW_TARGET = 'hsl(0 84% 60%)'; // red

function getFillByLikelihood(likelihood) {
  if (likelihood === 'green') return COLOR_ON_TARGET;
  if (likelihood === 'orange') return COLOR_PARTIAL;
  return COLOR_BELOW_TARGET;
}

export default function VehiclePerformanceChart({ vehicles, likelihoodOverrides = {} }) {
  const { data, xDomain } = useMemo(() => {
    const targetDefault = 12;
    const mapped = [...(Array.isArray(vehicles) ? vehicles : [])]
      .sort((a, b) => (b.washes_completed ?? 0) - (a.washes_completed ?? 0))
      .map(v => {
        const target = v.target ?? v.washesPerWeek ?? v.protocolNumber ?? targetDefault;
        const washes = v.washes_completed ?? 0;
        const displayName = [v.name, v.site_name].filter(Boolean).join(' · ') || v.rfid || v.id || 'Unknown';
        const effectiveLikelihood = likelihoodOverrides[v.id ?? v.rfid] ?? getDefaultLikelihood(v, target);
        return {
          name: displayName,
          washes,
          target,
          label: `${washes}/${target}`,
          fill: getFillByLikelihood(effectiveLikelihood),
        };
      });
    const maxVal = mapped.length ? Math.max(...mapped.map(d => Math.max(d.washes, d.target)), 6) + 2 : 8;
    return { data: mapped, xDomain: [0, maxVal] };
  }, [vehicles, likelihoodOverrides]);

  const chartHeight = Math.min(
    MAX_VISIBLE_HEIGHT,
    Math.max(MIN_CHART_HEIGHT, data.length * BAR_HEIGHT)
  );
  const needsScroll = data.length * BAR_HEIGHT > MAX_VISIBLE_HEIGHT;

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-foreground">Vehicle Performance</h3>
            <div className="w-10 h-[3px] bg-primary rounded-full mt-2" />
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> On Target
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Partial
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Below Target
            </span>
          </div>
        </div>

        <div className={needsScroll ? 'overflow-y-auto max-h-[480px] pr-1' : ''}>
          <ChartContainer config={chartConfig} className="w-full" style={{ minHeight: chartHeight, height: needsScroll ? data.length * BAR_HEIGHT : chartHeight }}>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 8, right: 50, left: 0, bottom: 8 }}
            >
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11 }}
                domain={xDomain}
              />
              <YAxis
                type="category"
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fontWeight: 500 }}
                width={200}
              />
              <ChartTooltip content={<ChartTooltipContent indicator="line" />} cursor={{ fill: 'hsl(var(--primary) / 0.06)' }} />
              <Bar dataKey="washes" radius={[0, 4, 4, 0]} barSize={22} maxBarSize={28}>
                {data.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
                <LabelList dataKey="label" position="right" fontSize={11} fontWeight={600} />
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  );
}