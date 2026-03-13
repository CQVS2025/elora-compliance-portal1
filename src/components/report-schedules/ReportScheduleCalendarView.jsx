import React, { useState, useMemo } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isToday,
} from 'date-fns';
import {
  ChevronLeft, ChevronRight, AlertTriangle, Mail, Send,
  CheckCircle2, Pencil, User, Building2, CalendarDays,
  FileText, Clock, MailCheck, MapPin,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  getDueDatesInRange,
  getNextDue,
  getInitials,
  REPORT_TYPE_LABELS,
  FREQUENCY_LABELS,
} from './scheduleUtils';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/* ---------- event card on calendar ---------- */
function ScheduleEventCard({ schedule, status, companies = [], onSelect }) {
  const name = schedule.contactName || schedule.contact_name || 'Contact';
  const company = schedule.companyName || schedule.company_name || companies.find((c) => c.id === (schedule.companyId || schedule.company_id))?.name || '';
  const shortName = name.split(/\s+/).map((w, i) => i === 0 ? w[0] + '.' : w).join(' ');
  const label = company ? `${shortName} · ${company}` : shortName;

  return (
    <button
      type="button"
      onClick={() => onSelect?.(schedule)}
      className={cn(
        'w-full text-left text-[11px] leading-tight rounded-md px-1.5 py-1 truncate flex items-center gap-1 transition-all duration-150',
        'hover:shadow-sm hover:scale-[1.02] active:scale-100',
        status === 'sent' && 'bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20',
        status === 'overdue' && 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20',
        status === 'due_today' && 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20',
        status === 'upcoming' && 'bg-muted/80 text-muted-foreground border border-transparent'
      )}
    >
      {status === 'sent' && <CheckCircle2 className="h-3 w-3 shrink-0" />}
      {status === 'overdue' && <AlertTriangle className="h-3 w-3 shrink-0" />}
      {status === 'due_today' && <Mail className="h-3 w-3 shrink-0" />}
      {status === 'upcoming' && <CalendarDays className="h-3 w-3 shrink-0" />}
      <span className="truncate">{label}</span>
    </button>
  );
}

/* ---------- legend pill ---------- */
function LegendItem({ icon: Icon, color, label }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium',
      color
    )}>
      <Icon className="h-3 w-3 shrink-0" />
      {label}
    </span>
  );
}

/* ---------- main calendar ---------- */
export default function ReportScheduleCalendarView({
  schedules = [],
  companies = [],
  onSelectSchedule,
  onEditSchedule,
}) {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [contactFilter, setContactFilter] = useState('all');

  const activeSchedules = useMemo(() => {
    let list = schedules.filter((s) => s.active !== false);
    if (contactFilter !== 'all') {
      list = list.filter((s) => s.id === contactFilter);
    }
    return list;
  }, [schedules, contactFilter]);

  const contactOptions = useMemo(() => {
    return [
      { value: 'all', label: 'All Contacts' },
      ...schedules
        .filter((s) => s.active !== false)
        .map((s) => ({
          value: s.id,
          label: s.contactName || s.contact_name || 'Contact',
        })),
    ];
  }, [schedules]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weekRows = [];
  for (let i = 0; i < days.length; i += 7) {
    weekRows.push(days.slice(i, i + 7));
  }

  const entriesByDate = useMemo(() => {
    const map = {};
    activeSchedules.forEach((s) => {
      const dueDates = getDueDatesInRange(s, calendarStart, calendarEnd);
      dueDates.forEach(({ date, status }) => {
        const key = format(date, 'yyyy-MM-dd');
        if (!map[key]) map[key] = [];
        map[key].push({ schedule: s, status });
      });
    });
    return map;
  }, [activeSchedules, calendarStart.getTime(), calendarEnd.getTime()]);

  const goToToday = () => setCurrentDate(new Date());
  const isCurrentMonth = isSameMonth(currentDate, new Date());

  return (
    <div className="space-y-4 min-w-0 overflow-x-hidden">
      {/* header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 rounded-lg" onClick={() => setCurrentDate((d) => subMonths(d, 1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-base sm:text-lg font-semibold min-w-[180px] sm:min-w-[220px] text-center">
            {format(currentDate, 'MMMM yyyy')}
          </span>
          <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 rounded-lg" onClick={() => setCurrentDate((d) => addMonths(d, 1))}>
            <ChevronRight className="size-4" />
          </Button>
          {!isCurrentMonth && (
            <Button variant="ghost" size="sm" onClick={goToToday} className="text-xs text-muted-foreground hover:text-foreground ml-1">
              Today
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={contactFilter} onValueChange={setContactFilter}>
            <SelectTrigger className="w-[180px] h-9">
              <User className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0" />
              <SelectValue placeholder="All Contacts" />
            </SelectTrigger>
            <SelectContent>
              {contactOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* legend */}
      <div className="flex flex-wrap gap-2">
        <LegendItem icon={AlertTriangle} color="border-amber-500/30 text-amber-700 bg-amber-500/5 dark:text-amber-400" label="Overdue" />
        <LegendItem icon={Mail} color="border-blue-500/30 text-blue-700 bg-blue-500/5 dark:text-blue-400" label="Due Today" />
        <LegendItem icon={CalendarDays} color="border-border text-muted-foreground bg-muted/30" label="Upcoming" />
        <LegendItem icon={CheckCircle2} color="border-green-500/30 text-green-700 bg-green-500/5 dark:text-green-400" label="Sent" />
      </div>

      {/* calendar grid */}
      <div className="rounded-xl border shadow-sm overflow-x-auto overflow-y-hidden bg-card min-w-0 w-full">
        {/* day header */}
        <div className="grid grid-cols-7 border-b bg-muted/40 min-w-[560px]">
          {DAY_LABELS.map((day) => (
            <div
              key={day}
              className="px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground border-r last:border-r-0"
            >
              {day}
            </div>
          ))}
        </div>
        {/* weeks */}
        <div className="flex flex-col min-w-[560px]">
          {weekRows.map((weekDaysInRow, rowIndex) => {
            const maxEntries = Math.max(
              1,
              ...weekDaysInRow.map((day) => (entriesByDate[format(day, 'yyyy-MM-dd')] ?? []).length)
            );
            const rowMinHeight = 36 + maxEntries * 28;
            return (
              <div
                key={rowIndex}
                className="grid grid-cols-7 border-b last:border-b-0"
                style={{ minHeight: Math.max(rowMinHeight, 90) }}
              >
                {weekDaysInRow.map((day) => {
                  const key = format(day, 'yyyy-MM-dd');
                  const dayEntries = entriesByDate[key] ?? [];
                  const inMonth = isSameMonth(day, currentDate);
                  const isTodayDate = isToday(day);
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  return (
                    <div
                      key={key}
                      className={cn(
                        'border-r last:border-r-0 p-1.5 sm:p-2 flex flex-col overflow-hidden transition-colors',
                        !inMonth && 'bg-muted/20',
                        inMonth && isWeekend && 'bg-muted/10',
                        isTodayDate && 'bg-primary/[0.04]'
                      )}
                      style={{ minHeight: Math.max(rowMinHeight, 90) }}
                    >
                      <div className="mb-1.5 flex justify-between items-center shrink-0 px-0.5">
                        <span
                          className={cn(
                            'text-xs sm:text-sm font-medium flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full transition-colors',
                            isTodayDate && 'bg-primary text-primary-foreground shadow-sm',
                            !isTodayDate && !inMonth && 'text-muted-foreground/40',
                            !isTodayDate && inMonth && 'text-foreground'
                          )}
                        >
                          {format(day, 'd')}
                        </span>
                        {dayEntries.length > 0 && (
                          <span className="text-[10px] font-medium text-muted-foreground/60 tabular-nums">
                            {dayEntries.length}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 space-y-0.5 overflow-hidden min-h-0 flex flex-col">
                        {dayEntries.map(({ schedule, status }) => (
                          <ScheduleEventCard
                            key={schedule.id}
                            schedule={schedule}
                            status={status}
                            companies={companies}
                            onSelect={(s) => setSelectedSchedule(s)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* detail dialog */}
      <Dialog open={!!selectedSchedule} onOpenChange={(o) => !o && setSelectedSchedule(null)}>
        <DialogContent className="max-w-md sm:max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 pr-8">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
                {getInitials(selectedSchedule?.contactName || selectedSchedule?.contact_name || '')}
              </div>
              <div className="min-w-0">
                <p className="text-base font-semibold truncate">
                  {selectedSchedule?.contactName || selectedSchedule?.contact_name || 'Schedule details'}
                </p>
                <p className="text-xs font-normal text-muted-foreground truncate">
                  {selectedSchedule?.roleTitle || selectedSchedule?.role_title || ''}
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>
          {selectedSchedule && (
            <div className="space-y-4 text-sm pt-1">
              {/* Info rows */}
              <div className="rounded-lg border divide-y bg-muted/20">
                <div className="flex items-center gap-3 px-4 py-3">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Company</p>
                    <p className="font-medium">{selectedSchedule.companyName || selectedSchedule.company_name || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 px-4 py-3">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="font-medium">{selectedSchedule.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 px-4 py-3">
                  <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Schedule</p>
                    <p className="font-medium">{FREQUENCY_LABELS[selectedSchedule.frequency] || selectedSchedule.frequency}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Next due</p>
                    <p className="text-xs font-medium">{format(getNextDue(selectedSchedule), 'd MMM yyyy')}</p>
                  </div>
                </div>
                {selectedSchedule.lastSent && (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <MailCheck className="h-4 w-4 text-green-500 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Last sent</p>
                      <p className="font-medium">{format(new Date(selectedSchedule.lastSent), 'd MMM yyyy')}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Reports */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  Reports included
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(selectedSchedule.reportTypes || selectedSchedule.report_types || []).length === 0 ? (
                    <span className="text-muted-foreground text-xs italic">No reports selected</span>
                  ) : (
                    (selectedSchedule.reportTypes || selectedSchedule.report_types || []).map((r) => (
                      <Badge key={r} variant="secondary" className="text-[11px] font-normal">
                        {REPORT_TYPE_LABELS[r] || r}
                      </Badge>
                    ))
                  )}
                </div>
              </div>

              {/* Notes */}
              {selectedSchedule.notes && (
                <div className="rounded-lg bg-muted/50 border border-muted p-3 text-muted-foreground text-xs leading-relaxed">
                  {selectedSchedule.notes}
                </div>
              )}

              {/* Edit button */}
              {onEditSchedule && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => {
                    onEditSchedule(selectedSchedule);
                    setSelectedSchedule(null);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit Schedule
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
