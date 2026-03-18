import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { SEVERITY_CONFIG, ALERT_TYPE_LABELS } from '@/lib/alertConstants';
import { cn } from '@/lib/utils';
import {
  Activity, AlertTriangle, Calendar, CheckCircle2,
  ClipboardList, Lock, Package, Droplets, Bell,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const TYPE_ICONS = {
  DEVICE_OFFLINE: Activity,
  DEVICE_BACK_ONLINE: CheckCircle2,
  DEVICE_OFFLINE_EXTENDED: Activity,
  REPORT_DUE_TODAY: Calendar,
  REPORT_DUE_IN_X_DAYS: Calendar,
  REPORT_OVERDUE: AlertTriangle,
  REPORT_SENT: CheckCircle2,
  LOW_CHEMICAL_LEVEL: Droplets,
  NEW_ENTRY_CREATED: ClipboardList,
  ENTRY_NO_ASSIGNEE: ClipboardList,
  ORDER_REQUEST_HIGH_PRIORITY: Package,
  ORDER_REQUEST_ANY: Package,
  FAILED_LOGIN_ATTEMPTS: Lock,
};

export default function AlertsLiveFeedSidebar({ alerts = [] }) {
  const recentAlerts = alerts.slice(0, 50);

  return (
    <div className="hidden xl:block">
      <div className="sticky top-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <h3 className="font-semibold text-sm">Live Feed</h3>
          <span className="text-xs text-muted-foreground ml-auto">Today</span>
        </div>

        <div className="space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
          {recentAlerts.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No alerts yet</p>
          )}
          {recentAlerts.map(alert => {
            const Icon = TYPE_ICONS[alert.type] || Bell;
            const severity = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.info;
            const timeAgo = formatDistanceToNow(new Date(alert.created_at), { addSuffix: false });

            return (
              <div key={alert.id} className="flex gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                <div className={cn(
                  'mt-0.5 p-1.5 rounded-md shrink-0',
                  alert.severity === 'critical' ? 'bg-red-100 text-red-600' :
                  alert.severity === 'resolved' ? 'bg-green-100 text-green-600' :
                  alert.severity === 'warning' ? 'bg-amber-100 text-amber-600' :
                  'bg-blue-100 text-blue-600'
                )}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs font-semibold truncate">
                      {ALERT_TYPE_LABELS[alert.type]?.split('(')[0]?.trim() || alert.type.replace(/_/g, ' ')}
                    </span>
                    <Badge className={cn('text-[9px] px-1 py-0 font-medium text-white shrink-0', severity.badgeBg)}>
                      {severity.label.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug truncate">
                    {alert.entity_name && <span className="font-medium text-foreground">{alert.entity_name}</span>}
                    {alert.entity_name && ' — '}
                    {alert.message}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[10px] text-muted-foreground">{timeAgo} ago</span>
                    {alert.delivery_channels?.length > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        &middot; {alert.delivery_channels.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(' + ')} {alert.delivery_channels.includes('portal') ? 'notification' : 'sent'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
