import React, { useMemo } from 'react';
import { format } from 'date-fns';
import {
  Search, Pencil, Check, Building2, CalendarClock, AlertCircle,
  CalendarCheck, Users, FileBarChart, User, Send, Clock, Mail,
  CalendarDays, MailCheck, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  getNextDue,
  getStatus,
  formatDueLabel,
  getInitials,
  REPORT_TYPE_LABELS,
  FREQUENCY_LABELS,
} from './scheduleUtils';

const MAX_VISIBLE_REPORTS = 2;

/* ---------- summary card component ---------- */
function SummaryCard({ icon: Icon, iconColor, label, value, sublabel, sublabelColor, onClick, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-xl border bg-card p-4 text-left transition-all duration-200 hover:shadow-md group relative overflow-hidden',
        active && 'ring-2 ring-primary/40 border-primary/30'
      )}
    >
      {/* decorative circle */}
      <div className={cn('absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-[0.04]', iconColor)} />
      <div className="flex items-center gap-2.5">
        <div className={cn(
          'flex h-9 w-9 items-center justify-center rounded-lg transition-transform group-hover:scale-105',
          iconColor
        )}>
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      </div>
      <p className="text-2xl font-bold mt-2 tabular-nums">{value}</p>
      {sublabel && (
        <p className={cn('text-xs mt-0.5', sublabelColor || 'text-muted-foreground')}>{sublabel}</p>
      )}
    </button>
  );
}

/* ---------- main component ---------- */
export default function ReportScheduleListView({
  schedules = [],
  companies = [],
  onEdit,
  onMarkSent,
  searchQuery = '',
  onSearchChange,
  companyFilter = 'all',
  onCompanyFilterChange,
  frequencyFilter = 'all',
  onFrequencyFilterChange,
  statusFilter = 'all',
  onStatusFilterChange,
}) {
  const filteredSchedules = useMemo(() => {
    let list = [...schedules];
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (s) =>
          (s.contactName || s.contact_name || '').toLowerCase().includes(q) ||
          (s.email || '').toLowerCase().includes(q) ||
          (s.companyName || s.company_name || '').toLowerCase().includes(q)
      );
    }
    if (companyFilter && companyFilter !== 'all') {
      list = list.filter((s) => (s.companyId || s.company_id) === companyFilter);
    }
    if (frequencyFilter && frequencyFilter !== 'all') {
      list = list.filter((s) => (s.frequency || '') === frequencyFilter);
    }
    if (statusFilter && statusFilter !== 'all') {
      list = list.filter((s) => getStatus(s) === statusFilter);
    }
    return list;
  }, [schedules, searchQuery, companyFilter, frequencyFilter, statusFilter]);

  const counts = useMemo(() => {
    const overdue = schedules.filter((s) => getStatus(s) === 'overdue').length;
    const dueToday = schedules.filter((s) => getStatus(s) === 'due_today').length;
    const dueWeek = schedules.filter((s) => getStatus(s) === 'due_this_week').length;
    const active = schedules.filter((s) => s.active !== false).length;
    const companySet = new Set(schedules.map((s) => s.companyId || s.company_id).filter(Boolean));
    return { overdue, dueToday, dueWeek, active, companiesCount: companySet.size };
  }, [schedules]);

  const companyOptions = useMemo(() => {
    const fromSchedules = [...new Set(schedules.map((s) => s.companyId || s.company_id).filter(Boolean))];
    return [
      { value: 'all', label: 'All Companies' },
      ...fromSchedules.map((id) => {
        const c = companies.find((x) => x.id === id);
        return { value: id, label: c?.name || c?.company_name || id };
      }),
    ];
  }, [schedules, companies]);

  const hasActiveFilters = companyFilter !== 'all' || frequencyFilter !== 'all' || statusFilter !== 'all' || searchQuery.trim();

  return (
    <div className="space-y-5">
      {/* summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard
          icon={AlertCircle}
          iconColor="bg-amber-500/15 text-amber-600"
          label="Overdue"
          value={counts.overdue}
          sublabel="Not yet sent"
          sublabelColor="text-amber-600"
          onClick={() => onStatusFilterChange?.(statusFilter === 'overdue' ? 'all' : 'overdue')}
          active={statusFilter === 'overdue'}
        />
        <SummaryCard
          icon={CalendarCheck}
          iconColor="bg-blue-500/15 text-blue-600"
          label="Due Today"
          value={counts.dueToday}
          sublabel="Action needed now"
          sublabelColor="text-blue-600"
          onClick={() => onStatusFilterChange?.(statusFilter === 'due_today' ? 'all' : 'due_today')}
          active={statusFilter === 'due_today'}
        />
        <SummaryCard
          icon={Clock}
          iconColor="bg-violet-500/15 text-violet-600"
          label="Due This Week"
          value={counts.dueWeek}
          sublabel="Coming up soon"
          sublabelColor="text-violet-600"
          onClick={() => onStatusFilterChange?.(statusFilter === 'due_this_week' ? 'all' : 'due_this_week')}
          active={statusFilter === 'due_this_week'}
        />
        <SummaryCard
          icon={Users}
          iconColor="bg-emerald-500/15 text-emerald-600"
          label="Schedules Active"
          value={counts.active}
          sublabel={`${counts.companiesCount} ${counts.companiesCount === 1 ? 'company' : 'companies'}`}
          sublabelColor="text-emerald-600"
        />
      </div>

      {/* filters */}
      <div className="flex flex-col sm:flex-row gap-2.5 flex-wrap items-stretch sm:items-center">
        <Select value={companyFilter} onValueChange={onCompanyFilterChange}>
          <SelectTrigger className="w-full sm:w-[180px] h-9">
            <Building2 className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0" />
            <SelectValue placeholder="All Companies" />
          </SelectTrigger>
          <SelectContent>
            {companyOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={frequencyFilter} onValueChange={onFrequencyFilterChange}>
          <SelectTrigger className="w-full sm:w-[160px] h-9">
            <CalendarClock className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0" />
            <SelectValue placeholder="All Frequencies" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Frequencies</SelectItem>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="fortnightly">Fortnightly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="quarterly">Quarterly</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="w-full sm:w-[150px] h-9">
            <CalendarCheck className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0" />
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="due_today">Due Today</SelectItem>
            <SelectItem value="due_this_week">Due This Week</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 gap-1.5 text-muted-foreground hover:text-foreground shrink-0"
            onClick={() => {
              onCompanyFilterChange?.('all');
              onFrequencyFilterChange?.('all');
              onStatusFilterChange?.('all');
              onSearchChange?.('');
            }}
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>

      {/* table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wider text-muted-foreground">Contact</th>
                <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wider text-muted-foreground">Company</th>
                <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wider text-muted-foreground">Reports</th>
                <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wider text-muted-foreground">Frequency</th>
                <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wider text-muted-foreground">Next Due</th>
                <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wider text-muted-foreground">Last Sent</th>
                <th className="w-[100px] px-4 py-3 font-medium text-xs uppercase tracking-wider text-muted-foreground text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredSchedules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                        <CalendarDays className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">No schedules found</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {hasActiveFilters
                            ? 'Try adjusting your filters or search query'
                            : 'Create your first schedule to get started'}
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredSchedules.map((s) => {
                  const status = getStatus(s);
                  const dueLabel = formatDueLabel(s);
                  const name = s.contactName || s.contact_name || '—';
                  const role = s.roleTitle || s.role_title || '';
                  const company = s.companyName || s.company_name || companies.find((c) => c.id === (s.companyId || s.company_id))?.name || '—';
                  const allReports = s.reportTypes || s.report_types || [];
                  const visibleReports = allReports.slice(0, MAX_VISIBLE_REPORTS);
                  const extraCount = allReports.length - MAX_VISIBLE_REPORTS;

                  return (
                    <tr
                      key={s.id}
                      className={cn(
                        'group transition-colors duration-150 hover:bg-muted/40',
                        status === 'overdue' && 'bg-amber-500/[0.03]'
                      )}
                    >
                      {/* Contact */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-2 ring-background shadow-sm',
                              status === 'overdue' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
                              status === 'due_today' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
                              status !== 'overdue' && status !== 'due_today' && 'bg-gradient-to-br from-muted to-muted/60 text-muted-foreground'
                            )}
                          >
                            {getInitials(name)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate leading-tight">{name}</p>
                            {role && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">{role}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      {/* Company */}
                      <td className="px-4 py-3">
                        <span className="text-muted-foreground">{company}</span>
                      </td>
                      {/* Reports */}
                      <td className="px-4 py-3 max-w-[240px]">
                        <div className="flex flex-wrap gap-1">
                          {allReports.length === 0 ? (
                            <span className="text-xs text-muted-foreground italic">None</span>
                          ) : (
                            <>
                              {visibleReports.map((r) => (
                                <span
                                  key={r}
                                  className="inline-flex items-center rounded-md border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                                >
                                  {REPORT_TYPE_LABELS[r] || r}
                                </span>
                              ))}
                              {extraCount > 0 && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="inline-flex items-center rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 text-[11px] font-semibold text-primary cursor-default">
                                        +{extraCount} more
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-[220px]">
                                      <p className="text-xs">
                                        {allReports.slice(MAX_VISIBLE_REPORTS).map((r) => REPORT_TYPE_LABELS[r] || r).join(', ')}
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                      {/* Frequency */}
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="font-normal text-xs">
                          {FREQUENCY_LABELS[s.frequency] || s.frequency}
                        </Badge>
                      </td>
                      {/* Next Due */}
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                            status === 'overdue' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                            status === 'due_today' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                            status === 'due_this_week' && 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
                            status === 'upcoming' && 'bg-muted text-muted-foreground'
                          )}
                        >
                          {status === 'overdue' && <AlertCircle className="h-3 w-3" />}
                          {status === 'due_today' && <CalendarCheck className="h-3 w-3" />}
                          {dueLabel}
                        </span>
                      </td>
                      {/* Last Sent */}
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {s.lastSent ? (
                          <span className="flex items-center gap-1.5">
                            <MailCheck className="h-3.5 w-3.5 text-green-500" />
                            {format(new Date(s.lastSent), 'd MMM yyyy')}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-0.5 opacity-70 group-hover:opacity-100 transition-opacity">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-lg"
                                  onClick={() => onEdit?.(s)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top"><p>Edit schedule</p></TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={cn(
                                    'h-8 w-8 rounded-lg',
                                    s.lastSent && 'text-green-600 hover:text-green-700'
                                  )}
                                  onClick={() => onMarkSent?.(s)}
                                >
                                  <Check className={cn(
                                    'h-3.5 w-3.5',
                                    s.lastSent ? 'text-green-600' : 'text-muted-foreground'
                                  )} />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <p>{s.lastSent ? 'Mark as not sent' : 'Mark as sent'}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
