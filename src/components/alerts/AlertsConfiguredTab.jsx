import React, { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { alertsApi } from '@/api/alertsApi';
import { ALERT_CATEGORIES, ALERT_TYPE_LABELS, ALERT_PRIORITY_DOTS, CATEGORY_ORDER, SEVERITY_CONFIG } from '@/lib/alertConstants';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  AlertTriangle, Shield, Activity, ClipboardList, Package,
  Truck, Droplets, CalendarClock, ChevronDown,
  Bell, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import AlertsLiveFeedSidebar from './AlertsLiveFeedSidebar';

const CATEGORY_ICONS = {
  operations: ClipboardList,
  orders: Package,
  delivery: Truck,
  devices: Activity,
  chemicals: Droplets,
  security: Shield,
  report_scheduling: CalendarClock,
};

export default function AlertsConfiguredTab({ configurations, stats, dedupedStats, isLoading, alerts }) {
  const queryClient = useQueryClient();
  const [openCategories, setOpenCategories] = useState(
    Object.fromEntries(CATEGORY_ORDER.map(c => [c, true]))
  );

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }) => alertsApi.updateConfiguration(id, updates),
    onMutate: async ({ id, updates }) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['alert-configurations'] });
      const previous = queryClient.getQueryData(['alert-configurations']);
      queryClient.setQueryData(['alert-configurations'], (old) =>
        old?.map(c => c.id === id ? { ...c, ...updates } : c) || []
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(['alert-configurations'], context?.previous);
      toast.error('Failed to update configuration');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-configurations'] });
    },
  });

  const grouped = useMemo(() => {
    const map = {};
    for (const cat of CATEGORY_ORDER) map[cat] = [];
    for (const config of configurations) {
      if (map[config.category]) {
        map[config.category].push(config);
      }
    }
    // Sort each category by alert_type so order stays consistent after toggling
    for (const cat of CATEGORY_ORDER) {
      map[cat].sort((a, b) => a.alert_type.localeCompare(b.alert_type));
    }
    return map;
  }, [configurations]);

  const toggleCategory = (cat) => {
    setOpenCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const handleToggle = (config, field, value) => {
    updateMutation.mutate({ id: config.id, updates: { [field]: value } });
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
        <div className="space-y-6">
          {/* Stats skeleton */}
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
          {/* Config skeleton */}
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Card key={i}>
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-lg" />
                    <Skeleton className="h-5 w-32" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
              </Card>
            ))}
          </div>
        </div>
        <div className="hidden xl:block space-y-2">
          <Skeleton className="h-5 w-20 mb-3" />
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const enabledCount = configurations.filter(c => c.enabled).length;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6 min-w-0">
      {/* Main content */}
      <div className="space-y-6 min-w-0 overflow-hidden">
        {/* Stats cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            label="CRITICAL ACTIVE"
            value={dedupedStats?.criticalCount ?? stats?.criticalCount ?? 0}
            description="Device offline + refill overdue"
            borderColor="border-t-red-500"
          />
          <StatsCard
            label="WARNINGS TODAY"
            value={dedupedStats?.warningsToday ?? stats?.warningsToday ?? 0}
            description={`${dedupedStats?.warningsToday ?? stats?.warningsToday ?? 0} new since this morning`}
            borderColor="border-t-amber-500"
          />
          <StatsCard
            label="ALERTS CONFIGURED"
            value={enabledCount}
            description={`All active across ${CATEGORY_ORDER.length} categories`}
            borderColor="border-t-green-500"
          />
          <StatsCard
            label="REPORTS UPCOMING"
            value={4}
            description="Due within 7 days"
            borderColor="border-t-blue-500"
          />
        </div>

        {/* Active Alert Configuration */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">Active Alert Configuration</h2>
              {updateMutation.isPending && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Saving...
                </div>
              )}
            </div>
            <span className="text-sm text-muted-foreground">{enabledCount} alerts enabled &middot; Click to expand</span>
          </div>

          <div className="space-y-3">
            {CATEGORY_ORDER.map(cat => {
              const items = grouped[cat] || [];
              if (items.length === 0) return null;
              const catConfig = ALERT_CATEGORIES[cat];
              const Icon = CATEGORY_ICONS[cat] || Bell;
              const activeCount = items.filter(i => i.enabled).length;
              const isNew = cat === 'report_scheduling';

              return (
                <Collapsible
                  key={cat}
                  open={openCategories[cat]}
                  onOpenChange={() => toggleCategory(cat)}
                >
                  <Card className="overflow-hidden">
                    <CollapsibleTrigger asChild>
                      <button className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors text-left">
                        <div className="flex items-center gap-3">
                          <div className={cn('p-2 rounded-lg', catConfig?.iconBg || 'bg-muted', catConfig?.iconText || 'text-muted-foreground')}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <span className="font-medium">{catConfig?.label || cat}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground">
                            {activeCount} active
                            {isNew && (
                              <Badge variant="default" className="ml-2 text-[10px] px-1.5 py-0 bg-green-500">NEW</Badge>
                            )}
                          </span>
                          <ChevronDown className={cn(
                            'h-4 w-4 text-muted-foreground transition-transform',
                            openCategories[cat] && 'rotate-180'
                          )} />
                        </div>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="border-t">
                        {items.map(config => (
                          <AlertConfigRow
                            key={config.id}
                            config={config}
                            onToggle={handleToggle}
                            isSaving={updateMutation.isPending && updateMutation.variables?.id === config.id}
                          />
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })}
          </div>
        </div>
      </div>

      {/* Live Feed Sidebar */}
      <AlertsLiveFeedSidebar alerts={alerts} />
    </div>
  );
}

function AlertConfigRow({ config, onToggle, isSaving }) {
  const label = ALERT_TYPE_LABELS[config.alert_type] || config.alert_type;
  const dotColor = ALERT_PRIORITY_DOTS[config.alert_type] || 'bg-gray-400';

  return (
    <div className={cn(
      'flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors border-b last:border-b-0',
      isSaving && 'opacity-60'
    )}>
      <div className="flex items-center gap-3">
        <div className={cn('w-2 h-2 rounded-full shrink-0', dotColor)} />
        <span className="text-sm">{label}</span>
        {isSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>
      <div className="flex items-center gap-2">
        {/* Channel badges — enabled */}
        {config.portal_enabled && config.enabled && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal cursor-pointer hover:bg-muted"
            onClick={() => onToggle(config, 'portal_enabled', false)}>
            Portal
          </Badge>
        )}
        {config.email_enabled && config.enabled && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal cursor-pointer hover:bg-muted"
            onClick={() => onToggle(config, 'email_enabled', false)}>
            Email
          </Badge>
        )}
        {config.sms_enabled && config.enabled && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal cursor-pointer hover:bg-muted"
            onClick={() => onToggle(config, 'sms_enabled', false)}>
            SMS
          </Badge>
        )}
        {/* Channel badges — disabled (faded) */}
        {!config.portal_enabled && config.enabled && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal opacity-30 cursor-pointer hover:opacity-60"
            onClick={() => onToggle(config, 'portal_enabled', true)}>
            Portal
          </Badge>
        )}
        {!config.email_enabled && config.enabled && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal opacity-30 cursor-pointer hover:opacity-60"
            onClick={() => onToggle(config, 'email_enabled', true)}>
            Email
          </Badge>
        )}
        {!config.sms_enabled && config.enabled && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal opacity-30 cursor-pointer hover:opacity-60"
            onClick={() => onToggle(config, 'sms_enabled', true)}>
            SMS
          </Badge>
        )}
        <Switch
          checked={config.enabled}
          onCheckedChange={(val) => onToggle(config, 'enabled', val)}
          className="ml-2"
          disabled={isSaving}
        />
      </div>
    </div>
  );
}

function StatsCard({ label, value, description, borderColor }) {
  return (
    <Card className={cn('border-t-4', borderColor)}>
      <CardContent className="p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-3xl font-bold mt-1">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}
