import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
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
import html2canvas from 'html2canvas';
import { CardsAndChartsGlassySkeleton, ActionLoaderOverlay } from './UsageCostsSkeletons';

const DEFAULT_DISPENSING_RATE_L_PER_60S = 5;
const ELORA_LOGO_URL = 'https://yyqspdpk0yebvddv.public.blob.vercel-storage.com/233633501.png';

function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return null;
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  const num = parseInt(clean, 16);
  if (Number.isNaN(num)) return null;
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

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
  const [pdfHtml, setPdfHtml] = useState('');
  const pdfContainerRef = useRef(null);

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

  const extractBodyHtml = (html) => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      return doc.body?.innerHTML || html;
    } catch {
      return html;
    }
  };

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

  const buildScenarioReportHtml = useCallback((branding, rowsForPage) => {
    const primaryColor = branding?.primary_color || '#004E2B';
    const secondaryColor = branding?.secondary_color || '#00DD39';
    const companyName = branding?.company_name || 'ELORA System';
    const companyLogoUrl = branding?.logo_url || '';
    const generated = new Date().toLocaleString();

    const headerSummary = `${summary.siteCount} site${summary.siteCount === 1 ? '' : 's'} · ${summary.totalTrucks} truck${summary.totalTrucks === 1 ? '' : 's'}`;

    const cardsHtml = `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 16px 0;border-collapse:separate;border-spacing:12px 0;">
        <tr>
          <td style="width:25%;vertical-align:top;">
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;">
              <div style="color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;margin:0 0 4px 0;">Current Total / Month</div>
              <div style="color:#0f172a;font-size:18px;font-weight:700;margin:0 0 2px 0;">$${summary.totalCurrentMo.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div style="color:#94a3b8;font-size:11px;margin:0;">${headerSummary}</div>
            </div>
          </td>
          <td style="width:25%;vertical-align:top;">
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;">
              <div style="color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;margin:0 0 4px 0;">Proposed Total / Month</div>
              <div style="color:#0f172a;font-size:18px;font-weight:700;margin:0 0 2px 0;">$${summary.totalProposedMo.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div style="color:#94a3b8;font-size:11px;margin:0;">After parameter changes</div>
            </div>
          </td>
          <td style="width:25%;vertical-align:top;">
            <div style="background:#ecfdf5;border:1px solid #bbf7d0;border-radius:10px;padding:14px 16px;">
              <div style="color:#16a34a;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;margin:0 0 4px 0;">Monthly Saving</div>
              <div style="color:#166534;font-size:18px;font-weight:700;margin:0 0 2px 0;">$${summary.monthlySaving.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div style="color:#4b5563;font-size:11px;margin:0;">${summary.pctReduction}% reduction</div>
            </div>
          </td>
          <td style="width:25%;vertical-align:top;">
            <div style="background:#ecfdf5;border:1px solid #bbf7d0;border-radius:10px;padding:14px 16px;">
              <div style="color:#16a34a;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;margin:0 0 4px 0;">Annual Saving</div>
              <div style="color:#166534;font-size:18px;font-weight:700;margin:0 0 2px 0;">$${summary.annualSaving.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div style="color:#4b5563;font-size:11px;margin:0;">Projected yearly saving</div>
            </div>
          </td>
        </tr>
      </table>
    `;

    const rows = rowsForPage && rowsForPage.length ? rowsForPage : siteRowsWithPricing;
    const rowsHtml = rows.map((row, index) => {
      const saving = row.monthlySaving;
      const savingColor = saving < 0 ? '#b91c1c' : '#047857';
      const bg = index % 2 === 0 ? '#ffffff' : '#f9fafb';
      return `
        <tr style="background:${bg};">
          <td style="padding:10px 12px;font-size:12px;color:#0f172a;border-bottom:1px solid #e5e7eb;">${row.siteName || row.siteRef}</td>
          <td style="padding:10px 12px;font-size:12px;color:#0f172a;text-align:right;border-bottom:1px solid #e5e7eb;">${row.trucks}</td>
          <td style="padding:10px 12px;font-size:12px;color:#64748b;text-align:right;border-bottom:1px solid #e5e7eb;">${row.currentWashTime}s</td>
          <td style="padding:10px 12px;font-size:12px;color:#0f172a;text-align:right;border-bottom:1px solid #e5e7eb;">${row.proposedWashTime}s</td>
          <td style="padding:10px 12px;font-size:12px;color:#64748b;text-align:right;border-bottom:1px solid #e5e7eb;">${row.currentWashesPerWeek}</td>
          <td style="padding:10px 12px;font-size:12px;color:#0f172a;text-align:right;border-bottom:1px solid #e5e7eb;">${row.proposedWashesPerWeek}</td>
          <td style="padding:10px 12px;font-size:12px;color:#0f172a;text-align:right;border-bottom:1px solid #e5e7eb;">$${Number(row.currentCostMo).toFixed(2)}</td>
          <td style="padding:10px 12px;font-size:12px;color:#0f172a;font-weight:600;text-align:right;border-bottom:1px solid #e5e7eb;">$${Number(row.proposedCostMo).toFixed(2)}</td>
          <td style="padding:10px 12px;font-size:12px;color:${savingColor};font-weight:600;text-align:right;border-bottom:1px solid #e5e7eb;">$${Number(saving).toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    const tableHtml = `
      <div style="margin-top:20px;">
        <h2 style="color:#0f172a;font-size:16px;font-weight:700;margin:0 0 8px 0;">Site-by-Site Parameters</h2>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:10px 12px;font-size:11px;color:#6b7280;text-align:left;text-transform:uppercase;letter-spacing:0.5px;">Site</th>
              <th style="padding:10px 12px;font-size:11px;color:#6b7280;text-align:right;text-transform:uppercase;letter-spacing:0.5px;">Trucks</th>
              <th style="padding:10px 12px;font-size:11px;color:#6b7280;text-align:right;text-transform:uppercase;letter-spacing:0.5px;">Current Wash</th>
              <th style="padding:10px 12px;font-size:11px;color:#6b7280;text-align:right;text-transform:uppercase;letter-spacing:0.5px;">Proposed Wash</th>
              <th style="padding:10px 12px;font-size:11px;color:#6b7280;text-align:right;text-transform:uppercase;letter-spacing:0.5px;">Current W/Wk</th>
              <th style="padding:10px 12px;font-size:11px;color:#6b7280;text-align:right;text-transform:uppercase;letter-spacing:0.5px;">Proposed W/Wk</th>
              <th style="padding:10px 12px;font-size:11px;color:#6b7280;text-align:right;text-transform:uppercase;letter-spacing:0.5px;">Current / Mo</th>
              <th style="padding:10px 12px;font-size:11px;color:#6b7280;text-align:right;text-transform:uppercase;letter-spacing:0.5px;">Proposed / Mo</th>
              <th style="padding:10px 12px;font-size:11px;color:#6b7280;text-align:right;text-transform:uppercase;letter-spacing:0.5px;">Monthly Saving</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Multi-Site Scenario Builder</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:820px;margin:28px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.12),0 2px 8px rgba(0,0,0,0.08);">
    <header style="background:linear-gradient(160deg,#004E2B 0%,#003d22 50%,#002a17 100%);padding:0;">
      <div style="padding:28px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td style="width:28%;vertical-align:middle;text-align:center;">
              <div style="display:inline-flex;flex-direction:column;align-items:center;gap:6px;">
                ${
                  companyLogoUrl
                    ? `<img src="${companyLogoUrl}" alt="${companyName}" style="height:32px;width:auto;object-fit:contain;display:block;" />`
                    : `<div style="height:32px;width:32px;border-radius:999px;background:#ffffff;display:flex;align-items:center;justify-content:center;overflow:hidden;">
                        <span style="font-size:11px;font-weight:700;color:#004E2B;">${(companyName || 'ELORA').slice(0, 3).toUpperCase()}</span>
                       </div>`
                }
                <span style="color:rgba(255,255,255,0.98);font-size:12px;font-weight:600;">${companyName}</span>
              </div>
            </td>
            <td style="width:44%;vertical-align:middle;text-align:center;">
              <h1 style="color:rgba(255,255,255,0.98);margin:0;font-size:24px;font-weight:800;letter-spacing:-0.5px;">Multi-Site Scenario Builder</h1>
              <p style="color:rgba(255,255,255,0.7);margin:4px 0 0 0;font-size:12px;">${customerName || 'Customer'} · ${summary.siteCount} sites · ${summary.totalTrucks} trucks</p>
              <div style="display:inline-block;margin-top:10px;padding:4px 14px;border-radius:999px;border:1px solid rgba(0,221,57,0.25);background:rgba(0,221,57,0.12);color:#bbf7d0;font-size:10px;font-weight:600;letter-spacing:0.3px;">
                ${generated}
              </div>
            </td>
            <td style="width:28%;vertical-align:middle;text-align:center;">
              <div style="display:inline-flex;flex-direction:column;align-items:center;gap:6px;opacity:0.95;">
                <img src="${ELORA_LOGO_URL}" alt="Elora" style="height:32px;width:auto;object-fit:contain;display:block;" />
                <span style="color:rgba(255,255,255,0.85);font-size:12px;font-weight:600;letter-spacing:0.3px;">Elora Solutions</span>
              </div>
            </td>
          </tr>
        </table>
      </div>
      <div style="height:3px;background:linear-gradient(90deg,#00DD39,#7cc43e);"></div>
    </header>
    <div style="background:#f0faf5;padding:10px 24px;border-bottom:1px solid #d1e8da;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
      <span style="color:#004E2B;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Scenario Summary</span>
      <span style="color:#004E2B;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">${headerSummary}</span>
    </div>
    <main style="padding:40px 44px;">
      ${cardsHtml}
      ${tableHtml}
    </main>
    <footer style="background:linear-gradient(180deg,#f7f8fa,#f0faf5);padding:24px 32px;border-top:1px solid #d1e8da;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
      <p style="color:#64748b;font-size:12px;margin:0;">This is an automated report from ${companyName} Compliance Portal</p>
      <div style="display:inline-flex;align-items:center;gap:8px;">
        <img src="${ELORA_LOGO_URL}" alt="" style="height:22px;width:auto;object-fit:contain;flex-shrink:0;display:inline-block;" />
        <span style="color:#64748b;font-size:11px;font-weight:500;white-space:nowrap;">Powered by ELORA · © ${new Date().getFullYear()}</span>
      </div>
    </footer>
  </div>
</body>
</html>
    `;
  }, [customerName, summary, siteRowsWithPricing]);

  const buildPdfFromHtml = useCallback(async (branding) => {
    const addCanvasToPdf = (pdf, canvas) => {
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const contentWidth = pageWidth - margin * 2;
      const imgWidth = contentWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const imgData = canvas.toDataURL('image/png', 0.95);
      let heightLeft = imgHeight;
      let position = margin;

      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= (pageHeight - margin * 2);

      while (heightLeft > 0) {
        position = -(imgHeight - heightLeft) + margin;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= (pageHeight - margin * 2);
      }
    };

    const captureContainerToCanvas = async () => {
      if (!pdfContainerRef.current) throw new Error('PDF container not available. Please try again.');
      return await html2canvas(pdfContainerRef.current, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#f1f5f9',
        logging: false,
        width: 860,
        height: pdfContainerRef.current.scrollHeight || 1200,
        x: 0,
        y: 0,
      });
    };

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true });
    const pageSize = 13;
    const totalRows = siteRowsWithPricing.length || 0;
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

    for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
      const start = pageIndex * pageSize;
      const end = start + pageSize;
      const chunk = siteRowsWithPricing.slice(start, end);

      const html = buildScenarioReportHtml(branding, chunk);
      setPdfHtml(extractBodyHtml(html));
      // allow React DOM to apply innerHTML
      await new Promise((r) => setTimeout(r, 800));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      if (pageIndex > 0) {
        pdf.addPage();
      }
      const canvas = await captureContainerToCanvas();
      addCanvasToPdf(pdf, canvas);
    }

    const filename = `scenario-builder-${(customerName || 'customer').replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`;
    return { pdf, filename };
  }, [buildScenarioReportHtml, extractBodyHtml, customerName, siteRowsWithPricing]);

  const handleExportPdf = useCallback(async () => {
    setExportPdfLoading(true);
    try {
      let branding = null;
      if (companyId) {
        const { data: brandingRows } = await supabaseClient.tables.companies
          .select('name, logo_url, primary_color, secondary_color')
          .eq('id', companyId)
          .limit(1);
        branding = brandingRows?.[0]
          ? {
              company_name: brandingRows[0].name || 'ELORA Solutions',
              logo_url: brandingRows[0].logo_url || undefined,
              primary_color: brandingRows[0].primary_color || '#004E2B',
              secondary_color: brandingRows[0].secondary_color || '#00DD39',
            }
          : null;
      }
      const effectiveBranding = branding || {
        company_name: 'ELORA Solutions',
        logo_url: undefined,
        primary_color: '#004E2B',
        secondary_color: '#00DD39',
      };
      const { pdf, filename } = await buildPdfFromHtml(effectiveBranding);
      pdf.save(filename);
      toast.success('PDF exported', { description: 'Scenario report downloaded.' });
    } finally {
      setExportPdfLoading(false);
    }
  }, [companyId, buildPdfFromHtml]);

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

      {/* Hidden PDF container for html2canvas capture */}
      <div
        ref={pdfContainerRef}
        style={{
          position: 'fixed',
          width: '860px',
          minHeight: pdfHtml ? '900px' : '0px',
          padding: '28px',
          background: 'linear-gradient(135deg, hsl(220, 13%, 91%) 0%, #e2e8f0 100%)',
          top: '-99999px',
          left: '0',
          pointerEvents: 'none',
          zIndex: -9999,
          overflow: 'visible',
          visibility: pdfHtml ? 'visible' : 'hidden',
        }}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: pdfHtml }}
      />
    </div>
  );
}
