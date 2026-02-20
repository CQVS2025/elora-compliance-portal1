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
  isSameDay,
  isToday,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  parseISO,
  getHours,
  getMinutes,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

const STATUS_LABELS = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved' };
const STATUS_COLORS = {
  open: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20',
  in_progress: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
  resolved: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
};

const PRIORITY_COLORS = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-500',
};

/* Theme-aware category colors (light/dark) using CSS variables */
const CATEGORY_STYLE_BY_INDEX = [
  'bg-[hsl(var(--chart-1)/0.15)] text-[hsl(var(--chart-1))] border-l-[hsl(var(--chart-1))]',
  'bg-[hsl(var(--chart-2)/0.15)] text-[hsl(var(--chart-2))] border-l-[hsl(var(--chart-2))]',
  'bg-[hsl(var(--chart-3)/0.15)] text-[hsl(var(--chart-3))] border-l-[hsl(var(--chart-3))]',
  'bg-[hsl(var(--chart-4)/0.15)] text-[hsl(var(--chart-4))] border-l-[hsl(var(--chart-4))]',
  'bg-[hsl(var(--chart-5)/0.15)] text-[hsl(var(--chart-5))] border-l-[hsl(var(--chart-5))]',
  'bg-[hsl(var(--primary)/0.15)] text-[hsl(var(--primary))] border-l-[hsl(var(--primary))]',
];

function getCategoryStyle(categoryName) {
  if (!categoryName) return 'bg-muted/50 text-muted-foreground border-l-border';
  const index = [...String(categoryName)].reduce((acc, c) => acc + c.charCodeAt(0), 0) % CATEGORY_STYLE_BY_INDEX.length;
  return CATEGORY_STYLE_BY_INDEX[index];
}

/** Parse as local date so calendar keys match the intended day in all timezones. */
function getEntryDate(entry) {
  if (entry.due_date) {
    const s = String(entry.due_date).trim();
    if (/^\d{4}-\d{2}-\d{2}(T|$)/.test(s)) {
      const [datePart] = s.split('T');
      const [y, m, d] = datePart.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date(entry.due_date);
  }
  return new Date(entry.created_at);
}

function getEntryTime(entry) {
  const date = getEntryDate(entry);
  return { hours: getHours(date), minutes: getMinutes(date) };
}

function EventCard({ entry, onSelect, compact = false, style = {} }) {
  const categoryStyle = getCategoryStyle(entry.category?.name);
  const statusColor = STATUS_COLORS[entry.status] ?? 'bg-muted text-muted-foreground border-border';
  const priorityColor = PRIORITY_COLORS[entry.priority] ?? 'bg-gray-500';

  if (compact) {
    return (
      <button
        type="button"
        className={cn(
          'w-full min-w-0 max-w-full rounded-md px-2 py-1.5 text-left text-xs border-l-4 transition-all hover:shadow-sm hover:scale-[1.02] overflow-hidden',
          categoryStyle,
          'mb-1'
        )}
        onClick={() => onSelect?.(entry.id)}
        title={entry.title}
        style={style}
      >
        <div className="flex items-start gap-1.5 min-w-0">
          <div className={cn('h-2 w-2 rounded-full shrink-0 mt-0.5', priorityColor)} />
          <div className="flex-1 min-w-0 overflow-hidden">
            <div className="font-medium truncate">{entry.title}</div>
            <div className="text-[10px] opacity-70 truncate mt-0.5">
              {entry.assigned_to ? `${entry.assigned_to}` : 'Unassigned'}
            </div>
          </div>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        'w-full rounded-lg px-3 py-2 text-left text-sm border-l-4 shadow-sm transition-all hover:shadow-md hover:scale-[1.01]',
        categoryStyle,
        'mb-2'
      )}
      onClick={() => onSelect?.(entry.id)}
      style={style}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5">
          <div className={cn('h-2.5 w-2.5 rounded-full shrink-0', priorityColor)} />
          <span className="font-semibold truncate">{entry.title}</span>
        </div>
        <Clock className="size-3 text-muted-foreground shrink-0" />
      </div>
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">
          {entry.category?.name && (
            <span className="font-medium">{entry.category.name}</span>
          )}
        </div>
        {entry.assigned_to && (
          <div className="text-xs opacity-80">
            Assigned: {entry.assigned_to}
          </div>
        )}
        <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 mt-1', statusColor)}>
          {STATUS_LABELS[entry.status] ?? entry.status}
        </Badge>
      </div>
    </button>
  );
}

export function OperationsLogCalendarView({
  entries,
  onSelectEntry,
  page = 1,
  total = 0,
  onPageChange,
  pageSize = 20,
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [calendarView, setCalendarView] = useState('month');

  const entriesByDate = useMemo(() => {
    const map = {};
    entries.forEach((e) => {
      const d = getEntryDate(e);
      const key = format(d, 'yyyy-MM-dd');
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return map;
  }, [entries]);

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const hours = Array.from({ length: 24 }, (_, i) => i);

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

  const renderDayView = () => {
    const dayKey = format(currentDate, 'yyyy-MM-dd');
    const dayEntries = entriesByDate[dayKey] ?? [];

    return (
      <div className="rounded-lg border overflow-hidden bg-card min-w-0 overflow-x-hidden">
        <div className="grid grid-cols-[60px_1fr] sm:grid-cols-[80px_1fr] divide-x min-w-0">
          <div className="bg-muted/30 shrink-0">
            <div className="h-12 sm:h-14 border-b" />
            {hours.map((hour) => (
              <div key={hour} className="h-16 sm:h-20 border-b flex items-start justify-center pt-1">
                <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">
                  {format(new Date().setHours(hour, 0, 0, 0), 'h a')}
                </span>
              </div>
            ))}
          </div>
          <div className="relative min-w-0">
            <div className="h-12 sm:h-14 border-b bg-muted/20 flex items-center justify-center">
              <span className="text-xs sm:text-sm font-medium truncate">{format(currentDate, 'EEEE')}</span>
            </div>
            <div className="relative" style={{ minHeight: hours.length * 64 }}>
              {hours.map((hour) => (
                <div key={hour} className="h-16 sm:h-20 border-b" />
              ))}
              <div className="absolute inset-0 p-1 sm:p-2 overflow-y-auto overflow-x-hidden">
                {dayEntries.map((entry) => {
                  const time = getEntryTime(entry);
                  const top = (time.hours * 64) + (time.minutes / 60 * 64);
                  return (
                    <EventCard
                      key={entry.id}
                      entry={entry}
                      onSelect={onSelectEntry}
                      style={{ position: 'absolute', top: `${top}px`, left: '4px', right: '4px', maxWidth: '100%' }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
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
                <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">
                  {format(day, 'EEE')}
                </span>
                <span
                  className={cn(
                    'text-sm sm:text-base font-semibold',
                    isToday(day) && 'flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-primary text-primary-foreground'
                  )}
                >
                  {format(day, 'd')}
                </span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-[60px_repeat(7,1fr)] divide-x">
            <div className="bg-muted/30">
              {hours.map((hour) => (
                <div key={hour} className="h-16 sm:h-20 border-b flex items-start justify-center pt-1">
                  <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">
                    {format(new Date().setHours(hour, 0, 0, 0), 'h a')}
                  </span>
                </div>
              ))}
            </div>
            {weekDaysArr.map((day) => {
              const dayKey = format(day, 'yyyy-MM-dd');
              const dayEntries = entriesByDate[dayKey] ?? [];
              return (
                <div key={dayKey} className="relative">
                  {hours.map((hour) => (
                    <div key={hour} className="h-16 sm:h-20 border-b" />
                  ))}
                  <div className="absolute inset-0 p-1 overflow-y-auto">
                    {dayEntries.map((entry) => {
                      const time = getEntryTime(entry);
                      const top = (time.hours * 64) + (time.minutes / 60 * 64);
                      return (
                        <EventCard
                          key={entry.id}
                          entry={entry}
                          onSelect={onSelectEntry}
                          compact
                          style={{ position: 'absolute', top: `${top}px`, left: '2px', right: '2px' }}
                        />
                      );
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
            <div key={day} className="p-2 text-center text-xs font-medium text-muted-foreground border-r last:border-r-0 min-w-0">
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
                  {dayEntries.slice(0, 3).map((entry) => (
                    <EventCard key={entry.id} entry={entry} onSelect={onSelectEntry} compact />
                  ))}
                  {dayEntries.length > 3 && (
                    <button
                      type="button"
                      className="text-[10px] text-muted-foreground hover:text-foreground w-full text-center py-0.5 shrink-0"
                      onClick={() => onSelectEntry?.(dayEntries[3].id)}
                    >
                      +{dayEntries.length - 3} more
                    </button>
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
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={navigatePrev}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-base sm:text-lg font-semibold min-w-[200px] sm:min-w-[280px] text-center">
            {getDateRangeLabel()}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={navigateNext}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ToggleGroup type="single" value={calendarView} onValueChange={(v) => v && setCalendarView(v)} className="border rounded-md">
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentDate(new Date())}
            className="shrink-0"
          >
            Today
          </Button>
        </div>
      </div>

      {calendarView === 'day' && renderDayView()}
      {calendarView === 'week' && renderWeekView()}
      {calendarView === 'month' && renderMonthView()}
      {totalPages > 1 && onPageChange && (
        <div className="flex items-center justify-end gap-2 pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
