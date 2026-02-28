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
import { customersOptions, sitesOptions, vehiclesOptions, pricingConfigOptions, scansOptions } from '@/query/options';
import { getStateFromSite, getPricingDetails, buildSitePricingMaps, buildVehicleWashTimeMaps, calculateScanCostFromScan, isBillableScan, formatDateRangeDisplay } from './usageCostUtils';
import { callEdgeFunction, supabase } from '@/lib/supabase';
import { supabaseClient } from '@/api/supabaseClient';
import { toast } from '@/lib/toast';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { PricingCalculatorGlassySkeleton, ActionLoaderOverlay } from './UsageCostsSkeletons';

const ELORA_LOGO_URL = 'https://yyqspdpk0yebvddv.public.blob.vercel-storage.com/233633501.png';
// Match functions/sendEmailReport.ts theme (ELORA Solutions branding)
const DEFAULT_PRIMARY = '#7CB342';
const DEFAULT_SECONDARY = '#9CCC65';

const DEFAULT_DISPENSING_RATE_L_PER_60S = 5;
const WEEKS_PER_MONTH = 52 / 12;

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
  const [pdfHtml, setPdfHtml] = useState('');
  const pdfContainerRef = useRef(null);
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

  // Pricing configuration from DB: tank_configurations + products
  const { data: pricingConfig } = useQuery(pricingConfigOptions());

  const hasSite = !!localCustomer && !!localSite;
  const truckCount = vehicles?.length ?? 0;

  const { data: scansData } = useQuery({
    ...scansOptions(companyId, {
      startDate: dateRange?.start,
      endDate: dateRange?.end,
      customerId: hasSite ? localCustomer : undefined,
      siteId: hasSite ? localSite : undefined,
      status: 'success,exceeded',
      export: true,
    }),
    enabled: !!companyId && hasSite && !!dateRange?.start && !!dateRange?.end,
  });

  const scans = useMemo(() => {
    const raw = scansData;
    if (Array.isArray(raw)) return raw;
    if (raw?.data) return raw.data;
    return [];
  }, [scansData]);

  const entitlementMaps = useMemo(() => {
    const list = vehicles ?? [];
    return buildVehicleWashTimeMaps(list);
  }, [vehicles]);

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

  const state = useMemo(() => getStateFromSite(siteName, customerName), [siteName, customerName]);

  // Build site-level pricing maps (flow rate + product price) from DB config
  const sitePricingMaps = useMemo(
    () =>
      buildSitePricingMaps(
        pricingConfig?.tankConfigs ?? [],
        pricingConfig?.products ?? [],
      ),
    [pricingConfig],
  );

  const fallbackPricing = useMemo(
    () => getPricingDetails(customerName, state),
    [customerName, state],
  );

  // Resolve dispensing rate (L/60s) + price per litre from DB when available,
  // falling back to regional PRICING_RULES (backward compatible).
  const dbPricingSample = useMemo(() => {
    const hasMaps =
      sitePricingMaps &&
      (Object.keys(sitePricingMaps.byDeviceSerial || {}).length > 0 ||
        Object.keys(sitePricingMaps.bySiteRef || {}).length > 0 ||
        (sitePricingMaps.products || []).length > 0);
    if (!hasMaps) return null;
    if (!customerName && !siteName) return null;
    // Synthetic scan row – calculateScanCostFromScan will use sitePricingMaps
    // to resolve litresPerMinute and pricePerLitre for this customer/site.
    return calculateScanCostFromScan(
      {
        customerName,
        customer_name: customerName,
        siteName,
        site_name: siteName,
      },
      null,
      sitePricingMaps,
    );
  }, [sitePricingMaps, customerName, siteName]);

  const pricePerLitre = dbPricingSample?.pricePerLitre ?? fallbackPricing.pricePerLitre ?? 3.85;
  const dispensingRate =
    dbPricingSample?.litresPerMinute ??
    fallbackPricing.litres ??
    DEFAULT_DISPENSING_RATE_L_PER_60S;

  const siteMetrics = useMemo(
    () => ({
      truckCount,
      dispensingRate,
      pricePerLitre,
      dispensingLabel: `${dispensingRate}L / 60s`,
    }),
    [truckCount, dispensingRate, pricePerLitre],
  );

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

  const pMaps = sitePricingMaps?.byDeviceSerial != null ? sitePricingMaps : null;
  const hasMaps = entitlementMaps && (Object.keys(entitlementMaps.byRef || {}).length > 0 || Object.keys(entitlementMaps.byRfid || {}).length > 0);
  const mapsForCost = hasMaps ? entitlementMaps : null;

  const historicalActualVsMax = useMemo(() => {
    if (!hasSite || !dateRange?.start || !dateRange?.end || currentCalc.maxCostPerMonthSite <= 0) return null;
    const billable = scans.filter((s) => isBillableScan(s));
    let actualSpend = 0;
    billable.forEach((scan) => {
      const pricing = calculateScanCostFromScan(scan, mapsForCost, pMaps);
      actualSpend += pricing.cost ?? 0;
    });
    actualSpend = round2(actualSpend);
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    const daysInRange = Math.max(1, Math.round((end - start) / (24 * 60 * 60 * 1000)) + 1);
    const maxForPeriod = round2(currentCalc.maxCostPerMonthSite * (daysInRange / 30));
    const pctOfMax = maxForPeriod > 0 ? round2((actualSpend / maxForPeriod) * 100) : 0;
    return {
      actualSpend,
      maxForPeriod,
      pctOfMax: Math.min(100, pctOfMax),
      daysInRange,
      scanCount: billable.length,
    };
  }, [hasSite, dateRange?.start, dateRange?.end, scans, currentCalc.maxCostPerMonthSite, mapsForCost, pMaps]);

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

  const extractBodyHtml = (html) => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      return doc.body?.innerHTML || html;
    } catch {
      return html;
    }
  };

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
    // Ensure each option's cost never exceeds the user's target budget (always at or under).
    const optionA = (() => {
      const washesPerWeek = currentWashesPerWeek;
      const litresPerWashNeeded = targetLitresPerWeekPerTruck / washesPerWeek;
      const washTimeSec = (litresPerWashNeeded / disp) * 60;
      let washTimeRounded = Math.max(30, Math.min(300, Math.round(washTimeSec / 6) * 6));
      let recalc = calcFromParams(washTimeRounded, currentWashesPerDay, washesPerWeek, disp, pricePerLitre, effectiveTruckCount);
      while (recalc.maxCostPerMonthSite > budget && washTimeRounded > 30) {
        washTimeRounded -= 6;
        recalc = calcFromParams(washTimeRounded, currentWashesPerDay, washesPerWeek, disp, pricePerLitre, effectiveTruckCount);
      }
      return { label: 'Reduce Wash Time', washTime: washTimeRounded, washesPerDay: currentWashesPerDay, washesPerWeek, cost: recalc.maxCostPerMonthSite };
    })();
    const optionB = (() => {
      const washTimeSec = currentWashTime;
      const litresPerWash = (washTimeSec / 60) * disp;
      const washesPerWeekNeeded = targetLitresPerWeekPerTruck / litresPerWash;
      let washesPerWeekRounded = Math.max(2, Math.min(12, Math.round(washesPerWeekNeeded)));
      let recalc = calcFromParams(washTimeSec, currentWashesPerDay, washesPerWeekRounded, disp, pricePerLitre, effectiveTruckCount);
      while (recalc.maxCostPerMonthSite > budget && washesPerWeekRounded > 2) {
        washesPerWeekRounded -= 1;
        recalc = calcFromParams(washTimeSec, currentWashesPerDay, washesPerWeekRounded, disp, pricePerLitre, effectiveTruckCount);
      }
      return { label: 'Reduce Washes/Week', washTime: washTimeSec, washesPerDay: currentWashesPerDay, washesPerWeek: washesPerWeekRounded, cost: recalc.maxCostPerMonthSite };
    })();
    const optionC = (() => {
      let washTimeSec = Math.round((currentWashTime + proposedWashTime) / 2 / 6) * 6 || 90;
      const litresPerWash = (washTimeSec / 60) * disp;
      const washesPerWeekNeeded = targetLitresPerWeekPerTruck / litresPerWash;
      let washesPerWeekRounded = Math.max(2, Math.min(12, Math.round(washesPerWeekNeeded)));
      let recalc = calcFromParams(washTimeSec, currentWashesPerDay, washesPerWeekRounded, disp, pricePerLitre, effectiveTruckCount);
      while (recalc.maxCostPerMonthSite > budget && washesPerWeekRounded > 2) {
        washesPerWeekRounded -= 1;
        recalc = calcFromParams(washTimeSec, currentWashesPerDay, washesPerWeekRounded, disp, pricePerLitre, effectiveTruckCount);
      }
      while (recalc.maxCostPerMonthSite > budget && washTimeSec > 30) {
        washTimeSec -= 6;
        const lpw = (washTimeSec / 60) * disp;
        const wpwNeeded = targetLitresPerWeekPerTruck / lpw;
        washesPerWeekRounded = Math.max(2, Math.min(12, Math.round(wpwNeeded)));
        recalc = calcFromParams(washTimeSec, currentWashesPerDay, washesPerWeekRounded, disp, pricePerLitre, effectiveTruckCount);
      }
      return { label: 'Combined', washTime: washTimeSec, washesPerDay: currentWashesPerDay, washesPerWeek: washesPerWeekRounded, cost: recalc.maxCostPerMonthSite };
    })();

    // Ensure each option has a different cost and different parameters from the others.
    const sameCost = (a, b) => Math.round(a.cost) === Math.round(b.cost);
    const sameParams = (a, b) => a.washTime === b.washTime && a.washesPerWeek === b.washesPerWeek;
    const isDuplicate = (a, b) => sameCost(a, b) || sameParams(a, b);

    let outB = optionB;
    if (isDuplicate(outB, optionA)) {
      // Nudge B to a lower cost (still under budget) so it differs from A.
      let wtB = optionB.washTime;
      let wpwB = optionB.washesPerWeek;
      while (wpwB > 2) {
        wpwB -= 1;
        const recalc = calcFromParams(wtB, currentWashesPerDay, wpwB, disp, pricePerLitre, effectiveTruckCount);
        if (recalc.maxCostPerMonthSite <= budget && (Math.round(recalc.maxCostPerMonthSite) !== Math.round(optionA.cost) || (wtB !== optionA.washTime || wpwB !== optionA.washesPerWeek))) {
          outB = { label: 'Reduce Washes/Week', washTime: wtB, washesPerDay: currentWashesPerDay, washesPerWeek: wpwB, cost: recalc.maxCostPerMonthSite };
          break;
        }
      }
      if (isDuplicate(outB, optionA) && wtB > 30) {
        wtB = Math.max(30, wtB - 6);
        const recalc = calcFromParams(wtB, currentWashesPerDay, outB.washesPerWeek, disp, pricePerLitre, effectiveTruckCount);
        if (recalc.maxCostPerMonthSite <= budget)
          outB = { label: 'Reduce Washes/Week', washTime: wtB, washesPerDay: currentWashesPerDay, washesPerWeek: outB.washesPerWeek, cost: recalc.maxCostPerMonthSite };
      }
    }

    let outC = optionC;
    while (isDuplicate(outC, optionA) || isDuplicate(outC, outB)) {
      let wt = outC.washTime;
      let wpw = outC.washesPerWeek;
      let changed = false;
      if (wpw > 2) {
        wpw -= 1;
        const recalc = calcFromParams(wt, currentWashesPerDay, wpw, disp, pricePerLitre, effectiveTruckCount);
        if (recalc.maxCostPerMonthSite <= budget) {
          outC = { label: 'Combined', washTime: wt, washesPerDay: currentWashesPerDay, washesPerWeek: wpw, cost: recalc.maxCostPerMonthSite };
          changed = true;
        }
      }
      if (!changed && wt > 30) {
        wt -= 6;
        const lpw = (wt / 60) * disp;
        const wpwNeeded = targetLitresPerWeekPerTruck / lpw;
        wpw = Math.max(2, Math.min(12, Math.round(wpwNeeded)));
        const recalc = calcFromParams(wt, currentWashesPerDay, wpw, disp, pricePerLitre, effectiveTruckCount);
        if (recalc.maxCostPerMonthSite <= budget) {
          outC = { label: 'Combined', washTime: wt, washesPerDay: currentWashesPerDay, washesPerWeek: wpw, cost: recalc.maxCostPerMonthSite };
          changed = true;
        }
      }
      if (!changed) break;
    }

    setReverseOptions({ optionA, optionB: outB, optionC: outC });
  };

  // When the user clicks one of the suggested reverse-calculator options,
  // apply those parameters into the Proposed section so they can be saved
  // or sent as a proposal.
  const applyReverseOption = useCallback(
    (option) => {
      if (!option) return;
      setProposedWashTime(option.washTime);
      setProposedWashesPerDay(option.washesPerDay);
      setProposedWashesPerWeek(option.washesPerWeek);
      // proposedCalc + savings are derived from these state values via useMemo
    },
    [],
  );

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

  /** Build email HTML for Pricing Calculator report (used in email body only). */
  const buildEmailHtml = useCallback((branding) => {
    const primaryColor = branding?.primary_color || '#004E2B';
    const secondaryColor = branding?.secondary_color || '#00DD39';
    const companyName = branding?.company_name || 'ELORA System';
    const logoUrl = branding?.logo_url || '';
    const generated = new Date().toLocaleString();

    const cardsHtml = `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 12px 0;border-collapse:separate;border-spacing:12px 0;">
        <tr>
          <td style="width:25%;vertical-align:top;">
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;">
              <div style="color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;margin:0 0 4px 0;">Site context</div>
              <div style="color:#0f172a;font-size:16px;font-weight:700;margin:0 0 2px 0;">${truckCount} trucks</div>
              <div style="color:#94a3b8;font-size:11px;margin:0;">$${pricePerLitre.toFixed(2)}/L · ${dispensingRate}L/60s</div>
            </div>
          </td>
          <td style="width:25%;vertical-align:top;">
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;">
              <div style="color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;margin:0 0 4px 0;">Current / Month</div>
              <div style="color:#0f172a;font-size:16px;font-weight:700;margin:0 0 2px 0;">$${currentCalc.maxCostPerMonthSite.toFixed(2)}</div>
              <div style="color:#94a3b8;font-size:11px;margin:0;">Max cost this site</div>
            </div>
          </td>
          <td style="width:25%;vertical-align:top;">
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;">
              <div style="color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;margin:0 0 4px 0;">Proposed / Month</div>
              <div style="color:#0f172a;font-size:16px;font-weight:700;margin:0 0 2px 0;">$${proposedCalc.maxCostPerMonthSite.toFixed(2)}</div>
              <div style="color:#94a3b8;font-size:11px;margin:0;">After changes</div>
            </div>
          </td>
          <td style="width:25%;vertical-align:top;">
            <div style="background:#ecfdf5;border:1px solid #bbf7d0;border-radius:10px;padding:14px 16px;">
              <div style="color:#16a34a;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;margin:0 0 4px 0;">Projected Savings</div>
              <div style="color:#166534;font-size:16px;font-weight:700;margin:0 0 2px 0;">$${savings.perSiteMonth.toFixed(2)}</div>
              <div style="color:#4b5563;font-size:11px;margin:0;">Per month · ${savings.pct}%</div>
            </div>
          </td>
        </tr>
      </table>
    `;

    const detailHtml = `
      <div style="margin-top:16px;">
        <h2 style="color:#0f172a;font-size:15px;font-weight:700;margin:5px 0 8px 10px;">Parameters</h2>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:8px 12px;font-size:11px;color:#6b7280;text-align:left;text-transform:uppercase;letter-spacing:0.5px;">Metric</th>
              <th style="padding:8px 12px;font-size:11px;color:#6b7280;text-align:left;text-transform:uppercase;letter-spacing:0.5px;">Current</th>
              <th style="padding:8px 12px;font-size:11px;color:#6b7280;text-align:left;text-transform:uppercase;letter-spacing:0.5px;">Proposed</th>
            </tr>
          </thead>
          <tbody>
            <tr style="background:#ffffff;">
              <td style="padding:8px 12px;font-size:12px;color:#0f172a;border-bottom:1px solid #e5e7eb;">Wash time (seconds)</td>
              <td style="padding:8px 12px;font-size:12px;color:#4b5563;border-bottom:1px solid #e5e7eb;">${currentWashTime}s</td>
              <td style="padding:8px 12px;font-size:12px;color:#0f172a;font-weight:600;border-bottom:1px solid #e5e7eb;">${proposedWashTime}s</td>
            </tr>
            <tr style="background:#f9fafb;">
              <td style="padding:8px 12px;font-size:12px;color:#0f172a;border-bottom:1px solid #e5e7eb;">Washes per day</td>
              <td style="padding:8px 12px;font-size:12px;color:#4b5563;border-bottom:1px solid #e5e7eb;">${currentWashesPerDay}</td>
              <td style="padding:8px 12px;font-size:12px;color:#0f172a;font-weight:600;border-bottom:1px solid #e5e7eb;">${proposedWashesPerDay}</td>
            </tr>
            <tr style="background:#ffffff;">
              <td style="padding:8px 12px;font-size:12px;color:#0f172a;border-bottom:1px solid #e5e7eb;">Washes per week</td>
              <td style="padding:8px 12px;font-size:12px;color:#4b5563;border-bottom:1px solid #e5e7eb;">${currentWashesPerWeek}</td>
              <td style="padding:8px 12px;font-size:12px;color:#0f172a;font-weight:600;border-bottom:1px solid #e5e7eb;">${proposedWashesPerWeek}</td>
            </tr>
            <tr style="background:#f9fafb;">
              <td style="padding:8px 12px;font-size:12px;color:#0f172a;border-bottom:1px solid #e5e7eb;">Max cost / month / site</td>
              <td style="padding:8px 12px;font-size:12px;color:#4b5563;border-bottom:1px solid #e5e7eb;">$${currentCalc.maxCostPerMonthSite.toFixed(2)}</td>
              <td style="padding:8px 12px;font-size:12px;color:#0f172a;font-weight:600;border-bottom:1px solid #e5e7eb;">$${proposedCalc.maxCostPerMonthSite.toFixed(2)}</td>
            </tr>
            <tr style="background:#ffffff;">
              <td style="padding:8px 12px;font-size:12px;color:#0f172a;">Max cost / year / site</td>
              <td style="padding:8px 12px;font-size:12px;color:#4b5563;">$${currentCalc.maxCostPerYearSite.toFixed(2)}</td>
              <td style="padding:8px 12px;font-size:12px;color:#0f172a;font-weight:600;">$${proposedCalc.maxCostPerYearSite.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pricing Calculator Report</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:680px;margin:24px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 6px 20px rgba(15,23,42,0.18);">
    <header style="background:linear-gradient(160deg,#004E2B 0%,#003d22 50%,#002a17 100%);padding:0;">
      <div style="padding:20px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td style="width:28%;vertical-align:middle;text-align:center;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:4px;">
                    ${
                      logoUrl
                        ? `<img src="${logoUrl}" alt="${companyName}" style="height:28px;width:auto;object-fit:contain;display:block;margin:0 auto;" />`
                        : `<div style="height:28px;width:28px;border-radius:999px;background:#ffffff;display:block;margin:0 auto;overflow:hidden;">
                            <table role="presentation" width="100%" height="100%"><tr><td align="center" valign="middle" style="font-size:10px;font-weight:700;color:#004E2B;">${(companyName || 'ELORA').slice(0, 3).toUpperCase()}</td></tr></table>
                           </div>`
                    }
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <span style="color:rgba(255,255,255,0.98);font-size:11px;font-weight:600;">${companyName}</span>
                  </td>
                </tr>
              </table>
            </td>
            <td style="width:44%;vertical-align:middle;text-align:center;">
              <h1 style="color:rgba(255,255,255,0.98);margin:0;font-size:20px;font-weight:800;letter-spacing:-0.4px;">Pricing Calculator Report</h1>
              <p style="color:rgba(255,255,255,0.74);margin:4px 0 0 0;font-size:12px;">${customerName} · ${siteName}</p>
              <div style="display:inline-block;margin-top:8px;padding:3px 12px;border-radius:999px;border:1px solid rgba(0,221,57,0.25);background:rgba(0,221,57,0.12);color:#bbf7d0;font-size:10px;font-weight:600;letter-spacing:0.3px;">
                ${generated}
              </div>
            </td>
            <td style="width:28%;vertical-align:middle;text-align:center;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:4px;">
                    <img src="${ELORA_LOGO_URL}" alt="Elora" style="height:28px;width:auto;object-fit:contain;display:block;margin:0 auto;" />
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <span style="color:rgba(255,255,255,0.9);font-size:11px;font-weight:600;letter-spacing:0.3px;">Elora Solutions</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
      <div style="height:3px;background:linear-gradient(90deg,#00DD39,#7cc43e);"></div>
    </header>
    <main style="padding:24px 56px 32px 56px;">
      <p style="color:#475569;font-size:14px;line-height:1.6;margin:5px 0 16px 10px;">
        Here is your pricing calculator snapshot for <span style="font-weight:600;color:#0f172a;">${customerName} · ${siteName}</span>.
      </p>
      ${cardsHtml}
      ${detailHtml}
    </main>
    <footer style="background:linear-gradient(180deg,#f7f8fa,#f0faf5);padding:18px 24px;border-top:1px solid #d1e8da;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <td align="left" style="vertical-align:middle;padding:4px 0;">
            <p style="color:#64748b;font-size:12px;margin:0;">This automated email was sent from the ${companyName} Compliance Portal.</p>
          </td>
          <td align="right" style="vertical-align:middle;padding:4px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;display:inline-table;">
              <tr>
                <td style="vertical-align:middle;padding-right:6px;">
                  <img src="${ELORA_LOGO_URL}" alt="Elora" style="height:18px;width:auto;object-fit:contain;display:block;" />
                </td>
                <td style="vertical-align:middle;">
                  <span style="color:#64748b;font-size:11px;font-weight:500;white-space:nowrap;">Powered by ELORA · © ${new Date().getFullYear()}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </footer>
  </div>
</body>
</html>
    `;
  }, [customerName, siteName, truckCount, pricePerLitre, dispensingRate, currentWashTime, currentWashesPerDay, currentWashesPerWeek, currentCalc, proposedWashTime, proposedWashesPerDay, proposedWashesPerWeek, proposedCalc, savings]);

  /** Build report HTML for PDF capture (matches Scenario Builder PDF theme). */
  const buildReportHtml = useCallback((branding) => {
    const primaryColor = branding?.primary_color || '#004E2B';
    const secondaryColor = branding?.secondary_color || '#00DD39';
    const companyName = branding?.company_name || 'ELORA System';
    const logoUrl = branding?.logo_url || '';
    const generated = new Date().toLocaleString();

    const cardsHtml = `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 16px 0;border-collapse:separate;border-spacing:12px 0;">
        <tr>
          <td style="width:25%;vertical-align:top;">
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;">
              <div style="color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;margin:0 0 4px 0;">Site context</div>
              <div style="color:#0f172a;font-size:16px;font-weight:700;margin:0 0 2px 0;">${truckCount} trucks</div>
              <div style="color:#94a3b8;font-size:11px;margin:0;">$${pricePerLitre.toFixed(2)}/L · ${dispensingRate}L/60s</div>
            </div>
          </td>
          <td style="width:25%;vertical-align:top;">
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;">
              <div style="color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;margin:0 0 4px 0;">Current / Month</div>
              <div style="color:#0f172a;font-size:16px;font-weight:700;margin:0 0 2px 0;">$${currentCalc.maxCostPerMonthSite.toFixed(2)}</div>
              <div style="color:#94a3b8;font-size:11px;margin:0;">Max cost this site</div>
            </div>
          </td>
          <td style="width:25%;vertical-align:top;">
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;">
              <div style="color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;margin:0 0 4px 0;">Proposed / Month</div>
              <div style="color:#0f172a;font-size:16px;font-weight:700;margin:0 0 2px 0;">$${proposedCalc.maxCostPerMonthSite.toFixed(2)}</div>
              <div style="color:#94a3b8;font-size:11px;margin:0;">After changes</div>
            </div>
          </td>
          <td style="width:25%;vertical-align:top;">
            <div style="background:#ecfdf5;border:1px solid #bbf7d0;border-radius:10px;padding:14px 16px;">
              <div style="color:#16a34a;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;margin:0 0 4px 0;">Projected Savings</div>
              <div style="color:#166534;font-size:16px;font-weight:700;margin:0 0 2px 0;">$${savings.perSiteMonth.toFixed(2)}</div>
              <div style="color:#4b5563;font-size:11px;margin:0;">Per month · ${savings.pct}%</div>
            </div>
          </td>
        </tr>
      </table>
    `;

    const detailHtml = `
      <div style="margin-top:20px;">
        <h2 style="color:#0f172a;font-size:16px;font-weight:700;margin:5px 0 8px 10px;">Parameters</h2>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:10px 12px;font-size:11px;color:#6b7280;text-align:left;text-transform:uppercase;letter-spacing:0.5px;">Metric</th>
              <th style="padding:10px 12px;font-size:11px;color:#6b7280;text-align:left;text-transform:uppercase;letter-spacing:0.5px;">Current</th>
              <th style="padding:10px 12px;font-size:11px;color:#6b7280;text-align:left;text-transform:uppercase;letter-spacing:0.5px;">Proposed</th>
            </tr>
          </thead>
          <tbody>
            <tr style="background:#ffffff;">
              <td style="padding:10px 12px;font-size:12px;color:#0f172a;border-bottom:1px solid #e5e7eb;">Wash time (seconds)</td>
              <td style="padding:10px 12px;font-size:12px;color:#4b5563;border-bottom:1px solid #e5e7eb;">${currentWashTime}s</td>
              <td style="padding:10px 12px;font-size:12px;color:#0f172a;font-weight:600;border-bottom:1px solid #e5e7eb;">${proposedWashTime}s</td>
            </tr>
            <tr style="background:#f9fafb;">
              <td style="padding:10px 12px;font-size:12px;color:#0f172a;border-bottom:1px solid #e5e7eb;">Washes per day</td>
              <td style="padding:10px 12px;font-size:12px;color:#4b5563;border-bottom:1px solid #e5e7eb;">${currentWashesPerDay}</td>
              <td style="padding:10px 12px;font-size:12px;color:#0f172a;font-weight:600;border-bottom:1px solid #e5e7eb;">${proposedWashesPerDay}</td>
            </tr>
            <tr style="background:#ffffff;">
              <td style="padding:10px 12px;font-size:12px;color:#0f172a;border-bottom:1px solid #e5e7eb;">Washes per week</td>
              <td style="padding:10px 12px;font-size:12px;color:#4b5563;border-bottom:1px solid #e5e7eb;">${currentWashesPerWeek}</td>
              <td style="padding:10px 12px;font-size:12px;color:#0f172a;font-weight:600;border-bottom:1px solid #e5e7eb;">${proposedWashesPerWeek}</td>
            </tr>
            <tr style="background:#f9fafb;">
              <td style="padding:10px 12px;font-size:12px;color:#0f172a;border-bottom:1px solid #e5e7eb;">Max cost / month / site</td>
              <td style="padding:10px 12px;font-size:12px;color:#4b5563;border-bottom:1px solid #e5e7eb;">$${currentCalc.maxCostPerMonthSite.toFixed(2)}</td>
              <td style="padding:10px 12px;font-size:12px;color:#0f172a;font-weight:600;border-bottom:1px solid #e5e7eb;">$${proposedCalc.maxCostPerMonthSite.toFixed(2)}</td>
            </tr>
            <tr style="background:#ffffff;">
              <td style="padding:10px 12px;font-size:12px;color:#0f172a;">Max cost / year / site</td>
              <td style="padding:10px 12px;font-size:12px;color:#4b5563;">$${currentCalc.maxCostPerYearSite.toFixed(2)}</td>
              <td style="padding:10px 12px;font-size:12px;color:#0f172a;font-weight:600;">$${proposedCalc.maxCostPerYearSite.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pricing Calculator Report</title>
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
                  logoUrl
                    ? `<img src="${logoUrl}" alt="${companyName}" style="height:32px;width:auto;object-fit:contain;display:block;" />`
                    : `<div style="height:32px;width:32px;border-radius:999px;background:#ffffff;display:flex;align-items:center;justify-content:center;overflow:hidden;">
                        <span style="font-size:11px;font-weight:700;color:#004E2B;">${(companyName || 'ELORA').slice(0, 3).toUpperCase()}</span>
                       </div>`
                }
                <span style="color:rgba(255,255,255,0.98);font-size:12px;font-weight:600;">${companyName}</span>
              </div>
            </td>
            <td style="width:44%;vertical-align:middle;text-align:center;">
              <h1 style="color:rgba(255,255,255,0.98);margin:0;font-size:24px;font-weight:800;letter-spacing:-0.5px;">Pricing Calculator Report</h1>
              <p style="color:rgba(255,255,255,0.7);margin:4px 0 0 0;font-size:12px;">${customerName} · ${siteName}</p>
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
      <span style="color:#004E2B;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Pricing Calculator</span>
      <span style="color:#004E2B;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">${truckCount} trucks</span>
    </div>
    <main style="padding:40px 44px;">
      ${cardsHtml}
      ${detailHtml}
    </main>
    <footer style="background:linear-gradient(180deg,#f7f8fa,#f0faf5);padding:24px 32px;border-top:1px solid #d1e8da;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
      <p style="color:#64748b;font-size:12px;margin:0;">This is an automated report from ${companyName} Compliance Portal</p>
      <div style="display:inline-flex;align-items:center;gap:8px;">
        <img src="${ELORA_LOGO_URL}" alt="Elora" style="height:22px;width:auto;object-fit:contain;flex-shrink:0;display:inline-block;" />
        <span style="color:#64748b;font-size:11px;font-weight:500;white-space:nowrap;">Powered by ELORA · © ${new Date().getFullYear()}</span>
      </div>
    </footer>
  </div>
</body>
</html>
    `;
  }, [customerName, siteName, truckCount, pricePerLitre, dispensingRate, currentWashTime, currentWashesPerDay, currentWashesPerWeek, currentCalc, proposedWashTime, proposedWashesPerDay, proposedWashesPerWeek, proposedCalc, savings]);

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

    const html = buildReportHtml(branding);
    setPdfHtml(extractBodyHtml(html));
    await new Promise((r) => setTimeout(r, 800));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true });
    const canvas = await captureContainerToCanvas();
    addCanvasToPdf(pdf, canvas);

    const filename = `pricing-calculator-${customerName.replace(/\s+/g, '-')}-${siteName.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`;
    return { pdf, filename };
  }, [buildReportHtml, extractBodyHtml, customerName, siteName]);

  const handleExportPdf = useCallback(async () => {
    setExportPdfLoading(true);
    try {
      const branding = await resolveBrandingForPricingReport();
      const { pdf, filename } = await buildPdfFromHtml(branding);
      pdf.save(filename);
      toast.success('PDF exported', { description: 'Calculator report downloaded.' });
    } finally {
      setExportPdfLoading(false);
    }
  }, [buildPdfFromHtml, resolveBrandingForPricingReport]);

  const handleEmailReport = useCallback(async () => {
    if (!userEmail) {
      toast.error('Cannot email report', { description: 'Your email address was not found.' });
      return;
    }
    setEmailReportLoading(true);
    try {
      const branding = await resolveBrandingForPricingReport();
      const { pdf, filename } = await buildPdfFromHtml(branding);
      const pdfBase64 = pdf.output('datauristring').split(',')[1];
      const pdfFilename = filename;
      await callEdgeFunction('sendPricingCalculatorReport', {
        to: userEmail,
        subject: `Pricing Calculator Report — ${customerName} · ${siteName}`,
        html: buildEmailHtml(branding),
        pdfBase64,
        pdfFilename,
      });
      toast.success('Report sent', { description: `Email sent to ${userEmail}.` });
    } catch (e) {
      toast.error('Failed to send email report', { description: e?.message || 'Please try again.' });
    } finally {
      setEmailReportLoading(false);
    }
  }, [userEmail, customerName, siteName, resolveBrandingForPricingReport, buildPdfFromHtml, buildEmailHtml]);

  if (hasSite && isLoading) {
    return <PricingCalculatorGlassySkeleton />;
  }

  const dateRangeLabel = dateRange ? formatDateRangeDisplay(dateRange) : '';

  return (
    <div className="space-y-6 relative">
      <ActionLoaderOverlay show={actionLoading} message={actionMessage} />
      {dateRangeLabel && (
        <p className="text-sm text-muted-foreground font-medium">Report period: {dateRangeLabel}</p>
      )}
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
                <p className="text-xs text-muted-foreground">From scan card (read-only){dateRangeLabel ? ` · ${dateRangeLabel}` : ''}</p>
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
                {historicalActualVsMax != null && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
                    <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Based on your selected period (live data)</p>
                    <p className="text-sm text-muted-foreground">
                      These max amounts assume every truck uses the full allowance. In the selected period you actually spent <strong className="text-foreground">${historicalActualVsMax.actualSpend.toFixed(2)}</strong>
                      {historicalActualVsMax.maxForPeriod > 0 ? (
                        <> ({historicalActualVsMax.pctOfMax}% of max possible for that period).</>
                      ) : (
                        '.'
                      )}
                    </p>
                    {historicalActualVsMax.maxForPeriod > 0 && (
                      <>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Actual spend vs max (period)</span>
                          <span>{historicalActualVsMax.pctOfMax}%</span>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${Math.min(100, historicalActualVsMax.pctOfMax)}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {historicalActualVsMax.scanCount} scans in period · Max for period would be ${historicalActualVsMax.maxForPeriod.toFixed(2)} if all trucks hit limit
                        </p>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Proposed Parameters
                </CardTitle>
                {dateRangeLabel && <p className="text-xs text-muted-foreground mt-0.5">{dateRangeLabel}</p>}
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
              {dateRangeLabel && <p className="text-xs text-muted-foreground mt-0.5">{dateRangeLabel}</p>}
              <p className="text-xs text-muted-foreground mt-1">Savings vs max possible spend. Your actual savings depend on how much trucks use (see live data in Current Parameters).</p>
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
              {dateRangeLabel && <p className="text-xs text-muted-foreground mt-0.5">{dateRangeLabel}</p>}
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
                  <Card
                    className="cursor-pointer hover:border-primary/60 hover:shadow-sm transition-colors"
                    onClick={() => applyReverseOption(reverseOptions.optionA)}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Option A — Reduce Wash Time</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{reverseOptions.optionA.washTime}s wash time · {reverseOptions.optionA.washesPerDay}/day · {reverseOptions.optionA.washesPerWeek}/week</p>
                      <p className="text-lg font-bold text-primary mt-2">${reverseOptions.optionA.cost.toFixed(0)}/mo</p>
                      <p className="text-xs text-muted-foreground mt-1">Click to use these as proposed parameters</p>
                    </CardContent>
                  </Card>
                  <Card
                    className="cursor-pointer hover:border-primary/60 hover:shadow-sm transition-colors"
                    onClick={() => applyReverseOption(reverseOptions.optionB)}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Option B — Reduce Washes/Week</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{reverseOptions.optionB.washTime}s wash time · {reverseOptions.optionB.washesPerDay}/day · {reverseOptions.optionB.washesPerWeek}/week</p>
                      <p className="text-lg font-bold text-primary mt-2">${reverseOptions.optionB.cost.toFixed(0)}/mo</p>
                      <p className="text-xs text-muted-foreground mt-1">Click to use these as proposed parameters</p>
                    </CardContent>
                  </Card>
                  <Card
                    className="cursor-pointer hover:border-primary/60 hover:shadow-sm transition-colors"
                    onClick={() => applyReverseOption(reverseOptions.optionC)}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Option C — Combined</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{reverseOptions.optionC.washTime}s wash time · {reverseOptions.optionC.washesPerDay}/day · {reverseOptions.optionC.washesPerWeek}/week</p>
                      <p className="text-lg font-bold text-primary mt-2">${reverseOptions.optionC.cost.toFixed(0)}/mo</p>
                      <p className="text-xs text-muted-foreground mt-1">Click to use these as proposed parameters</p>
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

      {/* Hidden PDF container for html2canvas capture */}
      <div
        ref={pdfContainerRef}
        style={{
          position: 'fixed',
          width: '860px',
          minHeight: pdfHtml ? '800px' : '0px',
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
