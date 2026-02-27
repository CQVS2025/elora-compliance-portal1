import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Copy, Save, Loader2 } from 'lucide-react';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { usePermissions } from '@/components/auth/PermissionGuard';
import { useAuth } from '@/lib/AuthContext';
import { customersOptions, vehiclesOptions } from '@/query/options';
import { getStateFromSite, getPricingDetails, calcFromParams, round2 } from './usageCostUtils';
import { callEdgeFunction, supabase } from '@/lib/supabase';
import { supabaseClient } from '@/api/supabaseClient';
import { toast } from '@/lib/toast';
import { jsPDF } from 'jspdf';
import { CardsAndChartsGlassySkeleton, ActionLoaderOverlay } from './UsageCostsSkeletons';

const DEFAULT_DISPENSING_RATE_L_PER_60S = 5;

function buildSiteRowsFromVehicles(vehicles, customerName, customerRef) {
  if (!Array.isArray(vehicles) || vehicles.length === 0) return [];
  const bySite = {};
  vehicles.forEach((v) => {
    const siteRef = v.siteRef ?? v.siteId ?? v.site_ref ?? '';
    const siteName = v.siteName ?? v.site_name ?? siteRef;
    if (!siteRef) return;
    if (!bySite[siteRef]) {
      const first = v;
      const washSec = first.washTime1Seconds ?? first.washTime ?? 120;
      const perDay = first.washesPerDay ?? 2;
      const perWeek = first.washesPerWeek ?? 12;
      bySite[siteRef] = {
        siteRef,
        siteName,
        customerName: customerName || first.customerName || first.customer_name || '—',
        customerRef: customerRef || first.customerRef || first.customer_ref,
        trucks: 0,
        currentWashTime: Number(washSec) || 120,
        currentWashesPerDay: Number(perDay) ?? 2,
        currentWashesPerWeek: Number(perWeek) ?? 6,
        proposedWashTime: Number(washSec) || 120,
        proposedWashesPerDay: Number(perDay) ?? 2,
        proposedWashesPerWeek: Number(perWeek) ?? 6,
      };
    }
    bySite[siteRef].trucks += 1;
  });
  return Object.values(bySite).sort((a, b) => (b.siteName || '').localeCompare(a.siteName || ''));
}

export default function UsageCostsScenarioBuilder({ selectedCustomer, selectedSite, dateRange }) {
  const permissions = usePermissions();
  const { user: authUser, userProfile } = useAuth();
  const userEmail = authUser?.email || userProfile?.email || '';
  const companyId = permissions.userProfile?.company_id ?? 'portal';
  const isSuperAdmin = permissions.isSuperAdmin ?? false;

  const [localCustomer, setLocalCustomer] = useState(selectedCustomer && selectedCustomer !== 'all' ? selectedCustomer : '');
  const [siteRows, setSiteRows] = useState([]);
  const [viewMode, setViewMode] = useState('current'); // 'current' | 'proposed'
  const [saveLoading, setSaveLoading] = useState(false);
  const [exportPdfLoading, setExportPdfLoading] = useState(false);
  const [applyToAllOpen, setApplyToAllOpen] = useState(false);
  const [applyToAllValues, setApplyToAllValues] = useState({ proposedWashTime: 60, proposedWashesPerWeek: 6 });

  const { data: customers = [] } = useQuery(customersOptions(companyId, { allTenants: isSuperAdmin }));
  const { data: vehiclesData, isLoading: vehiclesLoading } = useQuery({
    ...vehiclesOptions(companyId, { customerId: localCustomer || undefined, allTenants: isSuperAdmin }),
    enabled: !!companyId && !!localCustomer,
  });

  const vehicles = useMemo(() => {
    const raw = vehiclesData;
    if (Array.isArray(raw)) return raw;
    if (raw?.data) return raw.data;
    return [];
  }, [vehiclesData]);

  const selectedCustomerObj = useMemo(
    () => customers.find((c) => (c.id || c.ref) === localCustomer),
    [customers, localCustomer]
  );
  const customerName = selectedCustomerObj?.name ?? '';

  useEffect(() => {
    if (selectedCustomer && selectedCustomer !== 'all') setLocalCustomer(selectedCustomer);
  }, [selectedCustomer]);

  const initialSiteRows = useMemo(() => {
    return buildSiteRowsFromVehicles(vehicles, customerName, localCustomer);
  }, [vehicles, customerName, localCustomer]);

  useEffect(() => {
    setSiteRows(initialSiteRows);
  }, [initialSiteRows.length, localCustomer]);

  const siteRowsWithPricing = useMemo(() => {
    return siteRows.map((row) => {
      const state = getStateFromSite(row.siteName, row.customerName);
      const pricing = getPricingDetails(row.customerName, state);
      const pricePerLitre = pricing.pricePerLitre ?? 3.85;
      const disp = DEFAULT_DISPENSING_RATE_L_PER_60S;
      const currentCalc = calcFromParams(
        row.currentWashTime,
        row.currentWashesPerDay,
        row.currentWashesPerWeek,
        disp,
        pricePerLitre,
        row.trucks
      );
      const proposedWashTime = row.proposedWashTime === '' ? 60 : Number(row.proposedWashTime) || 60;
      const proposedWashesPerDay = row.proposedWashesPerDay === '' ? 2 : Number(row.proposedWashesPerDay) || 2;
      const proposedWashesPerWeek = row.proposedWashesPerWeek === '' ? 6 : Number(row.proposedWashesPerWeek) || 6;
      const proposedCalc = calcFromParams(
        proposedWashTime,
        proposedWashesPerDay,
        proposedWashesPerWeek,
        disp,
        pricePerLitre,
        row.trucks
      );
      const monthlySaving = round2(currentCalc.maxCostPerMonthSite - proposedCalc.maxCostPerMonthSite);
      return {
        ...row,
        pricePerLitre,
        currentCostMo: currentCalc.maxCostPerMonthSite,
        proposedCostMo: proposedCalc.maxCostPerMonthSite,
        monthlySaving,
      };
    });
  }, [siteRows]);

  const summary = useMemo(() => {
    const totalCurrent = siteRowsWithPricing.reduce((s, r) => s + r.currentCostMo, 0);
    const totalProposed = siteRowsWithPricing.reduce((s, r) => s + r.proposedCostMo, 0);
    const monthlySaving = round2(totalCurrent - totalProposed);
    const annualSaving = round2(monthlySaving * 12);
    const pct = totalCurrent > 0 ? round2((monthlySaving / totalCurrent) * 100) : 0;
    const totalTrucks = siteRowsWithPricing.reduce((s, r) => s + r.trucks, 0);
    return {
      totalCurrentMo: totalCurrent,
      totalProposedMo: totalProposed,
      monthlySaving,
      annualSaving,
      pctReduction: pct,
      siteCount: siteRowsWithPricing.length,
      totalTrucks,
    };
  }, [siteRowsWithPricing]);

  const updateRow = useCallback((siteRef, updates) => {
    setSiteRows((prev) =>
      prev.map((r) => (r.siteRef === siteRef ? { ...r, ...updates } : r))
    );
  }, []);

  const handleApplyToAll = useCallback(() => {
    const { proposedWashTime, proposedWashesPerWeek } = applyToAllValues;
    setSiteRows((prev) =>
      prev.map((r) => ({
        ...r,
        proposedWashTime: Number(proposedWashTime) || 60,
        proposedWashesPerWeek: Number(proposedWashesPerWeek) ?? 6,
      }))
    );
    setApplyToAllOpen(false);
    toast.success('Applied to all sites', { description: `Wash time ${proposedWashTime}s, ${proposedWashesPerWeek} washes/week.` });
  }, [applyToAllValues]);

  // When we get initial site rows for a customer, optionally merge in saved proposals (latest per site)
  useEffect(() => {
    if (!companyId || !localCustomer || initialSiteRows.length === 0) return;
    setSiteRows(initialSiteRows);
    let cancelled = false;
    (async () => {
      const { data: rows, error } = await supabase
        .from('pricing_calculator_proposals')
        .select('site_ref, proposed_wash_time_sec, proposed_washes_per_day, proposed_washes_per_week')
        .eq('company_id', companyId)
        .eq('customer_ref', localCustomer)
        .in('site_ref', initialSiteRows.map((r) => r.siteRef))
        .order('created_at', { ascending: false });
      if (cancelled || error) return;
      const bySite = {};
      (rows || []).forEach((r) => {
        if (bySite[r.site_ref]) return;
        bySite[r.site_ref] = r;
      });
      setSiteRows((prev) =>
        prev.map((r) => {
          const saved = bySite[r.siteRef];
          if (!saved) return r;
          return {
            ...r,
            proposedWashTime: Number(saved.proposed_wash_time_sec) ?? r.proposedWashTime,
            proposedWashesPerDay: Number(saved.proposed_washes_per_day) ?? r.proposedWashesPerDay,
            proposedWashesPerWeek: Number(saved.proposed_washes_per_week) ?? r.proposedWashesPerWeek,
          };
        })
      );
    })();
    return () => { cancelled = true; };
  }, [companyId, localCustomer, initialSiteRows.length]);

  const handleSaveScenario = useCallback(async () => {
    if (!companyId || !userEmail || siteRowsWithPricing.length === 0) {
      toast.error('Cannot save', { description: 'Select a customer with sites or sign in.' });
      return;
    }
    setSaveLoading(true);
    try {
      const { data: brandingRows } = await supabaseClient.tables.companies
        .select('name, logo_url, primary_color, secondary_color')
        .eq('id', companyId)
        .limit(1);
      const branding = brandingRows?.[0]
        ? {
            company_name: brandingRows[0].name || 'ELORA Solutions',
            logo_url: brandingRows[0].logo_url || undefined,
            primary_color: brandingRows[0].primary_color || '#7CB342',
            secondary_color: brandingRows[0].secondary_color || '#9CCC65',
          }
        : { company_name: 'ELORA Solutions', logo_url: undefined, primary_color: '#7CB342', secondary_color: '#9CCC65' };

      let saved = 0;
      for (const row of siteRowsWithPricing) {
        await callEdgeFunction('submitPricingProposal', {
          company_id: companyId,
          customer_ref: row.customerRef || localCustomer,
          customer_name: row.customerName,
          site_ref: row.siteRef,
          site_name: row.siteName,
          current_wash_time_sec: row.currentWashTime,
          current_washes_per_day: row.currentWashesPerDay,
          current_washes_per_week: row.currentWashesPerWeek,
          proposed_wash_time_sec: row.proposedWashTime,
          proposed_washes_per_day: row.proposedWashesPerDay,
          proposed_washes_per_week: row.proposedWashesPerWeek,
          submitted_by_email: userEmail,
          dispensing_rate_l_per_60s: DEFAULT_DISPENSING_RATE_L_PER_60S,
          price_per_litre: row.pricePerLitre,
          truck_count: row.trucks,
          send_notification: false,
          branding,
        });
        saved += 1;
      }
      toast.success('Scenario saved', { description: `Proposed parameters saved for ${saved} site(s).` });
    } catch (e) {
      toast.error('Failed to save scenario', { description: e?.message || 'Please try again.' });
    } finally {
      setSaveLoading(false);
    }
  }, [companyId, userEmail, localCustomer, siteRowsWithPricing]);

  const buildPdfDoc = useCallback(() => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 36;
    const contentWidth = pageWidth - margin * 2;
    let y = 0;

    // Header bar (ELORA green)
    doc.setFillColor(124, 179, 66);
    doc.rect(0, 0, pageWidth, 56, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Multi-Site Scenario Builder', margin, 32);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`${customerName || 'Customer'} · ${summary.siteCount} sites · ${summary.totalTrucks} trucks`, margin, 46);
    y = 72;

    // Generated line
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
    y += 24;

    // Summary cards: 4 boxes with border and spacing
    const cardW = (contentWidth - 12) / 4;
    const cardH = 44;
    const borderColor = { r: 226, g: 232, b: 240 };
    doc.setDrawColor(borderColor.r, borderColor.g, borderColor.b);
    doc.setLineWidth(0.5);

    const cards = [
      { label: 'Current Total / Month', value: `$${summary.totalCurrentMo.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, sub: `${summary.totalTrucks} trucks · ${summary.siteCount} sites` },
      { label: 'Proposed Total / Month', value: `$${summary.totalProposedMo.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, sub: 'After parameter changes' },
      { label: 'Monthly Saving', value: `$${summary.monthlySaving.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, sub: `${summary.pctReduction}% reduction`, green: true },
      { label: 'Annual Saving', value: `$${summary.annualSaving.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, sub: 'Projected yearly saving', green: true },
    ];
    cards.forEach((card, i) => {
      const x = margin + i * (cardW + 4);
      doc.setFillColor(248, 250, 252);
      doc.rect(x, y, cardW, cardH, 'FD');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(card.label, x + 10, y + 14);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      if (card.green) doc.setTextColor(4, 120, 87);
      else doc.setTextColor(15, 23, 42);
      doc.text(card.value, x + 10, y + 28);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(card.sub, x + 10, y + 38);
    });
    y += cardH + 20;

    // Section title
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Site-by-Site Parameters', margin, y);
    y += 20;

    // Table: wider columns and taller rows so headers and currency don't wrap
    const headerRowH = 32;
    const dataRowH = 28;
    const pad = 12;
    // Column widths (pt) – sum = contentWidth; extra width for money columns to avoid wrap
    const colW = [88, 42, 52, 52, 46, 46, 70, 70, 67];
    const headers = ['Site', 'Trucks', 'Curr Wash', 'Prop Wash', 'Curr W/Wk', 'Prop W/Wk', 'Current / Mo', 'Proposed / Mo', 'Saving'];
    const tableLeft = margin;
    const tableWidth = Math.min(contentWidth, colW.reduce((a, b) => a + b, 0));
    const colX = [tableLeft];
    for (let i = 1; i < colW.length; i++) colX[i] = colX[i - 1] + colW[i - 1];

    // Header row – extra height so labels stay on one line
    doc.setFillColor(241, 245, 249);
    doc.rect(tableLeft, y, tableWidth, headerRowH, 'FD');
    doc.setDrawColor(borderColor.r, borderColor.g, borderColor.b);
    doc.rect(tableLeft, y, tableWidth, headerRowH, 'S');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 65, 85);
    const headerY = y + headerRowH / 2 + 3;
    headers.forEach((h, i) => {
      if (i >= 6) {
        doc.text(h, colX[i] + colW[i] - pad, headerY, { align: 'right' });
      } else {
        doc.text(h, colX[i] + pad, headerY);
      }
    });
    y += headerRowH;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    siteRowsWithPricing.forEach((row, idx) => {
      if (y + dataRowH > pageHeight - 52) {
        doc.addPage();
        y = margin;
      }
      const fill = idx % 2 === 1 ? [248, 250, 252] : [255, 255, 255];
      doc.setFillColor(...fill);
      doc.rect(tableLeft, y, tableWidth, dataRowH, 'FD');
      doc.rect(tableLeft, y, tableWidth, dataRowH, 'S');
      const cellY = y + dataRowH / 2 + 3;
      doc.setTextColor(15, 23, 42);
      doc.text((row.siteName || row.siteRef).substring(0, 20), colX[0] + pad, cellY);
      doc.text(String(row.trucks), colX[1] + pad, cellY);
      doc.text(`${row.currentWashTime}s`, colX[2] + pad, cellY);
      doc.text(`${row.proposedWashTime}s`, colX[3] + pad, cellY);
      doc.text(String(row.currentWashesPerWeek), colX[4] + pad, cellY);
      doc.text(String(row.proposedWashesPerWeek), colX[5] + pad, cellY);
      // Money: right-align without maxWidth to prevent wrapping (column width is sufficient)
      doc.text(`$${Number(row.currentCostMo).toFixed(2)}`, colX[6] + colW[6] - pad, cellY, { align: 'right' });
      doc.text(`$${Number(row.proposedCostMo).toFixed(2)}`, colX[7] + colW[7] - pad, cellY, { align: 'right' });
      const saving = row.monthlySaving;
      if (saving < 0) doc.setTextColor(185, 28, 28);
      else doc.setTextColor(4, 120, 87);
      doc.text(`$${Number(saving).toFixed(2)}`, colX[8] + colW[8] - pad, cellY, { align: 'right' });
      y += dataRowH;
    });
    y += 24;

    // Footer
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(1);
    doc.line(margin, y, pageWidth - margin, y);
    y += 14;
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`ELORA Scenario Builder · ${new Date().toLocaleString()}`, margin, y);
    doc.text('This report is generated from the Usage Costs module.', pageWidth - margin, y, { align: 'right' });
    return doc;
  }, [customerName, summary, siteRowsWithPricing]);

  const handleExportPdf = useCallback(() => {
    setExportPdfLoading(true);
    try {
      const doc = buildPdfDoc();
      doc.save(`scenario-builder-${(customerName || 'customer').replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('PDF exported', { description: 'Scenario report downloaded.' });
    } finally {
      setExportPdfLoading(false);
    }
  }, [customerName, buildPdfDoc]);

  if (vehiclesLoading) {
    return <CardsAndChartsGlassySkeleton />;
  }

  return (
    <div className="space-y-6 relative">
      <ActionLoaderOverlay show={saveLoading} message="Saving scenario..." />
      <ActionLoaderOverlay show={exportPdfLoading} message="Generating PDF..." />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Multi-Site Scenario Builder</h2>
          <p className="text-sm text-muted-foreground mt-1">Adjust parameters across all sites for a customer and see total impact</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={localCustomer || '_none'} onValueChange={(v) => setLocalCustomer(v === '_none' ? '' : v)}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Select customer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">Select customer</SelectItem>
              {customers.map((c) => (
                <SelectItem key={c.id || c.ref} value={c.id || c.ref}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {siteRowsWithPricing.length > 0 && (
            <>
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {summary.siteCount} sites · {summary.totalTrucks} trucks
              </span>
              <Button variant="outline" size="sm" onClick={() => setApplyToAllOpen(true)}>
                <Copy className="w-4 h-4 mr-2" />
                Apply to All Sites
              </Button>
              <Button size="sm" onClick={handleSaveScenario} disabled={saveLoading}>
                {saveLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Scenario
              </Button>
            </>
          )}
        </div>
      </div>

      {!localCustomer ? (
        <Card className="border-border">
          <CardContent className="py-12 text-center text-muted-foreground">
            Select a customer to see sites and adjust parameters.
          </CardContent>
        </Card>
      ) : siteRowsWithPricing.length === 0 ? (
        <Card className="border-border">
          <CardContent className="py-12 text-center text-muted-foreground">
            No sites or vehicles found for this customer.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-border border-t-4 border-t-blue-500/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Current Total / Month</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-foreground">
                  ${summary.totalCurrentMo.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{summary.totalTrucks} trucks · {summary.siteCount} sites</p>
              </CardContent>
            </Card>
            <Card className="border-border border-t-4 border-t-primary/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Proposed Total / Month</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-foreground">
                  ${summary.totalProposedMo.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">After parameter changes</p>
              </CardContent>
            </Card>
            <Card className="border-border border-t-4 border-t-green-500/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Saving</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                  ${summary.monthlySaving.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{summary.pctReduction}% reduction</p>
              </CardContent>
            </Card>
            <Card className="border-border border-t-4 border-t-green-500/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Annual Saving</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                  ${summary.annualSaving.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Projected yearly saving</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <CardTitle>Site-by-Site Parameters</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {viewMode === 'current'
                      ? 'A Current — read-only data from API (same as Compliance).'
                      : 'B Proposed — edit proposed values; Apply to All Sites and Save Scenario update this section.'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={viewMode === 'current' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('current')}
                  >
                    A Current
                  </Button>
                  <Button
                    variant={viewMode === 'proposed' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('proposed')}
                    className={viewMode === 'proposed' ? 'border-primary' : ''}
                  >
                    B Proposed
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border border-border">
                {viewMode === 'current' ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Site</TableHead>
                        <TableHead className="text-right">Trucks</TableHead>
                        <TableHead className="text-right">Current Wash Time</TableHead>
                        <TableHead className="text-right">Current W/Week</TableHead>
                        <TableHead className="text-right">Current / Mo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {siteRowsWithPricing.map((row) => (
                        <TableRow key={row.siteRef}>
                          <TableCell className="font-medium">{row.siteName}</TableCell>
                          <TableCell className="text-right">{row.trucks}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{row.currentWashTime}s</TableCell>
                          <TableCell className="text-right text-muted-foreground">{row.currentWashesPerWeek}</TableCell>
                          <TableCell className="text-right">${row.currentCostMo.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Site</TableHead>
                        <TableHead className="text-right">Trucks</TableHead>
                        <TableHead className="text-right">Current Wash Time</TableHead>
                        <TableHead className="text-right">Proposed Wash Time</TableHead>
                        <TableHead className="text-right">Current W/Week</TableHead>
                        <TableHead className="text-right">Proposed W/Week</TableHead>
                        <TableHead className="text-right">Current / Mo</TableHead>
                        <TableHead className="text-right">Proposed / Mo</TableHead>
                        <TableHead className="text-right text-green-700 dark:text-green-400">Monthly Saving</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {siteRowsWithPricing.map((row) => (
                        <TableRow key={row.siteRef}>
                          <TableCell className="font-medium">{row.siteName}</TableCell>
                          <TableCell className="text-right">{row.trucks}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{row.currentWashTime}s</TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              min={15}
                              max={600}
                              className="w-20 h-8 text-right inline-block"
                              value={row.proposedWashTime}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '' || val === null) {
                                  updateRow(row.siteRef, { proposedWashTime: '' });
                                } else {
                                  updateRow(row.siteRef, { proposedWashTime: Number(val) || 60 });
                                }
                              }}
                              onBlur={(e) => {
                                if (e.target.value === '' || e.target.value === null) {
                                  updateRow(row.siteRef, { proposedWashTime: 60 });
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">{row.currentWashesPerWeek}</TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              min={1}
                              max={50}
                              className="w-16 h-8 text-right inline-block"
                              value={row.proposedWashesPerWeek}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '' || val === null) {
                                  updateRow(row.siteRef, { proposedWashesPerWeek: '' });
                                } else {
                                  updateRow(row.siteRef, { proposedWashesPerWeek: Number(val) ?? 6 });
                                }
                              }}
                              onBlur={(e) => {
                                if (e.target.value === '' || e.target.value === null) {
                                  updateRow(row.siteRef, { proposedWashesPerWeek: 6 });
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell className="text-right">${row.currentCostMo.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-primary font-medium">${row.proposedCostMo.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-green-700 dark:text-green-400 font-medium">${row.monthlySaving.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleExportPdf} disabled={exportPdfLoading} className="bg-green-600 hover:bg-green-700 text-white">
              {exportPdfLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
              Export Scenario Report as PDF
            </Button>
          </div>
        </>
      )}

      <Dialog open={applyToAllOpen} onOpenChange={setApplyToAllOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Apply to All Sites</DialogTitle>
            <DialogDescription>Set the same proposed wash time and washes per week for every site.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Proposed Wash Time (seconds)</Label>
              <Input
                type="number"
                min={15}
                max={600}
                value={applyToAllValues.proposedWashTime}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || val === null) {
                    setApplyToAllValues((p) => ({ ...p, proposedWashTime: '' }));
                  } else {
                    setApplyToAllValues((p) => ({ ...p, proposedWashTime: Number(val) || 60 }));
                  }
                }}
                onBlur={(e) => {
                  if (e.target.value === '' || e.target.value === null) {
                    setApplyToAllValues((p) => ({ ...p, proposedWashTime: 60 }));
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Proposed Washes per Week</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={applyToAllValues.proposedWashesPerWeek}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || val === null) {
                    setApplyToAllValues((p) => ({ ...p, proposedWashesPerWeek: '' }));
                  } else {
                    setApplyToAllValues((p) => ({ ...p, proposedWashesPerWeek: Number(val) ?? 6 }));
                  }
                }}
                onBlur={(e) => {
                  if (e.target.value === '' || e.target.value === null) {
                    setApplyToAllValues((p) => ({ ...p, proposedWashesPerWeek: 6 }));
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyToAllOpen(false)}>Cancel</Button>
            <Button onClick={handleApplyToAll}>Apply to All Sites</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
