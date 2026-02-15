import React, { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  MessageSquare,
  Loader2,
  Filter,
  Users,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import moment from 'moment';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePermissions } from '@/components/auth/PermissionGuard';
import { smsRemindersOptions } from '@/query/options';

const RISK_COLORS = {
  critical: 'bg-destructive/90 text-destructive-foreground',
  high: 'bg-amber-500/90 text-white',
  medium: 'bg-yellow-500/80 text-black',
  low: 'bg-primary/80 text-primary-foreground',
};

function maskPhone(phone) {
  if (!phone || typeof phone !== 'string') return '—';
  const cleaned = phone.replace(/\s/g, '');
  if (cleaned.length < 6) return '***';
  return `${cleaned.slice(0, 6)}***${cleaned.slice(-2)}`;
}

export default function SMSAlerts() {
  const permissions = usePermissions();
  const companyId = permissions.userProfile?.company_id;

  const [dateFrom, setDateFrom] = useState(moment().subtract(30, 'days').format('YYYY-MM-DD'));
  const [dateTo, setDateTo] = useState(moment().format('YYYY-MM-DD'));
  const [customerFilter, setCustomerFilter] = useState('all');
  const [siteFilter, setSiteFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [expandedBatchId, setExpandedBatchId] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const isSuperAdmin = permissions.isSuperAdmin ?? false;

  const filters = useMemo(
    () => ({
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      customerName: customerFilter,
      siteName: siteFilter,
      type: typeFilter,
      page,
      pageSize,
    }),
    [dateFrom, dateTo, customerFilter, siteFilter, typeFilter, page, pageSize]
  );

  const companyEloraCustomerRef = permissions.userProfile?.company_elora_customer_ref?.trim() || null;

  const { data: queryResult, isLoading } = useQuery({
    ...smsRemindersOptions(companyId ?? null, filters, { isSuperAdmin, companyEloraCustomerRef }),
    enabled: !!companyId || isSuperAdmin,
  });

  const rawRows = queryResult?.data ?? [];
  const totalCount = queryResult?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const showingFrom = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, totalCount);

  useEffect(() => {
    setPage(1);
  }, [dateFrom, dateTo, customerFilter, siteFilter, typeFilter]);

  const customers = useMemo(() => {
    const set = new Set();
    rawRows.forEach((r) => {
      const name = (r.customer_name || '').trim();
      if (name) set.add(name);
    });
    return Array.from(set).sort();
  }, [rawRows]);

  const sites = useMemo(() => {
    const set = new Set();
    rawRows.forEach((r) => {
      const name = (r.site_name || '').trim();
      if (name) set.add(name);
    });
    return Array.from(set).sort();
  }, [rawRows]);

  const displayRows = useMemo(() => {
    const byBatch = new Map();
    const singles = [];
    rawRows.forEach((row) => {
      if (row.batch_id) {
        if (!byBatch.has(row.batch_id)) {
          byBatch.set(row.batch_id, []);
        }
        byBatch.get(row.batch_id).push(row);
      } else {
        singles.push({ type: 'single', row, key: row.id });
      }
    });
    const batchEntries = Array.from(byBatch.entries()).map(([batchId, rows]) => ({
      type: 'batch',
      batchId,
      rows,
      key: batchId,
    }));
    const combined = [
      ...batchEntries.map((b) => ({ ...b, sortAt: b.rows[0]?.created_at || b.rows[0]?.sent_at })),
      ...singles.map((s) => ({ ...s, sortAt: s.row.created_at || s.row.sent_at })),
    ];
    combined.sort((a, b) => new Date(b.sortAt || 0) - new Date(a.sortAt || 0));
    return combined;
  }, [rawRows]);

  const toggleBatch = (batchId) => {
    setExpandedBatchId((prev) => (prev === batchId ? null : batchId));
  };

  if (!companyId && !isSuperAdmin) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            You do not have access to SMS Alerts. This tab is available to organization admins and super admins.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <MessageSquare className="h-6 w-6" />
          SMS Alerts
        </h1>
        <p className="text-muted-foreground mt-1">
          Risk prediction alerts sent via SMS. Single and batch sends are recorded per vehicle, customer, and site.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">From date</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">To date</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Customer name</label>
              <Select value={customerFilter} onValueChange={setCustomerFilter}>
                <SelectTrigger className="w-[200px] h-9">
                  <SelectValue placeholder="All customers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All customers</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Site name</label>
              <Select value={siteFilter} onValueChange={setSiteFilter}>
                <SelectTrigger className="w-[200px] h-9">
                  <SelectValue placeholder="All sites" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sites</SelectItem>
                  {sites.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Type</label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="single">Single</SelectItem>
                  <SelectItem value="batch">Batch</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Alert history</CardTitle>
          <p className="text-sm text-muted-foreground">
            {isSuperAdmin ? 'All companies' : 'Your company'} · {totalCount} send event{totalCount !== 1 ? 's' : ''} total
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : displayRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No alerts in this period or filters.</p>
          ) : (
            <>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-9" aria-label="Expand" />
                    <TableHead>Date & time</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Vehicle(s)</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Risk level</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayRows.map((item) => {
                    if (item.type === 'batch') {
                      const first = item.rows[0];
                      const at = first?.sent_at || first?.created_at;
                      const siteName = first?.site_name || first?.site_ref || '—';
                      const customerName = first?.customer_name || first?.customer_ref || '—';
                      const riskLevel = first?.risk_level || '—';
                      const statusCounts = item.rows.reduce((acc, r) => {
                        acc[r.status || 'unknown'] = (acc[r.status || 'unknown'] || 0) + 1;
                        return acc;
                      }, {});
                      const statusLabel = Object.entries(statusCounts)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(', ');
                      const isExpanded = expandedBatchId === item.batchId;
                      return (
                        <React.Fragment key={item.key}>
                          <TableRow
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => toggleBatch(item.batchId)}
                          >
                            <TableCell className="w-9 py-2 align-middle" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => toggleBatch(item.batchId)}
                                className="p-0.5 rounded hover:bg-muted inline-flex items-center justify-center"
                                aria-expanded={isExpanded}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                              </button>
                            </TableCell>
                            <TableCell className="font-medium">
                              {at ? moment(at).format('DD MMM YYYY · HH:mm') : '—'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="gap-1">
                                <Users className="h-3 w-3" /> Batch
                              </Badge>
                            </TableCell>
                            <TableCell>{item.rows.length} vehicle(s)</TableCell>
                            <TableCell>{siteName}</TableCell>
                            <TableCell>{customerName}</TableCell>
                            <TableCell>
                              <Badge className={RISK_COLORS[riskLevel] || ''}>{riskLevel}</Badge>
                            </TableCell>
                            <TableCell>{statusLabel}</TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow>
                              <TableCell colSpan={8} className="bg-muted/30 p-0">
                                <div className="px-4 py-3">
                                  <p className="text-xs font-medium text-muted-foreground mb-2">Batch details</p>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Vehicle</TableHead>
                                        <TableHead>Driver</TableHead>
                                        <TableHead>Phone</TableHead>
                                        <TableHead>Site</TableHead>
                                        <TableHead>Customer</TableHead>
                                        <TableHead>Risk</TableHead>
                                        <TableHead>Status</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {item.rows.map((row) => (
                                        <TableRow key={row.id}>
                                          <TableCell>{row.vehicle_name || row.vehicle_ref || '—'}</TableCell>
                                          <TableCell>{row.driver_name || '—'}</TableCell>
                                          <TableCell>{maskPhone(row.driver_phone)}</TableCell>
                                          <TableCell>{row.site_name || row.site_ref || '—'}</TableCell>
                                          <TableCell>{row.customer_name || row.customer_ref || '—'}</TableCell>
                                          <TableCell>
                                            <Badge className={RISK_COLORS[row.risk_level] || ''}>{row.risk_level || '—'}</Badge>
                                          </TableCell>
                                          <TableCell>{row.status || '—'}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    }
                    const r = item.row;
                    const at = r.sent_at || r.created_at;
                    return (
                      <TableRow key={item.key}>
                        <TableCell className="w-9" />
                        <TableCell className="font-medium">
                          {at ? moment(at).format('DD MMM YYYY · HH:mm') : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">Single</Badge>
                        </TableCell>
                        <TableCell>{r.vehicle_name || r.vehicle_ref || '—'}</TableCell>
                        <TableCell>{r.site_name || r.site_ref || '—'}</TableCell>
                        <TableCell>{r.customer_name || r.customer_ref || '—'}</TableCell>
                        <TableCell>
                          <Badge className={RISK_COLORS[r.risk_level] || ''}>{r.risk_level || '—'}</Badge>
                        </TableCell>
                        <TableCell>{r.status || '—'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                Showing {showingFrom} to {showingTo} of {totalCount} records
              </p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Per page</span>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(v) => {
                      setPageSize(Number(v));
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[72px] h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[10, 20, 50, 100].map((n) => (
                        <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
