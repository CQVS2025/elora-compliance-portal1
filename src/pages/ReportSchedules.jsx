import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, List, CalendarDays, Loader2, FileDown, CalendarClock, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { companiesOptions, reportSchedulesOptions } from '@/query/options';
import { useCreateReportSchedule, useUpdateReportSchedule, useMarkReportScheduleSent, useDeleteReportSchedule } from '@/query/mutations/reportSchedules';
import { useAuth } from '@/lib/AuthContext';
import ReportScheduleModal from '@/components/report-schedules/ReportScheduleModal';
import ReportScheduleListView from '@/components/report-schedules/ReportScheduleListView';
import ReportScheduleCalendarView from '@/components/report-schedules/ReportScheduleCalendarView';
import ExportExcelModal from '@/components/report-schedules/ExportExcelModal';
import { toast } from '@/lib/toast';
import { format } from 'date-fns';
import { getNextDue } from '@/components/report-schedules/scheduleUtils';
import { cn } from '@/lib/utils';

/** Normalize DB row to component format (supports both snake_case and camelCase) */
function normalizeSchedule(row, companies = []) {
  const companyId = row.contact_company_id;
  const companyName = companies.find((c) => c.id === companyId)?.name ?? null;
  return {
    id: row.id,
    contactName: row.contact_name,
    contact_name: row.contact_name,
    companyId,
    company_id: companyId,
    companyName: companyName ?? row.contact_company?.name,
    company_name: companyName ?? row.contact_company?.name,
    email: row.email,
    roleTitle: row.role_title,
    role_title: row.role_title,
    reportTypes: row.report_types ?? [],
    report_types: row.report_types ?? [],
    frequency: row.frequency,
    sendDay: row.send_day,
    send_day: row.send_day,
    startingFrom: row.starting_from,
    starting_from: row.starting_from,
    lastSent: row.last_sent,
    last_sent: row.last_sent,
    active: row.active !== false,
    notes: row.notes,
  };
}

export default function ReportSchedules() {
  const { userProfile } = useAuth();
  const [view, setView] = useState('list');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportSchedule, setExportSchedule] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [frequencyFilter, setFrequencyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const companyIdForQuery = userProfile?.company_id ?? 'all';
  const { data: companiesRaw = [], isLoading: companiesLoading } = useQuery(companiesOptions(companyIdForQuery));
  const { data: schedulesRaw = [], isLoading: schedulesLoading } = useQuery(reportSchedulesOptions(companyIdForQuery));

  const companies = useMemo(() => {
    return Array.isArray(companiesRaw) ? companiesRaw : [];
  }, [companiesRaw]);

  const schedules = useMemo(() => {
    return (schedulesRaw || []).map((row) => normalizeSchedule(row, companies));
  }, [schedulesRaw, companies]);

  const createMutation = useCreateReportSchedule();
  const updateMutation = useUpdateReportSchedule();
  const markSentMutation = useMarkReportScheduleSent();
  const deleteMutation = useDeleteReportSchedule();

  const handleSaveSchedule = (payload) => {
    const companyId = userProfile?.company_id ?? companyIdForQuery;
    if (payload.id) {
      updateMutation.mutate(
        {
          id: payload.id,
          companyId,
          payload: {
            contactName: payload.contactName,
            companyId: payload.companyId,
            companyName: payload.companyName,
            email: payload.email,
            roleTitle: payload.roleTitle,
            reportTypes: payload.reportTypes,
            frequency: payload.frequency,
            sendDay: payload.sendDay,
            startingFrom: payload.startingFrom,
            notes: payload.notes,
          },
        },
        {
          onSuccess: () => {
            toast.success('Schedule updated');
            setModalOpen(false);
            setEditingSchedule(null);
          },
          onError: (err) => {
            toast.error(err?.message || 'Failed to update schedule');
          },
        }
      );
    } else {
      createMutation.mutate(
        {
          companyId,
          payload: {
            contactName: payload.contactName,
            companyId: payload.companyId,
            email: payload.email,
            roleTitle: payload.roleTitle,
            reportTypes: payload.reportTypes,
            frequency: payload.frequency,
            sendDay: payload.sendDay,
            startingFrom: payload.startingFrom,
            notes: payload.notes,
          },
        },
        {
          onSuccess: () => {
            toast.success('Schedule created');
            setModalOpen(false);
            setEditingSchedule(null);
          },
          onError: (err) => {
            toast.error(err?.message || 'Failed to create schedule');
          },
        }
      );
    }
  };

  const handleExportExcel = (schedule) => {
    setExportSchedule(schedule);
    setExportModalOpen(true);
  };

  const handleEdit = (schedule) => {
    setEditingSchedule(schedule);
    setModalOpen(true);
  };

  const handleMarkSent = (schedule) => {
    const companyId = userProfile?.company_id ?? companyIdForQuery;
    const markedAsSent = !schedule.lastSent;
    markSentMutation.mutate(
      {
        id: schedule.id,
        markedAsSent,
        companyId,
      },
      {
        onSuccess: () => {
          toast.success(markedAsSent ? 'Marked as sent' : 'Marked as not sent');
        },
        onError: (err) => {
          toast.error(err?.message || 'Failed to update');
        },
      }
    );
  };

  const handleDelete = (schedule) => {
    const companyId = userProfile?.company_id ?? companyIdForQuery;
    deleteMutation.mutate(
      {
        id: schedule.id,
        contactName: schedule.contactName || schedule.contact_name,
        companyId,
      },
      {
        onSuccess: () => {
          toast.success(`Schedule for ${schedule.contactName || schedule.contact_name} deleted`);
        },
        onError: (err) => {
          toast.error(err?.message || 'Failed to delete schedule');
        },
      }
    );
  };

  const handleExport = () => {
    const headers = ['Contact', 'Company', 'Email', 'Frequency', 'Next Due', 'Last Sent'];
    const rows = schedules.map((s) => [
      s.contactName || s.contact_name,
      s.companyName || s.company_name,
      s.email,
      s.frequency,
      format(getNextDue(s), 'd MMM yyyy'),
      s.lastSent ? format(new Date(s.lastSent), 'd MMM yyyy') : '—',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-schedules-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Export downloaded');
  };

  const isLoading = companiesLoading || schedulesLoading;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Send className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Report Schedules</h1>
            <p className="text-muted-foreground text-sm">
              Manage client report delivery - who gets what, and when
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={schedules.length === 0} className="gap-2">
            <FileDown className="h-4 w-4" />
            Export
          </Button>
          <Button size="sm" onClick={() => { setEditingSchedule(null); setModalOpen(true); }} className="gap-2 shadow-sm">
            <Plus className="h-4 w-4" />
            New Schedule
          </Button>
        </div>
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-1 rounded-lg border bg-muted/50 p-1 w-fit">
        <button
          type="button"
          onClick={() => setView('list')}
          className={cn(
            'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200',
            view === 'list'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <List className="h-4 w-4" />
          List View
          <span className={cn(
            'rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums transition-colors',
            view === 'list' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          )}>
            {schedules.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setView('calendar')}
          className={cn(
            'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200',
            view === 'calendar'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <CalendarDays className="h-4 w-4" />
          Calendar View
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
            <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Loading schedules...</p>
        </div>
      ) : (
        <>
          {view === 'list' && (
            <ReportScheduleListView
              schedules={schedules}
              companies={companies}
              onEdit={handleEdit}
              onMarkSent={handleMarkSent}
              onDelete={handleDelete}
              onExportExcel={handleExportExcel}
              isDeletingId={deleteMutation.isPending ? deleteMutation.variables?.id : null}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              companyFilter={companyFilter}
              onCompanyFilterChange={setCompanyFilter}
              frequencyFilter={frequencyFilter}
              onFrequencyFilterChange={setFrequencyFilter}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
            />
          )}

          {view === 'calendar' && (
            <ReportScheduleCalendarView
              schedules={schedules}
              companies={companies}
              onEditSchedule={handleEdit}
            />
          )}
        </>
      )}

      <ReportScheduleModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingSchedule(null); }}
        schedule={editingSchedule}
        companies={companies}
        onSave={handleSaveSchedule}
      />

      <ExportExcelModal
        open={exportModalOpen}
        onOpenChange={setExportModalOpen}
        schedule={exportSchedule}
        companies={companies}
      />
    </div>
  );
}
