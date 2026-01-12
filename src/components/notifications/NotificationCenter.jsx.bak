import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from "@/api/base44Client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Bell, 
  AlertTriangle, 
  Wrench, 
  TrendingDown, 
  Truck, 
  CheckCircle,
  X,
  Settings
} from 'lucide-react';
import moment from 'moment';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const NOTIFICATION_ICONS = {
  maintenance_due: Wrench,
  maintenance_overdue: AlertTriangle,
  low_compliance: TrendingDown,
  vehicle_assigned: Truck,
  issue_reported: AlertTriangle,
  issue_resolved: CheckCircle,
  system: Bell
};

const SEVERITY_COLORS = {
  info: 'bg-blue-500',
  warning: 'bg-orange-500',
  critical: 'bg-red-500'
};

export default function NotificationCenter() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const user = await base44.auth.me();
      const allNotifications = await base44.entities.Notification.filter(
        { user_email: user.email },
        '-created_date',
        50
      );
      return allNotifications;
    },
    refetchInterval: 30000 // Refetch every 30 seconds
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId) => {
      await base44.entities.Notification.update(notificationId, { read: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['notifications']);
    }
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
      await Promise.all(unreadIds.map(id => 
        base44.entities.Notification.update(id, { read: true })
      ));
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['notifications']);
    }
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId) => {
      await base44.entities.Notification.delete(notificationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['notifications']);
    }
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleNotificationClick = (notification) => {
    if (!notification.read) {
      markAsReadMutation.mutate(notification.id);
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 p-0">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-slate-800">Notifications</h3>
          <div className="flex items-center gap-2">
            <Link to={createPageUrl('NotificationSettings')}>
              <Button variant="ghost" size="sm">
                <Settings className="w-4 h-4" />
              </Button>
            </Link>
            {unreadCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => markAllAsReadMutation.mutate()}
              >
                Mark all read
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="p-8 text-center text-slate-500">
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.map((notification) => {
                const Icon = NOTIFICATION_ICONS[notification.type] || Bell;
                const severityColorBg = SEVERITY_COLORS[notification.severity] || SEVERITY_COLORS.info;
                const severityColorText = severityColorBg.replace('bg-', 'text-');

                return (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer ${
                      !notification.read ? 'bg-blue-50/50' : ''
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full ${severityColorBg}/10 flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-5 h-5 ${severityColorText}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className={`font-semibold text-sm ${!notification.read ? 'text-slate-900' : 'text-slate-700'}`}>
                            {notification.title}
                          </p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotificationMutation.mutate(notification.id);
                            }}
                            className="text-slate-400 hover:text-slate-600 flex-shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-sm text-slate-600 mb-2">{notification.message}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">
                            {moment(notification.created_date).fromNow()}
                          </span>
                          {!notification.read && (
                            <Badge className="bg-blue-500 text-white text-xs">New</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}