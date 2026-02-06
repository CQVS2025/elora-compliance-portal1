import React, { useMemo, useState, useEffect } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = ['5am', '6am', '7am', '8am', '9am', '10am', '11am', '12pm', '1pm', '2pm', '3pm', '4pm', '5pm'];

// Fallback when no pattern summary (before first Run Fleet Analysis)
function getPlaceholderHeatmap() {
  const grid = [];
  for (let d = 0; d < 7; d++) {
    const row = [];
    for (let h = 0; h < 13; h++) {
      if (d === 4) row.push(Math.max(0, 4 - Math.abs(h - 1) + Math.floor(Math.random() * 2)));
      else row.push(Math.max(0, 6 - Math.abs(h - 1) + Math.floor(Math.random() * 3)));
    }
    grid.push(row);
  }
  return grid;
}

export default function AIInsightsPatterns({ companyId, patternSummary }) {
  const heatmap = Array.isArray(patternSummary?.heatmap_json) && patternSummary.heatmap_json.length === 7
    ? patternSummary.heatmap_json
    : getPlaceholderHeatmap();
  const flatVals = heatmap.flatMap((row) => (Array.isArray(row) ? row : [row])).filter((n) => typeof n === 'number');
  const maxVal = flatVals.length ? Math.max(...flatVals, 1) : 1;

  const peakHour = patternSummary?.peak_hour ?? '6:15 AM';
  const peakHourCount = patternSummary?.peak_hour_count ?? 64;
  const lowestDay = patternSummary?.lowest_day ?? 'Friday';
  const lowestDayPct = patternSummary?.lowest_day_pct_below_avg ?? 34;
  const bestSiteName = patternSummary?.best_site_name ?? '—';
  const bestSiteCompliance = patternSummary?.best_site_compliance ?? 82;
  const topDriverName = patternSummary?.top_driver_name ?? '—';
  const positivePatterns = Array.isArray(patternSummary?.positive_patterns) ? patternSummary.positive_patterns : [
    { text: 'Morning washers hit targets 73% more often', confidence: 92 },
    { text: 'SMS reminders improve compliance by 34%', confidence: 85 },
  ];
  const concernPatterns = Array.isArray(patternSummary?.concern_patterns) ? patternSummary.concern_patterns : [
    { text: 'Friday compliance 34% below average', confidence: 94 },
    { text: 'Afternoon wash slots severely underutilized', confidence: 91 },
  ];
  const hasRealData = !!patternSummary;

  const washesByDayData = useMemo(() => {
    return DAYS.map((day, d) => {
      const row = heatmap[d];
      const total = Array.isArray(row) ? row.reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0) : 0;
      return { day, washes: total };
    });
  }, [heatmap]);

  const washesByHourData = useMemo(() => {
    return HOURS.map((hour, h) => {
      let total = 0;
      for (let d = 0; d < 7; d++) {
        const row = heatmap[d];
        const v = Array.isArray(row) ? row[h] : 0;
        total += typeof v === 'number' ? v : 0;
      }
      return { hour, washes: total };
    });
  }, [heatmap]);

  const dayChartConfig = { washes: { label: 'Washes', color: 'hsl(var(--primary))' } };
  const hourChartConfig = { washes: { label: 'Washes', color: 'hsl(var(--primary))' } };

  const [heatmapMounted, setHeatmapMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setHeatmapMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Peak Wash Hour</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{peakHour}</p>
            <p className="text-xs text-muted-foreground">{peakHourCount} washes avg</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Lowest Day</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{lowestDay}</p>
            <p className="text-xs text-muted-foreground">{lowestDayPct}% below average</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Best Site</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{bestSiteName}</p>
            <p className="text-xs text-muted-foreground">{bestSiteCompliance}% compliance</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Top Driver</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{topDriverName}</p>
            <p className="text-xs text-muted-foreground">100% target hit</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts: Washes by day (Bar) + Washes by hour (Area) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Washes by day of week</CardTitle>
            <CardDescription>Total washes per day (from pattern data)</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={dayChartConfig} className="aspect-auto h-[220px] w-full">
              <BarChart data={washesByDayData} margin={{ left: 12, right: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                <Bar dataKey="washes" fill="var(--color-washes)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Washes by hour</CardTitle>
            <CardDescription>Peak wash times across the week</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={hourChartConfig} className="aspect-auto h-[220px] w-full">
              <AreaChart data={washesByHourData} margin={{ left: 12, right: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="hour" tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                <Area dataKey="washes" type="natural" fill="var(--color-washes)" fillOpacity={0.4} stroke="var(--color-washes)" />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Weekly Wash Pattern Heatmap</CardTitle>
          <CardDescription>
            Darker = more washes. Identify underutilized time slots.
            {!hasRealData && ' Run Fleet Analysis to populate from your data.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-border bg-muted/30 p-2">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="rounded-tl p-2 bg-muted/60 font-medium w-14 text-left" />
                  {HOURS.map((h, i) => (
                    <th
                      key={h}
                      className="p-2 bg-muted/60 font-medium text-center min-w-[2.25rem]"
                      style={{
                        opacity: heatmapMounted ? 1 : 0,
                        transform: heatmapMounted ? 'scale(1)' : 'scale(0.95)',
                        transition: `opacity 0.25s ease-out ${i * 15}ms, transform 0.25s ease-out ${i * 15}ms`,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((day, d) => (
                  <tr key={day}>
                    <td className="p-2 bg-muted/60 font-medium text-left sticky left-0 z-[1]">
                      {day} {d === 4 ? ' ⚠️' : ''}
                    </td>
                    {HOURS.map((_, h) => {
                      const row = heatmap[d];
                      const v = Array.isArray(row) ? (row[h] ?? 0) : 0;
                      const intensity = maxVal ? v / maxVal : 0;
                      const isDark = intensity > 0.45;
                      const delayMs = (d * HOURS.length + h) * 22;
                      return (
                        <td
                          key={h}
                          className="relative p-1 min-w-[2.25rem] align-middle"
                          title={`${day} ${HOURS[h]} — ${v} wash${v !== 1 ? 'es' : ''}`}
                        >
                          <span
                            className={`
                              block w-full min-h-[2rem] rounded p-2 text-center font-medium
                              transition-[opacity,transform] duration-300 ease-out
                              hover:brightness-110 hover:ring-2 hover:ring-primary/40 hover:ring-offset-1 hover:shadow-md
                              ${heatmapMounted ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
                              ${intensity > 0 ? 'cursor-default' : ''}
                            `}
                            style={{
                              backgroundColor: intensity > 0
                                ? `hsl(var(--primary) / ${0.25 + intensity * 0.75})`
                                : 'hsl(var(--muted) / 0.8)',
                              color: isDark ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
                              transitionDelay: `${delayMs}ms`,
                            }}
                          >
                            {v > 0 ? v : '—'}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-3 mt-4 text-muted-foreground text-xs">
            <span>Less</span>
            <div
              className="h-3 flex-1 max-w-[120px] rounded-full overflow-hidden border border-border/50"
              role="presentation"
              aria-hidden
            >
              <div
                className="h-full w-full rounded-full transition-opacity duration-500"
                style={{
                  opacity: heatmapMounted ? 1 : 0,
                  background: 'linear-gradient(to right, hsl(var(--muted)), hsl(var(--primary) / 0.3), hsl(var(--primary)))',
                }}
              />
            </div>
            <span>More</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Positive Patterns</CardTitle>
            <CardDescription>Detected from wash history</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {positivePatterns.map((p, i) => (
              <p key={i} className="text-sm text-muted-foreground">
                {typeof p === 'object' && p !== null && 'text' in p ? p.text : p}
                {typeof p === 'object' && p !== null && 'confidence' in p && (
                  <span className="ml-1 font-medium">— {p.confidence}%</span>
                )}
              </p>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Areas of Concern</CardTitle>
            <CardDescription>Patterns to address</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {concernPatterns.map((p, i) => (
              <p key={i} className="text-sm text-muted-foreground">
                {typeof p === 'object' && p !== null && 'text' in p ? p.text : p}
                {typeof p === 'object' && p !== null && 'confidence' in p && (
                  <span className="ml-1 font-medium">— {p.confidence}%</span>
                )}
              </p>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
