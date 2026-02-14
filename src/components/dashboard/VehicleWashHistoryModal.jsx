import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Droplets } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { scansOptions } from '@/query/options';
import moment from 'moment';

/**
 * Modal showing wash history (scan events) for a single vehicle.
 * Uses Scans API with current Compliance filters (customer, site, date range).
 */
export default function VehicleWashHistoryModal({
  vehicle,
  dateRange,
  selectedCustomer,
  selectedSite,
  companyId,
  open,
  onClose,
}) {
  const {
    data: scans = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    ...scansOptions(companyId, {
      vehicleId: vehicle?.id ?? vehicle?.rfid,
      fromDate: dateRange?.start,
      toDate: dateRange?.end,
      customerId: selectedCustomer && selectedCustomer !== 'all' ? selectedCustomer : undefined,
      siteId: selectedSite && selectedSite !== 'all' ? selectedSite : undefined,
      status: 'success,exceeded',
    }),
    enabled: !!companyId && !!vehicle && !!dateRange?.start && !!dateRange?.end && open,
  });

  const list = Array.isArray(scans) ? scans : (scans?.data ?? []);
  const sortedScans = [...list].sort((a, b) => {
    const ta = new Date(a.createdAt ?? a.timestamp ?? a.scanDate ?? 0).getTime();
    const tb = new Date(b.createdAt ?? b.timestamp ?? b.scanDate ?? 0).getTime();
    return tb - ta;
  });

  if (!vehicle) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose?.()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Droplets className="w-5 h-5 text-primary" />
            </div>
            <div>
              <span className="text-lg font-semibold">Wash history</span>
              <p className="text-sm font-medium text-muted-foreground">
                {vehicle.name ?? '—'} {vehicle.rfid && <span className="font-mono">({vehicle.rfid})</span>}
              </p>
            </div>
          </DialogTitle>
          <DialogDescription>
            {dateRange?.start && dateRange?.end && (
              <span>
                {moment(dateRange.start).format('DD MMM YYYY')} – {moment(dateRange.end).format('DD MMM YYYY')}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* ScanCard Program Parameters (from CMS) */}
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">ScanCard Program Parameters</p>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Wash Time</span>
              <p className="font-medium">
                {vehicle.washTime1Seconds != null ? `${vehicle.washTime1Seconds} Secs` : (vehicle.washTime != null ? `${vehicle.washTime} Secs` : '—')}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Washes per week</span>
              <p className="font-medium">{vehicle.washesPerWeek ?? '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Protocol (monthly target)</span>
              <p className="font-medium">{vehicle.protocolNumber ?? '—'}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto border rounded-md -mx-1 px-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : isError ? (
            <p className="text-sm text-destructive py-4">{error?.message ?? 'Failed to load wash history.'}</p>
          ) : sortedScans.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No washes in this period.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Date</TableHead>
                  <TableHead className="w-[80px]">Time</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Wash time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedScans.map((scan, idx) => {
                  const dt = scan.createdAt ?? scan.timestamp ?? scan.scanDate;
                  const m = dt ? moment(dt) : null;
                  const status = scan.statusLabel ?? scan.status ?? '—';
                  const duration = scan.washDurationSeconds ?? scan.durationSeconds ?? scan.washTime;
                  return (
                    <TableRow key={scan.scanRef ?? scan.internalScanId ?? idx}>
                      <TableCell className="text-muted-foreground text-sm">
                        {m ? m.format('DD/MM/YYYY') : '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {m ? m.format('HH:mm') : '—'}
                      </TableCell>
                      <TableCell className="text-sm">{scan.siteName ?? '—'}</TableCell>
                      <TableCell className="text-sm">{status}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {duration != null ? (duration >= 60 ? `${Math.round(duration / 60)}m` : `${duration} Secs`) : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
