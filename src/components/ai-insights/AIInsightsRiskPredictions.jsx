import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Send, Download, Info, X, RotateCcw, Loader2, Phone, Mail, MessageSquare } from 'lucide-react';
import { callEdgeFunction } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { toast } from '@/lib/toast';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

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

function maskPhone(phone) {
  if (!phone || typeof phone !== 'string') return null;
  const cleaned = phone.replace(/\s/g, '');
  if (cleaned.length < 6) return cleaned;
  return `${cleaned.slice(0, 6)}***${cleaned.slice(-2)}`;
}

const SMS_TEMPLATES = {
  1: {
    id: 1,
    label: 'Friendly Reminder',
    template: `Hi, your vehicle {{VEHICLE_ID}} at {{SITE}} has not hit its wash target yet. A quick wash before end of day keeps you on track. Wash bays are quietest between {{OPTIMAL_WINDOW}}. - ELORA`,
  },
  2: {
    id: 2,
    label: 'Direct Performance Reminder',
    template: `Wash reminder: {{VEHICLE_ID}} is due at {{SITE}}.
You're {{WASHES_REMAINING}} wash(es) short of your target.
Best time to go: {{OPTIMAL_WINDOW}}.
Let's get it done today — ELORA`,
  },
  3: {
    id: 3,
    label: 'Data-Focused',
    template: `{{VEHICLE_ID}} wash due at {{SITE}}.
Target: {{WEEKLY_TARGET}} | Done: {{WASHES_COMPLETED}}.
Recommended window: {{OPTIMAL_WINDOW}}.
— ELORA`,
  },
};

// Same target logic as Compliance page: protocolNumber ?? washesPerWeek ?? 12
// When liveVehicleDataMap is provided, use live data (matches Compliance page)
function buildPreview(row, templateId, liveData = null) {
  const t = SMS_TEMPLATES[templateId] || SMS_TEMPLATES[2];
  const target = Number(liveData?.target_washes ?? row.target_washes ?? 12);
  const completed = Number(liveData?.washes_completed ?? row.current_week_washes ?? 0);
  const remaining = Math.max(0, target - completed);
  const data = {
    VEHICLE_ID: row.vehicle_name || row.vehicle_ref || 'Your vehicle',
    SITE: row.site_name || row.site_ref || 'your site',
    WASHES_REMAINING: String(remaining),
    WEEKLY_TARGET: String(target),
    WASHES_COMPLETED: String(completed),
    OPTIMAL_WINDOW: '6-8am',
  };
  return t.template
    .replace(/\{\{VEHICLE_ID\}\}/g, data.VEHICLE_ID)
    .replace(/\{\{SITE\}\}/g, data.SITE)
    .replace(/\{\{WASHES_REMAINING\}\}/g, data.WASHES_REMAINING)
    .replace(/\{\{WEEKLY_TARGET\}\}/g, data.WEEKLY_TARGET)
    .replace(/\{\{WASHES_COMPLETED\}\}/g, data.WASHES_COMPLETED)
    .replace(/\{\{OPTIMAL_WINDOW\}\}/g, data.OPTIMAL_WINDOW);
}

// Jumping dots loader for Progress column while live data computes
function JumpingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1" aria-label="Calculating...">
      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms', animationDuration: '0.6s' }} />
      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.15s', animationDuration: '0.6s' }} />
      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.3s', animationDuration: '0.6s' }} />
    </span>
  );
}

export default function AIInsightsRiskPredictions({ 
  predictions, 
  isLoading, 
  isSuperAdmin, 
  canSendAlerts = false, 
  companyId = null,
  onRefresh,
  sitesForCustomer = [],
  viewSiteFilter = 'all',
  onSiteFilterChange,
  liveVehicleDataMap = null,
  isLiveDataLoading = false,
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [riskLevelFilter, setRiskLevelFilter] = useState('all');
  const [siteFilter, setSiteFilter] = useState('all');
  const [sendingRowId, setSendingRowId] = useState(null);
  const [sendingAll, setSendingAll] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [sendModalRow, setSendModalRow] = useState(null);
  const [sendModalBulk, setSendModalBulk] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState(2);

  // Handler for clicking on chart bars to filter
  const handleChartBarClick = (data) => {
    if (!data || !data.level) return;
    const levelValue = data.level.toLowerCase();
    // Toggle: if already selected, clear it; otherwise set it
    setRiskLevelFilter(prev => prev === levelValue ? 'all' : levelValue);
  };

  // Clear all filters
  const clearFilters = () => {
    setRiskLevelFilter('all');
    setSiteFilter('all');
  };

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (riskLevelFilter !== 'all') count++;
    if (siteFilter !== 'all') count++;
    return count;
  }, [riskLevelFilter, siteFilter]);

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
      if (!bySite[s]) bySite[s] = { site: s, critical: 0, high: 0, medium: 0, low: 0, total: 0 };
      const level = p.risk_level || 'low';
      if (['critical', 'high', 'medium', 'low'].includes(level)) {
        bySite[s][level]++;
        bySite[s].total++;
      }
    });
    return Object.values(bySite).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [predictions]);

  const riskChartConfig = { count: { label: 'Vehicles' }, level: { label: 'Risk Level' } };
  const siteChartConfig = {
    critical: { label: 'Critical', color: 'hsl(var(--chart-critical))' },
    high: { label: 'High', color: 'hsl(var(--chart-high))' },
    medium: { label: 'Medium', color: 'hsl(var(--chart-medium))' },
    low: { label: 'Low', color: 'hsl(var(--chart-low))' },
  };

  const openSendModal = (row, bulk = false) => {
    if (!canSendAlerts) return;
    if (bulk) {
      const withPhone = filteredPredictions.filter((p) => (p.driver_phone || '').trim());
      if (withPhone.length === 0) {
        toast.error('No phone numbers', { description: 'None of the filtered vehicles have driver phone numbers.' });
        return;
      }
      setSendModalRow({ bulk: true, rows: withPhone });
      setSendModalBulk(true);
    } else {
      const phone = (row.driver_phone || '').trim();
      if (!phone) {
        toast.error('No phone number', { description: 'This vehicle has no driver phone. Add phone in the vehicles API or run Process All Vehicles.' });
        return;
      }
      setSendModalRow({ bulk: false, row });
      setSendModalBulk(false);
    }
    setSelectedTemplateId(2);
    setSendModalOpen(true);
  };

  const getLiveData = (r) => (liveVehicleDataMap && r?.vehicle_ref ? liveVehicleDataMap.get(r.vehicle_ref) : null);

  const handleConfirmSend = async () => {
    if (!sendModalRow || !canSendAlerts) return;
    const templateId = selectedTemplateId;
    const sentBy = user?.id ?? null;
    const payload = (r) => {
      const live = getLiveData(r);
      return {
        vehicle_ref: r.vehicle_ref,
        vehicle_name: r.vehicle_name || r.vehicle_ref,
        driver_name: r.driver_name || null,
        driver_phone: (r.driver_phone || '').trim(),
        risk_level: r.risk_level || 'medium',
        site_name: r.site_name || null,
        site_ref: r.site_ref || null,
        customer_ref: r.customer_ref ?? r.customer_id ?? null,
        customer_name: r.customer_name ?? null,
        current_week_washes: live?.washes_completed ?? r.current_week_washes ?? null,
        target_washes: live?.target_washes ?? r.target_washes ?? 12,
        optimal_window: '6-8am',
      };
    };
    if (sendModalRow.bulk) {
      setSendingAll(true);
      try {
        const batchId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : null;
        const data = await callEdgeFunction('send-sms', {
          template_id: templateId,
          reminders: sendModalRow.rows.map(payload),
          company_id: companyId,
          batch_id: batchId,
          sent_by: sentBy,
        });
        const sent = data?.sent ?? 0;
        const failed = data?.failed ?? 0;
        const withoutPhone = filteredPredictions.filter((p) => !(p.driver_phone || '').trim()).length;
        if (sent > 0) {
          toast.success('SMS sent', {
            description: `Sent ${sent} reminder(s).${failed > 0 ? ` ${failed} failed.` : ''}${withoutPhone > 0 ? ` ${withoutPhone} vehicle(s) have no phone.` : ''}`,
            duration: 4000,
          });
          setSendModalOpen(false);
          setSendModalRow(null);
        } else {
          toast.error('SMS failed', { description: data?.results?.[0]?.error || data?.error || 'Could not send SMS' });
        }
        if (companyId) {
          queryClient.invalidateQueries({ queryKey: ['tenant', companyId, 'smsReminders'] });
        }
      } catch (err) {
        toast.error('SMS failed', { description: err?.message || 'Could not send SMS' });
      } finally {
        setSendingAll(false);
      }
    } else {
      const row = sendModalRow.row;
      setSendingRowId(row.id);
      try {
        const data = await callEdgeFunction('send-sms', {
          template_id: templateId,
          ...payload(row),
          company_id: companyId,
          sent_by: sentBy,
        });
        if (data?.sent >= 1) {
          toast.success('SMS sent', { description: `Reminder sent to ${maskPhone(row.driver_phone)}` });
          setSendModalOpen(false);
          setSendModalRow(null);
        } else {
          toast.error('SMS failed', { description: data?.results?.[0]?.error || data?.error || 'Could not send SMS' });
        }
        if (companyId) {
          queryClient.invalidateQueries({ queryKey: ['tenant', companyId, 'smsReminders'] });
        }
      } catch (err) {
        toast.error('SMS failed', { description: err?.message || 'Could not send SMS' });
      } finally {
        setSendingRowId(null);
      }
    }
  };

  const previewRow = sendModalRow?.bulk ? sendModalRow.rows[0] : sendModalRow?.row;
  const previewText = previewRow ? buildPreview(previewRow, selectedTemplateId, getLiveData(previewRow)) : '';

  const handleExport = () => {
    toast('Export', { description: 'Export will be available in a future update.' });
  };

  const columns = [
    { id: 'vehicle', header: 'Vehicle', accessorKey: 'vehicle_name', cell: (row) => row.vehicle_name || row.vehicle_ref || '—' },
    {
      id: 'driver',
      header: 'Driver',
      accessorKey: 'driver_name',
      cell: (row) => row.driver_name || row.vehicle_name || '—',
    },
    {
      id: 'phone',
      header: (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 cursor-help">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Phone</span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-[240px]">
              <p className="text-xs">Driver/contact phone from vehicles API. Required for SMS reminders.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ),
      cell: (row) => {
        const phone = (row.driver_phone || '').trim();
        return phone ? maskPhone(phone) : <span className="text-muted-foreground">—</span>;
      },
    },
    {
      id: 'email',
      header: (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 cursor-help">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Email</span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-[240px]">
              <p className="text-xs">Driver/contact email from vehicles API.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ),
      cell: (row) => {
        const email = (row.driver_email || '').trim();
        return email ? (
          <span className="truncate max-w-[140px] block" title={email}>{email}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
    { id: 'site', header: 'Site', accessorKey: 'site_name', cell: (row) => row.site_name || row.site_ref || '—' },
    {
      id: 'customer',
      header: 'Customer',
      accessorKey: 'customer_name',
      cell: (row) => row.customer_name || '—',
    },
    {
      id: 'rfid',
      header: 'RFID',
      accessorKey: 'vehicle_rfid',
      cell: (row) => {
        const rfid = (row.vehicle_rfid || '').trim();
        return rfid ? (
          <span className="font-mono text-xs truncate max-w-[100px] block" title={rfid}>{rfid}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
    {
      id: 'progress',
      header: 'Progress',
      cell: (row) => {
        if (isLiveDataLoading) return <JumpingDots />;
        const live = getLiveData(row);
        const current = live?.washes_completed ?? row.current_week_washes;
        const target = live?.target_washes ?? row.target_washes;
        if (current != null && target != null && target > 0) {
          const pct = Math.min(100, Math.round((current / target) * 100));
          return `${current}/${target} (${pct}%)`;
        }
        return '—';
      },
    },
    {
      id: 'risk_level',
      header: 'Risk Level',
      cell: (row) => (
        <Badge className={RISK_COLORS[row.risk_level] || RISK_COLORS.medium}>{row.risk_level}</Badge>
      ),
    },
    {
      id: 'confidence',
      header: (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 cursor-help">
                <span>Chance of Missing Target (%)</span>
                <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-[280px]">
              <p className="text-xs">
                Percentage chance this vehicle will miss its required number of washes, based on historical patterns and current progress.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ),
      cell: (row) => (row.confidence_score != null ? `${Math.round(Number(row.confidence_score))}%` : '—'),
    },
    {
      id: 'action',
      header: 'Action',
      cell: (row) => {
        const hasPhone = !!(row.driver_phone || '').trim();
        const isSending = sendingRowId === row.id;
        const btn = (
          <Button
            variant="ghost"
            size="sm"
            disabled={!canSendAlerts || !hasPhone || isSending || isLiveDataLoading}
            onClick={() => openSendModal(row, false)}
          >
            {(isSending || isLiveDataLoading) ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
            Send Message
          </Button>
        );
        if (!canSendAlerts) {
          return (
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
        }
        if (!hasPhone) {
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-block">{btn}</span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>No driver phone in vehicles API. Run Process All Vehicles to refresh.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        }
        if (isLiveDataLoading) {
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-block">{btn}</span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Calculating live wash data…</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        }
        return btn;
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Site Filter at top */}
      {sitesForCustomer.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Filter by site:</span>
          <Select value={viewSiteFilter} onValueChange={onSiteFilterChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sites</SelectItem>
              {sitesForCustomer.map((site) => (
                <SelectItem key={site.id} value={site.ref || site.id}>
                  {site.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Card className="bg-muted/40">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-2xl font-bold">{predictions?.length ?? 0}</p>
              <p className="text-sm text-primary font-semibold">Vehicles at risk</p>
            </div>
            <div>
              <p className="text-2xl font-bold">73%</p>
              <p className="text-sm text-primary font-semibold">Predicted fleet compliance</p>
            </div>
            <div className="flex gap-4">
              <div>
                <p className="text-xl font-bold">{critical}</p>
                <p className="text-xs text-primary font-semibold">Critical (24hrs)</p>
              </div>
              <div>
                <p className="text-xl font-bold">{high}</p>
                <p className="text-xs text-primary font-semibold">High (48hrs)</p>
              </div>
              <div>
                <p className="text-xl font-bold">{medium}</p>
                <p className="text-xs text-primary font-semibold">Medium (72hrs)</p>
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
                <CardTitle>Risk Level Breakdown</CardTitle>
                <CardDescription>Click on a bar to filter vehicles by risk level</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={riskChartConfig} className="aspect-auto h-[200px] w-full">
                  <BarChart 
                    data={riskLevelChartData} 
                    margin={{ left: 12, right: 12 }}
                    onClick={(data) => {
                      if (data && data.activePayload && data.activePayload[0]) {
                        handleChartBarClick(data.activePayload[0].payload);
                      }
                    }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="level" tickLine={false} axisLine={false} tickMargin={8} />
                    <ChartTooltip 
                      cursor={{ fill: 'hsl(var(--muted))', opacity: 0.2 }} 
                      content={<ChartTooltipContent hideLabel />} 
                    />
                    <Bar dataKey="count" radius={4} className="cursor-pointer">
                      {riskLevelChartData.map((entry, i) => {
                        const isSelected = riskLevelFilter === entry.level.toLowerCase();
                        return (
                          <Cell 
                            key={i} 
                            fill={entry.fill} 
                            opacity={isSelected ? 1 : (riskLevelFilter !== 'all' ? 0.3 : 0.9)}
                            className="transition-opacity hover:opacity-100"
                          />
                        );
                      })}
                    </Bar>
                  </BarChart>
                </ChartContainer>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  {riskLevelFilter !== 'all' 
                    ? `Filtered by: ${RISK_LEVEL_OPTIONS.find(o => o.value === riskLevelFilter)?.label || riskLevelFilter}` 
                    : 'Click a bar to filter by risk level'}
                </p>
              </CardContent>
            </Card>
          )}
          {riskBySiteData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>At-risk vehicles by site</CardTitle>
                <CardDescription>Sites with most at-risk vehicles, segmented by risk level</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={siteChartConfig} className="aspect-auto h-[200px] w-full">
                  <BarChart data={riskBySiteData} layout="vertical" margin={{ left: 12, right: 12 }}>
                    <CartesianGrid horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="site" type="category" width={100} tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(v) => (v && v.length > 12 ? v.slice(0, 10) + '…' : v)} />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                    <Bar dataKey="critical" stackId="site" fill="hsl(var(--chart-critical))" radius={[0, 0, 0, 0]} layout="vertical" />
                    <Bar dataKey="high" stackId="site" fill="hsl(var(--chart-high))" radius={[0, 0, 0, 0]} layout="vertical" />
                    <Bar dataKey="medium" stackId="site" fill="hsl(var(--chart-medium))" radius={[0, 0, 0, 0]} layout="vertical" />
                    <Bar dataKey="low" stackId="site" fill="hsl(var(--chart-low))" radius={[0, 4, 4, 0]} layout="vertical" />
                  </BarChart>
                </ChartContainer>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground justify-center">
                  <span><span className="inline-block w-2 h-2 rounded-full bg-[hsl(var(--chart-critical))]" /> Critical</span>
                  <span><span className="inline-block w-2 h-2 rounded-full bg-[hsl(var(--chart-high))]" /> High</span>
                  <span><span className="inline-block w-2 h-2 rounded-full bg-[hsl(var(--chart-medium))]" /> Medium</span>
                  <span><span className="inline-block w-2 h-2 rounded-full bg-[hsl(var(--chart-low))]" /> Low</span>
                </div>
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
        <div className="space-y-3">
          {/* Active Filters Badge */}
          {activeFiltersCount > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-muted-foreground">Active filters:</span>
              {riskLevelFilter !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  Risk: {RISK_LEVEL_OPTIONS.find(o => o.value === riskLevelFilter)?.label}
                  <button
                    onClick={() => setRiskLevelFilter('all')}
                    className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {siteFilter !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  Site: {siteFilter}
                  <button
                    onClick={() => setSiteFilter('all')}
                    className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="h-7 text-xs gap-1"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset filters
              </Button>
            </div>
          )}
          
          <DataTable
            columns={columns}
            data={filteredPredictions}
            getRowId={(row) => row.id}
            searchPlaceholder="Filter by vehicle, driver, site, customer..."
            title="At-Risk Vehicle Details"
            pageSize={20}
            headerExtra={
              <>
                <Select value={riskLevelFilter} onValueChange={setRiskLevelFilter}>
                  <SelectTrigger className="w-[160px] h-9">
                    <SelectValue placeholder="Filter by risk" />
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
                    <SelectValue placeholder="Filter by site" />
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
                  <Button variant="outline" size="sm" onClick={() => openSendModal(null, true)} disabled={sendingAll || isLiveDataLoading} title={isLiveDataLoading ? 'Calculating live data…' : undefined}>
                    {(sendingAll || isLiveDataLoading) ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                    Send All Messages
                  </Button>
                ) : (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-block cursor-not-allowed">
                          <Button variant="outline" size="sm" disabled>
                            <Send className="h-4 w-4 mr-1" />
                            Send All Messages
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
                {activeFiltersCount > 0 && (
                  <Button variant="outline" size="sm" onClick={clearFilters} className="gap-1">
                    <RotateCcw className="h-4 w-4" />
                    Reset
                  </Button>
                )}
                {onRefresh && (
                  <Button variant="ghost" size="sm" onClick={onRefresh}>
                    Refresh
                  </Button>
                )}
              </>
            }
          />
        </div>
      )}

      <Dialog open={sendModalOpen} onOpenChange={(open) => { setSendModalOpen(open); if (!open) setSendModalRow(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send Message</DialogTitle>
            <DialogDescription>
              {sendModalBulk
                ? `Choose a message template to send to ${sendModalRow?.rows?.length ?? 0} driver(s). Each will receive the message with their vehicle data.`
                : `Choose a message template. Preview uses ${previewRow?.vehicle_name || 'vehicle'} as example.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Template</label>
              <Select value={String(selectedTemplateId)} onValueChange={(v) => setSelectedTemplateId(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3].map((id) => (
                    <SelectItem key={id} value={String(id)}>
                      {SMS_TEMPLATES[id].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Preview</label>
              <div className="rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-wrap font-sans">
                {previewText || 'Select a template to see preview.'}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendModalOpen(false)}>Cancel</Button>
            <Button onClick={handleConfirmSend} disabled={sendingAll || sendingRowId}>
              {sendingAll || sendingRowId ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MessageSquare className="h-4 w-4 mr-2" />}
              Send Message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
