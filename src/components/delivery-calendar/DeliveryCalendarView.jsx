import React, { useState, useMemo } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  isSameMonth,
  isToday,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  parseISO,
  getHours,
  getMinutes,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar, User, Building2, MapPin, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const STATUS_COLORS = {
  Planned: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
  Completed: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
  'In Progress': 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
  Cancelled: 'bg-muted text-muted-foreground border-border',
};

function getStatusStyle(status) {
  if (!status) return 'bg-muted/50 text-muted-foreground border-border';
  return STATUS_COLORS[status] ?? 'bg-muted/50 text-muted-foreground border-border';
}

function getDeliveryDate(delivery) {
  const s = String(delivery.date_start || '').trim();
  if (!s) return null;
  if (s.includes('T')) return parseISO(s);
  const [datePart] = s.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getDeliveryTime(delivery) {
  const d = getDeliveryDate(delivery);
  if (!d) return { hours: 0, minutes: 0 };
  return { hours: getHours(d), minutes: getMinutes(d) };
}

function DeliveryEventCard({ delivery, compact = false, style = {}, onSelect }) {
  const handleClick = () => onSelect?.(delivery);
  const cardClass = compact
    ? cn(
        'w-full min-w-0 max-w-full rounded-md px-2 py-1.5 text-left text-xs border-l-4 mb-1 cursor-pointer transition-opacity hover:opacity-90',
        'bg-[hsl(var(--chart-1)/0.12)] text-[hsl(var(--chart-1))] border-l-[hsl(var(--chart-1))]'
      )
    : cn(
        'w-full rounded-lg px-3 py-2 text-left text-sm border-l-4 shadow-sm mb-2 cursor-pointer transition-opacity hover:opacity-90',
        'bg-[hsl(var(--chart-1)/0.12)] text-[hsl(var(--chart-1))] border-l-[hsl(var(--chart-1))]'
      );

  if (compact) {
    return (
      <button
        type="button"
        className={cardClass}
        style={style}
        onClick={handleClick}
      >
        <div className="font-medium truncate">{delivery.title || 'Delivery'}</div>
        <div className="text-[10px] opacity-70 truncate mt-0.5">
          {delivery.driver_name || 'Unassigned'}
          {delivery.site ? ` · ${delivery.site}` : ''}
        </div>
      </button>
    );
  }

  const statusStyle = getStatusStyle(delivery.status);
  return (
    <button
      type="button"
      className={cardClass}
      style={style}
      onClick={handleClick}
    >
      <div className="font-semibold truncate">{delivery.title || 'Delivery'}</div>
      <div className="text-xs text-muted-foreground mt-1">
        {delivery.customer && <span>{delivery.customer}</span>}
        {delivery.site && <span> · {delivery.site}</span>}
      </div>
      {delivery.driver_name && <div className="text-xs opacity-80 mt-0.5">Driver: {delivery.driver_name}</div>}
      {delivery.status && (
        <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 mt-1', statusStyle)}>
          {delivery.status}
        </Badge>
      )}
    </button>
  );
}

export function DeliveryCalendarView({ deliveries = [] }) {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [calendarView, setCalendarView] = useState('month');
  const [selectedDelivery, setSelectedDelivery] = useState(null);

  const entriesByDate = useMemo(() => {
    const map = {};
    deliveries.forEach((d) => {
      const date = getDeliveryDate(d);
      if (!date) return;
      const key = format(date, 'yyyy-MM-dd');
      if (!map[key]) map[key] = [];
      map[key].push(d);
    });
    return map;
  }, [deliveries]);

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const ROW_HEIGHT = 64;
  const CARD_STACK_HEIGHT_DAY = 56;
  const CARD_STACK_HEIGHT_WEEK = 40;

  /** Group deliveries by hour for stacking; returns { [hour]: deliveries[] } */
  const groupByHour = (entries) => {
    const byHour = {};
    entries.forEach((d) => {
      const t = getDeliveryTime(d);
      const h = t.hours;
      if (!byHour[h]) byHour[h] = [];
      byHour[h].push(d);
    });
    Object.keys(byHour).forEach((h) => byHour[h].sort((a, b) => {
      const ta = getDeliveryTime(a);
      const tb = getDeliveryTime(b);
      return ta.minutes - tb.minutes;
    }));
    return byHour;
  };

  const navigatePrev = () => {
    if (calendarView === 'day') setCurrentDate((d) => subDays(d, 1));
    else if (calendarView === 'week') setCurrentDate((d) => subWeeks(d, 1));
    else setCurrentDate((d) => subMonths(d, 1));
  };

  const navigateNext = () => {
    if (calendarView === 'day') setCurrentDate((d) => addDays(d, 1));
    else if (calendarView === 'week') setCurrentDate((d) => addWeeks(d, 1));
    else setCurrentDate((d) => addMonths(d, 1));
  };

  const getDateRangeLabel = () => {
    if (calendarView === 'day') return format(currentDate, 'EEEE, MMMM d, yyyy');
    if (calendarView === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
    }
    return format(currentDate, 'MMMM yyyy');
  };

  const formatDeliveryDateTime = (delivery) => {
    const d = getDeliveryDate(delivery);
    if (!d) return '—';
    const t = getDeliveryTime(delivery);
    const hasTime = t.hours !== 0 || t.minutes !== 0;
    return hasTime ? format(d, 'EEE, d MMM yyyy · h:mm a') : format(d, 'EEE, d MMM yyyy');
  };

  const renderDayView = () => {
    const dayKey = format(currentDate, 'yyyy-MM-dd');
    const dayEntries = entriesByDate[dayKey] ?? [];
    const byHour = groupByHour(dayEntries);
    const MIN_ROW_HEIGHT = 48;
    return (
      <div className="rounded-lg border overflow-hidden bg-card min-w-0 overflow-x-hidden">
        <div className="grid grid-cols-[72px_1fr] min-w-0">
          <div className="border-b h-11 bg-muted/30" />
          <div className="border-b h-11 bg-muted/20 flex items-center justify-center">
            <span className="text-sm font-medium truncate">{format(currentDate, 'EEEE')}</span>
          </div>
          {hours.map((h) => {
            const slotDeliveries = byHour[h] ?? [];
            return (
              <React.Fragment key={h}>
                <div
                  className="border-b flex items-start justify-center pt-2 text-muted-foreground font-medium bg-muted/20"
                  style={{ minHeight: MIN_ROW_HEIGHT }}
                >
                  <span className="text-xs">{format(new Date().setHours(h, 0, 0, 0), 'h a')}</span>
                </div>
                <div
                  className={cn(
                    'border-b p-2 flex flex-col gap-2 min-w-0',
                    slotDeliveries.length === 0 && 'min-h-[48px]'
                  )}
                  style={{ minHeight: MIN_ROW_HEIGHT }}
                >
                  {slotDeliveries.map((delivery) => (
                    <DeliveryEventCard key={delivery.id} delivery={delivery} onSelect={setSelectedDelivery} />
                  ))}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
    const weekDaysArr = eachDayOfInterval({ start: weekStart, end: weekEnd });
    return (
      <div className="rounded-lg border overflow-x-auto bg-card">
        <div className="min-w-[800px]">
          <div className="grid grid-cols-[60px_repeat(7,1fr)] divide-x">
            <div className="bg-muted/30 h-12 sm:h-14 border-b" />
            {weekDaysArr.map((day) => (
              <div
                key={format(day, 'yyyy-MM-dd')}
                className={cn(
                  'h-12 sm:h-14 border-b bg-muted/20 flex flex-col items-center justify-center',
                  isToday(day) && 'bg-primary/5'
                )}
              >
                <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">{format(day, 'EEE')}</span>
                <span
                  className={cn(
                    'text-sm sm:text-base font-semibold',
                    isToday(day) &&
                      'flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-primary text-primary-foreground'
                  )}
                >
                  {format(day, 'd')}
                </span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-[60px_repeat(7,1fr)] divide-x">
            <div className="bg-muted/30">
              {hours.map((h) => (
                <div key={h} className="h-16 sm:h-20 border-b flex items-start justify-center pt-1">
                  <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">
                    {format(new Date().setHours(h, 0, 0, 0), 'h a')}
                  </span>
                </div>
              ))}
            </div>
            {weekDaysArr.map((day) => {
              const dayKey = format(day, 'yyyy-MM-dd');
              const dayEntries = entriesByDate[dayKey] ?? [];
              const byHour = groupByHour(dayEntries);
              return (
                <div key={dayKey} className="relative">
                  {hours.map((h) => (
                    <div key={h} className="h-16 sm:h-20 border-b" />
                  ))}
                  <div className="absolute inset-0 p-1 overflow-y-auto">
                    {Object.entries(byHour).map(([hourStr, slotDeliveries]) => {
                      const hour = Number(hourStr);
                      const firstTime = getDeliveryTime(slotDeliveries[0]);
                      const baseTop = hour * ROW_HEIGHT + (firstTime.minutes / 60) * ROW_HEIGHT;
                      return slotDeliveries.map((delivery, idx) => (
                        <DeliveryEventCard
                          key={delivery.id}
                          delivery={delivery}
                          compact
                          onSelect={setSelectedDelivery}
                          style={{
                            position: 'absolute',
                            top: `${baseTop + idx * CARD_STACK_HEIGHT_WEEK}px`,
                            left: '2px',
                            right: '2px',
                          }}
                        />
                      ));
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    return (
      <div className="rounded-lg border overflow-hidden bg-card min-w-0 w-full">
        <div className="grid grid-cols-7 border-b bg-muted/50">
          {weekDays.map((day) => (
            <div
              key={day}
              className="p-2 text-center text-xs font-medium text-muted-foreground border-r last:border-r-0 min-w-0"
            >
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 auto-rows-fr" style={{ minHeight: 400 }}>
          {days.map((day) => {
            const key = format(day, 'yyyy-MM-dd');
            const dayEntries = entriesByDate[key] ?? [];
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isTodayDate = isToday(day);
            return (
              <div
                key={key}
                className={cn(
                  'min-h-[80px] sm:min-h-[100px] border-b border-r last:border-r-0 p-1 sm:p-2 flex flex-col min-w-0 overflow-hidden',
                  !isCurrentMonth && 'bg-muted/30'
                )}
              >
                <div className="mb-1 flex justify-center shrink-0">
                  <span
                    className={cn(
                      'text-xs sm:text-sm font-medium flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full',
                      isTodayDate && 'bg-primary text-primary-foreground'
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                </div>
                <div className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden min-h-0 min-w-0">
                  {dayEntries.slice(0, 3).map((delivery) => (
                    <DeliveryEventCard key={delivery.id} delivery={delivery} compact onSelect={setSelectedDelivery} />
                  ))}
                  {dayEntries.length > 3 && (
                    <div className="text-[10px] text-muted-foreground w-full text-center py-0.5 shrink-0">
                      +{dayEntries.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 min-w-0 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={navigatePrev}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-base sm:text-lg font-semibold min-w-[200px] sm:min-w-[280px] text-center">
            {getDateRangeLabel()}
          </span>
          <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={navigateNext}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ToggleGroup
            type="single"
            value={calendarView}
            onValueChange={(v) => v && setCalendarView(v)}
            className="border rounded-md"
          >
            <ToggleGroupItem value="day" className="px-3 py-1.5 text-xs sm:text-sm">
              Day
            </ToggleGroupItem>
            <ToggleGroupItem value="week" className="px-3 py-1.5 text-xs sm:text-sm">
              Week
            </ToggleGroupItem>
            <ToggleGroupItem value="month" className="px-3 py-1.5 text-xs sm:text-sm">
              Month
            </ToggleGroupItem>
          </ToggleGroup>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())} className="shrink-0">
            Today
          </Button>
        </div>
      </div>
      {calendarView === 'day' && renderDayView()}
      {calendarView === 'week' && renderWeekView()}
      {calendarView === 'month' && renderMonthView()}

      <Dialog open={!!selectedDelivery} onOpenChange={(open) => !open && setSelectedDelivery(null)}>
        <DialogContent className="max-w-sm sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base pr-8">
              {selectedDelivery?.title || 'Delivery details'}
            </DialogTitle>
          </DialogHeader>
          {selectedDelivery && (
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <Calendar className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                <span className="text-muted-foreground">{formatDeliveryDateTime(selectedDelivery)}</span>
              </div>
              {selectedDelivery.customer && (
                <div className="flex items-start gap-3">
                  <Building2 className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                  <span>{selectedDelivery.customer}</span>
                </div>
              )}
              {selectedDelivery.site && (
                <div className="flex items-start gap-3">
                  <MapPin className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                  <span>{selectedDelivery.site}</span>
                </div>
              )}
              {selectedDelivery.driver_name && (
                <div className="flex items-start gap-3">
                  <User className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                  <span>{selectedDelivery.driver_name}</span>
                </div>
              )}
              {selectedDelivery.status && (
                <div className="flex items-center gap-3">
                  <Tag className="size-4 text-muted-foreground shrink-0" />
                  <Badge variant="outline" className={cn('text-xs', getStatusStyle(selectedDelivery.status))}>
                    {selectedDelivery.status}
                  </Badge>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
