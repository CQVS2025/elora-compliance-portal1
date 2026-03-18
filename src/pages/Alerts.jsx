import React, { useState, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { alertsApi } from '@/api/alertsApi';
import { useAlertSocket } from '@/hooks/useAlertSocket';
import { toast } from 'sonner';
import AlertsConfiguredTab from '@/components/alerts/AlertsConfiguredTab';
import AlertsLiveFeedTab from '@/components/alerts/AlertsLiveFeedTab';
import AlertsDeliverySettingsTab from '@/components/alerts/AlertsDeliverySettingsTab';
import { Bell, Play, Settings, Wifi, WifiOff, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export default function Alerts() {
  const { userProfile } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('configured');
  const isSuperAdmin = userProfile?.role === 'super_admin';

  // ── Queries ──────────────────────────────────────────────────
  const { data: configurations = [], isLoading: configLoading, isFetching: configFetching } = useQuery({
    queryKey: ['alert-configurations'],
    queryFn: alertsApi.getConfigurations,
    enabled: isSuperAdmin,
  });

  const { data: alertsData, isLoading: alertsLoading, isFetching: alertsFetching, refetch: refetchAlerts } = useQuery({
    queryKey: ['alerts-feed'],
    queryFn: () => alertsApi.getAlerts(),
    enabled: isSuperAdmin,
    refetchInterval: 30000,
  });

  const { data: stats, isLoading: statsLoading, isFetching: statsFetching } = useQuery({
    queryKey: ['alert-stats'],
    queryFn: alertsApi.getAlertStats,
    enabled: isSuperAdmin,
    refetchInterval: 30000,
  });

  const alerts = alertsData?.data || [];

  // ── WebSocket ────────────────────────────────────────────────
  const handleNewAlert = useCallback((alert) => {
    queryClient.setQueryData(['alerts-feed'], (old) => {
      if (!old) return { data: [alert], count: 1 };
      // Deduplicate — don't add if this alert ID already exists in cache
      const exists = old.data.some(a => a.id === alert.id);
      if (exists) return old;
      return { data: [alert, ...old.data], count: (old.count || 0) + 1 };
    });
    queryClient.invalidateQueries({ queryKey: ['alert-stats'] });
    toast.info(`New alert: ${alert.message}`, {
      description: alert.entity_name || alert.type,
    });
  }, [queryClient]);

  const { connected } = useAlertSocket({
    enabled: isSuperAdmin,
    onAlert: handleNewAlert,
  });

  // ── Test Alert ───────────────────────────────────────────────
  const testAlertMutation = useMutation({
    mutationFn: alertsApi.sendTestAlert,
    onSuccess: (result) => {
      if (result?.fallback) {
        refetchAlerts();
        queryClient.invalidateQueries({ queryKey: ['alert-stats'] });
      }

      const notifications = result?.notifications;
      if (notifications) {
        const allResults = [...(notifications.email || []), ...(notifications.sms || [])];
        const errors = allResults.filter(r => !r.success);
        const successes = allResults.filter(r => r.success);

        if (errors.length > 0) {
          errors.forEach(err => {
            toast.error(`Notification failed${err.to ? ` (${err.to})` : ''}`, {
              description: err.error,
              duration: 8000,
            });
          });
        }
        if (successes.length > 0) {
          toast.success(`Test alert sent — ${successes.length} notification${successes.length > 1 ? 's' : ''} delivered`);
        } else if (errors.length === 0) {
          toast.success('Test alert created (portal only)');
        }
      } else {
        toast.success('Test alert sent successfully');
      }
    },
    onError: (err) => toast.error('Failed to send test alert', {
      description: err?.message || 'Could not reach the alerts server',
    }),
  });

  // ── Refresh all data ─────────────────────────────────────────
  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['alert-configurations'] }),
      queryClient.invalidateQueries({ queryKey: ['alerts-feed'] }),
      queryClient.invalidateQueries({ queryKey: ['alert-stats'] }),
    ]);
    setTimeout(() => setIsRefreshing(false), 600);
  };

  // ── Access Guard ─────────────────────────────────────────────
  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Bell className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-1">Access Restricted</h2>
          <p className="text-sm text-muted-foreground">Alerts configuration is only accessible by Super Admin users.</p>
        </div>
      </div>
    );
  }

  // ── Full page initial load ───────────────────────────────────
  if (configLoading && alertsLoading && statsLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-16 rounded-full" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-28" />
          </div>
        </div>
        {/* Tabs skeleton */}
        <div className="border-b pb-0">
          <div className="flex gap-6 pb-3">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-32" />
          </div>
        </div>
        {/* Stats skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="border rounded-lg p-4 border-t-4 border-t-muted space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-12" />
              <Skeleton className="h-3 w-36" />
            </div>
          ))}
        </div>
        {/* Config list skeleton */}
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <Skeleton className="h-5 w-32" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
              {i === 0 && (
                <div className="border-t pt-3 space-y-2">
                  {[...Array(3)].map((_, j) => (
                    <div key={j} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-2 w-2 rounded-full" />
                        <Skeleton className="h-4 w-48" />
                      </div>
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-5 w-12" />
                        <Skeleton className="h-5 w-12" />
                        <Skeleton className="h-5 w-10 rounded-full" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const enabledCount = configurations.filter(c => c.enabled).length;
  // Use DB-backed count for accurate "today" number
  const liveFeedCount = stats?.todayCount ?? alerts.filter(a => {
    const d = new Date(a.created_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;

  const tabs = [
    { id: 'configured', label: 'Configured', count: enabledCount },
    { id: 'live-feed', label: 'Live Feed', count: liveFeedCount },
    { id: 'delivery-settings', label: 'Delivery Settings' },
  ];

  const isAnyFetching = configFetching || alertsFetching || statsFetching;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alerts</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Configure and monitor your real-time notification triggers</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Connection status */}
          <div className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
            connected ? 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400' : 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400'
          )}>
            {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {connected ? 'Live' : 'Disconnected'}
          </div>

          {/* Background fetch indicator */}
          {isAnyFetching && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-muted text-muted-foreground text-xs">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Syncing</span>
            </div>
          )}

          {/* Refresh */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => testAlertMutation.mutate()}
            disabled={testAlertMutation.isPending}
            className="gap-1.5"
          >
            {testAlertMutation.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                Test Alert
              </>
            )}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => setActiveTab('delivery-settings')}
            className="gap-1.5"
          >
            <Settings className="h-3.5 w-3.5" />
            Alert Settings
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-6" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'pb-3 text-sm font-medium transition-colors relative',
                activeTab === tab.id
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <span className="flex items-center gap-1.5">
                {tab.label}
                {tab.count != null && (
                  <Badge
                    variant="secondary"
                    className={cn(
                      'text-[10px] px-1.5 py-0 min-w-[20px] justify-center',
                      activeTab === tab.id && 'bg-primary/10 text-primary'
                    )}
                  >
                    {tab.count}
                  </Badge>
                )}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'configured' && (
        <AlertsConfiguredTab
          configurations={configurations}
          stats={stats}
          isLoading={configLoading || statsLoading}
          alerts={alerts}
        />
      )}
      {activeTab === 'live-feed' && (
        <AlertsLiveFeedTab
          alerts={alerts}
          stats={stats}
          isLoading={alertsLoading}
        />
      )}
      {activeTab === 'delivery-settings' && (
        <AlertsDeliverySettingsTab />
      )}
    </div>
  );
}
