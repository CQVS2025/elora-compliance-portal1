import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { alertsApi } from '@/api/alertsApi';
import { useAlertSocket } from '@/hooks/useAlertSocket';
import { SEVERITY_CONFIG, ALERT_TYPE_LABELS } from '@/lib/alertConstants';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Bell, Activity, AlertTriangle, Calendar, CheckCircle2,
  ClipboardList, Lock, Package, Droplets, Trash2, Loader2,
  ExternalLink, Truck, Shield, CalendarClock, Clock,
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

export default function AlertNotificationBell() {
  const { userProfile } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const isSuperAdmin = userProfile?.role === 'super_admin';

  const { data: alertsData } = useQuery({
    queryKey: ['alerts-feed'],
    queryFn: () => alertsApi.getAlerts({ limit: 100 }),
    enabled: isSuperAdmin,
    refetchInterval: 30000,
  });

  const alerts = alertsData?.data || [];
  const recentAlerts = alerts.slice(0, 50);

  // WebSocket — real-time alerts
  const handleNewAlert = useCallback((alert) => {
    queryClient.setQueryData(['alerts-feed'], (old) => {
      if (!old) return { data: [alert], count: 1 };
      const exists = old.data.some(a => a.id === alert.id);
      if (exists) return old;
      return { data: [alert, ...old.data], count: (old.count || 0) + 1 };
    });
    queryClient.invalidateQueries({ queryKey: ['alert-stats'] });
    if (!open) {
      setUnreadCount(prev => prev + 1);
    }
  }, [queryClient, open]);

  useAlertSocket({
    enabled: isSuperAdmin,
    onAlert: handleNewAlert,
  });

  const deleteMutation = useMutation({
    mutationFn: alertsApi.deleteAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts-feed'] });
      queryClient.invalidateQueries({ queryKey: ['alert-stats'] });
    },
    onError: () => toast.error('Failed to delete alert'),
  });

  if (!isSuperAdmin) return null;

  const handleOpenChange = (isOpen) => {
    setOpen(isOpen);
    if (isOpen) setUnreadCount(0);
  };

  const todayCount = alerts.filter(a => {
    const d = new Date(a.created_at);
    return d.toDateString() === new Date().toDateString();
  }).length;

  const displayCount = unreadCount > 0 ? unreadCount : todayCount;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9 shrink-0">
          <Bell className="h-4 w-4" />
          {displayCount > 0 && (
            <span className={cn(
              'absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white',
              unreadCount > 0 ? 'bg-red-500 animate-pulse' : 'bg-primary'
            )}>
              {displayCount > 99 ? '99+' : displayCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[400px] p-0" sideOffset={8}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">Alerts</h3>
            {todayCount > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {todayCount} today
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
            onClick={() => { setOpen(false); navigate('/alerts'); }}
          >
            View all
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>

        <div className="max-h-[420px] overflow-y-auto">
          {recentAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <Bell className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No alerts yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {recentAlerts.map(alert => (
                <AlertItem
                  key={alert.id}
                  alert={alert}
                  onDelete={() => deleteMutation.mutate(alert.id)}
                  isDeleting={deleteMutation.isPending && deleteMutation.variables === alert.id}
                />
              ))}
            </div>
          )}
        </div>

        {recentAlerts.length > 0 && (
          <div className="border-t px-4 py-2.5">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground hover:text-foreground"
              onClick={() => { setOpen(false); navigate('/alerts'); }}
            >
              See all {alerts.length} alerts
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function AlertItem({ alert, onDelete, isDeleting }) {
  const Icon = TYPE_ICONS[alert.type] || Bell;
  const severity = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.info;
  const timeAgo = formatDistanceToNow(new Date(alert.created_at), { addSuffix: false });

  const friendlyTitle = ALERT_TYPE_LABELS[alert.type]?.split('(')[0]?.trim()
    || alert.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  return (
    <div className={cn(
      'group flex gap-3 px-4 py-3 hover:bg-muted/40 transition-colors',
      isDeleting && 'opacity-50'
    )}>
      <div className={cn(
        'mt-0.5 p-1.5 rounded-md shrink-0',
        alert.severity === 'critical' ? 'bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400' :
        alert.severity === 'resolved' ? 'bg-green-100 text-green-600 dark:bg-green-950/40 dark:text-green-400' :
        alert.severity === 'warning' ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400' :
        'bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
      )}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-xs font-semibold truncate">{friendlyTitle}</span>
          <Badge className={cn('text-[9px] px-1 py-0 font-medium text-white shrink-0', severity.badgeBg)}>
            {severity.label.toUpperCase()}
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
          {alert.entity_name && <span className="font-medium text-foreground">{alert.entity_name}</span>}
          {alert.entity_name && ' — '}
          {alert.message}
        </p>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-[10px] text-muted-foreground">{timeAgo} ago</span>
          {alert.delivery_channels?.length > 0 && (
            <span className="text-[10px] text-muted-foreground">
              &middot; {alert.delivery_channels.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(' + ')}
            </span>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive transition-opacity',
          isDeleting ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        )}
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        disabled={isDeleting}
      >
        {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
      </Button>
    </div>
  );
}
