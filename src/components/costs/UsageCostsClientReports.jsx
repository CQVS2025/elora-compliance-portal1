import React, { useMemo, useCallback, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePermissions } from '@/components/auth/PermissionGuard';
import { customersOptions, sitesOptions, scansOptions, vehiclesOptions, pricingConfigOptions, companiesOptions, companyOptions } from '@/query/options';
import { queryKeys } from '@/query/keys';
import { calculateScanCostFromScan, isBillableScan, buildVehicleWashTimeMaps, buildSitePricingMaps, round2 } from './usageCostUtils';
import { supabaseClient } from '@/api/supabaseClient';
import { callEdgeFunction } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import moment from 'moment';
import { FileText, Mail, Calendar, Loader2 } from 'lucide-react';

const ELORA_LOGO_URL = 'https://yyqspdpk0yebvddv.public.blob.vercel-storage.com/233633501.png';
const DEFAULT_PRIMARY = '#004E2B';
const DEFAULT_SECONDARY = '#00DD39';

function formatReportCompanyName(name) {
  if (!name || typeof name !== 'string') return name || '';
  return name
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export default function UsageCostsClientReports({ selectedCustomer, selectedSite, dateRange }) {
  const permissions = usePermissions();
  const companyId = permissions.userProfile?.company_id ?? 'portal';
  const isSuperAdmin = permissions.isSuperAdmin ?? false;
  const queryClient = useQueryClient();

  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState('');
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [exportPdfLoading, setExportPdfLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const reportCardRef = useRef(null);

  // Full-period scans for report (no pagination)
  const { data: scansResult } = useQuery(
    scansOptions(companyId, {
      customerId: selectedCustomer && selectedCustomer !== 'all' ? selectedCustomer : undefined,
      siteId: selectedSite && selectedSite !== 'all' ? selectedSite : undefined,
      startDate: dateRange.start,
      endDate: dateRange.end,
      status: 'success,exceeded',
      export: true,
    })
  );

  const { data: vehiclesData } = useQuery(
    vehiclesOptions(companyId, {
      customerId: selectedCustomer && selectedCustomer !== 'all' ? selectedCustomer : undefined,
      siteId: selectedSite && selectedSite !== 'all' ? selectedSite : undefined,
    })
  );

  const { data: pricingConfig } = useQuery(pricingConfigOptions());
  const { data: customers = [] } = useQuery(customersOptions(companyId, { allTenants: isSuperAdmin }));
  const { data: sites = [] } = useQuery({
    ...sitesOptions(companyId, { customerId: selectedCustomer && selectedCustomer !== 'all' ? selectedCustomer : undefined, allTenants: isSuperAdmin }),
    enabled: !!companyId && !!selectedCustomer && selectedCustomer !== 'all',
  });
  const { data: companies = [] } = useQuery({
    ...companiesOptions(companyId),
    enabled: !!companyId && isSuperAdmin,
  });
  const { data: userCompany } = useQuery({
    ...companyOptions(companyId, companyId),
    enabled: !!companyId && !isSuperAdmin,
  });

  const scans = Array.isArray(scansResult) ? scansResult : (scansResult?.data ?? []);
  const vehiclesList = vehiclesData?.data ?? (Array.isArray(vehiclesData) ? vehiclesData : []);

  const entitlementMaps = useMemo(
    () => buildVehicleWashTimeMaps(vehiclesList),
    [vehiclesList]
  );
  const sitePricingMaps = useMemo(
    () => buildSitePricingMaps(pricingConfig?.tankConfigs ?? [], pricingConfig?.products ?? []),
    [pricingConfig]
  );

  const reportData = useMemo(() => {
    const billableScans = scans.filter((s) => isBillableScan(s));
    if (!billableScans.length) {
      const fleetSize = vehiclesList.length;
      const uniqueSites = new Set(vehiclesList.map((v) => v.site_id ?? v.siteRef).filter(Boolean));
      return {
        totalFleetSize: fleetSize,
        activeSites: uniqueSites.size,
        totalWashes: 0,
        totalProgramCost: 0,
        avgCostPerTruck: 0,
        avgCostPerWash: 0,
        complianceRate: null,
        complianceDelta: null,
      };
    }

    const hasMaps = entitlementMaps && (Object.keys(entitlementMaps.byRef || {}).length > 0 || Object.keys(entitlementMaps.byRfid || {}).length > 0);
    const maps = hasMaps ? entitlementMaps : null;
    const pMaps = sitePricingMaps?.byDeviceSerial != null ? sitePricingMaps : null;

    let totalCost = 0;
    let successCount = 0;
    const vehicleCosts = new Map();
    const siteRefs = new Set();

    billableScans.forEach((scan) => {
      const pricing = calculateScanCostFromScan(scan, maps, pMaps);
      if (pricing.configMissing) return;
      totalCost += pricing.cost;
      const status = (scan.statusLabel ?? scan.status ?? '').toString().trim().toLowerCase();
      if (status === 'success') successCount++;
      const key = `${scan.customerRef}_${scan.siteRef}_${scan.vehicleRef}`.replace(/undefined/g, '');
      if (key) {
        const cur = vehicleCosts.get(key) || 0;
        vehicleCosts.set(key, cur + pricing.cost);
      }
      if (scan.siteRef) siteRefs.add(scan.siteRef);
    });

    const totalWashes = billableScans.length;
    const fleetSize = vehicleCosts.size || vehiclesList.length;
    const activeSites = siteRefs.size || 1;
    const totalProgramCost = round2(totalCost);
    const avgCostPerTruck = fleetSize > 0 ? round2(totalProgramCost / fleetSize) : 0;
    const avgCostPerWash = totalWashes > 0 ? round2(totalProgramCost / totalWashes) : 0;
    const complianceRate = totalWashes > 0 ? Math.round((successCount / totalWashes) * 100) : null;

    return {
      totalFleetSize: fleetSize,
      activeSites: activeSites,
      totalWashes: totalWashes,
      totalProgramCost: totalProgramCost,
      avgCostPerTruck: avgCostPerTruck,
      avgCostPerWash: avgCostPerWash,
      complianceRate,
      complianceDelta: null,
    };
  }, [scans, vehiclesList, entitlementMaps, sitePricingMaps]);

  const customerName = useMemo(() => {
    if (!selectedCustomer || selectedCustomer === 'all') return 'All Customers';
    const c = customers.find((x) => (x.id || x.ref) === selectedCustomer);
    return c?.name ?? selectedCustomer;
  }, [customers, selectedCustomer]);

  const siteLabel = useMemo(() => {
    if (!selectedSite || selectedSite === 'all') return 'All Sites';
    const s = sites.find((x) => (x.id || x.ref) === selectedSite);
    return s?.name ?? selectedSite;
  }, [sites, selectedSite]);

  const reportMonthLabel = useMemo(() => {
    const start = moment(dateRange.start);
    const end = moment(dateRange.end);
    if (start.month() === end.month() && start.year() === end.year()) return start.format('MMMM YYYY');
    return `${start.format('MMM D')} – ${end.format('MMM D, YYYY')}`;
  }, [dateRange]);

  const reportCompanyNameFormatted = useMemo(() => formatReportCompanyName(customerName), [customerName]);

  const companyForBranding = useMemo(() => {
    if (selectedCustomer && selectedCustomer !== 'all' && isSuperAdmin && Array.isArray(companies)) {
      const c = companies.find((co) => co.elora_customer_ref === selectedCustomer);
      if (c) return c;
    }
    if (userCompany) return userCompany;
    if (isSuperAdmin && Array.isArray(companies)) {
      const cid = permissions.userProfile?.company_id;
      return companies.find((c) => c.id === cid) ?? null;
    }
    return null;
  }, [companies, userCompany, selectedCustomer, isSuperAdmin, permissions.userProfile?.company_id]);

  const branding = useMemo(
    () => ({
      company_name: companyForBranding?.name ?? 'ELORA Solutions',
      logo_url: companyForBranding?.logo_url ?? null,
      primary_color: companyForBranding?.primary_color ?? DEFAULT_PRIMARY,
      secondary_color: companyForBranding?.secondary_color ?? DEFAULT_SECONDARY,
    }),
    [companyForBranding]
  );

  const valueStatement = useMemo(() => {
    const { totalFleetSize, totalWashes, avgCostPerTruck } = reportData;
    if (totalFleetSize === 0 && totalWashes === 0) {
      return 'No wash activity in the selected period. Select a customer and date range to see your fleet wash program summary.';
    }
    return `Your wash program protected ${totalFleetSize} vehicles this month at an average cost of $${avgCostPerTruck.toFixed(2)} per truck. Industry estimates place concrete damage repair costs at $800–$2,500 per incident. With ${totalWashes} washes completed, your program is delivering significant protection against fleet deterioration and maintaining vehicle resale value.`;
  }, [reportData]);

  const buildReportHtml = useCallback(
    (forPdf = true, eloraLogoDataUrl = null) => {
      const { totalFleetSize, activeSites, totalWashes, avgCostPerTruck, avgCostPerWash, totalProgramCost, complianceRate } = reportData;
      const reportCompanyName = formatReportCompanyName(customerName);
      // For PDF: use embedded data URL for ELORA logo to avoid canvas taint; otherwise use external URL
      const eloraLogoSrc = forPdf ? (eloraLogoDataUrl || '') : ELORA_LOGO_URL;
      const showEloraLogo = !forPdf || !!eloraLogoDataUrl;

      const tableRows = [
        ['Total Fleet Size', `${totalFleetSize} vehicles`],
        ['Active Sites', String(activeSites)],
        ['Total Washes', String(totalWashes)],
        ['Average Cost Per Truck', `$${avgCostPerTruck.toFixed(2)}`],
        ['Average Cost Per Wash', `$${avgCostPerWash.toFixed(2)}`],
        ['Total Program Cost', `$${totalProgramCost.toFixed(2)}`],
      ];

      const tableHtml = `
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:10px 12px;font-size:11px;color:#6b7280;text-align:left;text-transform:uppercase;">METRIC</th>
              <th style="padding:10px 12px;font-size:11px;color:#6b7280;text-align:left;text-transform:uppercase;">VALUE</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows.map(([metric, value], i) => `<tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'};"><td style="padding:10px 12px;font-size:12px;color:#0f172a;border-bottom:1px solid #e5e7eb;">${metric}</td><td style="padding:10px 12px;font-size:12px;color:#374151;border-bottom:1px solid #e5e7eb;">${value}</td></tr>`).join('')}
          </tbody>
        </table>
      `;

      return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>Fleet Wash Program Report</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:820px;margin:28px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.12);">
    <header style="background:linear-gradient(160deg,#004E2B 0%,#003d22 50%,#002a17 100%);padding:28px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <td style="width:28%;vertical-align:middle;text-align:center;">
            <span style="color:rgba(255,255,255,0.98);font-size:18px;font-weight:700;letter-spacing:0.02em;">${reportCompanyName}</span>
          </td>
          <td style="width:44%;vertical-align:middle;text-align:center;">
            <h1 style="color:rgba(255,255,255,0.98);margin:0;font-size:22px;font-weight:800;">Fleet Wash Program Report</h1>
            <p style="color:rgba(255,255,255,0.8);margin:6px 0 0 0;font-size:13px;">${reportCompanyName}</p>
            <p style="color:rgba(255,255,255,0.7);margin:2px 0 0 0;font-size:12px;">${reportMonthLabel} · ${siteLabel}</p>
          </td>
          <td style="width:28%;vertical-align:middle;text-align:center;">
  <div style="display:inline-block;text-align:center;">
    <div style="margin-bottom:6px;">
      ${showEloraLogo && eloraLogoSrc
          ? `<img src="${eloraLogoSrc}" alt="ELORA" style="height:32px;width:auto;object-fit:contain;display:block;margin:0 auto;"/>`
          : `<span style="display:inline-block;padding:4px 12px;border-radius:999px;background:rgba(0,221,57,0.2);color:#bbf7d0;font-size:11px;font-weight:700;">ELORA</span>`}
    </div>
    <div style="color:rgba(255,255,255,0.85);font-size:11px;">
      Prepared by ELORA
    </div>
  </div>
</td>
        </tr>
      </table>
      <div style="height:3px;background:linear-gradient(90deg,#00DD39,#7cc43e);margin-top:12px;"></div>
    </header>
    <main style="padding:32px 40px;">
      <div style="display:table;width:100%;border-collapse:separate;border-spacing:16px 0;margin-bottom:24px;">
        <div style="display:table-cell;width:48%;vertical-align:top;">
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;">
            <div style="color:#166534;font-size:11px;font-weight:600;text-transform:uppercase;margin-bottom:4px;">Compliance Rate</div>
            <div style="color:#15803d;font-size:28px;font-weight:800;">${complianceRate != null ? complianceRate + '%' : '—'}</div>
            <div style="color:#166534;font-size:12px;">${reportData.complianceDelta != null ? `↑ ${reportData.complianceDelta}% from last month` : 'Based on wash scans in period'}</div>
          </div>
        </div>
        <div style="display:table-cell;width:48%;vertical-align:top;">
          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px;">
            <div style="color:#1e40af;font-size:11px;font-weight:600;text-transform:uppercase;margin-bottom:4px;">Total Washes</div>
            <div style="color:#1d4ed8;font-size:28px;font-weight:800;">${totalWashes}</div>
            <div style="color:#1e40af;font-size:12px;">Across ${activeSites} sites</div>
          </div>
        </div>
      </div>
      <h2 style="color:#0f172a;font-size:14px;font-weight:700;margin:0 0 12px 10px;">Monthly Cost Summary</h2>
      ${tableHtml}
      <h2 style="color:#16a34a;font-size:14px;font-weight:700;margin:24px 0 8px 10px;">Value Statement</h2>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;">
        <p style="color:#166534;font-size:13px;line-height:1.6;margin:0;">${valueStatement}</p>
      </div>
    </main>
    <footer style="background:#f8fafc;padding:16px 24px;border-top:1px solid #e2e8f0;">
      <p style="color:#64748b;font-size:11px;margin:0;">Report generated by ELORA Fleet Compliance Portal · elora.com.au</p>
    </footer>
  </div>
</body>
</html>
      `;
    },
    [reportData, branding, customerName, siteLabel, reportMonthLabel, valueStatement]
  );

  const handleExportPdf = useCallback(async () => {
    setExportPdfLoading(true);
    try {
      let eloraLogoDataUrl = null;
      try {
        const res = await fetch(ELORA_LOGO_URL, { mode: 'cors' });
        if (res.ok) {
          const blob = await res.blob();
          eloraLogoDataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        }
      } catch (_) {
        // Keep null; PDF will show text "ELORA" fallback
      }
      const fullHtml = buildReportHtml(true, eloraLogoDataUrl);
      const innerMatch = fullHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      const htmlToRender = innerMatch ? innerMatch[1].trim() : fullHtml;
      const wrapper = document.createElement('div');
      wrapper.style.background = '#f1f5f9';
      wrapper.style.padding = '24px';
      wrapper.style.position = 'absolute';
      wrapper.style.left = '-9999px';
      wrapper.style.top = '0';
      wrapper.style.width = '820px';
      wrapper.innerHTML = htmlToRender;
      document.body.appendChild(wrapper);

      const target = wrapper.firstElementChild;
      if (!target) throw new Error('Could not find report content.');
      await new Promise((r) => setTimeout(r, 150));
      const canvas = await html2canvas(target, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#f1f5f9',
        logging: false,
      });
      document.body.removeChild(wrapper);

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true });
      const imgW = pdf.internal.pageSize.getWidth();
      const imgH = (canvas.height * imgW) / canvas.width;
      const dataUrl = canvas.toDataURL('image/png');
      if (!dataUrl || dataUrl.length < 100) throw new Error('Canvas export failed.');
      pdf.addImage(dataUrl, 'PNG', 0, 0, imgW, imgH);
      const filename = `client-report-${customerName.replace(/\s+/g, '-')}-${moment(dateRange.start).format('YYYY-MM')}.pdf`;
      pdf.save(filename);
      toast.success('PDF exported', { description: 'Client report downloaded.' });
    } catch (e) {
      toast.error('Export failed', { description: e?.message || 'Could not generate PDF.' });
    } finally {
      setExportPdfLoading(false);
    }
  }, [buildReportHtml, customerName, dateRange.start]);

  const handleEmailToCustomer = useCallback(async () => {
    const to = emailRecipients.trim().split(/[\s,;]+/).filter(Boolean);
    if (to.length === 0) {
      toast.error('Enter at least one email address.');
      return;
    }
    setEmailLoading(true);
    try {
      const res = await callEdgeFunction('sendClientReport', {
        companyId: companyForBranding?.id ?? companyId,
        customerRef: selectedCustomer !== 'all' ? selectedCustomer : undefined,
        dateRange: { start: dateRange.start, end: dateRange.end },
        recipients: to,
        reportHtml: buildReportHtml(false),
        reportData,
        customerName,
        siteLabel,
        reportMonthLabel,
      });
      if (res?.error) throw new Error(res.error);
      setEmailDialogOpen(false);
      setEmailRecipients('');
      toast.success('Email sent', { description: `Report sent to ${to.length} recipient(s).` });
    } catch (e) {
      toast.error('Send failed', { description: e?.message || 'Could not send email.' });
    } finally {
      setEmailLoading(false);
    }
  }, [emailRecipients, companyForBranding, companyId, selectedCustomer, dateRange, buildReportHtml, reportData, customerName, siteLabel, reportMonthLabel]);

  const companyToSchedule = useMemo(() => {
    if (selectedCustomer && selectedCustomer !== 'all' && isSuperAdmin && companies?.length) {
      return companies.find((c) => c.elora_customer_ref === selectedCustomer) ?? null;
    }
    return userCompany ?? (companies?.find((c) => c.id === companyId) ?? null);
  }, [companies, userCompany, selectedCustomer, isSuperAdmin, companyId]);

  const handleScheduleMonthly = useCallback(async () => {
    const company = companyToSchedule;
    if (!company) {
      toast.error('Company not found', { description: 'Select a specific customer to enable scheduled reports.' });
      return;
    }
    setScheduleLoading(true);
    try {
      const { error } = await supabaseClient.tables.companies.update({ scheduled_email_reports_enabled: !company.scheduled_email_reports_enabled }).eq('id', company.id);
      if (error) throw error;
      await Promise.all([
        queryClient.refetchQueries({ queryKey: queryKeys.tenant.companies(companyId) }),
        queryClient.refetchQueries({ queryKey: queryKeys.tenant.company(companyId, company.id) }),
      ]);
      setScheduleDialogOpen(false);
      toast.success(company.scheduled_email_reports_enabled ? 'Scheduled reports disabled' : 'Scheduled reports enabled', { description: 'Monthly client report emails will ' + (company.scheduled_email_reports_enabled ? 'no longer' : '') + ' be sent.' });
    } catch (e) {
      toast.error('Update failed', { description: e?.message || 'Could not update schedule.' });
    } finally {
      setScheduleLoading(false);
    }
  }, [companyToSchedule, queryClient, companyId]);

  const summaryRows = [
    { metric: 'Total Fleet Size', value: `${reportData.totalFleetSize} vehicles` },
    { metric: 'Active Sites', value: String(reportData.activeSites) },
    { metric: 'Total Washes', value: String(reportData.totalWashes) },
    { metric: 'Average Cost Per Truck', value: `$${reportData.avgCostPerTruck.toFixed(2)}` },
    { metric: 'Average Cost Per Wash', value: `$${reportData.avgCostPerWash.toFixed(2)}` },
    { metric: 'Total Program Cost', value: `$${reportData.totalProgramCost.toFixed(2)}` },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Client-Facing Cost Report</h2>
        <p className="text-sm text-muted-foreground">Generate professional reports to share with customers.</p>
      </div>

      <Card ref={reportCardRef} className="overflow-hidden">
        <CardHeader className="border-b bg-muted/30">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col justify-center text-center min-w-0 flex-1">
              <p className="text-lg font-bold text-foreground truncate">{reportCompanyNameFormatted}</p>
            </div>
            <div className="flex flex-col gap-1 text-center flex-[2] min-w-0">
              <CardTitle className="text-lg font-semibold uppercase tracking-wide">Fleet Wash Program Report</CardTitle>
              <p className="text-sm text-muted-foreground">{reportMonthLabel} · {siteLabel}</p>
            </div>
            <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
              <img src={ELORA_LOGO_URL} alt="ELORA" className="h-8 w-auto object-contain" />
              <span className="text-xs text-muted-foreground whitespace-nowrap">Prepared by ELORA</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Card className="border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800">
              <CardContent className="pt-4">
                <p className="text-xs font-semibold uppercase text-green-700 dark:text-green-400">Compliance Rate</p>
                <p className="text-3xl font-bold text-green-800 dark:text-green-300">{reportData.complianceRate != null ? `${reportData.complianceRate}%` : '—'}</p>
                <p className="text-xs text-green-600 dark:text-green-500">{reportData.complianceDelta != null ? `↑ ${reportData.complianceDelta}% from last month` : 'Based on wash scans in period'}</p>
              </CardContent>
            </Card>
            <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
              <CardContent className="pt-4">
                <p className="text-xs font-semibold uppercase text-blue-700 dark:text-blue-400">Total Washes</p>
                <p className="text-3xl font-bold text-blue-800 dark:text-blue-300">{reportData.totalWashes}</p>
                <p className="text-xs text-blue-600 dark:text-blue-500">Across {reportData.activeSites} sites</p>
              </CardContent>
            </Card>
          </div>

          <h3 className="text-sm font-semibold mb-2 ml-1">Monthly Cost Summary</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50%]">Metric</TableHead>
                <TableHead>Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaryRows.map((row) => (
                <TableRow key={row.metric}>
                  <TableCell className="font-medium">{row.metric}</TableCell>
                  <TableCell>{row.value}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <h3 className="text-sm font-semibold text-green-700 dark:text-green-400 mt-6 mb-2 ml-1">Value Statement</h3>
          <div className="rounded-lg border border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-800 p-4">
            <p className="text-sm text-foreground/90 leading-relaxed">{valueStatement}</p>
          </div>

          <p className="text-xs text-muted-foreground mt-4">Report generated by ELORA Fleet Compliance Portal · elora.com.au</p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button variant="default" onClick={handleExportPdf} disabled={exportPdfLoading}>
          {exportPdfLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
          Export as PDF
        </Button>
        <Button variant="outline" onClick={() => setEmailDialogOpen(true)} disabled={emailLoading}>
          {emailLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
          Email to Customer
        </Button>
        <Button variant="outline" onClick={() => setScheduleDialogOpen(true)} disabled={scheduleLoading}>
          <Calendar className="h-4 w-4 mr-2" />
          Schedule Monthly
        </Button>
      </div>

      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Email to Customer</DialogTitle>
            <DialogDescription>Send this report to one or more email addresses (comma or space separated).</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Label htmlFor="client-report-emails">Recipient emails</Label>
            <Input id="client-report-emails" value={emailRecipients} onChange={(e) => setEmailRecipients(e.target.value)} placeholder="email1@example.com, email2@example.com" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEmailToCustomer} disabled={emailLoading || !emailRecipients.trim()}>
              {emailLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule Monthly Report</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm">
                {companyToSchedule ? (
                  <>
                    <p>
                      {companyToSchedule.scheduled_email_reports_enabled
                        ? 'This client is set to receive monthly client report emails. Disable to stop all monthly client reports for this company.'
                        : 'Enable to send the Fleet Wash Program Report automatically each month.'}
                    </p>
                    <p className="font-medium text-foreground/90">How it works:</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>Runs on the <strong>1st of each month</strong> (Australia/Sydney).</li>
                      <li>Report covers the <strong>previous calendar month</strong>.</li>
                      <li>Emails go to everyone who has an <strong>enabled schedule</strong> in Reports → Email Reports for this company (their email plus any extra recipients they added).</li>
                    </ul>
                    {companyToSchedule.scheduled_email_reports_enabled && (
                      <p className="text-amber-600 dark:text-amber-500">Disabling will stop monthly client report emails for this company only.</p>
                    )}
                  </>
                ) : (
                  <p>Select a specific customer (company) in the dashboard filters, then open this dialog to enable or disable scheduled monthly client reports for that company.</p>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>Cancel</Button>
            {companyToSchedule && (
              <Button onClick={handleScheduleMonthly} disabled={scheduleLoading}>
                {scheduleLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {companyToSchedule.scheduled_email_reports_enabled ? 'Disable monthly' : 'Enable monthly'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
