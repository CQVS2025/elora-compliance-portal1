import React, { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  MapPin,
  Calendar,
  Image,
  Building2,
  Car,
  FileText,
  Loader2,
} from 'lucide-react';
import { toastError, toastSuccess } from '@/lib/toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  customersOptions,
  sitesOptions,
  vehiclesOptions,
  operationsLogEntryOptions,
} from '@/query/options';
import { useUpdateOperationsLogStatus } from '@/query/mutations';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
];

const PRIORITY_COLORS = {
  urgent: 'destructive',
  high: 'destructive',
  medium: 'secondary',
  low: 'outline',
};

function getInitials(name) {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .map((s) => s[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function EntryDetailModal({ entryId, open, onOpenChange, effectiveCompanyId }) {
  const queryClient = useQueryClient();
  const { data: entry, isLoading } = useQuery({
    ...operationsLogEntryOptions(effectiveCompanyId, entryId),
    enabled: open && !!entryId,
  });

  const { data: companyForCustomer, isLoading: isCompanyLoading } = useQuery({
    queryKey: ['companyForEloraCustomer', entry?.customer_ref],
    queryFn: async () => {
      if (!entry?.customer_ref) return null;
      const { data } = await supabase
        .from('companies')
        .select('id')
        .eq('elora_customer_ref', entry.customer_ref)
        .maybeSingle();
      return data?.id ?? null;
    },
    enabled: open && !!entry?.customer_ref && (effectiveCompanyId === 'all' || !effectiveCompanyId),
  });

  const companyForQueries =
    effectiveCompanyId && effectiveCompanyId !== 'all'
      ? effectiveCompanyId
      : entry?.customer_ref
        ? companyForCustomer
        : effectiveCompanyId;

  const { data: customers = [], isLoading: isCustomersLoading } = useQuery({
    ...customersOptions(effectiveCompanyId),
    enabled: open && !!effectiveCompanyId,
  });

  const { data: sitesRaw = [], isLoading: isSitesLoading } = useQuery({
    ...sitesOptions(companyForQueries ?? effectiveCompanyId, {
      customerId: entry?.customer_ref || undefined,
    }),
    enabled: open && !!(companyForQueries ?? effectiveCompanyId) && !!entry?.customer_ref,
  });

  const { data: vehiclesRaw = [], isLoading: isVehiclesLoading } = useQuery({
    ...vehiclesOptions(companyForQueries ?? effectiveCompanyId, {
      customerId: entry?.customer_ref || undefined,
      siteId: entry?.site_ref || undefined,
    }),
    enabled: open && !!(companyForQueries ?? effectiveCompanyId) && !!entry?.customer_ref,
  });

  const needsCompany = open && !!entry?.customer_ref && (effectiveCompanyId === 'all' || !effectiveCompanyId);
  const needsCustomers = open && !!effectiveCompanyId && !!entry?.customer_ref;
  const needsSites = open && !!(companyForQueries ?? effectiveCompanyId) && !!entry?.customer_ref;
  const needsVehicles = needsSites && !!entry?.operations_log_vehicle_links?.length;

  const isResolvingNames =
    (needsCompany && isCompanyLoading) ||
    (needsCustomers && isCustomersLoading) ||
    (needsSites && isSitesLoading) ||
    (needsVehicles && isVehiclesLoading);

  const showLoader = isLoading || isResolvingNames;

  const customerName = useMemo(() => {
    if (!entry?.customer_ref) return null;
    const c = (customers || []).find(
      (x) => String(x.id ?? x.ref ?? '') === String(entry.customer_ref)
    );
    return c?.name ?? entry.customer_ref;
  }, [customers, entry?.customer_ref]);

  const siteName = useMemo(() => {
    if (!entry?.site_ref) return null;
    const s = (sitesRaw || []).find(
      (x) => String(x.id ?? x.ref ?? '') === String(entry.site_ref)
    );
    return s?.name ?? s?.siteName ?? entry.site_ref;
  }, [sitesRaw, entry?.site_ref]);

  const vehicleIdToName = useMemo(() => {
    const map = {};
    (vehiclesRaw || []).forEach((v) => {
      const id = String(v.vehicleRef ?? v.ref ?? v.id ?? '');
      if (id) map[id] = v.vehicleName ?? v.name ?? v.vehicleRef ?? v.ref ?? id;
    });
    return map;
  }, [vehiclesRaw]);

  const updateStatus = useUpdateOperationsLogStatus();

  const handleStatusChange = (newStatus) => {
    if (!entryId || newStatus === entry?.status) return;
    updateStatus.mutate(
      { entryId, status: newStatus },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['tenant'], exact: false });
          toastSuccess('update', 'status');
        },
        onError: (err) => {
          toastError(err, 'updating status');
        },
      }
    );
  };

  const getSignedUrl = async (path) => {
    const { data } = await supabase.storage.from('operations-log').createSignedUrl(path, 3600);
    return data?.signedUrl;
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-2xl max-h-[90vh] sm:max-h-[85vh] overflow-y-auto overflow-x-hidden p-0 gap-0 rounded-lg sm:rounded-lg">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b bg-muted/30">
          <DialogTitle className="text-lg sm:text-xl truncate pr-8">Entry details</DialogTitle>
        </DialogHeader>

        {showLoader ? (
          <div className="flex items-center justify-center min-h-[240px] px-4 sm:px-6 py-8">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="size-10 animate-spin" aria-hidden />
              <span className="text-sm">
                {isLoading ? 'Loading entry…' : 'Loading details…'}
              </span>
            </div>
          </div>
        ) : !entry ? (
          <div className="px-4 sm:px-6 py-12 text-center text-muted-foreground">
            Entry not found.
          </div>
        ) : (
          <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-5 sm:space-y-6 overflow-x-hidden">
            {/* Status & priority row */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={entry.status === 'resolved' ? 'default' : 'secondary'}
                className="font-medium"
              >
                {STATUS_OPTIONS.find((s) => s.value === entry.status)?.label ?? entry.status}
              </Badge>
              <Badge variant={PRIORITY_COLORS[entry.priority] ?? 'outline'} className="uppercase">
                {entry.priority}
              </Badge>
              {entry.category?.name && (
                <Badge variant="outline" className="font-normal">
                  {entry.category.name}
                </Badge>
              )}
            </div>

            {/* Title & brief */}
            <div>
              <h2 className="text-lg font-semibold tracking-tight">{entry.title}</h2>
              {entry.brief && (
                <p className="text-sm text-muted-foreground mt-1">{entry.brief}</p>
              )}
            </div>

            {/* Customer, Site, Vehicles - prominent block */}
            <div className="rounded-lg border bg-card p-3 sm:p-4 space-y-3 min-w-0">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Location & vehicles
              </h3>
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                <div className="flex items-start gap-3">
                  <div className="rounded-md bg-muted p-2">
                    <Building2 className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Customer</p>
                    <p className="font-medium truncate">{customerName ?? entry.customer_ref ?? '—'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="rounded-md bg-muted p-2">
                    <MapPin className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Site</p>
                    <p className="font-medium truncate">{siteName ?? entry.site_ref ?? '—'}</p>
                  </div>
                </div>
              </div>
              {entry.operations_log_vehicle_links?.length > 0 && (
                <div className="flex items-start gap-3 pt-1">
                  <div className="rounded-md bg-muted p-2 shrink-0">
                    <Car className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">
                      Linked vehicles
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {entry.operations_log_vehicle_links.map((l) => {
                        const name = vehicleIdToName[l.vehicle_id] ?? l.vehicle_id;
                        return (
                          <Badge
                            key={l.id ?? l.vehicle_id}
                            variant="secondary"
                            className="font-normal"
                          >
                            {name}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Assigned, dates, product */}
            <div className="grid gap-3 sm:grid-cols-2">
              {entry.assigned_to && (
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <Avatar className="size-9">
                    <AvatarFallback className="text-sm bg-primary/10 text-primary">
                      {getInitials(entry.assigned_to)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Assigned to</p>
                    <p className="font-medium truncate">{entry.assigned_to}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <Calendar className="size-5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="font-medium">
                    {format(new Date(entry.created_at), 'd MMM yyyy')}
                    {entry.due_date && (
                      <span className="text-muted-foreground font-normal ml-1">
                        · Due {format(new Date(entry.due_date), 'd MMM yyyy')}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="rounded-lg border p-4">
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                <FileText className="size-4 text-muted-foreground" />
                Description
              </h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {entry.description || '—'}
              </p>
            </div>

            {/* Attachments */}
            {entry.operations_log_attachments?.length > 0 && (
              <div className="rounded-lg border p-4">
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <Image className="size-4 text-muted-foreground" />
                  Attachments
                </h3>
                <ul className="space-y-2">
                  {entry.operations_log_attachments.map((att) => (
                    <li key={att.id}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start font-normal h-auto py-2"
                        onClick={async () => {
                          const url = await getSignedUrl(att.storage_path);
                          if (url) window.open(url, '_blank');
                        }}
                      >
                        <Image className="size-4 text-muted-foreground shrink-0 mr-2" />
                        <span className="truncate">{att.file_name}</span>
                        {att.file_size != null && (
                          <span className="text-xs text-muted-foreground ml-auto shrink-0">
                            {(att.file_size / 1024).toFixed(1)} KB
                          </span>
                        )}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Separator />

            {/* Status update */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-4">
              <div className="flex flex-col gap-1.5 min-w-0">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                  Update status
                  {updateStatus.isPending && (
                    <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden />
                  )}
                </p>
                <Select
                  value={entry.status}
                  onValueChange={handleStatusChange}
                  disabled={updateStatus.isPending}
                >
                  <SelectTrigger className={cn('w-full sm:w-[180px] min-w-0', updateStatus.isPending && 'opacity-70')}>
                    <span className="flex items-center gap-2">
                      <SelectValue />
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {entry.status === 'resolved' && entry.resolved_at && (
                <p className="text-sm text-muted-foreground">
                  Resolved {format(new Date(entry.resolved_at), 'd MMM yyyy')}
                </p>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Created {format(new Date(entry.created_at), 'PPpp')}
              {entry.updated_at &&
                entry.updated_at !== entry.created_at &&
                ` · Updated ${format(new Date(entry.updated_at), 'PPpp')}`}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
