import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Truck, Droplets, Loader2, User, FileText, Hash } from 'lucide-react';
import moment from 'moment';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { vehiclesOptions, dashboardOptions, scansOptions } from '@/query/options';
import { usePermissions } from '@/components/auth/PermissionGuard';

const WASH_HISTORY_PAGE_SIZES = [10, 20, 50, 100];

const EMPTY_LABEL = '—';

/** Show value or placeholder for empty/missing data. */
function orEmpty(value) {
  if (value == null) return EMPTY_LABEL;
  if (typeof value === 'string' && value.trim() === '') return EMPTY_LABEL;
  return value;
}

/** Mask phone/mobile so only partial digits visible (e.g. +61***2256). */
function maskPhone(value) {
  if (!value || typeof value !== 'string') return EMPTY_LABEL;
  const s = value.trim();
  if (s.length <= 4) return '***';
  if (s.length <= 8) return s.slice(0, 2) + '***' + s.slice(-2);
  return s.slice(0, 3) + '***' + s.slice(-4);
}

const DEFAULT_DATE_RANGE = {
  start: moment().startOf('month').format('YYYY-MM-DD'),
  end: moment().format('YYYY-MM-DD'),
};

export default function VehicleDetail() {
  const { vehicleRef } = useParams();
  const navigate = useNavigate();
  const permissions = usePermissions();
  const companyId = permissions.userProfile?.company_id;

  const { data: allVehicles = [], isLoading: vehiclesLoading, error: vehiclesError } = useQuery({
    ...vehiclesOptions(companyId, {}),
    enabled: !!companyId && !!vehicleRef,
  });

  const vehicle = useMemo(() => {
    if (!vehicleRef || !Array.isArray(allVehicles)) return null;
    return allVehicles.find(
      (v) =>
        String(v.vehicleRef ?? '') === String(vehicleRef) ||
        String(v.internalVehicleId ?? '') === String(vehicleRef)
    ) ?? null;
  }, [allVehicles, vehicleRef]);

  const { data: dashboardData } = useQuery({
    ...dashboardOptions(companyId, {
      customerId: vehicle?.customerId ?? 'all',
      siteId: vehicle?.siteId ?? 'all',
      startDate: DEFAULT_DATE_RANGE.start,
      endDate: DEFAULT_DATE_RANGE.end,
    }),
    enabled: !!companyId && !!vehicle,
  });

  const { data: scansRaw, isLoading: scansLoading } = useQuery({
    ...scansOptions(companyId, {
      vehicleId: vehicleRef,
      fromDate: moment().subtract(3, 'months').format('YYYY-MM-DD'),
      toDate: moment().format('YYYY-MM-DD'),
      status: 'success,exceeded',
      export: 'all',
    }),
    enabled: !!companyId && !!vehicleRef,
  });

  const scans = useMemo(() => {
    const list = Array.isArray(scansRaw) ? scansRaw : (scansRaw?.data ?? []);
    return [...list].sort((a, b) => {
      const ta = new Date(a.createdAt ?? a.timestamp ?? a.scanDate ?? 0).getTime();
      const tb = new Date(b.createdAt ?? b.timestamp ?? b.scanDate ?? 0).getTime();
      return tb - ta;
    });
  }, [scansRaw]);

  const dashboardRowForVehicle = useMemo(() => {
    if (!vehicle?.vehicleRef || !dashboardData?.rows?.length) return null;
    const start = moment(DEFAULT_DATE_RANGE.start);
    const end = moment(DEFAULT_DATE_RANGE.end);
    const rows = dashboardData.rows.filter(
      (r) => r.vehicleRef === vehicle.vehicleRef && moment(`${r.year}-${String(r.month).padStart(2, '0')}-01`).isBetween(start, end, 'month', '[]')
    );
    const totalScans = rows.reduce((sum, r) => sum + (r.totalScans || 0), 0);
    const lastScan = rows.length
      ? rows.reduce((latest, r) => (!latest || (r.lastScan && r.lastScan > latest) ? r.lastScan : latest), null)
      : vehicle.lastScanAt;
    return { totalScans, lastScan, rows };
  }, [vehicle, dashboardData]);

  const targetWashes = vehicle?.protocolNumber ?? 12;
  const washesThisMonth = dashboardRowForVehicle?.totalScans ?? 0;
  const isCompliant = washesThisMonth >= targetWashes;
  const progressPct = targetWashes ? Math.round((washesThisMonth / targetWashes) * 100) : 0;

  const [washHistoryPage, setWashHistoryPage] = useState(1);
  const [washHistoryPageSize, setWashHistoryPageSize] = useState(20);
  const paginatedScans = useMemo(() => {
    const start = (washHistoryPage - 1) * washHistoryPageSize;
    return scans.slice(start, start + washHistoryPageSize);
  }, [scans, washHistoryPage, washHistoryPageSize]);
  const washHistoryTotalPages = Math.max(1, Math.ceil(scans.length / washHistoryPageSize));

  if (vehiclesLoading || (vehicleRef && !vehicle && !vehiclesError)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4 gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Vehicle not found. It may be outside your access or the link is invalid.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <Button variant="ghost" onClick={() => navigate('/')} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Back to Compliance
      </Button>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Truck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">{vehicle.vehicleName ?? '—'}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {vehicle.customerName ?? '—'} · {vehicle.siteName ?? '—'}
              </p>
            </div>
            <Badge className={isCompliant ? 'bg-primary' : 'bg-red-500 hover:bg-red-600'} style={{ marginLeft: 'auto' }}>
              {isCompliant ? 'Compliant' : 'Non-Compliant'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <Hash className="h-4 w-4" /> Identity & status
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Vehicle reference</p>
                <p className="font-mono text-sm">{orEmpty(vehicle.vehicleRef)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Internal ID</p>
                <p className="font-mono text-sm">{orEmpty(vehicle.internalVehicleId)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">RFID tag</p>
                <p className="font-mono text-sm">{orEmpty(vehicle.vehicleRfid)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge variant="outline">{orEmpty(vehicle.statusLabel)}</Badge>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Overview</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-xs text-muted-foreground">Washes this month</p>
                <p className="text-2xl font-bold">{washesThisMonth}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-xs text-muted-foreground">Target washes (monthly)</p>
                <p className="text-2xl font-bold">{targetWashes}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-xs text-muted-foreground">Progress</p>
                <p className="text-2xl font-bold">{progressPct}%</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-xs text-muted-foreground">Last scan</p>
                <p className="text-sm font-medium">
                  {vehicle.lastScanAt ? moment(vehicle.lastScanAt).format('DD MMM YYYY HH:mm') : EMPTY_LABEL}
                </p>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Scan card programmed parameters</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Wash time</p>
                <p className="font-medium">{vehicle.washTime1Seconds != null ? `${vehicle.washTime1Seconds} secs` : EMPTY_LABEL}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Washes per day</p>
                <p className="font-medium">{orEmpty(vehicle.washesPerDay)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Washes per week</p>
                <p className="font-medium">{orEmpty(vehicle.washesPerWeek)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Target washes (monthly)</p>
                <p className="font-medium">{orEmpty(vehicle.protocolNumber)}</p>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <User className="h-4 w-4" /> Contact
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="font-medium">{vehicle.phone ? maskPhone(vehicle.phone) : EMPTY_LABEL}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Mobile</p>
                <p className="font-medium">{vehicle.mobile ? maskPhone(vehicle.mobile) : EMPTY_LABEL}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-medium break-all">{orEmpty(vehicle.email)}</p>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4" /> Notes
            </h3>
            <p className="text-sm rounded-lg border bg-muted/30 p-4">{orEmpty(vehicle.notes)}</p>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Additional information</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">First name</p>
                <p className="font-medium">{orEmpty(vehicle.legacyFirstName)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Last name</p>
                <p className="font-medium">{orEmpty(vehicle.legacyLastName)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Position</p>
                <p className="font-medium">{orEmpty(vehicle.legacyPosition)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Wash ID</p>
                <p className="font-medium">{vehicle.legacyWashId != null && vehicle.legacyWashId !== 0 ? String(vehicle.legacyWashId) : EMPTY_LABEL}</p>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <Droplets className="h-4 w-4" /> Wash history
            </h3>
            {scansLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : scans.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No wash scans in the last 3 months.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
                  <p className="text-sm text-muted-foreground">
                    {scans.length} scan{scans.length !== 1 ? 's' : ''} total
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Per page</span>
                    <Select
                      value={String(washHistoryPageSize)}
                      onValueChange={(v) => {
                        setWashHistoryPageSize(Number(v));
                        setWashHistoryPage(1);
                      }}
                    >
                      <SelectTrigger className="w-[80px] h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WASH_HISTORY_PAGE_SIZES.map((n) => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date & time</TableHead>
                        <TableHead>Site</TableHead>
                        <TableHead>Device</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedScans.map((scan, i) => (
                        <TableRow key={scan.internalScanId ?? scan.scanRef ?? `${washHistoryPage}-${i}`}>
                          <TableCell>
                            {scan.createdAt
                              ? moment(scan.createdAt).format('DD MMM YYYY HH:mm')
                              : scan.timestamp
                                ? moment(scan.timestamp).format('DD MMM YYYY HH:mm')
                                : '—'}
                          </TableCell>
                          <TableCell>{scan.siteName ?? '—'}</TableCell>
                          <TableCell>{scan.deviceName ?? scan.deviceSerial ?? '—'}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{scan.statusLabel ?? 'Success'}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {washHistoryTotalPages > 1 && (
                  <div className="mt-4 flex items-center justify-center gap-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setWashHistoryPage((p) => Math.max(1, p - 1))}
                      disabled={washHistoryPage <= 1}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {washHistoryPage} of {washHistoryTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setWashHistoryPage((p) => Math.min(washHistoryTotalPages, p + 1))}
                      disabled={washHistoryPage >= washHistoryTotalPages}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            )}
          </section>

          {vehicle.createdAt && (
            <section className="text-xs text-muted-foreground">
              Vehicle record created {moment(vehicle.createdAt).format('DD MMM YYYY')}
              {vehicle.updatedAt && ` · Last updated ${moment(vehicle.updatedAt).format('DD MMM YYYY')}`}.
            </section>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
