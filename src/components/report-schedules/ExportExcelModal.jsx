import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  FileSpreadsheet, Loader2, CalendarDays, Building2, MapPin, Download, Check,
} from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth, subDays, subWeeks } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import { callEdgeFunction, supabase } from '@/lib/supabase';
import { sitesOptions } from '@/query/options/sites';
import { buildReportData, generateFleetReport } from '@/utils/fleetReportExport';
import {
  calculateScanCostFromScan,
  buildVehicleWashTimeMaps,
  buildSitePricingMaps,
  getPricePerLitreFromProducts,
} from '@/components/costs/usageCostUtils';
import { toast } from '@/lib/toast';

const DATE_PRESETS = [
  { key: 'last_month', label: 'Last month' },
  { key: 'this_month', label: 'This month' },
  { key: 'last_7', label: 'Last 7 days' },
  { key: 'last_14', label: 'Last 14 days' },
  { key: 'custom', label: 'Custom' },
];

function getPresetDates(key) {
  const now = new Date();
  switch (key) {
    case 'last_month': {
      const prev = subMonths(now, 1);
      return { start: startOfMonth(prev), end: endOfMonth(prev) };
    }
    case 'this_month':
      return { start: startOfMonth(now), end: now };
    case 'last_7':
      return { start: subDays(now, 7), end: now };
    case 'last_14':
      return { start: subDays(now, 14), end: now };
    default:
      return null;
  }
}

function formatPeriodLabel(start, end) {
  if (!start || !end) return '';
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const s = new Date(start);
  const e = new Date(end);
  // If it's a full month, show "Month Year"
  if (s.getDate() === 1 && e.getDate() === new Date(e.getFullYear(), e.getMonth() + 1, 0).getDate()
    && s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${months[s.getMonth()]} ${s.getFullYear()}`;
  }
  return `${format(s, 'dd/MM/yyyy')} - ${format(e, 'dd/MM/yyyy')}`;
}

export default function ExportExcelModal({ open, onOpenChange, schedule, companies = [] }) {
  const { userProfile } = useAuth();
  const companyId = userProfile?.company_id ?? 'all';

  // Resolve the customer company from schedule
  const contactCompanyId = schedule?.companyId || schedule?.company_id;
  const company = useMemo(
    () => companies.find((c) => c.id === contactCompanyId),
    [companies, contactCompanyId],
  );
  const companyName = schedule?.companyName || schedule?.company_name || company?.name || 'Unknown';
  const customerRef = company?.elora_customer_ref || null;

  // Tab selection — default from schedule, or all tabs
  const ALL_TABS = ['dashboard', 'site_summary', 'vehicle_breakdown', 'compliance_status'];
  const TAB_LABELS = {
    dashboard: 'Fleet Compliance Report',
    site_summary: 'Site Summary',
    vehicle_breakdown: 'Vehicle Breakdown',
    compliance_status: 'Compliance Status',
  };

  // Normalize legacy report types from schedule to new tab IDs
  const normalizeToTabs = (types) => {
    if (!types || types.length === 0) return [...ALL_TABS];
    const LEGACY_MAP = {
      compliance_rate: 'dashboard',
      total_washes: 'dashboard',
      total_program_cost: 'dashboard',
      avg_cost_per_truck: 'dashboard',
      avg_cost_per_wash: 'dashboard',
      per_vehicle_breakdown: 'vehicle_breakdown',
      last_scan_date: 'vehicle_breakdown',
      compliant_vs_non_compliant: 'compliance_status',
      site_summary: 'site_summary',
    };
    const mapped = new Set();
    for (const t of types) {
      if (ALL_TABS.includes(t)) mapped.add(t);
      else if (LEGACY_MAP[t]) mapped.add(LEGACY_MAP[t]);
    }
    return mapped.size > 0 ? [...mapped] : [...ALL_TABS];
  };

  const scheduleTabs = useMemo(
    () => normalizeToTabs(schedule?.reportTypes || schedule?.report_types),
    [schedule],
  );

  const [selectedTabs, setSelectedTabs] = useState(scheduleTabs);

  // Reset when schedule changes
  React.useEffect(() => { setSelectedTabs(scheduleTabs); }, [scheduleTabs]);

  const allTabsSelected = ALL_TABS.every((t) => selectedTabs.includes(t));
  const toggleTab = (tabId) => {
    setSelectedTabs((prev) =>
      prev.includes(tabId) ? prev.filter((t) => t !== tabId) : [...prev, tabId],
    );
  };
  const toggleAllTabs = () => {
    setSelectedTabs(allTabsSelected ? [] : [...ALL_TABS]);
  };

  // Date range state
  const [datePreset, setDatePreset] = useState('last_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [generating, setGenerating] = useState(false);

  const dateRange = useMemo(() => {
    if (datePreset === 'custom') {
      if (!customFrom || !customTo) return null;
      return { start: new Date(customFrom), end: new Date(customTo) };
    }
    return getPresetDates(datePreset);
  }, [datePreset, customFrom, customTo]);

  const periodLabel = useMemo(
    () => dateRange ? formatPeriodLabel(dateRange.start, dateRange.end) : '',
    [dateRange],
  );

  // Fetch sites for the customer (for site filter)
  const { data: sites = [] } = useQuery({
    ...sitesOptions(companyId, { customerId: customerRef, allTenants: true }),
    enabled: open && !!customerRef,
  });

  // Site selection state
  const [selectedSites, setSelectedSites] = useState([]); // empty = all sites
  const allSitesSelected = selectedSites.length === 0;

  const toggleSite = useCallback((siteRef) => {
    setSelectedSites((prev) => {
      if (prev.includes(siteRef)) {
        return prev.filter((s) => s !== siteRef);
      }
      return [...prev, siteRef];
    });
  }, []);

  // Contact info
  const contactName = schedule?.contactName || schedule?.contact_name || '';
  const contactInitials = contactName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleGenerate = async () => {
    if (!dateRange) {
      toast.error('Please select a date range');
      return;
    }
    if (!customerRef) {
      toast.error('This company has no ACATC customer reference configured. Cannot generate report.');
      return;
    }

    setGenerating(true);
    try {
      const fromDate = format(dateRange.start, 'yyyy-MM-dd');
      const toDate = format(dateRange.end, 'yyyy-MM-dd');

      // Fetch all data in parallel — always filter by customer ref
      const [vehiclesResp, scansResp, pricingResp] = await Promise.all([
        callEdgeFunction('elora_vehicles', {
          customer: customerRef,
          export: true,
        }),
        callEdgeFunction('elora_scans', {
          customer: customerRef,
          fromDate,
          toDate,
          status: 'success,exceeded',  // both billable scan types
          export: true,
        }),
        (async () => {
          const [tankResult, productsResult] = await Promise.all([
            supabase
              .from('tank_configurations')
              .select('site_ref, device_ref, device_serial, product_type, calibration_rate_per_60s')
              .eq('active', true),
            supabase
              .from('products')
              .select('name, price_cents, status')
              .eq('status', 'active'),
          ]);
          return {
            tankConfigs: tankResult.data ?? [],
            products: productsResult.data ?? [],
          };
        })(),
      ]);

      let vehicles = vehiclesResp?.data ?? vehiclesResp ?? [];
      let scans = scansResp?.data ?? scansResp ?? [];

      // Safety: client-side verify vehicles/scans belong to this customer
      // (in case the API returned extra rows)
      vehicles = vehicles.filter((v) => {
        const ref = v.customerId ?? v.customer_id ?? v.customerRef ?? v.customer_ref ?? null;
        // Keep if customerRef matches, or if no customer field (trust API filter)
        return ref == null || ref === customerRef;
      });
      scans = scans.filter((s) => {
        const ref = s.customerRef ?? s.customer_ref ?? null;
        return ref == null || ref === customerRef;
      });

      // Build the set of valid site names/refs for this customer from the fetched vehicles
      const customerSiteNames = new Set(
        vehicles.map((v) => v.siteName ?? v.site_name ?? '').filter(Boolean),
      );
      const customerSiteRefs = new Set(
        vehicles.map((v) => v.siteRef ?? v.site_ref ?? '').filter(Boolean),
      );

      // Filter scans to only include sites that belong to this customer's vehicles
      scans = scans.filter((s) => {
        const sSite = s.siteName ?? s.site_name ?? '';
        const sSiteRef = s.siteRef ?? s.site_ref ?? '';
        return customerSiteNames.has(sSite) || customerSiteRefs.has(sSiteRef);
      });

      // Filter by selected sites if not all
      if (selectedSites.length > 0) {
        const selectedSiteNameSet = new Set(
          sites.filter((s) => selectedSites.includes(s.ref || s.id)).map((s) => s.name),
        );
        const selectedSiteRefSet = new Set(selectedSites);
        vehicles = vehicles.filter((v) => {
          const vSite = v.siteName ?? v.site_name ?? '';
          const vSiteRef = v.siteRef ?? v.site_ref ?? '';
          return selectedSiteNameSet.has(vSite) || selectedSiteRefSet.has(vSiteRef);
        });
        scans = scans.filter((s) => {
          const sSite = s.siteName ?? s.site_name ?? '';
          const sSiteRef = s.siteRef ?? s.site_ref ?? '';
          return selectedSiteNameSet.has(sSite) || selectedSiteRefSet.has(sSiteRef);
        });
      }

      // Build pricing maps
      const entitlementMaps = buildVehicleWashTimeMaps(vehicles);
      const pricingMaps = buildSitePricingMaps(pricingResp.tankConfigs, pricingResp.products);

      // Parse company name into customer + region
      const nameParts = companyName.split(' - ');
      const custName = nameParts[0]?.trim() || companyName;
      const region = nameParts.slice(1).join(' - ').trim() || '';

      // Build report data
      const reportData = buildReportData({
        vehicles,
        scans,
        entitlementMaps,
        pricingMaps,
        customerName: custName,
        region,
        period: periodLabel,
        costUtils: {
          calculateScanCostFromScan,
          getPricePerLitreFromProducts,
        },
      });

      // Resolve selected site names for filename
      const selectedSiteNames = selectedSites.length > 0
        ? sites.filter((s) => selectedSites.includes(s.ref || s.id)).map((s) => s.name)
        : [];

      // Generate and download — only include selected tabs
      await generateFleetReport(reportData, {
        clientLogoUrl: company?.logo_url || null,
        eloraLogoUrl: '/eloralogo.png',
        dateRange: { start: dateRange.start, end: dateRange.end },
        selectedSiteNames,
        includeTabs: selectedTabs.length > 0 ? selectedTabs : ALL_TABS,
      });

      toast.success(`Report generated: ${custName} ${region ? '- ' + region : ''}`);
      onOpenChange(false);
    } catch (err) {
      console.error('Report generation failed:', err);
      toast.error(`Report generation failed: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            Export Excel Report
          </DialogTitle>
          <DialogDescription>
            {companyName} - {contactName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Contact info card */}
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold dark:bg-emerald-900/40 dark:text-emerald-400">
              {contactInitials}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{contactName}</p>
              <p className="text-xs text-muted-foreground truncate">
                {companyName}
              </p>
            </div>
            <Badge variant="secondary" className="ml-auto text-[10px]">
              {selectedTabs.length === ALL_TABS.length ? 'All tabs' : `${selectedTabs.length} tab${selectedTabs.length !== 1 ? 's' : ''}`}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {schedule?.frequency ? schedule.frequency.charAt(0).toUpperCase() + schedule.frequency.slice(1) : 'Monthly'} schedule
            </Badge>
          </div>

          {/* Reporting period */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              Reporting period
            </Label>
            <p className="text-[11px] text-muted-foreground">
              Select the date range for this export
            </p>
            <div className="flex flex-wrap gap-1.5">
              {DATE_PRESETS.map((p) => (
                <Button
                  key={p.key}
                  variant={datePreset === p.key ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setDatePreset(p.key)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            {datePreset === 'custom' && (
              <div className="flex gap-2 mt-2">
                <div className="flex-1">
                  <Label className="text-[11px] text-muted-foreground">From</Label>
                  <Input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="flex-1">
                  <Label className="text-[11px] text-muted-foreground">To</Label>
                  <Input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            )}
            {dateRange && (
              <p className="text-xs text-emerald-600 font-medium mt-1">
                {periodLabel}
              </p>
            )}
          </div>

          {/* Sites filter */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              Sites to include
            </Label>
            <p className="text-[11px] text-muted-foreground">
              Saved from schedule - override for this export only
            </p>
            <div className="max-h-[140px] overflow-y-auto rounded-md border p-2 space-y-1">
              <div
                className={cn(
                  'flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer hover:bg-muted/50 transition-colors',
                  allSitesSelected && 'bg-emerald-50 dark:bg-emerald-900/20',
                )}
                onClick={() => setSelectedSites([])}
              >
                <Checkbox checked={allSitesSelected} />
                <span className="text-xs font-medium">All Sites</span>
              </div>
              {sites.map((site) => (
                <div
                  key={site.id || site.ref}
                  className={cn(
                    'flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer hover:bg-muted/50 transition-colors',
                    selectedSites.includes(site.ref || site.id) && 'bg-emerald-50 dark:bg-emerald-900/20',
                  )}
                  onClick={() => toggleSite(site.ref || site.id)}
                >
                  <Checkbox checked={selectedSites.includes(site.ref || site.id)} />
                  <span className="text-xs">{site.name}</span>
                </div>
              ))}
              {sites.length === 0 && (
                <p className="text-xs text-muted-foreground italic px-2 py-1">
                  {customerRef ? 'Loading sites...' : 'No customer ref found'}
                </p>
              )}
            </div>
          </div>

          {/* Tab selection */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Excel tabs to include
            </Label>
            <div className="rounded-md border p-2 space-y-0.5">
              <div
                className={cn(
                  'flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer hover:bg-muted/50 transition-colors border-b pb-1.5 mb-1',
                  allTabsSelected && 'bg-emerald-50 dark:bg-emerald-900/20',
                )}
                onClick={toggleAllTabs}
              >
                <Checkbox checked={allTabsSelected} />
                <span className="text-xs font-medium">All Tabs</span>
              </div>
              {ALL_TABS.map((tabId) => (
                <div
                  key={tabId}
                  className={cn(
                    'flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer hover:bg-muted/50 transition-colors',
                    selectedTabs.includes(tabId) && 'bg-emerald-50 dark:bg-emerald-900/20',
                  )}
                  onClick={() => toggleTab(tabId)}
                >
                  <Checkbox checked={selectedTabs.includes(tabId)} />
                  <span className="text-xs">{TAB_LABELS[tabId]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer note */}
          <p className="text-[11px] text-muted-foreground text-center">
            Generates branded .xlsx - Arial font - No gridlines
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={generating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={generating || !dateRange || !customerRef || selectedTabs.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Generate & Download
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
