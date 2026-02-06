import React, { useMemo, useState } from 'react';
import { Send, Download } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import DataTable from '@/components/DataTable';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

const NO_ACCESS_MESSAGE = "You don't have access to perform this operation.";

const RISK_COLORS = {
  critical: 'bg-destructive/90 text-destructive-foreground',
  high: 'bg-amber-500/90 text-white',
  medium: 'bg-yellow-500/80 text-black',
  low: 'bg-primary/80 text-primary-foreground',
};

const RISK_LEVEL_OPTIONS = [
  { value: 'all', label: 'All risk levels' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export default function AIInsightsRiskPredictions({ predictions, isLoading, isSuperAdmin, canSendAlerts = false, onRefresh }) {
  const { toast } = useToast();
  const [riskLevelFilter, setRiskLevelFilter] = useState('all');
  const [siteFilter, setSiteFilter] = useState('all');

  const uniqueSites = useMemo(() => {
    const set = new Set();
    (predictions || []).forEach((p) => {
      const s = p.site_name || p.site_ref;
      if (s) set.add(s);
    });
    return Array.from(set).sort();
  }, [predictions]);

  const filteredPredictions = useMemo(() => {
    let list = predictions || [];
    if (riskLevelFilter !== 'all') list = list.filter((p) => p.risk_level === riskLevelFilter);
    if (siteFilter !== 'all') list = list.filter((p) => (p.site_name || p.site_ref) === siteFilter);
    return list;
  }, [predictions, riskLevelFilter, siteFilter]);

  const critical = (predictions || []).filter((p) => p.risk_level === 'critical').length;
  const high = (predictions || []).filter((p) => p.risk_level === 'high').length;
  const medium = (predictions || []).filter((p) => p.risk_level === 'medium').length;

  const riskLevelChartData = useMemo(() => [
    { level: 'Critical', count: critical, fill: 'hsl(var(--chart-critical))' },
    { level: 'High', count: high, fill: 'hsl(var(--chart-high))' },
    { level: 'Medium', count: medium, fill: 'hsl(var(--chart-medium))' },
    { level: 'Low', count: (predictions || []).filter((p) => p.risk_level === 'low').length, fill: 'hsl(var(--chart-low))' },
  ].filter((d) => d.count > 0), [predictions, critical, high, medium]);

  const riskBySiteData = useMemo(() => {
    const bySite = {};
    (predictions || []).forEach((p) => {
      const s = p.site_name || p.site_ref || 'Unknown';
      bySite[s] = (bySite[s] || 0) + 1;
    });
    return Object.entries(bySite).map(([site, count]) => ({ site, count, fill: 'hsl(var(--primary))' })).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [predictions]);

  const riskChartConfig = { count: { label: 'Vehicles' }, level: { label: 'Risk Level' } };
  const siteChartConfig = { count: { label: 'At risk' }, primary: { label: 'At risk', color: 'hsl(var(--primary))' } };

  const handleSendReminder = (vehicleRef) => {
    if (!canSendAlerts) return;
    toast({ title: 'Queued', description: 'SMS will be enabled in Phase 2.' });
  };

  const handleSendAllReminders = () => {
    if (!canSendAlerts) return;
    toast({ title: 'Queued', description: 'SMS will be enabled in Phase 2.' });
  };

  const handleExport = () => {
    toast({ title: 'Export', description: 'Export will be available in a future update.' });
  };

  const columns = [
    { id: 'vehicle', header: 'Vehicle', accessorKey: 'vehicle_name', cell: (row) => row.vehicle_name || row.vehicle_ref || '—' },
    { id: 'driver', header: 'Driver', accessorKey: 'driver_name', cell: (row) => row.driver_name || '—' },
    { id: 'site', header: 'Site', accessorKey: 'site_name', cell: (row) => row.site_name || row.site_ref || '—' },
    { id: 'progress', header: 'Progress', cell: () => '—' },
    {
      id: 'risk_level',
      header: 'Risk Level',
      cell: (row) => (
        <Badge className={RISK_COLORS[row.risk_level] || RISK_COLORS.medium}>{row.risk_level}</Badge>
      ),
    },
    {
      id: 'confidence',
      header: 'AI Confidence',
      cell: (row) => (row.confidence_score != null ? `${Math.round(Number(row.confidence_score))}%` : '—'),
    },
    {
      id: 'action',
      header: 'Action',
      cell: (row) => {
        const btn = (
          <Button
            variant="ghost"
            size="sm"
            disabled={!canSendAlerts}
            onClick={() => handleSendReminder(row.vehicle_ref)}
          >
            Send Reminder
          </Button>
        );
        return canSendAlerts ? (
          btn
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-block cursor-not-allowed">{btn}</span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{NO_ACCESS_MESSAGE}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <Card className="bg-muted/40">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-2xl font-bold">{predictions?.length ?? 0}</p>
              <p className="text-sm text-muted-foreground">Vehicles at risk</p>
            </div>
            <div>
              <p className="text-2xl font-bold">73%</p>
              <p className="text-sm text-muted-foreground">Predicted fleet compliance</p>
            </div>
            <div className="flex gap-4">
              <div>
                <p className="text-xl font-bold">{critical}</p>
                <p className="text-xs text-muted-foreground">Critical (24hrs)</p>
              </div>
              <div>
                <p className="text-xl font-bold">{high}</p>
                <p className="text-xs text-muted-foreground">High (48hrs)</p>
              </div>
              <div>
                <p className="text-xl font-bold">{medium}</p>
                <p className="text-xs text-muted-foreground">Medium (72hrs)</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts: Risk level breakdown + By site */}
      {(riskLevelChartData.length > 0 || riskBySiteData.length > 0) && !isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {riskLevelChartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Risk level breakdown</CardTitle>
                <CardDescription>Number of vehicles per risk level</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={riskChartConfig} className="aspect-auto h-[200px] w-full">
                  <BarChart data={riskLevelChartData} margin={{ left: 12, right: 12 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="level" tickLine={false} axisLine={false} tickMargin={8} />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                    <Bar dataKey="count" radius={4}>
                      {riskLevelChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}
          {riskBySiteData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>At-risk vehicles by site</CardTitle>
                <CardDescription>Sites with most at-risk vehicles</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={siteChartConfig} className="aspect-auto h-[200px] w-full">
                  <BarChart data={riskBySiteData} layout="vertical" margin={{ left: 12, right: 12 }}>
                    <CartesianGrid horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="site" type="category" width={100} tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(v) => (v && v.length > 12 ? v.slice(0, 10) + '…' : v)} />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={4} layout="vertical" />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {isLoading && (
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      )}
      {!isLoading && !filteredPredictions.length && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm py-8">
              {predictions?.length
                ? 'No vehicles match the current filters.'
                : 'No at-risk vehicles. Run Fleet Analysis to refresh.'}
            </p>
          </CardContent>
        </Card>
      )}
      {!isLoading && filteredPredictions.length > 0 && (
        <DataTable
          columns={columns}
          data={filteredPredictions}
          getRowId={(row) => row.id}
          searchPlaceholder="Search vehicle, driver, site..."
          title="At-Risk Vehicle Details"
          pageSize={20}
          headerExtra={
            <>
              <Select value={riskLevelFilter} onValueChange={setRiskLevelFilter}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder="Risk level" />
                </SelectTrigger>
                <SelectContent>
                  {RISK_LEVEL_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={siteFilter} onValueChange={setSiteFilter}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="Site" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sites</SelectItem>
                  {uniqueSites.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {canSendAlerts ? (
                <Button variant="outline" size="sm" onClick={handleSendAllReminders}>
                  <Send className="h-4 w-4 mr-1" />
                  Send All Reminders
                </Button>
              ) : (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-block cursor-not-allowed">
                        <Button variant="outline" size="sm" disabled>
                          <Send className="h-4 w-4 mr-1" />
                          Send All Reminders
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{NO_ACCESS_MESSAGE}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-1" />
                Export Report
              </Button>
              {onRefresh && (
                <Button variant="ghost" size="sm" onClick={onRefresh}>
                  Refresh
                </Button>
              )}
            </>
          }
        />
      )}
    </div>
  );
}
