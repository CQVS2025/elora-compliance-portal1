import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Mail, Zap, ClipboardList, Send, Save, Loader2 } from 'lucide-react';
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
import { usePermissions } from '@/components/auth/PermissionGuard';
import { useAuth } from '@/lib/AuthContext';
import { customersOptions, sitesOptions, vehiclesOptions } from '@/query/options';
import { getStateFromSite, getPricingDetails } from './usageCostUtils';
import { callEdgeFunction, supabase } from '@/lib/supabase';
import { supabaseClient } from '@/api/supabaseClient';
import { toast } from '@/lib/toast';
import { jsPDF } from 'jspdf';
import { PricingCalculatorGlassySkeleton, ActionLoaderOverlay } from './UsageCostsSkeletons';

const ELORA_LOGO_URL = 'https://yyqspdpk0yebvddv.public.blob.vercel-storage.com/233633501.png';
// Match functions/sendEmailReport.ts theme (ELORA Solutions branding)
const DEFAULT_PRIMARY = '#7CB342';
const DEFAULT_SECONDARY = '#9CCC65';

const DEFAULT_DISPENSING_RATE_L_PER_60S = 5;
const WEEKS_PER_MONTH = 52 / 12;

function round2(n) {
  return Math.round(n * 100) / 100;
}

function calcFromParams(washTimeSec, washesPerDay, washesPerWeek, dispensingRate, pricePerLitre, truckCount) {
  const litresPerWash = (washTimeSec / 60) * dispensingRate;
  const maxLitresPerWeekPerTruck = litresPerWash * washesPerWeek;
  const maxLitresPerMonthPerTruck = maxLitresPerWeekPerTruck * WEEKS_PER_MONTH;
  const maxCostPerMonthPerTruck = maxLitresPerMonthPerTruck * pricePerLitre;
  const maxCostPerMonthSite = maxCostPerMonthPerTruck * (truckCount || 1);
  const maxCostPerYearSite = maxCostPerMonthSite * 12;
  return {
    litresPerWash: round2(litresPerWash),
    maxLitresPerWeekPerTruck: round2(maxLitresPerWeekPerTruck),
    maxLitresPerMonthPerTruck: round2(maxLitresPerMonthPerTruck),
    maxCostPerMonthPerTruck: round2(maxCostPerMonthPerTruck),
    maxCostPerMonthSite: round2(maxCostPerMonthSite),
    maxCostPerYearSite: round2(maxCostPerYearSite),
  };
}

export default function UsageCostsPricingCalculator({ selectedCustomer: globalCustomer, selectedSite: globalSite, dateRange }) {
  const permissions = usePermissions();
  const { user: authUser, userProfile } = useAuth();
  const userEmail = authUser?.email || userProfile?.email || '';
  const companyId = permissions.userProfile?.company_id ?? 'portal';

  const [localCustomer, setLocalCustomer] = useState(globalCustomer !== 'all' ? globalCustomer : '');
  const [localSite, setLocalSite] = useState(globalSite !== 'all' ? globalSite : '');
  const [currentWashTime, setCurrentWashTime] = useState(120);
  const [currentWashesPerDay, setCurrentWashesPerDay] = useState(2);
  const [currentWashesPerWeek, setCurrentWashesPerWeek] = useState(3);
  const [proposedWashTime, setProposedWashTime] = useState(60);
  const [proposedWashesPerDay, setProposedWashesPerDay] = useState(2);
  const [proposedWashesPerWeek, setProposedWashesPerWeek] = useState(3);
  const [targetBudget, setTargetBudget] = useState(4000);
  const [reverseOptions, setReverseOptions] = useState(null);
  const [saveProposalLoading, setSaveProposalLoading] = useState(false);
  const [sendProposalLoading, setSendProposalLoading] = useState(false);
  const [emailReportLoading, setEmailReportLoading] = useState(false);
  const [exportPdfLoading, setExportPdfLoading] = useState(false);
  const lastInitializedSiteKey = useRef('');
  const lastLoadedProposalKey = useRef('');
  const queryClient = useQueryClient();
  const isSuperAdmin = permissions.isSuperAdmin ?? false;

  const { data: customers = [] } = useQuery(customersOptions(companyId, { allTenants: isSuperAdmin }));
  const { data: sites = [], isLoading: sitesLoading } = useQuery({
    ...sitesOptions(companyId, { customerId: localCustomer || undefined, allTenants: isSuperAdmin }),
    enabled: !!companyId && !!localCustomer,
  });
  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery({
    ...vehiclesOptions(companyId, {
      customerId: localCustomer || undefined,
      siteId: localSite || undefined,
    }),
    enabled: !!companyId && !!localCustomer && !!localSite,
  });

  const { data: savedProposal } = useQuery({
    queryKey: ['pricingProposal', companyId, localCustomer, localSite],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pricing_calculator_proposals')
        .select('proposed_wash_time_sec, proposed_washes_per_day, proposed_washes_per_week')
        .eq('company_id', companyId)
        .eq('customer_ref', localCustomer)
        .eq('site_ref', localSite)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && !!localCustomer && !!localSite,
    staleTime: 0,
    refetchOnMount: true,
  });

  const selectedCustomerObj = useMemo(() => customers.find((c) => (c.id || c.ref) === localCustomer), [customers, localCustomer]);
  const selectedSiteObj = useMemo(() => sites.find((s) => (s.id || s.ref) === localSite), [sites, localSite]);
  const customerName = selectedCustomerObj?.name ?? '';
  const siteName = selectedSiteObj?.name ?? '';

  useEffect(() => {
    if (localCustomer && globalCustomer !== 'all' && globalCustomer !== localCustomer) setLocalCustomer(globalCustomer);
  }, [globalCustomer]);
  useEffect(() => {
    if (localSite && globalSite !== 'all' && globalSite !== localSite) setLocalSite(globalSite);
  }, [globalSite]);
  useEffect(() => {
    if (localCustomer && !sites.some((s) => (s.id || s.ref) === localSite)) setLocalSite('');
  }, [localCustomer, localSite, sites]);

  const truckCount = vehicles.length;
  const state = useMemo(() => getStateFromSite(siteName, customerName), [siteName, customerName]);
  const pricing = useMemo(() => getPricingDetails(customerName, state), [customerName, state]);
  const pricePerLitre = pricing.pricePerLitre ?? 3.85;
  const dispensingRate = DEFAULT_DISPENSING_RATE_L_PER_60S;

  const siteMetrics = useMemo(() => ({
    truckCount,
    dispensingRate,
    pricePerLitre,
    dispensingLabel: `${dispensingRate}L / 60s`,
  }), [truckCount, pricePerLitre]);

  const siteKey = `${localCustomer}|${localSite}`;
  useEffect(() => {
    const first = vehicles[0];
    const vehiclesForThisSite = vehicles.length > 0 && (
      (first?.siteRef === localSite) ||
      (first?.siteId === localSite) ||
      (first?.site_ref === localSite)
    );
    if (vehiclesForThisSite && siteKey && siteKey !== lastInitializedSiteKey.current) {
      lastInitializedSiteKey.current = siteKey;
      const washSec = first.washTime1Seconds ?? first.washTime ?? 120;
      const perDay = first.washesPerDay ?? 2;
      const perWeek = first.washesPerWeek ?? 12;
      setCurrentWashTime(Number(washSec) || 120);
      setCurrentWashesPerDay(Number(perDay) ?? 2);
      setCurrentWashesPerWeek(Number(perWeek) ?? 3);
      // Only set proposed from vehicles if we haven't already applied saved proposal for this site
      // (saved proposal effect may run after this and would then overwrite)
      if (lastLoadedProposalKey.current !== siteKey) {
        setProposedWashTime(Number(washSec) || 120);
        setProposedWashesPerDay(Number(perDay) ?? 2);
        setProposedWashesPerWeek(Number(perWeek) ?? 3);
      }
    }
  }, [siteKey, localSite, vehicles, vehicles.length]);

  // When a saved proposal exists for this customer/site, load it into proposed params (once per site)
  useEffect(() => {
    if (!siteKey || savedProposal === undefined) return;
    if (lastLoadedProposalKey.current === siteKey) return;
    if (savedProposal) {
      lastLoadedProposalKey.current = siteKey;
      setProposedWashTime(Number(savedProposal.proposed_wash_time_sec) || 60);
      setProposedWashesPerDay(Number(savedProposal.proposed_washes_per_day) ?? 2);
      setProposedWashesPerWeek(Number(savedProposal.proposed_washes_per_week) ?? 3);
    }
  }, [siteKey, savedProposal]);

  const currentCalc = useMemo(
    () => calcFromParams(currentWashTime, currentWashesPerDay, currentWashesPerWeek, dispensingRate, pricePerLitre, truckCount),
    [currentWashTime, currentWashesPerDay, currentWashesPerWeek, dispensingRate, pricePerLitre, truckCount]
  );
  const proposedCalc = useMemo(
    () => {
      const washTime = proposedWashTime === '' ? 60 : Number(proposedWashTime) || 60;
      const washesDay = proposedWashesPerDay === '' ? 2 : Number(proposedWashesPerDay) || 2;
      const washesWeek = proposedWashesPerWeek === '' ? 3 : Number(proposedWashesPerWeek) || 3;
      return calcFromParams(washTime, washesDay, washesWeek, dispensingRate, pricePerLitre, truckCount);
    },
    [proposedWashTime, proposedWashesPerDay, proposedWashesPerWeek, dispensingRate, pricePerLitre, truckCount]
  );

  const savings = useMemo(() => {
    const perTruckMonth = round2(currentCalc.maxCostPerMonthPerTruck - proposedCalc.maxCostPerMonthPerTruck);
    const perSiteMonth = round2(currentCalc.maxCostPerMonthSite - proposedCalc.maxCostPerMonthSite);
    const perSiteDay = truckCount > 0 ? round2(perSiteMonth / 30) : 0;
    const perSiteYear = round2(perSiteMonth * 12);
    const pct = currentCalc.maxCostPerMonthSite > 0
      ? round2((perSiteMonth / currentCalc.maxCostPerMonthSite) * 100)
      : 0;
    return { perTruckMonth, perSiteMonth, perSiteDay, perSiteYear, pct };
  }, [currentCalc, proposedCalc, truckCount]);

  const runReverseCalculator = () => {
    const effectiveTruckCount = Math.max(1, truckCount);
    const budget = targetBudget === '' ? 0 : Number(targetBudget) || 0;
    if (!budget || budget <= 0) {
      setReverseOptions(null);
      return;
    }
    const targetPerTruck = budget / effectiveTruckCount;
    const targetLitresPerMonthPerTruck = targetPerTruck / pricePerLitre;
    const targetLitresPerWeekPerTruck = targetLitresPerMonthPerTruck / WEEKS_PER_MONTH;

    const disp = dispensingRate;
    const optionA = (() => {
      const washesPerWeek = currentWashesPerWeek;
      const litresPerWashNeeded = targetLitresPerWeekPerTruck / washesPerWeek;
      const washTimeSec = (litresPerWashNeeded / disp) * 60;
      const washTimeRounded = Math.max(30, Math.min(300, Math.round(washTimeSec / 6) * 6));
      const recalc = calcFromParams(washTimeRounded, currentWashesPerDay, washesPerWeek, disp, pricePerLitre, effectiveTruckCount);
      return { label: 'Reduce Wash Time', washTime: washTimeRounded, washesPerDay: currentWashesPerDay, washesPerWeek, cost: recalc.maxCostPerMonthSite };
    })();
    const optionB = (() => {
      const washTimeSec = currentWashTime;
      const litresPerWash = (washTimeSec / 60) * disp;
      const washesPerWeekNeeded = targetLitresPerWeekPerTruck / litresPerWash;
      const washesPerWeekRounded = Math.max(2, Math.min(12, Math.round(washesPerWeekNeeded)));
      const recalc = calcFromParams(washTimeSec, currentWashesPerDay, washesPerWeekRounded, disp, pricePerLitre, effectiveTruckCount);
      return { label: 'Reduce Washes/Week', washTime: washTimeSec, washesPerDay: currentWashesPerDay, washesPerWeek: washesPerWeekRounded, cost: recalc.maxCostPerMonthSite };
    })();
    const optionC = (() => {
      const washTimeSec = Math.round((currentWashTime + proposedWashTime) / 2 / 6) * 6 || 90;
      const litresPerWash = (washTimeSec / 60) * disp;
      const washesPerWeekNeeded = targetLitresPerWeekPerTruck / litresPerWash;
      const washesPerWeekRounded = Math.max(2, Math.min(12, Math.round(washesPerWeekNeeded)));
      const recalc = calcFromParams(washTimeSec, currentWashesPerDay, washesPerWeekRounded, disp, pricePerLitre, effectiveTruckCount);
      return { label: 'Combined', washTime: washTimeSec, washesPerDay: currentWashesPerDay, washesPerWeek: washesPerWeekRounded, cost: recalc.maxCostPerMonthSite };
    })();
    setReverseOptions({ optionA, optionB, optionC });
  };

  /** Resolve branding for email/PDF: company by company_id (same as Email Report Settings). */
  const resolveBrandingForPricingReport = useCallback(async () => {
    const cid = permissions.userProfile?.company_id;
    if (!cid) return { company_name: 'ELORA Solutions', logo_url: null, primary_color: DEFAULT_PRIMARY, secondary_color: DEFAULT_SECONDARY };
    try {
      const { data: rows } = await supabaseClient.tables.companies
        .select('name, logo_url, primary_color, secondary_color')
        .eq('id', cid)
        .limit(1);
      if (rows?.length > 0) {
        const c = rows[0];
        return {
          company_name: c.name || 'ELORA Solutions',
          logo_url: c.logo_url || null,
          primary_color: c.primary_color || DEFAULT_PRIMARY,
          secondary_color: c.secondary_color || DEFAULT_SECONDARY,
        };
      }
    } catch (e) {
      console.warn('[resolveBrandingForPricingReport]', e);
    }
    return { company_name: 'ELORA Solutions', logo_url: null, primary_color: DEFAULT_PRIMARY, secondary_color: DEFAULT_SECONDARY };
  }, [permissions.userProfile?.company_id]);

  const hasSite = !!localCustomer && !!localSite;
  const isLoading = sitesLoading || vehiclesLoading;
  const actionLoading = saveProposalLoading || sendProposalLoading || emailReportLoading || exportPdfLoading;
  const actionMessage = sendProposalLoading
    ? 'Sending proposal...'
    : saveProposalLoading
      ? 'Saving proposed parameters...'
      : emailReportLoading
        ? 'Sending email report...'
        : exportPdfLoading
          ? 'Generating PDF...'
          : 'Working...';

  const submitProposalPayload = useMemo(
    () => ({
      company_id: companyId,
      customer_ref: localCustomer,
      customer_name: customerName,
      site_ref: localSite,
      site_name: siteName,
      current_wash_time_sec: currentWashTime,
      current_washes_per_day: currentWashesPerDay,
      current_washes_per_week: currentWashesPerWeek,
      proposed_wash_time_sec: proposedWashTime,
      proposed_washes_per_day: proposedWashesPerDay,
      proposed_washes_per_week: proposedWashesPerWeek,
      submitted_by_email: userEmail,
      dispensing_rate_l_per_60s: dispensingRate,
      price_per_litre: pricePerLitre,
      truck_count: truckCount,
    }),
    [
      companyId,
      localCustomer,
      customerName,
      localSite,
      siteName,
      currentWashTime,
      currentWashesPerDay,
      currentWashesPerWeek,
      proposedWashTime,
      proposedWashesPerDay,
      proposedWashesPerWeek,
      userEmail,
      dispensingRate,
      pricePerLitre,
      truckCount,
    ]
  );

  const handleSaveProposal = useCallback(async () => {
    if (!companyId || !userEmail) {
      toast.error('Cannot save', { description: 'User or company not found.' });
      return;
    }
    setSaveProposalLoading(true);
    try {
      const branding = await resolveBrandingForPricingReport();
      await callEdgeFunction('submitPricingProposal', {
        ...submitProposalPayload,
        send_notification: false,
        branding: {
          company_name: branding.company_name,
          logo_url: branding.logo_url || undefined,
          primary_color: branding.primary_color,
          secondary_color: branding.secondary_color,
        },
      });
      queryClient.invalidateQueries({ queryKey: ['pricingProposal', companyId, localCustomer, localSite] });
      toast.success('Proposed parameters saved', { description: 'You can update them here or send a proposal email later.' });
    } catch (e) {
      toast.error('Failed to save proposed parameters', { description: e?.message || 'Please try again.' });
    } finally {
      setSaveProposalLoading(false);
    }
  }, [companyId, userEmail, submitProposalPayload, resolveBrandingForPricingReport, queryClient, localCustomer, localSite]);

  const handleSendProposal = useCallback(async () => {
    if (!companyId || !userEmail) {
      toast.error('Cannot send proposal', { description: 'User or company not found.' });
      return;
    }
    setSendProposalLoading(true);
    try {
      const branding = await resolveBrandingForPricingReport();
      await callEdgeFunction('submitPricingProposal', {
        ...submitProposalPayload,
        send_notification: true,
        branding: {
          company_name: branding.company_name,
          logo_url: branding.logo_url || undefined,
          primary_color: branding.primary_color,
          secondary_color: branding.secondary_color,
        },
      });
      queryClient.invalidateQueries({ queryKey: ['pricingProposal', companyId, localCustomer, localSite] });
      toast.success('Proposal sent', { description: 'Proposed parameters saved and notification email sent.' });
    } catch (e) {
      toast.error('Failed to send proposal', { description: e?.message || 'Please try again.' });
    } finally {
      setSendProposalLoading(false);
    }
  }, [companyId, userEmail, submitProposalPayload, resolveBrandingForPricingReport, queryClient, localCustomer, localSite]);

  /** Build email HTML matching sendEmailReport.ts theme: same colors, gradient, footer. */
  const buildReportHtml = useCallback((branding) => {
    const primaryColor = branding?.primary_color || DEFAULT_PRIMARY;
    const secondaryColor = branding?.secondary_color || DEFAULT_SECONDARY;
    const companyName = branding?.company_name || 'ELORA Solutions';
    const logoUrl = branding?.logo_url || null;
    const generated = new Date().toLocaleString();
    const content = `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);border-left:4px solid #e2e8f0;border-collapse:collapse;">
        <tr><td style="padding:16px 20px;">
          <p style="color:#64748b;font-size:12px;margin:0;">Site context</p>
          <p style="color:#0f172a;font-size:15px;font-weight:600;margin:4px 0 0 0;">${truckCount} trucks · $${pricePerLitre.toFixed(2)}/L · ${dispensingRate}L/60s</p>
        </td></tr>
      </table>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);border-left:4px solid #94a3b8;">
        <tr><td style="padding:18px 20px;">
          <p style="color:#475569;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 10px 0;">Current parameters</p>
          <p style="color:#0f172a;font-size:15px;margin:0;">Wash time <strong>${currentWashTime}s</strong> · Washes/day <strong>${currentWashesPerDay}</strong> · Washes/week <strong>${currentWashesPerWeek}</strong></p>
          <p style="color:#64748b;font-size:13px;margin:10px 0 0 0;">Max cost/month (site): <strong style="color:#0f172a;">$${currentCalc.maxCostPerMonthSite.toFixed(2)}</strong> · Max cost/year: <strong style="color:#0f172a;">$${currentCalc.maxCostPerYearSite.toFixed(2)}</strong></p>
        </td></tr>
      </table>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);border-left:4px solid ${primaryColor};">
        <tr><td style="padding:18px 20px;">
          <p style="color:#334155;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 10px 0;">Proposed parameters</p>
          <p style="color:#0f172a;font-size:15px;margin:0;">Wash time <strong>${proposedWashTime}s</strong> · Washes/day <strong>${proposedWashesPerDay}</strong> · Washes/week <strong>${proposedWashesPerWeek}</strong></p>
          <p style="color:#64748b;font-size:13px;margin:10px 0 0 0;">Max cost/month (site): <strong style="color:${primaryColor};">$${proposedCalc.maxCostPerMonthSite.toFixed(2)}</strong> · Max cost/year: <strong style="color:${primaryColor};">$${proposedCalc.maxCostPerYearSite.toFixed(2)}</strong></p>
        </td></tr>
      </table>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);border-left:4px solid ${secondaryColor};">
        <tr><td style="padding:18px 20px;">
          <p style="color:#334155;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 10px 0;">Projected savings</p>
          <p style="color:#0f172a;font-size:15px;margin:0;">Per site/month <strong style="color:#059669;">$${savings.perSiteMonth.toFixed(2)}</strong> · Per site/year <strong style="color:#059669;">$${savings.perSiteYear.toFixed(2)}</strong></p>
          <p style="color:#047857;font-size:14px;font-weight:700;margin:8px 0 0 0;">Total saving: ${savings.pct}%</p>
        </td></tr>
      </table>`;
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pricing Calculator Report</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:680px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
    <div style="background:linear-gradient(135deg,${primaryColor} 0%,${secondaryColor} 100%);padding:24px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <td style="width:28%;vertical-align:middle;text-align:left;">
            <div style="display:inline-flex;align-items:center;gap:12px;">
              ${logoUrl ? `<img src="${logoUrl}" alt="" style="max-height:36px;max-width:120px;object-fit:contain;filter:brightness(0) invert(1);" />` : ''}
              <span style="color:rgba(255,255,255,0.98);font-size:14px;font-weight:600;">${companyName}</span>
            </div>
          </td>
          <td style="width:44%;vertical-align:middle;text-align:center;">
            <h1 style="color:rgba(255,255,255,0.98);margin:0;font-size:24px;font-weight:700;">Pricing Calculator Report</h1>
            <p style="color:rgba(255,255,255,0.75);margin:4px 0 0 0;font-size:12px;">${customerName} · ${siteName}</p>
            <p style="color:rgba(255,255,255,0.7);margin:2px 0 0 0;font-size:11px;">Generated ${generated}</p>
          </td>
          <td style="width:28%;vertical-align:middle;text-align:center;">
            <div style="display:inline-block;text-align:center;">
              <div style="margin-bottom:6px;"><img src="${ELORA_LOGO_URL}" alt="" style="height:32px;width:auto;object-fit:contain;display:block;margin:0 auto;" /></div>
              <span style="color:rgba(255,255,255,0.85);font-size:11px;font-weight:600;">Powered by Elora Solutions</span>
            </div>
          </td>
        </tr>
      </table>
      <div style="margin-top:12px;text-align:center;">
        <div style="height:3px;width:60px;background:linear-gradient(90deg,${primaryColor} 0%,${secondaryColor} 100%);border-radius:2px;margin:0 auto;display:inline-block;"></div>
      </div>
    </div>
    <div style="padding:40px 30px;">${content}</div>
    <div style="background:#f8fafc;padding:30px 20px;text-align:center;border-top:2px solid #e2e8f0;">
      <p style="color:#64748b;font-size:14px;margin:0 0 10px 0;">This is an automated report from ${companyName} Compliance Portal</p>
      <p style="color:#94a3b8;font-size:12px;margin:0;">© ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
  }, [customerName, siteName, truckCount, pricePerLitre, dispensingRate, currentWashTime, currentWashesPerDay, currentWashesPerWeek, currentCalc, proposedWashTime, proposedWashesPerDay, proposedWashesPerWeek, proposedCalc, savings]);

  const buildPdfDoc = useCallback(() => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 36;
    let y = 0;

    // Header bar (match sendEmailReport.ts: #7CB342 primary)
    doc.setFillColor(124, 179, 66);
    doc.rect(0, 0, pageWidth, 52, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Pricing Calculator Report', margin, 28);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`${customerName} · ${siteName}`, margin, 44);
    y = 68;

    // Generated line
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
    y += 22;

    const borderColor = { r: 226, g: 232, b: 240 };
    doc.setDrawColor(borderColor.r, borderColor.g, borderColor.b);
    doc.setLineWidth(0.5);

    // Site context box
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, pageWidth - margin * 2, 36, 'FD');
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.text(`Site context: ${truckCount} trucks · $${pricePerLitre.toFixed(2)}/L · ${dispensingRate}L/60s`, margin + 12, y + 14);
    doc.setFont('helvetica', 'normal');
    y += 48;

    // Current parameters box
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, pageWidth - margin * 2, 50, 'FD');
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('CURRENT PARAMETERS', margin + 12, y + 16);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`Wash time ${currentWashTime}s · Washes/day ${currentWashesPerDay} · Washes/week ${currentWashesPerWeek}`, margin + 12, y + 32);
    doc.text(`Max cost/month (site): $${currentCalc.maxCostPerMonthSite.toFixed(2)} · Max cost/year: $${currentCalc.maxCostPerYearSite.toFixed(2)}`, margin + 12, y + 46);
    y += 62;

    // Proposed parameters box
    doc.setFillColor(239, 246, 255);
    doc.rect(margin, y, pageWidth - margin * 2, 50, 'FD');
    doc.setTextColor(124, 179, 66);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('PROPOSED PARAMETERS', margin + 12, y + 16);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`Wash time ${proposedWashTime}s · Washes/day ${proposedWashesPerDay} · Washes/week ${proposedWashesPerWeek}`, margin + 12, y + 32);
    doc.setTextColor(124, 179, 66);
    doc.setTextColor(124, 179, 66);
    doc.text(`Max cost/month (site): $${proposedCalc.maxCostPerMonthSite.toFixed(2)} · Max cost/year: $${proposedCalc.maxCostPerYearSite.toFixed(2)}`, margin + 12, y + 46);
    doc.setTextColor(15, 23, 42);
    y += 62;

    // Projected savings box
    doc.setFillColor(236, 253, 245);
    doc.rect(margin, y, pageWidth - margin * 2, 44, 'FD');
    doc.setTextColor(4, 120, 87);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('PROJECTED SAVINGS', margin + 12, y + 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(`Per site/month: $${savings.perSiteMonth.toFixed(2)} · Per site/year: $${savings.perSiteYear.toFixed(2)}`, margin + 12, y + 32);
    doc.setTextColor(5, 150, 105);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total saving: ${savings.pct}%`, margin + 12, y + 46);
    y += 58;

    // Footer
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageWidth - margin, y);
    y += 16;
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Pricing Calculator Report', margin, y);
    doc.text(`© ${new Date().getFullYear()} ELORA Solutions. All rights reserved.`, margin, y + 12);

    return doc;
  }, [customerName, siteName, truckCount, pricePerLitre, dispensingRate, currentWashTime, currentWashesPerDay, currentWashesPerWeek, currentCalc, proposedWashTime, proposedWashesPerDay, proposedWashesPerWeek, proposedCalc, savings]);

  const handleExportPdf = useCallback(() => {
    setExportPdfLoading(true);
    try {
      const doc = buildPdfDoc();
      doc.save(`pricing-calculator-${customerName.replace(/\s+/g, '-')}-${siteName.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('PDF exported', { description: 'Calculator report downloaded.' });
    } finally {
      setExportPdfLoading(false);
    }
  }, [customerName, siteName, buildPdfDoc]);

  const handleEmailReport = useCallback(async () => {
    if (!userEmail) {
      toast.error('Cannot email report', { description: 'Your email address was not found.' });
      return;
    }
    setEmailReportLoading(true);
    try {
      const branding = await resolveBrandingForPricingReport();
      const doc = buildPdfDoc();
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const pdfFilename = `pricing-calculator-${customerName.replace(/\s+/g, '-')}-${siteName.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`;
      await callEdgeFunction('sendPricingCalculatorReport', {
        to: userEmail,
        subject: `Pricing Calculator Report — ${customerName} · ${siteName}`,
        html: buildReportHtml(branding),
        pdfBase64,
        pdfFilename,
      });
      toast.success('Report sent', { description: `Email sent to ${userEmail}.` });
    } catch (e) {
      toast.error('Failed to send email report', { description: e?.message || 'Please try again.' });
    } finally {
      setEmailReportLoading(false);
    }
  }, [userEmail, customerName, siteName, resolveBrandingForPricingReport, buildPdfDoc, buildReportHtml]);

  if (hasSite && isLoading) {
    return <PricingCalculatorGlassySkeleton />;
  }

  return (
    <div className="space-y-6 relative">
      <ActionLoaderOverlay show={actionLoading} message={actionMessage} />
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-3">Select Customer & Site</h3>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label>Customer</Label>
            <Select value={localCustomer || '_all'} onValueChange={(v) => { setLocalCustomer(v === '_all' ? '' : v); setLocalSite(''); }}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Select customer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All Customers</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id || c.ref} value={c.id || c.ref}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Site</Label>
            <Select value={localSite || '_all'} onValueChange={(v) => setLocalSite(v === '_all' ? '' : v)} disabled={!localCustomer}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Select site" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All Sites</SelectItem>
                {sites.map((s) => (
                  <SelectItem key={s.id || s.ref} value={s.id || s.ref}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {hasSite && (
            <div className="flex flex-wrap gap-6 ml-4">
              <div>
                <p className="text-xs text-muted-foreground">Trucks Allocated</p>
                <p className="text-lg font-semibold">{isLoading ? '…' : truckCount}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Dispensing Rate</p>
                <p className="text-lg font-semibold">{siteMetrics.dispensingLabel}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Price / Litre</p>
                <p className="text-lg font-semibold">${siteMetrics.pricePerLitre.toFixed(2)}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {hasSite && (
        <>
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Current Scan Card Parameters</p>
            <div className="flex flex-wrap gap-4">
              <Card className="flex-1 min-w-[100px]">
                <CardContent className="pt-4 pb-4 text-center">
                  <p className="text-2xl font-bold text-foreground">{currentWashTime}s</p>
                  <p className="text-xs text-muted-foreground">Wash Time</p>
                </CardContent>
              </Card>
              <Card className="flex-1 min-w-[100px]">
                <CardContent className="pt-4 pb-4 text-center">
                  <p className="text-2xl font-bold text-foreground">{currentWashesPerDay}</p>
                  <p className="text-xs text-muted-foreground">Washes / Day</p>
                </CardContent>
              </Card>
              <Card className="flex-1 min-w-[100px]">
                <CardContent className="pt-4 pb-4 text-center">
                  <p className="text-2xl font-bold text-foreground">{currentWashesPerWeek}</p>
                  <p className="text-xs text-muted-foreground">Washes / Week</p>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardList className="w-4 h-4" />
                  Current Parameters
                </CardTitle>
                <p className="text-xs text-muted-foreground">From scan card (read-only)</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Wash Time (seconds)</Label>
                    <div className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm">{currentWashTime}</div>
                  </div>
                  <div className="space-y-2">
                    <Label>Litres Per Wash</Label>
                    <div className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm">{currentCalc.litresPerWash}L</div>
                    <p className="text-xs text-muted-foreground">({currentWashTime}s ÷ 60) × {dispensingRate}L = {currentCalc.litresPerWash}L</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Max Washes / Day</Label>
                    <div className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm">{currentWashesPerDay}</div>
                  </div>
                  <div className="space-y-2">
                    <Label>Max Washes / Week</Label>
                    <div className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm">{currentWashesPerWeek}</div>
                  </div>
                </div>
                <div className="rounded-lg bg-muted/50 p-4 space-y-2 text-sm">
                  <p>Max litres / week / truck: <strong>{currentCalc.maxLitresPerWeekPerTruck}L</strong></p>
                  <p>Max litres / month / truck: <strong>{currentCalc.maxLitresPerMonthPerTruck}L</strong></p>
                  <p>Max cost / month / truck: <strong>${currentCalc.maxCostPerMonthPerTruck.toFixed(2)}</strong></p>
                  <p>Max cost / month / site ({truckCount} trucks): <strong>${currentCalc.maxCostPerMonthSite.toFixed(2)}</strong></p>
                  <p>Max cost / year / site: <strong>${currentCalc.maxCostPerYearSite.toFixed(2)}</strong></p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Proposed Parameters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Wash Time (seconds)</Label>
                    <Input 
                      type="number" 
                      min={15} 
                      max={600} 
                      value={proposedWashTime} 
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || val === null) {
                          setProposedWashTime('');
                        } else {
                          setProposedWashTime(Number(val) || 60);
                        }
                      }}
                      onBlur={(e) => {
                        if (e.target.value === '' || e.target.value === null) {
                          setProposedWashTime(60);
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Litres Per Wash</Label>
                    <Input readOnly value={`${proposedCalc.litresPerWash}L`} className="bg-primary/5 text-primary font-medium" />
                    <p className="text-xs text-muted-foreground">({proposedWashTime}s ÷ 60) × {dispensingRate}L = {proposedCalc.litresPerWash}L</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Max Washes / Day</Label>
                    <Input 
                      type="number" 
                      min={1} 
                      max={20} 
                      value={proposedWashesPerDay} 
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || val === null) {
                          setProposedWashesPerDay('');
                        } else {
                          setProposedWashesPerDay(Number(val) || 2);
                        }
                      }}
                      onBlur={(e) => {
                        if (e.target.value === '' || e.target.value === null) {
                          setProposedWashesPerDay(2);
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Washes / Week</Label>
                    <Input 
                      type="number" 
                      min={1} 
                      max={50} 
                      value={proposedWashesPerWeek} 
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || val === null) {
                          setProposedWashesPerWeek('');
                        } else {
                          setProposedWashesPerWeek(Number(val) || 3);
                        }
                      }}
                      onBlur={(e) => {
                        if (e.target.value === '' || e.target.value === null) {
                          setProposedWashesPerWeek(3);
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="rounded-lg bg-primary/5 p-4 space-y-2 text-sm text-primary">
                  <p>Max litres / week / truck: <strong>{proposedCalc.maxLitresPerWeekPerTruck}L</strong></p>
                  <p>Max litres / month / truck: <strong>{proposedCalc.maxLitresPerMonthPerTruck}L</strong></p>
                  <p>Max cost / month / truck: <strong>${proposedCalc.maxCostPerMonthPerTruck.toFixed(2)}</strong></p>
                  <p>Max cost / month / site ({truckCount} trucks): <strong>${proposedCalc.maxCostPerMonthSite.toFixed(2)}</strong></p>
                  <p>Max cost / year / site: <strong>${proposedCalc.maxCostPerYearSite.toFixed(2)}</strong></p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" onClick={handleSaveProposal} className="w-full sm:w-auto" disabled={actionLoading}>
                    {saveProposalLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Save proposed parameters
                  </Button>
                  <Button onClick={handleSendProposal} className="w-full sm:w-auto" disabled={actionLoading}>
                    {sendProposalLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                    Send proposal
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-green-200 dark:border-green-900/50 bg-green-50/50 dark:bg-green-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Projected Savings — {customerName} · {siteName}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Per Truck / Month</p>
                  <p className="text-xl font-bold text-green-700 dark:text-green-400">${savings.perTruckMonth.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">{savings.pct}% reduction</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Per Site / Day</p>
                  <p className="text-xl font-bold text-green-700 dark:text-green-400">${savings.perSiteDay.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">{truckCount} trucks</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Per Site / Month</p>
                  <p className="text-xl font-bold text-green-700 dark:text-green-400">${savings.perSiteMonth.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">vs ${currentCalc.maxCostPerMonthSite.toFixed(2)} current</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Per Site / Year</p>
                  <p className="text-xl font-bold text-green-700 dark:text-green-400">${savings.perSiteYear.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Annual saving</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-green-200 dark:border-green-800">
                <p className="text-xs text-muted-foreground">Total Saving %</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">{savings.pct}%</p>
                <p className="text-xs text-muted-foreground">cost reduction</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Reverse Calculator — Set a Budget, Get Parameters</CardTitle>
              <p className="text-sm text-muted-foreground">Enter your target monthly spend and we'll calculate the scan card parameters needed to achieve it.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-2">
                  <Label>Target Monthly Budget (Site)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={100}
                    value={targetBudget}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || val === null) {
                        setTargetBudget('');
                      } else {
                        setTargetBudget(Number(val) || 0);
                      }
                    }}
                    onBlur={(e) => {
                      if (e.target.value === '' || e.target.value === null) {
                        setTargetBudget(0);
                      }
                    }}
                    className="w-[180px]"
                  />
                </div>
                <Button onClick={runReverseCalculator}>Calculate Parameters →</Button>
              </div>
              {reverseOptions && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Option A — Reduce Wash Time</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{reverseOptions.optionA.washTime}s wash time · {reverseOptions.optionA.washesPerDay}/day · {reverseOptions.optionA.washesPerWeek}/week</p>
                      <p className="text-lg font-bold text-primary mt-2">${reverseOptions.optionA.cost.toFixed(0)}/mo</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Option B — Reduce Washes/Week</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{reverseOptions.optionB.washTime}s wash time · {reverseOptions.optionB.washesPerDay}/day · {reverseOptions.optionB.washesPerWeek}/week</p>
                      <p className="text-lg font-bold text-primary mt-2">${reverseOptions.optionB.cost.toFixed(0)}/mo</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Option C — Combined</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{reverseOptions.optionC.washTime}s wash time · {reverseOptions.optionC.washesPerDay}/day · {reverseOptions.optionC.washesPerWeek}/week</p>
                      <p className="text-lg font-bold text-primary mt-2">${reverseOptions.optionC.cost.toFixed(0)}/mo</p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-3">
            <Button variant="default" onClick={handleExportPdf} disabled={actionLoading}>
              {exportPdfLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
              Export Calculator Report as PDF
            </Button>
            <Button variant="outline" onClick={handleEmailReport} disabled={actionLoading}>
              {emailReportLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
              Email Report to Me
            </Button>
          </div>
        </>
      )}

      {!hasSite && (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 py-12 text-center">
          <p className="text-muted-foreground">Select a customer and site above to use the pricing calculator.</p>
        </div>
      )}
    </div>
  );
}
