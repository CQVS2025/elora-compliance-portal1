import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek } from 'date-fns';
import { CalendarDays, Loader2, RefreshCw, List, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/AuthContext';
import { usePermissions } from '@/components/auth/PermissionGuard';
import { callEdgeFunction } from '@/lib/supabase';
import { deliveryDriversOptions, deliveryDeliveriesOptions } from '@/query/options';
import { queryKeys } from '@/query/keys';
import { DeliveryCalendarView } from '@/components/delivery-calendar/DeliveryCalendarView';
import { cn } from '@/lib/utils';

const VIEWS = [
  { value: 'calendar', label: 'Calendar', icon: CalendarDays },
  { value: 'today', label: 'Today', icon: List },
  { value: 'week', label: 'This Week', icon: LayoutGrid },
];

function slugify(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

export default function DeliveryCalendar() {
  const { userProfile } = useAuth();
  const permissions = usePermissions();
  const queryClient = useQueryClient();
  const [driverSlug, setDriverSlug] = useState(null);
  const [view, setView] = useState('calendar');

  const isAdmin = permissions.isAdmin || permissions.isSuperAdmin;

  const { data: drivers = [], isLoading: driversLoading } = useQuery(deliveryDriversOptions());

  const todayStart = useMemo(() => startOfDay(new Date()).toISOString(), []);
  const todayEnd = useMemo(() => endOfDay(new Date()).toISOString(), []);
  const weekStart = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString(), []);
  const weekEnd = useMemo(() => endOfWeek(new Date(), { weekStartsOn: 1 }).toISOString(), []);

  const { data: deliveriesToday = [], isLoading: todayLoading } = useQuery(
    deliveryDeliveriesOptions({ from: todayStart, to: todayEnd, driverSlug })
  );
  const { data: deliveriesWeek = [], isLoading: weekLoading } = useQuery(
    deliveryDeliveriesOptions({ from: weekStart, to: weekEnd, driverSlug })
  );

  const calendarFrom = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    d.setDate(1);
    return startOfDay(d).toISOString();
  }, []);
  const calendarTo = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 2);
    d.setDate(0);
    return endOfDay(d).toISOString();
  }, []);

  const { data: deliveriesCalendar = [], isLoading: calendarLoading } = useQuery(
    deliveryDeliveriesOptions({ from: calendarFrom, to: calendarTo, driverSlug })
  );

  const syncMutation = useMutation({
    mutationFn: async () => {
      return await callEdgeFunction('sync-notion-deliveries', { full: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.global.deliveryDrivers() });
      queryClient.invalidateQueries({ queryKey: ['deliveryDeliveries'] });
    },
  });

  const driverTabs = useMemo(() => {
    const list = [{ value: 'all', label: 'All' }];
    drivers.forEach((d) => list.push({ value: d.slug, label: d.name }));
    return list;
  }, [drivers]);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Delivery Calendar</h1>
          <p className="text-muted-foreground text-sm mt-1">
            View deliveries from Notion. Filter by driver to see individual calendars.
          </p>
        </div>
        {isAdmin && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            {syncMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Sync from Notion
          </Button>
        )}
      </div>

      <Tabs value={driverSlug ?? 'all'} onValueChange={(v) => setDriverSlug(v === 'all' ? null : v)}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          {driverTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="text-sm">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-4 flex flex-wrap gap-2">
          {VIEWS.map((v) => (
            <Button
              key={v.value}
              variant={view === v.value ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setView(v.value)}
            >
              <v.icon className="mr-2 h-4 w-4" />
              {v.label}
            </Button>
          ))}
        </div>

        {driversLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {!driversLoading && (
          <>
            {view === 'calendar' && (
              <div className="mt-4">
                {calendarLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <DeliveryCalendarView deliveries={deliveriesCalendar} />
                )}
              </div>
            )}

            {view === 'today' && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-base">Today&apos;s deliveries</CardTitle>
                </CardHeader>
                <CardContent>
                  {todayLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : deliveriesToday.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No deliveries for today.</p>
                  ) : (
                    <ul className="space-y-2">
                      {deliveriesToday.map((d) => (
                        <li
                          key={d.id}
                          className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm"
                        >
                          <span className="font-medium">{d.title || 'Delivery'}</span>
                          {d.customer && (
                            <span className="text-muted-foreground">{d.customer}</span>
                          )}
                          {d.site && (
                            <Badge variant="outline" className="text-xs">
                              {d.site}
                            </Badge>
                          )}
                          {d.driver_name && (
                            <Badge variant="secondary" className="text-xs">
                              {d.driver_name}
                            </Badge>
                          )}
                          {d.status && (
                            <Badge variant="outline" className="text-xs">
                              {d.status}
                            </Badge>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )}

            {view === 'week' && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-base">This week</CardTitle>
                </CardHeader>
                <CardContent>
                  {weekLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : deliveriesWeek.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No deliveries this week.</p>
                  ) : (
                    <ul className="space-y-2">
                      {deliveriesWeek.map((d) => (
                        <li
                          key={d.id}
                          className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm"
                        >
                          <span className="text-muted-foreground shrink-0">
                            {format(new Date(d.date_start), 'EEE d MMM')}
                          </span>
                          <span className="font-medium">{d.title || 'Delivery'}</span>
                          {d.customer && (
                            <span className="text-muted-foreground">{d.customer}</span>
                          )}
                          {d.site && (
                            <Badge variant="outline" className="text-xs">
                              {d.site}
                            </Badge>
                          )}
                          {d.driver_name && (
                            <Badge variant="secondary" className="text-xs">
                              {d.driver_name}
                            </Badge>
                          )}
                          {d.status && (
                            <Badge variant="outline" className="text-xs">
                              {d.status}
                            </Badge>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </Tabs>
    </div>
  );
}
