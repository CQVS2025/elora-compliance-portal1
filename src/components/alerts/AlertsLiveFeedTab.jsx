import React, { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { alertsApi } from '@/api/alertsApi';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import { SEVERITY_CONFIG, ALERT_TYPE_LABELS, ALERT_CATEGORIES } from '@/lib/alertConstants';
import { formatEntityName, formatAlertMessage } from '@/lib/alertFormatters';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Activity, AlertTriangle, Calendar, CheckCircle2,
  ClipboardList, Lock, Package, Droplets, Bell, Trash2,
  Clock, TrendingUp, Loader2, ChevronLeft, ChevronRight,
  Truck, Shield, CalendarClock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const TYPE_ICONS = {
  // Operations
  NEW_ENTRY_CREATED: ClipboardList,
  ENTRY_OPEN_5_DAYS: Clock,
  ENTRY_RESOLVED: CheckCircle2,
  ENTRY_NO_ASSIGNEE: ClipboardList,
  ENTRY_NO_DUE_DATE: ClipboardList,
  // Orders
  ORDER_REQUEST_HIGH_PRIORITY: Package,
  ORDER_REQUEST_ANY: Package,
  ORDER_PENDING_APPROVAL: Package,
  ORDER_STATUS_CHANGED: Package,
  STOCK_TAKE_SUBMITTED: Package,
  AGENT_PARTS_NO_REQUEST: Package,
  // Delivery
  DELIVERY_SCHEDULED_TODAY: Truck,
  SITE_NO_DELIVERY: Truck,
  SITE_APPROACHING_REFILL: Truck,
  SITE_OVERDUE_REFILL: Truck,
  UNUSUAL_CONSUMPTION: AlertTriangle,
  // Devices
  DEVICE_OFFLINE: Activity,
  DEVICE_BACK_ONLINE: CheckCircle2,
  DEVICE_OFFLINE_EXTENDED: Activity,
  // Chemicals
  LOW_CHEMICAL_LEVEL: Droplets,
  // Security
  FAILED_LOGIN_ATTEMPTS: Lock,
  NEW_USER_FIRST_LOGIN: Shield,
  MANAGER_NOT_LOGGED_IN_7_DAYS: Shield,
  ENTRY_ASSIGNED_INACTIVE_USER: Shield,
  // Report Scheduling
  REPORT_DUE_TODAY: Calendar,
  REPORT_DUE_IN_X_DAYS: Calendar,
  REPORT_OVERDUE: AlertTriangle,
  REPORT_SENT: CheckCircle2,
  NEW_REPORT_SCHEDULE: CalendarClock,
  REPORT_SCHEDULE_MODIFIED: CalendarClock,
  CONTACT_ADDED_TO_SCHEDULE: CalendarClock,
  CONTACT_REMOVED_FROM_SCHEDULE: CalendarClock,
  COMPANY_NO_REPORT_SCHEDULE: CalendarClock,
  SCHEDULE_NO_REPORTS: CalendarClock,
  WEEKLY_REPORT_DIGEST: CalendarClock,
};

const ITEMS_PER_PAGE = 15;

// Device alert types
const DEVICE_ALERT_TYPES = new Set(['DEVICE_OFFLINE', 'DEVICE_BACK_ONLINE', 'DEVICE_OFFLINE_EXTENDED']);

// Site/delivery alert types that can be enriched with customer info
const SITE_ALERT_TYPES = new Set([
  'SITE_NO_DELIVERY', 'SITE_APPROACHING_REFILL', 'SITE_OVERDUE_REFILL',
  'DELIVERY_SCHEDULED_TODAY', 'UNUSUAL_CONSUMPTION', 'LOW_CHEMICAL_LEVEL',
]);

export default function AlertsLiveFeedTab({ alerts = [], stats, isLoading, devices = [] }) {
  const queryClient = useQueryClient();
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [deleteMode, setDeleteMode] = useState('all'); // 'all' | 'range'
  const [deleteFrom, setDeleteFrom] = useState('');
  const [deleteTo, setDeleteTo] = useState('');

  // Build device lookup: match by computerName, computerSerialId, or deviceRef
  const deviceLookup = useMemo(() => {
    const map = {};
    for (const d of devices) {
      if (d.computerName) map[d.computerName.toLowerCase()] = d;
      if (d.computerSerialId) map[d.computerSerialId.toLowerCase()] = d;
      if (d.deviceRef) map[d.deviceRef.toLowerCase()] = d;
    }
    return map;
  }, [devices]);

  // Build site name → customer name lookup from devices (devices have both siteName and customerName)
  const siteToCustomer = useMemo(() => {
    const map = {};
    for (const d of devices) {
      if (d.siteName && d.customerName) {
        map[d.siteName.toLowerCase()] = d.customerName;
      }
    }
    return map;
  }, [devices]);

  // Find the matching device for a device alert
  const findDeviceForAlert = (alert) => {
    const raw = (alert.entity_name || '').trim();
    if (!raw) return null;
    const tokens = raw.split(/[\s\-—()]+/).filter(Boolean);
    for (const token of [raw, ...tokens]) {
      const key = token.toLowerCase();
      if (deviceLookup[key]) return deviceLookup[key];
    }
    if (alert.entity_id) {
      const key = String(alert.entity_id).toLowerCase();
      if (deviceLookup[key]) return deviceLookup[key];
    }
    return null;
  };

  // Find customer name for a site-based alert
  const findCustomerForSiteAlert = (alert) => {
    const raw = (alert.entity_name || '').trim().toLowerCase();
    if (!raw) return null;
    return siteToCustomer[raw] || null;
  };

  // Deduplicate ALL alerts: keep only the latest per (type + entity_name) combo.
  // Also enrich device & site alerts with customer/site context.
  const enrichedAlerts = useMemo(() => {
    const seen = new Map(); // "type|entity_key" → true
    const result = [];

    for (const alert of alerts) {
      // Deduplication key: type + normalised entity_name (alerts are sorted newest first)
      const entityKey = (alert.entity_name || alert.entity_id || alert.id || '').toLowerCase().trim();
      const dedupKey = `${alert.type}|${entityKey}`;

      if (seen.has(dedupKey)) continue;
      seen.set(dedupKey, true);

      const enriched = { ...alert };

      // Enrich device alerts
      if (DEVICE_ALERT_TYPES.has(alert.type)) {
        const device = findDeviceForAlert(alert);
        enriched._device = device;
        if (device) {
          const parts = [device.customerName, device.siteName].filter(Boolean);
          enriched._deviceLabel = device.computerName || device.deviceRef || alert.entity_name;
          enriched._customerSite = parts.length > 0 ? parts.join(' - ') : null;
        }
      }

      // Enrich site/delivery alerts with customer name
      if (SITE_ALERT_TYPES.has(alert.type)) {
        const customer = findCustomerForSiteAlert(alert);
        if (customer) {
          enriched._customerName = customer;
        }
      }

      result.push(enriched);
    }
    return result;
  }, [alerts, deviceLookup, siteToCustomer]);

  const deleteMutation = useMutation({
    mutationFn: alertsApi.deleteAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts-feed'] });
      queryClient.invalidateQueries({ queryKey: ['alert-stats'] });
      toast.success('Alert deleted');
    },
    onError: () => toast.error('Failed to delete alert'),
  });

  const deleteAllMutation = useMutation({
    mutationFn: alertsApi.deleteAllAlerts,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts-feed'] });
      queryClient.invalidateQueries({ queryKey: ['alert-stats'] });
      setCurrentPage(1);
      toast.success('All alerts deleted');
    },
    onError: () => toast.error('Failed to delete alerts'),
  });

  const filteredAlerts = useMemo(() => {
    if (categoryFilter === 'all') return enrichedAlerts;
    return enrichedAlerts.filter(a => a.category === categoryFilter);
  }, [enrichedAlerts, categoryFilter]);

  // Reset to page 1 when filter changes
  const handleCategoryChange = (val) => {
    setCategoryFilter(val);
    setCurrentPage(1);
  };

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredAlerts.length / ITEMS_PER_PAGE));
  const paginatedAlerts = filteredAlerts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Group paginated alerts by date
  const grouped = useMemo(() => {
    const groups = {};
    for (const alert of paginatedAlerts) {
      const d = new Date(alert.created_at);
      let label;
      if (isToday(d)) label = 'Today';
      else if (isYesterday(d)) label = 'Yesterday';
      else label = format(d, 'EEEE, d MMM');
      if (!groups[label]) groups[label] = [];
      groups[label].push(alert);
    }
    return groups;
  }, [paginatedAlerts]);

  // Stats based on deduplicated alerts (enrichedAlerts) so counts match what the user sees
  const todayCount = enrichedAlerts.filter(a => isToday(new Date(a.created_at))).length;
  const criticalToday = enrichedAlerts.filter(a => a.severity === 'critical' && a.status === 'active').length;
  const resolvedCount = enrichedAlerts.filter(a => a.status === 'resolved').length;
  const weekAlerts = enrichedAlerts.length;
  const totalForRate = todayCount + weekAlerts;
  const resolutionRate = totalForRate > 0 ? Math.round((resolvedCount / totalForRate) * 100) : 0;

  // Compute average response time from resolved alerts (time between created_at and resolved_at)
  const avgResponseTime = useMemo(() => {
    const resolvedAlerts = enrichedAlerts.filter(a => a.status === 'resolved' && a.resolved_at);
    if (resolvedAlerts.length === 0) return null;
    const totalMs = resolvedAlerts.reduce((sum, a) => {
      return sum + (new Date(a.resolved_at) - new Date(a.created_at));
    }, 0);
    const avgMs = totalMs / resolvedAlerts.length;
    const avgMins = Math.round(avgMs / (60 * 1000));
    if (avgMins < 60) return `${avgMins}m`;
    const hours = Math.floor(avgMins / 60);
    const mins = avgMins % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }, [enrichedAlerts]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="border-t-4 border-t-muted">
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-12" />
                <Skeleton className="h-3 w-36" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="flex items-start gap-4 p-4">
                <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-full max-w-md" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          label="TODAY'S ALERTS"
          value={todayCount}
          description="need attention"
          borderColor="border-t-red-500"
          criticalCount={criticalToday}
        />
        <StatsCard
          label="THIS WEEK"
          value={weekAlerts}
          description="Across all categories"
          borderColor="border-t-amber-500"
        />
        <StatsCard
          label="RESOLVED"
          value={resolvedCount}
          description={`${resolutionRate}% resolution rate`}
          borderColor="border-t-green-500"
        />
        <StatsCard
          label="AVG RESPONSE"
          value={avgResponseTime || '-'}
          description={avgResponseTime ? 'Time to resolve' : 'No resolved alerts yet'}
          borderColor="border-t-blue-500"
        />
      </div>

      {/* Filter & Alerts List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">All Alerts - {Object.keys(grouped)[0] || 'Today'}</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {filteredAlerts.length} alert{filteredAlerts.length !== 1 ? 's' : ''}
            </span>
            {enrichedAlerts.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                onClick={() => setShowDeleteAllDialog(true)}
                disabled={deleteAllMutation.isPending}
              >
                {deleteAllMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                {deleteAllMutation.isPending ? 'Deleting...' : 'Delete All'}
              </Button>
            )}
            <Select value={categoryFilter} onValueChange={handleCategoryChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {Object.entries(ALERT_CATEGORIES).map(([key, cat]) => (
                  <SelectItem key={key} value={key}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {filteredAlerts.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Bell className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">No alerts to show</p>
            </CardContent>
          </Card>
        )}

        <div className="space-y-6">
          {Object.entries(grouped).map(([dateLabel, dateAlerts]) => (
            <div key={dateLabel}>
              {Object.keys(grouped).length > 1 && (
                <h3 className="text-sm font-medium text-muted-foreground mb-3">{dateLabel}</h3>
              )}
              <div className="space-y-2">
                {dateAlerts.map(alert => (
                  <AlertRow
                    key={alert.id}
                    alert={alert}
                    onDelete={() => deleteMutation.mutate(alert.id)}
                    isDeleting={deleteMutation.isPending && deleteMutation.variables === alert.id}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-6 border-t mt-6">
            <p className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredAlerts.length)} of {filteredAlerts.length}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {generatePageNumbers(currentPage, totalPages).map((page, i) => (
                page === '...' ? (
                  <span key={`ellipsis-${i}`} className="px-1 text-xs text-muted-foreground">...</span>
                ) : (
                  <Button
                    key={page}
                    variant={currentPage === page ? 'default' : 'outline'}
                    size="icon"
                    className="h-8 w-8 text-xs"
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </Button>
                )
              ))}
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteAllDialog} onOpenChange={(open) => {
        setShowDeleteAllDialog(open);
        if (!open) { setDeleteMode('all'); setDeleteFrom(''); setDeleteTo(''); }
      }}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Alerts</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>Choose how to delete alerts from the live feed. This action cannot be undone.</p>

                {/* Mode selector */}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={deleteMode === 'all' ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1"
                    onClick={() => setDeleteMode('all')}
                  >
                    Delete All ({enrichedAlerts.length})
                  </Button>
                  <Button
                    type="button"
                    variant={deleteMode === 'range' ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1"
                    onClick={() => setDeleteMode('range')}
                  >
                    Date Range
                  </Button>
                </div>

                {/* Date range inputs */}
                {deleteMode === 'range' && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">From</label>
                      <input
                        type="date"
                        value={deleteFrom}
                        onChange={(e) => setDeleteFrom(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </div>
                    <span className="text-sm text-muted-foreground mt-5">to</span>
                    <div className="flex-1 space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">To</label>
                      <input
                        type="date"
                        value={deleteTo}
                        onChange={(e) => setDeleteTo(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </div>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMode === 'range' && (!deleteFrom || !deleteTo)}
              onClick={() => {
                if (deleteMode === 'range') {
                  deleteAllMutation.mutate({ from: deleteFrom, to: deleteTo });
                } else {
                  deleteAllMutation.mutate({});
                }
              }}
            >
              {deleteMode === 'range' ? 'Delete Range' : 'Delete All'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function generatePageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [];
  pages.push(1);
  if (current > 3) pages.push('...');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}

function AlertRow({ alert, onDelete, isDeleting }) {
  const Icon = TYPE_ICONS[alert.type] || Bell;
  const severity = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.info;
  const d = new Date(alert.created_at);
  const timeStr = isToday(d)
    ? formatDistanceToNow(d, { addSuffix: false }) + ' ago'
    : isYesterday(d)
    ? 'Yesterday ' + format(d, 'h:mm a')
    : format(d, 'EEE d MMM, h:mm a');

  const friendlyTitle = ALERT_TYPE_LABELS[alert.type]?.split('(')[0]?.trim()
    || alert.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  const channelStr = alert.delivery_channels?.length > 0
    ? alert.delivery_channels.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(' + ') + ' sent'
    : null;

  const isDevice = DEVICE_ALERT_TYPES.has(alert.type);
  const isSiteAlert = SITE_ALERT_TYPES.has(alert.type);
  const entityDisplay = isDevice ? (alert._deviceLabel || formatEntityName(alert)) : formatEntityName(alert);
  const messageDisplay = formatAlertMessage(alert);
  // Context line: customer - site for devices, or customer name for site alerts
  const contextLine = isDevice
    ? alert._customerSite
    : isSiteAlert && alert._customerName
      ? alert._customerName
      : null;
  const deviceApp = isDevice && alert._device?.application ? alert._device.application : null;

  return (
    <Card className={cn('group hover:shadow-md transition-all', isDeleting && 'opacity-50 scale-[0.99]')}>
      <CardContent className="flex items-start gap-4 p-4">
        <div className={cn(
          'mt-0.5 p-2 rounded-lg shrink-0',
          alert.severity === 'critical' ? 'bg-red-100 text-red-600' :
          alert.severity === 'resolved' ? 'bg-green-100 text-green-600' :
          alert.severity === 'warning' ? 'bg-amber-100 text-amber-600' :
          alert.severity === 'upcoming' ? 'bg-purple-100 text-purple-600' :
          alert.severity === 'security' ? 'bg-yellow-100 text-yellow-700' :
          'bg-blue-100 text-blue-600'
        )}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-semibold text-sm">{friendlyTitle}</span>
            <Badge className={cn('text-[10px] px-1.5 py-0 font-medium text-white', severity.badgeBg)}>
              {severity.label.toUpperCase()}
            </Badge>
            {deviceApp && (
              <span className="text-[10px] px-1.5 py-0 rounded bg-muted text-muted-foreground font-medium">{deviceApp}</span>
            )}
          </div>
          {contextLine && (
            <p className="text-xs text-muted-foreground mb-0.5">{contextLine}</p>
          )}
          <p className="text-sm text-muted-foreground leading-relaxed">
            {entityDisplay && <span className="font-medium text-foreground">{entityDisplay}</span>}
            {entityDisplay && ' - '}
            {messageDisplay}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-xs text-muted-foreground">{timeStr}</span>
            {channelStr && (
              <span className="text-xs text-muted-foreground">&middot; {channelStr}</span>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'transition-opacity h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive',
            isDeleting ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          )}
          onClick={onDelete}
          disabled={isDeleting}
        >
          {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </Button>
      </CardContent>
    </Card>
  );
}

function StatsCard({ label, value, description, borderColor, criticalCount }) {
  return (
    <Card className={cn('border-t-4', borderColor)}>
      <CardContent className="p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-3xl font-bold mt-1">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {criticalCount > 0 && <span className="text-red-600 font-medium">{criticalCount} critical</span>}
          {criticalCount > 0 && ' '}
          {description}
        </p>
      </CardContent>
    </Card>
  );
}
