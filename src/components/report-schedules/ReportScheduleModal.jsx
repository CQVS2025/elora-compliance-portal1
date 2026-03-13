import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, User, Building2, Mail, Briefcase, FileBarChart, Clock, CalendarDays, StickyNote } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

const REPORT_TYPES = [
  { id: 'compliance_rate', label: 'Compliance Rate' },
  { id: 'total_washes', label: 'Total Washes' },
  { id: 'per_vehicle_breakdown', label: 'Per Vehicle Breakdown' },
  { id: 'compliant_vs_non_compliant', label: 'Compliant vs Non-Compliant' },
  { id: 'last_scan_date', label: 'Last Scan Date' },
  { id: 'total_program_cost', label: 'Total Program Cost' },
  { id: 'avg_cost_per_truck', label: 'Avg Cost per Truck' },
  { id: 'avg_cost_per_wash', label: 'Avg Cost per Wash' },
  { id: 'site_summary', label: 'Site Summary' },
];

const FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
];

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

function SectionHeading({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-2 pt-2 pb-1">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</span>
      <div className="flex-1 h-px bg-border ml-1" />
    </div>
  );
}

export default function ReportScheduleModal({ open, onClose, schedule, companies = [], onSave }) {
  const [formData, setFormData] = useState({
    contactName: '',
    companyId: '',
    email: '',
    roleTitle: '',
    reportTypes: [],
    frequency: 'weekly',
    sendDay: 5,
    startingFrom: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
  });

  useEffect(() => {
    if (open) {
      if (schedule) {
        setFormData({
          contactName: schedule.contactName ?? schedule.contact_name ?? '',
          companyId: schedule.companyId ?? schedule.company_id ?? '',
          email: schedule.email ?? '',
          roleTitle: schedule.roleTitle ?? schedule.role_title ?? '',
          reportTypes: schedule.reportTypes ?? schedule.report_types ?? [],
          frequency: schedule.frequency ?? 'weekly',
          sendDay: schedule.sendDay ?? schedule.send_day ?? 5,
          startingFrom: schedule.startingFrom ?? schedule.starting_from ?? format(new Date(), 'yyyy-MM-dd'),
          notes: schedule.notes ?? '',
        });
      } else {
        setFormData({
          contactName: '',
          companyId: '',
          email: '',
          roleTitle: '',
          reportTypes: [],
          frequency: 'weekly',
          sendDay: 5,
          startingFrom: format(new Date(), 'yyyy-MM-dd'),
          notes: '',
        });
      }
    }
  }, [open, schedule]);

  const toggleReportType = (id) => {
    setFormData((prev) => ({
      ...prev,
      reportTypes: prev.reportTypes.includes(id)
        ? prev.reportTypes.filter((r) => r !== id)
        : [...prev.reportTypes, id],
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      contactName: formData.contactName.trim(),
      companyId: formData.companyId || null,
      companyName: companies.find((c) => c.id === formData.companyId)?.name ?? '',
      email: formData.email.trim(),
      roleTitle: formData.roleTitle.trim(),
      reportTypes: formData.reportTypes,
      frequency: formData.frequency,
      sendDay: formData.sendDay,
      startingFrom: formData.startingFrom,
      notes: formData.notes.trim() || null,
      ...(schedule?.id && { id: schedule.id }),
    };
    onSave?.(payload);
  };

  const isValid = formData.contactName.trim() && formData.email.trim();
  const selectedCount = formData.reportTypes.length;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0">
        {/* colored header */}
        <div className="px-6 pt-6 pb-4 border-b bg-muted/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm',
                schedule ? 'bg-blue-500/15 text-blue-600' : 'bg-primary/15 text-primary'
              )}>
                {schedule ? <CalendarDays className="h-5 w-5" /> : <User className="h-5 w-5" />}
              </div>
              <div>
                <p className="text-lg font-semibold">{schedule ? 'Edit Report Schedule' : 'New Report Schedule'}</p>
                <p className="text-xs font-normal text-muted-foreground">
                  {schedule ? 'Update delivery schedule details' : 'Set up a new report delivery contact'}
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 pt-4 space-y-5">
          {/* Contact section */}
          <SectionHeading icon={User}>Contact Details</SectionHeading>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="contactName" className="text-xs font-medium">Contact Name</Label>
              <Input
                id="contactName"
                placeholder="e.g. Rebekah Sharp"
                value={formData.contactName}
                onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                className="h-9"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="company" className="text-xs font-medium">Company</Label>
                <Select value={formData.companyId} onValueChange={(v) => setFormData({ ...formData, companyId: v })}>
                  <SelectTrigger id="company" className="h-9">
                    <SelectValue placeholder="Select company..." />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name || c.company_name || '—'}
                      </SelectItem>
                    ))}
                    {companies.length === 0 && (
                      <div className="py-4 text-center text-sm text-muted-foreground">No companies available</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="roleTitle" className="text-xs font-medium">Role / Title</Label>
                <Input
                  id="roleTitle"
                  placeholder="e.g. Compliance Manager"
                  value={formData.roleTitle}
                  onChange={(e) => setFormData({ ...formData, roleTitle: e.target.value })}
                  className="h-9"
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="email" className="text-xs font-medium">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="e.g. rebekah.sharp@holcim.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="h-9"
              />
            </div>
          </div>

          {/* Reports section */}
          <SectionHeading icon={FileBarChart}>Reports to Include</SectionHeading>
          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {REPORT_TYPES.map((r) => {
                const checked = formData.reportTypes.includes(r.id);
                return (
                  <label
                    key={r.id}
                    className={cn(
                      'flex items-center gap-2.5 cursor-pointer rounded-md px-2 py-1.5 text-sm transition-colors',
                      checked ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleReportType(r.id)}
                    />
                    <span className={cn('text-[13px]', checked && 'font-medium')}>{r.label}</span>
                  </label>
                );
              })}
            </div>
            {selectedCount > 0 && (
              <p className="text-[11px] text-muted-foreground mt-2 pt-2 border-t">
                {selectedCount} report{selectedCount !== 1 ? 's' : ''} selected
              </p>
            )}
          </div>

          {/* Schedule section */}
          <SectionHeading icon={Clock}>Delivery Schedule</SectionHeading>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium">Frequency</Label>
                <Select value={formData.frequency} onValueChange={(v) => setFormData({ ...formData, frequency: v })}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {(formData.frequency === 'weekly' || formData.frequency === 'fortnightly') && (
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium">Send Day</Label>
                  <Select
                    value={String(formData.sendDay)}
                    onValueChange={(v) => setFormData({ ...formData, sendDay: Number(v) })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS_OF_WEEK.map((d) => (
                        <SelectItem key={d.value} value={String(d.value)}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {(formData.frequency === 'monthly' || formData.frequency === 'quarterly') && (
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium">Day of Month</Label>
                  <Select
                    value={String(Math.min(formData.sendDay || 1, 28))}
                    onValueChange={(v) => setFormData({ ...formData, sendDay: Number(v) })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                        <SelectItem key={d} value={String(d)}>
                          {d === 1 ? '1st' : d === 2 ? '2nd' : d === 3 ? '3rd' : `${d}th`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium">Starting From</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal h-9',
                      !formData.startingFrom && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                    {formData.startingFrom
                      ? format(new Date(formData.startingFrom + 'T12:00:00'), 'dd/MM/yyyy')
                      : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="z-[200] w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.startingFrom ? new Date(formData.startingFrom + 'T12:00:00') : undefined}
                    onSelect={(d) => setFormData({ ...formData, startingFrom: d ? format(d, 'yyyy-MM-dd') : '' })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Notes */}
          <div className="grid gap-1.5">
            <Label htmlFor="notes" className="text-xs font-medium flex items-center gap-1.5">
              <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
              Notes
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="notes"
              placeholder="Any specific notes for this contact's reports..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Footer */}
          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid} className="gap-2 shadow-sm">
              {schedule ? 'Update Schedule' : 'Create Schedule'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
