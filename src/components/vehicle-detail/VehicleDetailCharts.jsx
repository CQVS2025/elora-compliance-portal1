import React, { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { cn } from '@/lib/utils';
import moment from 'moment';

const TREND_RANGES = [
  { value: '14d', label: '14d', days: 14 },
  { value: '30d', label: '30d', days: 30 },
  { value: '90d', label: '90d', days: 90 },
  { value: 'all', label: 'All', days: null },
];

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Daily wash count line chart with optional daily target line */
export function VehicleWashActivityTrend({ scans = [], dailyTarget = 2, vehicleName = 'Vehicle' }) {
  const [range, setRange] = useState('14d');

  const chartData = useMemo(() => {
    if (!Array.isArray(scans) || scans.length === 0) return [];
    const byDay = {};
    scans.forEach((s) => {
      const t = s.createdAt ?? s.timestamp ?? s.scanDate;
      if (!t) return;
      const key = moment(t).format('YYYY-MM-DD');
      byDay[key] = (byDay[key] || 0) + 1;
    });
    const days = TREND_RANGES.find((r) => r.value === range)?.days ?? 14;
    const start = days ? moment().subtract(days, 'days') : moment(scans[scans.length - 1]?.createdAt ?? scans[scans.length - 1]?.timestamp).startOf('day');
    const end = moment();
    const points = [];
    for (let m = moment(start); m.isSameOrBefore(end, 'day'); m.add(1, 'day')) {
      const key = m.format('YYYY-MM-DD');
      points.push({
        date: m.format('D MMM'),
        fullDate: key,
        washes: byDay[key] || 0,
        target: dailyTarget,
      });
    }
    return points;
  }, [scans, range, dailyTarget]);

  const config = useMemo(
    () => ({
      washes: { label: 'Washes', color: 'hsl(0 84% 60%)' },
      target: { label: 'Daily Target', color: 'hsl(142 76% 36%)' },
    }),
    []
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">Wash Activity Trend</CardTitle>
        <ToggleGroup type="single" value={range} onValueChange={(v) => v && setRange(v)} variant="outline" size="sm">
          {TREND_RANGES.map((r) => (
            <ToggleGroupItem key={r.value} value={r.value} aria-label={r.label}>
              {r.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-3">Daily wash count for {vehicleName}</p>
        <ChartContainer config={config} className="h-[240px] w-full">
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} fontSize={11} allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
            <ReferenceLine y={dailyTarget} stroke="hsl(142 76% 36%)" strokeDasharray="4 4" />
            <Line type="monotone" dataKey="washes" stroke="hsl(0 84% 60%)" strokeWidth={2} dot={{ r: 3 }} name="Actual" />
            <Line type="monotone" dataKey="target" stroke="hsl(142 76% 36%)" strokeDasharray="4 4" dot={false} name="Daily Target" hide />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

/** Monthly compliance progress: gauge-style display + breakdown */
export function VehicleComplianceProgress({
  washesThisMonth = 0,
  targetWashes = 16,
  vehicleName = 'Vehicle',
  monthLabel,
}) {
  const progressPct = targetWashes ? Math.round((washesThisMonth / targetWashes) * 100) : 0;
  const remaining = Math.max(0, targetWashes - washesThisMonth);
  const now = moment();
  const daysInMonth = now.daysInMonth();
  const dayOfMonth = now.date();
  const expectedAtMidMonth = Math.round((targetWashes * 0.5));
  const expectedPct = 50;
  const likelihood = progressPct >= expectedPct ? 'ON TRACK' : 'OFF TRACK';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">Monthly Compliance Progress</CardTitle>
        <p className="text-xs text-muted-foreground">
          {vehicleName} wash progress vs target · {monthLabel ?? now.format('MMM YYYY')}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col sm:flex-row items-center gap-6">
        <div className="relative flex items-center justify-center w-32 h-32 shrink-0">
          <svg className="w-32 h-32 -rotate-90" viewBox="0 0 36 36">
            <path
              d="M18 2.5 a 15.5 15.5 0 0 1 0 31 a 15.5 15.5 0 0 1 0 -31"
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="3"
            />
            <path
              d="M18 2.5 a 15.5 15.5 0 0 1 0 31 a 15.5 15.5 0 0 1 0 -31"
              fill="none"
              stroke={progressPct >= 50 ? 'hsl(142 76% 36%)' : 'hsl(0 84% 60%)'}
              strokeWidth="3"
              strokeDasharray={`${progressPct} 100`}
              strokeLinecap="round"
            />
          </svg>
          <span
            className={cn(
              'absolute text-lg font-bold',
              progressPct >= 50 ? 'text-emerald-600' : 'text-red-600'
            )}
          >
            {progressPct}%
          </span>
        </div>
        <div className="text-sm space-y-2 min-w-0">
          <p className="font-medium text-muted-foreground">Progress</p>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0" />
            <span>Completed washes: {washesThisMonth}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/50 shrink-0" />
            <span>Remaining target: {remaining}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500 shrink-0" />
            <span>Expected at mid-month: {expectedAtMidMonth}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', likelihood === 'ON TRACK' ? 'bg-emerald-500' : 'bg-red-500')} />
            <span className={likelihood === 'OFF TRACK' ? 'text-red-600 font-medium' : 'text-emerald-600 font-medium'}>
              Likelihood: {likelihood}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Cumulative washes vs target pace and projection */
export function VehicleCumulativeWashesChart({ scans = [], targetWashes = 16, vehicleName = 'Vehicle' }) {
  const chartData = useMemo(() => {
    const now = moment();
    const start = moment(now).startOf('month');
    const end = moment(now).endOf('month');
    const daysInMonth = end.date();

    const byDay = {};
    (scans || []).forEach((s) => {
      const t = s.createdAt ?? s.timestamp ?? s.scanDate;
      if (!t) return;
      const d = moment(t);
      if (!d.isSame(start, 'month')) return;
      const day = d.date();
      byDay[day] = (byDay[day] || 0) + 1;
    });

    const points = [];
    let cumulative = 0;
    const today = now.date();
    for (let day = 1; day <= daysInMonth; day++) {
      cumulative += byDay[day] || 0;
      const targetPace = (day / daysInMonth) * targetWashes;
      const projection = day <= today ? cumulative : today > 0 ? cumulative + (cumulative / today) * (day - today) : 0;
      points.push({
        day: `${day} ${start.format('MMM')}`,
        actual: cumulative,
        targetPace: Math.round(targetPace * 10) / 10,
        projection: day > today ? Math.round(projection * 10) / 10 : cumulative,
      });
    }
    return points;
  }, [scans, targetWashes]);

  const config = useMemo(
    () => ({
      actual: { label: 'Actual', color: 'hsl(0 84% 60%)' },
      targetPace: { label: 'Target Pace', color: 'hsl(142 76% 36%)' },
      projection: { label: 'Projection (if unchanged)', color: 'hsl(38 92% 50%)' },
    }),
    []
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">Cumulative Washes vs Target</CardTitle>
        <p className="text-xs text-muted-foreground">{vehicleName} actual pace vs expected pace</p>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[240px] w-full">
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} fontSize={10} />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
            <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
            <Line type="monotone" dataKey="actual" stroke="hsl(0 84% 60%)" strokeWidth={2} dot={{ r: 2 }} name="Actual" />
            <Line type="monotone" dataKey="targetPace" stroke="hsl(142 76% 36%)" strokeDasharray="4 4" dot={false} name="Target Pace" />
            <Line type="monotone" dataKey="projection" stroke="hsl(38 92% 50%)" strokeDasharray="4 4" dot={false} name="Projection (if unchanged)" />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

/** Wash count by day of week (Mon–Sun) */
export function VehicleWashFrequencyByDay({ scans = [], vehicleName = 'Vehicle', monthLabel }) {
  const chartData = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    (scans || []).forEach((s) => {
      const t = s.createdAt ?? s.timestamp ?? s.scanDate;
      if (!t) return;
      const d = moment(t);
      let dayIndex = d.isoWeekday() - 1;
      counts[dayIndex]++;
    });
    return DAY_NAMES.map((name, i) => ({ day: name, count: counts[i] }));
  }, [scans]);

  const config = useMemo(() => ({ count: { label: 'Washes', color: 'hsl(var(--primary))' } }), []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">Wash Frequency by Day</CardTitle>
        <p className="text-xs text-muted-foreground">
          When {vehicleName} washes happen · {monthLabel ?? moment().format('MMM YYYY')}
        </p>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[220px] w-full">
          <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} fontSize={11} />
            <YAxis type="category" dataKey="day" axisLine={false} tickLine={false} width={36} fontSize={11} />
            <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: 'hsl(var(--primary) / 0.06)' }} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20} fill="hsl(var(--primary))" />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

/** Heatmap: wash activity by hour (0–23) */
export function VehicleWashActivityByHour({ scans = [], vehicleName = 'Vehicle' }) {
  const { byHour, maxCount } = useMemo(() => {
    const counts = Array(24).fill(0);
    (scans || []).forEach((s) => {
      const t = s.createdAt ?? s.timestamp ?? s.scanDate;
      if (!t) return;
      const h = moment(t).hour();
      counts[h]++;
    });
    const max = Math.max(1, ...counts);
    return { byHour: counts.map((c, i) => ({ hour: i, count: c })), maxCount: max };
  }, [scans]);

  const getIntensity = (count) => {
    if (count === 0) return 0;
    const q = count / maxCount;
    if (q >= 0.75) return 4;
    if (q >= 0.5) return 3;
    if (q >= 0.25) return 2;
    return 1;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">Wash Activity by Hour</CardTitle>
        <p className="text-xs text-muted-foreground">
          When {vehicleName} scans occur throughout the day · darker = more washes
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1">
          {byHour.map(({ hour, count }) => {
            const level = getIntensity(count);
            return (
              <div
                key={hour}
                title={`Hour ${hour}: ${count} wash${count !== 1 ? 'es' : ''}`}
                className={cn(
                  'h-8 w-8 rounded border border-border flex items-center justify-center text-[10px] font-medium',
                  level === 0 && 'bg-muted/50 text-muted-foreground',
                  level === 1 && 'bg-primary/20 text-foreground',
                  level === 2 && 'bg-primary/50 text-primary-foreground',
                  level === 3 && 'bg-primary/75 text-primary-foreground',
                  level === 4 && 'bg-primary text-primary-foreground'
                )}
              >
                {hour}
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
          <span>Intensity:</span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-muted" /> None
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-primary/20" /> Low
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-primary/50" /> Medium
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-primary" /> High
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
