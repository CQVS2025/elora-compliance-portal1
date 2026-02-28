import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Loader2, Wallet } from 'lucide-react';
import moment from 'moment';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { usePermissions } from '@/components/auth/PermissionGuard';
import { customersOptions, scansOptions, vehiclesOptions, pricingConfigOptions } from '@/query/options';
import { calculateScanCostFromScan, isBillableScan, buildVehicleWashTimeMaps, buildSitePricingMaps, formatDateRangeDisplay } from './usageCostUtils';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { CardsAndChartsGlassySkeleton } from './UsageCostsSkeletons';

function getMonthRange(dateRange) {
  const start = moment(dateRange?.start || undefined);
  const end = moment(dateRange?.end || undefined);
  if (!start.isValid()) {
    const now = moment();
    return { period: now.format('YYYY-MM'), monthStart: now.clone().startOf('month'), monthEnd: now.clone().endOf('month'), daysInMonth: now.daysInMonth() };
  }
  const monthStart = start.clone().startOf('month');
  const monthEnd = start.clone().endOf('month');
  const period = monthStart.format('YYYY-MM');
  return { period, monthStart, monthEnd, daysInMonth: monthStart.daysInMonth() };
}

export default function UsageCostsBudgetTracker({ selectedCustomer, selectedSite, dateRange }) {
  const permissions = usePermissions();
  const queryClient = useQueryClient();
  const companyId = permissions.userProfile?.company_id ?? 'portal';
  const isSuperAdmin = permissions.isSuperAdmin ?? false;

  const [setBudgetOpen, setSetBudgetOpen] = useState(false);
  const [setBudgetCompanyId, setSetBudgetCompanyId] = useState(companyId || '');
  const [setBudgetCustomerRef, setSetBudgetCustomerRef] = useState('');
  const [setBudgetAmount, setSetBudgetAmount] = useState('');
  const [setBudgetPeriod, setSetBudgetPeriod] = useState('');
  const [saveBudgetLoading, setSaveBudgetLoading] = useState(false);

  const { period, monthStart, monthEnd, daysInMonth } = useMemo(() => getMonthRange(dateRange), [dateRange?.start, dateRange?.end]);
  const monthLabel = monthStart ? monthStart.format('MMMM YYYY') : '';
  const today = moment();
  const daysElapsed = monthStart && monthEnd ? Math.min(Math.max(0, today.diff(monthStart, 'days') + 1), daysInMonth) : 0;
  const daysRemaining = Math.max(0, daysInMonth - daysElapsed);

  const { data: scansData, isLoading: scansLoading } = useQuery({
    ...scansOptions(companyId, {
      startDate: monthStart.format('YYYY-MM-DD'),
      endDate: monthEnd.format('YYYY-MM-DD'),
      customerId: selectedCustomer && selectedCustomer !== 'all' ? selectedCustomer : undefined,
      siteId: selectedSite && selectedSite !== 'all' ? selectedSite : undefined,
      export: true,
      status: 'success,exceeded',
    }),
    enabled: !!companyId && !!period,
  });

  const scans = useMemo(() => {
    const raw = scansData;
    if (Array.isArray(raw)) return raw;
    if (raw?.data) return raw.data;
    return [];
  }, [scansData]);

  const { data: vehiclesData, isLoading: vehiclesLoading } = useQuery(
    vehiclesOptions(companyId, {
      customerId: selectedCustomer && selectedCustomer !== 'all' ? selectedCustomer : undefined,
      siteId: selectedSite && selectedSite !== 'all' ? selectedSite : undefined,
    })
  );

  const { data: pricingConfig } = useQuery(pricingConfigOptions());

  const entitlementMaps = useMemo(() => {
    const list = vehiclesData?.data ?? (Array.isArray(vehiclesData) ? vehiclesData : []);
    return buildVehicleWashTimeMaps(list);
  }, [vehiclesData]);

  const sitePricingMaps = useMemo(() => {
    return buildSitePricingMaps(
      pricingConfig?.tankConfigs ?? [],
      pricingConfig?.products ?? [],
    );
  }, [pricingConfig]);

  const hasMaps = useMemo(
    () =>
      entitlementMaps &&
      (Object.keys(entitlementMaps.byRef || {}).length > 0 || Object.keys(entitlementMaps.byRfid || {}).length > 0),
    [entitlementMaps]
  );
  const maps = hasMaps ? entitlementMaps : null;
  const pMaps = sitePricingMaps?.byDeviceSerial != null ? sitePricingMaps : null;

  const spentByCustomer = useMemo(() => {
    const filtered = scans.filter((s) => isBillableScan(s));
    const byCustomer = {};
    let scansExcludedConfigMissing = 0;
    filtered.forEach((scan) => {
      const ref = scan.customerRef ?? scan.customer_ref ?? '__unknown__';
      const name = scan.customerName ?? scan.customer_name ?? (ref === '__unknown__' ? 'Unknown / Unassigned' : ref);
      if (!byCustomer[ref]) byCustomer[ref] = { customerRef: ref, customerName: name, totalScans: 0, spent: 0 };
      const pricing = calculateScanCostFromScan(scan, maps, pMaps);
      if (pricing.configMissing) scansExcludedConfigMissing += 1;
      const cost = pricing.cost;
      byCustomer[ref].totalScans += 1;
      byCustomer[ref].spent += cost;
    });
    const rows = Object.values(byCustomer).map((c) => ({ ...c, spent: Math.round(c.spent * 100) / 100 }));
    return { rows, scansExcludedConfigMissing };
  }, [scans, maps, pMaps]);

  const spentBySite = useMemo(() => {
    const filtered = scans.filter((s) => isBillableScan(s));
    const bySite = {};
    filtered.forEach((scan) => {
      const cRef = scan.customerRef ?? scan.customer_ref ?? '__unknown__';
      const cName = scan.customerName ?? scan.customer_name ?? (cRef === '__unknown__' ? 'Unknown / Unassigned' : cRef);
      const sRef = scan.siteRef ?? scan.site_ref ?? '__unknown_site__';
      const sName = scan.siteName ?? scan.site_name ?? (sRef === '__unknown_site__' ? 'Unknown site' : sRef);
      const key = `${cRef}\0${sRef}`;
      if (!bySite[key]) bySite[key] = { customerRef: cRef, customerName: cName, siteRef: sRef, siteName: sName, totalScans: 0, spent: 0 };
      const pricing = calculateScanCostFromScan(scan, maps, pMaps);
      const cost = pricing.cost;
      bySite[key].totalScans += 1;
      bySite[key].spent += cost;
    });
    return Object.values(bySite).map((s) => ({ ...s, spent: Math.round(s.spent * 100) / 100 }));
  }, [scans, maps, pMaps]);

  const scansExcludedConfigMissing = spentByCustomer.scansExcludedConfigMissing ?? 0;

  const { data: budgetsRows = [], isLoading: budgetsLoading } = useQuery({
    queryKey: ['usage-cost-budgets', companyId, period],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('usage_cost_budgets')
        .select('customer_ref, customer_name, amount')
        .eq('company_id', companyId)
        .eq('period', period);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!companyId && !!period,
  });

  const budgetsByCustomer = useMemo(() => {
    const map = {};
    budgetsRows.forEach((r) => {
      map[r.customer_ref] = { customerName: r.customer_name, amount: Number(r.amount) || 0 };
    });
    return map;
  }, [budgetsRows]);

  const { data: customers = [] } = useQuery(customersOptions(companyId, { allTenants: isSuperAdmin }));

  const { data: companies = [] } = useQuery({
    queryKey: ['companies-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('companies').select('id, name').order('name');
      if (error) throw error;
      return data ?? [];
    },
    enabled: isSuperAdmin,
  });

  const customerRows = useMemo(() => {
    const seen = new Set();
    const list = [];
    spentByCustomer.rows.forEach((c) => {
      const ref = c.customerRef;
      if (seen.has(ref)) return;
      seen.add(ref);
      const budget = budgetsByCustomer[ref];
      const budgetAmount = budget?.amount ?? 0;
      const spent = c.spent;
      const pctUsed = budgetAmount > 0 ? Math.round((spent / budgetAmount) * 1000) / 10 : 0;
      const projected = daysElapsed > 0 ? (spent / daysElapsed) * daysInMonth : 0;
      const remaining = budgetAmount - spent;
      let status = 'On Track';
      if (pctUsed >= 100) status = 'Over';
      else if (pctUsed >= 90) status = 'At Risk';
      const projectedDiff = projected - budgetAmount;
      list.push({
        customerRef: ref,
        customerName: c.customerName,
        totalScans: c.totalScans,
        spent,
        budget: budgetAmount,
        pctUsed,
        remaining,
        projected,
        status,
        projectedDiff,
      });
    });
    budgetsRows.forEach((r) => {
      if (seen.has(r.customer_ref)) return;
      seen.add(r.customer_ref);
      const spentRow = spentByCustomer.rows.find((c) => c.customerRef === r.customer_ref);
      const spent = spentRow?.spent ?? 0;
      const budgetAmount = Number(r.amount) || 0;
      const pctUsed = budgetAmount > 0 ? Math.round((spent / budgetAmount) * 1000) / 10 : 0;
      const projected = daysElapsed > 0 ? (spent / daysElapsed) * daysInMonth : 0;
      const remaining = budgetAmount - spent;
      let status = 'On Track';
      if (pctUsed >= 100) status = 'Over';
      else if (pctUsed >= 90) status = 'At Risk';
      list.push({
        customerRef: r.customer_ref,
        customerName: r.customer_name,
        totalScans: spentRow?.totalScans ?? 0,
        spent,
        budget: budgetAmount,
        pctUsed,
        remaining,
        projected,
        status,
        projectedDiff: projected - budgetAmount,
      });
    });
    return list.sort((a, b) => (b.budget || b.spent) - (a.budget || a.spent));
  }, [spentByCustomer, budgetsByCustomer, budgetsRows, daysElapsed, daysInMonth]);

  const siteRowsFiltered = useMemo(() => {
    let list = spentBySite;
    if (selectedCustomer && selectedCustomer !== 'all') {
      list = list.filter((s) => s.customerRef === selectedCustomer);
    }
    return list.sort((a, b) => b.spent - a.spent);
  }, [spentBySite, selectedCustomer]);

  const siteRowsByCustomer = useMemo(() => {
    const groups = {};
    siteRowsFiltered.forEach((row) => {
      const ref = row.customerRef;
      if (!groups[ref]) groups[ref] = { customerRef: ref, customerName: row.customerName, budget: budgetsByCustomer[ref]?.amount ?? 0, sites: [] };
      groups[ref].sites.push(row);
    });
    return Object.values(groups).map((g) => ({
      ...g,
      totalSpent: g.sites.reduce((s, r) => s + r.spent, 0),
      totalScans: g.sites.reduce((s, r) => s + r.totalScans, 0),
    }));
  }, [siteRowsFiltered, budgetsByCustomer]);

  const summary = useMemo(() => {
    const totalBudget = customerRows.reduce((s, r) => s + r.budget, 0);
    const totalSpent = customerRows.reduce((s, r) => s + r.spent, 0);
    const remaining = totalBudget - totalSpent;
    const pctUsed = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 1000) / 10 : 0;
    const projectedEom = daysElapsed > 0 ? (totalSpent / daysElapsed) * daysInMonth : totalSpent;
    const projectedDiff = projectedEom - totalBudget;
    return {
      totalBudget,
      totalSpent,
      remaining,
      pctUsed,
      projectedEom,
      projectedDiff,
      daysRemaining,
    };
  }, [customerRows, daysElapsed, daysInMonth, daysRemaining]);

  const openSetBudget = useCallback(() => {
    setSetBudgetCompanyId(companyId || '');
    setSetBudgetCustomerRef('');
    setSetBudgetAmount('');
    setSetBudgetPeriod(period);
    setSetBudgetOpen(true);
  }, [companyId, period]);

  const saveBudget = useCallback(async () => {
    const customerRef = setBudgetCustomerRef;
    const customer = customers.find((c) => (c.id || c.ref) === customerRef);
    const customerName = customer?.name ?? customerRef;
    const amount = parseFloat(setBudgetAmount);
    const periodVal = setBudgetPeriod || period;
    const companyIdToUse = isSuperAdmin ? setBudgetCompanyId : companyId;
    if (!companyIdToUse || !customerRef || isNaN(amount) || amount < 0) {
      toast.error('Invalid input', { description: 'Select customer and enter a valid amount.' });
      return;
    }
    setSaveBudgetLoading(true);
    try {
      const { error } = await supabase.from('usage_cost_budgets').upsert(
        {
          company_id: companyIdToUse,
          customer_ref: customerRef,
          customer_name: customerName,
          period: periodVal,
          amount,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'company_id,customer_ref,period' }
      );
      if (error) throw error;
      toast.success('Budget saved', { description: `${customerName}: $${amount.toFixed(2)} for ${periodVal}.` });
      setSetBudgetOpen(false);
      queryClient.invalidateQueries({ queryKey: ['usage-cost-budgets'] });
    } catch (e) {
      toast.error('Failed to save budget', { description: e?.message || 'Please try again.' });
    } finally {
      setSaveBudgetLoading(false);
    }
  }, [setBudgetCustomerRef, setBudgetAmount, setBudgetPeriod, setBudgetCompanyId, companyId, isSuperAdmin, customers, period, queryClient]);

  const isLoading = scansLoading || budgetsLoading || vehiclesLoading;
  if (isLoading) {
    return <CardsAndChartsGlassySkeleton />;
  }

  const dateRangeLabel = formatDateRangeDisplay(dateRange);

  return (
    <div className="space-y-6">
      {dateRangeLabel && (
        <p className="text-sm text-muted-foreground font-medium">Data for period: {dateRangeLabel}</p>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Budget Tracker</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {monthLabel} — {daysRemaining} days remaining
          </p>
        </div>
        <Button onClick={openSetBudget} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Set Budget
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Budget</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              ${summary.totalBudget.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground mt-1">All customers this month</p>
            {dateRangeLabel && <p className="text-xs text-muted-foreground mt-0.5">{dateRangeLabel}</p>}
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Spent to Date</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              ${summary.totalSpent.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.totalBudget > 0 ? `${summary.pctUsed}% of budget used` : 'Actual spend this period'}
            </p>
            {dateRangeLabel && <p className="text-xs text-muted-foreground mt-0.5">{dateRangeLabel}</p>}
          </CardContent>
        </Card>
        <Card className="border-border border-t-4 border-t-green-500/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Remaining</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-700 dark:text-green-400">
              ${summary.remaining.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.totalBudget > 0 ? `${Math.round((summary.remaining / summary.totalBudget) * 1000) / 10}% remaining` : '—'}
            </p>
            {dateRangeLabel && <p className="text-xs text-muted-foreground mt-0.5">{dateRangeLabel}</p>}
          </CardContent>
        </Card>
        <Card className="border-border border-t-4 border-t-primary/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Projected End-of-Month</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              ${summary.projectedEom.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs mt-1">
              {summary.projectedDiff <= 0 ? (
                <span className="text-green-600 dark:text-green-400">Under Budget</span>
              ) : (
                <span className="text-red-600 dark:text-red-400">Over Budget</span>
              )}
            </p>
            {dateRangeLabel && <p className="text-xs text-muted-foreground mt-0.5">{dateRangeLabel}</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <Tabs defaultValue="customer" className="w-full">
          <CardHeader>
            <CardTitle>Budget vs Actual</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Spend and budget for {monthLabel}{dateRangeLabel ? ` · ${dateRangeLabel}` : ''}</p>
            <TabsList className="grid w-full max-w-[280px] grid-cols-2 mt-3">
              <TabsTrigger value="customer">By Customer</TabsTrigger>
              <TabsTrigger value="site">By Site</TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent>
            <TabsContent value="customer" className="mt-0">
              {dateRangeLabel && (
                <p className="text-xs text-muted-foreground mb-3">Period: {dateRangeLabel}</p>
              )}
              {customerRows.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center">
                  No scan data or budgets for this period. Set a budget or adjust the date range.
                </p>
              ) : (
                <div className="space-y-6">
                  {customerRows.map((row) => {
                    const displayName = row.customerRef === '__unknown__' ? 'Unknown / Unassigned' : row.customerName;
                    const pctBar = row.budget > 0 ? Math.min(100, (row.spent / row.budget) * 100) : 0;
                    const barColor = pctBar >= 100 ? 'bg-red-500' : pctBar >= 90 ? 'bg-amber-500' : 'bg-green-500';
                    const hasBudget = row.budget > 0;
                    const statusLabel = !hasBudget ? 'No budget set' : row.status === 'Over' ? 'Over Budget' : row.status === 'At Risk' ? 'At Risk' : 'On Track';
                    const projectedText = hasBudget
                      ? (row.projectedDiff <= 0 ? ` — $${Math.abs(row.projectedDiff).toFixed(0)} under budget` : ` — $${row.projectedDiff.toFixed(0)} OVER budget`)
                      : ' this month';
                    return (
                      <div key={row.customerRef} className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="font-medium text-foreground">{displayName}</span>
                            <span className="text-muted-foreground ml-2">{row.totalScans.toLocaleString()} scans</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-foreground">
                              ${row.spent.toFixed(2)} / ${row.budget.toFixed(2)}
                            </span>
                            <span
                              className={
                                !hasBudget
                                  ? 'text-muted-foreground'
                                  : row.status === 'Over'
                                    ? 'text-red-600 dark:text-red-400 font-medium'
                                    : row.status === 'At Risk'
                                      ? 'text-amber-600 dark:text-amber-400 font-medium'
                                      : 'text-green-600 dark:text-green-400 font-medium'
                              }
                            >
                              {statusLabel}
                            </span>
                          </div>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pctBar}%` }} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {hasBudget ? `${row.pctUsed}% used` : 'No budget set'} · Projected: ${row.projected.toFixed(0)}
                          {projectedText}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
            <TabsContent value="site" className="mt-0">
              {dateRangeLabel && (
                <p className="text-xs text-muted-foreground mb-3">Period: {dateRangeLabel}</p>
              )}
              {siteRowsByCustomer.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center">
                  No scan data for this period. Select a customer or date range to see spend by site.
                </p>
              ) : (
                <div className="space-y-6">
                  {siteRowsByCustomer.map((group) => {
                    const hasBudget = group.budget > 0;
                    const pctBar = hasBudget ? Math.min(100, (group.totalSpent / group.budget) * 100) : 0;
                    const barColor = pctBar >= 100 ? 'bg-red-500' : pctBar >= 90 ? 'bg-amber-500' : 'bg-green-500';
                    const statusLabel = !hasBudget ? 'No budget set' : pctBar >= 100 ? 'Over Budget' : pctBar >= 90 ? 'At Risk' : 'On Track';
                    const displayName = group.customerRef === '__unknown__' ? 'Unknown / Unassigned' : group.customerName;
                    return (
                      <div key={group.customerRef} className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-foreground">{displayName}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-foreground">
                              ${group.totalSpent.toFixed(2)} / ${group.budget.toFixed(2)} total
                            </span>
                            <span
                              className={
                                !hasBudget
                                  ? 'text-muted-foreground text-sm'
                                  : pctBar >= 100
                                    ? 'text-red-600 dark:text-red-400 font-medium text-sm'
                                    : pctBar >= 90
                                      ? 'text-amber-600 dark:text-amber-400 font-medium text-sm'
                                      : 'text-green-600 dark:text-green-400 font-medium text-sm'
                              }
                            >
                              {statusLabel}
                            </span>
                          </div>
                        </div>
                        {hasBudget && (
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pctBar}%` }} />
                          </div>
                        )}
                        <div className="space-y-2 pt-1">
                          {group.sites.map((site) => (
                            <div
                              key={`${site.customerRef}-${site.siteRef}`}
                              className="flex flex-wrap items-center justify-between gap-2 py-2 px-3 rounded-md bg-background/60 border border-border/50"
                            >
                              <div>
                                <span className="font-medium text-foreground">{site.siteName}</span>
                                <span className="text-muted-foreground ml-2 text-sm">{site.totalScans.toLocaleString()} scans</span>
                              </div>
                              <span className="text-sm font-semibold text-primary">${site.spent.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      <Dialog open={setBudgetOpen} onOpenChange={setSetBudgetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set Budget</DialogTitle>
            <DialogDescription>
              {isSuperAdmin ? 'Set monthly budget for any company and customer.' : 'Set monthly budget for your company.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {isSuperAdmin && (
              <div className="space-y-2">
                <Label>Company</Label>
                <Select value={setBudgetCompanyId || '_'} onValueChange={(v) => setSetBudgetCompanyId(v === '_' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select company" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Customer</Label>
              <Select value={setBudgetCustomerRef || '_'} onValueChange={(v) => setSetBudgetCustomerRef(v === '_' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id || c.ref} value={c.id || c.ref}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Period (YYYY-MM)</Label>
              <Input
                type="text"
                placeholder="e.g. 2026-02"
                value={setBudgetPeriod}
                onChange={(e) => setSetBudgetPeriod(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Amount ($)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                placeholder="0.00"
                value={setBudgetAmount}
                onChange={(e) => setSetBudgetAmount(e.target.value)}
                onBlur={(e) => {
                  if (e.target.value === '' || e.target.value === null) {
                    setSetBudgetAmount('0');
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSetBudgetOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveBudget} disabled={saveBudgetLoading}>
              {saveBudgetLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Budget
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
