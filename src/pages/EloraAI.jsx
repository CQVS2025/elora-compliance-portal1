import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles, LayoutDashboard, AlertTriangle, Lightbulb, BarChart3, Loader2, Play, Calendar as CalendarIcon, ChevronsUpDown, Check, RotateCcw } from 'lucide-react';
import moment from 'moment';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Label } from '@/components/ui/label';
import { toast } from '@/lib/toast';
import { usePermissions, useFilteredData } from '@/components/auth/PermissionGuard';
import {
  customersOptions,
  sitesOptions,
} from '@/query/options';
import {
  aiSettingsOptions,
  aiPredictionsOptions,
  aiRecommendationsOptions,
  aiWashWindowsOptions,
  aiDriverPatternsOptions,
  aiSiteInsightsOptions,
  aiPatternSummaryOptions,
} from '@/query/options/aiInsights';
import { callEdgeFunction, supabase as supabaseClient } from '@/lib/supabase';
import AIInsightsOverview from '@/components/ai-insights/AIInsightsOverview';
import AIInsightsRiskPredictions from '@/components/ai-insights/AIInsightsRiskPredictions';
import AIInsightsRecommendations from '@/components/ai-insights/AIInsightsRecommendations';
import AIInsightsPatterns from '@/components/ai-insights/AIInsightsPatterns';

// Default filter values (no site in main filters)
const getDefaultFilters = () => ({
  selectedCustomer: 'all',
  dateRange: {
    start: moment().format('YYYY-MM-DD'),
    end: moment().format('YYYY-MM-DD')
  },
  activePeriod: 'Today'
});

// Date range for period preset
const getDateRangeForPeriod = (period) => {
  if (period === 'Today') {
    return { start: moment().format('YYYY-MM-DD'), end: moment().format('YYYY-MM-DD') };
  }
  if (period === 'Week') {
    return { start: moment().startOf('week').format('YYYY-MM-DD'), end: moment().format('YYYY-MM-DD') };
  }
  if (period === 'Month') {
    return { start: moment().startOf('month').format('YYYY-MM-DD'), end: moment().format('YYYY-MM-DD') };
  }
  return null;
};

export default function EloraAI() {
  const queryClient = useQueryClient();
  const permissions = usePermissions();
  const companyId = permissions.userProfile?.company_id;
  const isSuperAdmin = permissions.isSuperAdmin;
  const isAdmin = permissions.isAdmin;
  const canRunFleetAnalysis = isSuperAdmin || isAdmin;

  // Filter state - customer and date only
  const [filters, setFilters] = useState(getDefaultFilters);
  const { selectedCustomer, dateRange, activePeriod } = filters;

  // Update filters
  const updateFilter = useCallback((updates) => {
    console.log('🔄 [EloraAI] updateFilter called with:', updates);
    setFilters(prev => {
      const next = { ...prev, ...updates };
      console.log('🔄 [EloraAI] New filters state:', next);
      return next;
    });
  }, []);

  const setSelectedCustomer = useCallback((v) => {
    console.log('🎯 [EloraAI] setSelectedCustomer called with:', v);
    updateFilter({ selectedCustomer: v });
    setViewSiteFilter('all'); // Reset view site filter when customer changes
  }, [updateFilter]);
  const setDateRange = useCallback((v) => updateFilter({ dateRange: v, activePeriod: 'Custom' }), [updateFilter]);
  const setActivePeriod = useCallback((period) => {
    const range = getDateRangeForPeriod(period);
    if (range) updateFilter({ activePeriod: period, dateRange: range });
  }, [updateFilter]);

  const resetMainFilters = useCallback(() => {
    setFilters(getDefaultFilters());
    setViewSiteFilter('all');
    setCustomerComboboxOpen(false);
  }, []);

  // Fetch customers and sites
  const { data: rawCustomers = [], isLoading: customersLoading } = useQuery(customersOptions(companyId));
  const { data: rawSites = [], isLoading: sitesLoading } = useQuery(sitesOptions(companyId));

  // Fetch companies to check which customers are onboarded
  const { data: companiesData = [] } = useQuery({
    queryKey: ['companies-onboarded'],
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from('companies')
        .select('id, name, elora_customer_ref')
        .not('elora_customer_ref', 'is', null);
      if (error) throw error;
      return data || [];
    },
    enabled: isSuperAdmin, // Only fetch for super admins
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Create a map of onboarded customer refs
  const onboardedCustomerRefs = useMemo(() => {
    return new Set((companiesData || []).map(c => c.elora_customer_ref));
  }, [companiesData]);

  // Normalize customers: ensure they have 'id' field and add 'isOnboarded' flag
  const customers = useMemo(() => {
    return rawCustomers.map(c => ({
      ...c,
      id: c.ref || c.id, // Use 'ref' as 'id' for FilterSection compatibility
      isOnboarded: onboardedCustomerRefs.has(c.ref || c.id), // Check if customer is onboarded
    }));
  }, [rawCustomers, onboardedCustomerRefs]);

  // Debug logging
  console.log('🔍 [EloraAI] Raw Data:', {
    customers,
    customersCount: customers?.length,
    rawSites,
    rawSitesCount: rawSites?.length,
    companyId,
    isSuperAdmin,
    isAdmin,
    sampleCustomer: customers?.[0],
  });

  // Apply role-based filtering
  const { filteredSites: permissionFilteredSites } = useFilteredData([], rawSites, customers);

  console.log('🔍 [EloraAI] Permissions Filtered:', {
    permissionFilteredSites,
    permissionFilteredSitesCount: permissionFilteredSites?.length,
  });

  // Customer dropdown: super_admin sees all customers; company users (any other role) see only their company's customer
  const customersForDropdown = useMemo(() => {
    if (isSuperAdmin) {
      console.log('✅ [EloraAI] Super Admin - showing all customers:', customers?.length);
      return customers;
    }
    
    // For non-super admins, only show their company's customer
    const companyCustomerRef = permissions.userProfile?.company_elora_customer_ref?.trim();
    if (!companyCustomerRef) {
      console.warn('⚠️ [EloraAI] Admin has no company_elora_customer_ref set');
      return [];
    }
    
    const filtered = customers.filter(c => (c.ref || c.id) === companyCustomerRef);
    console.log('✅ [EloraAI] Admin - showing company customer only:', filtered?.length, filtered);
    
    return filtered;
  }, [isSuperAdmin, permissions.userProfile?.company_elora_customer_ref, customers]);

  // Sites for selected customer (for filtering displayed data, not for processing)
  const sitesForCustomer = useMemo(() => {
    if (selectedCustomer === 'all') return permissionFilteredSites;
    const filtered = permissionFilteredSites.filter(s => s.customer_ref === selectedCustomer);
    console.log('🔍 [EloraAI] Sites for customer:', selectedCustomer, '→', filtered?.length, 'sites');
    return filtered;
  }, [selectedCustomer, permissionFilteredSites]);

  // Auto-select and lock customer for non-super admins
  const shouldAutoSelectCustomer = !isSuperAdmin && customersForDropdown.length === 1;
  const effectiveCustomer = shouldAutoSelectCustomer ? (customersForDropdown[0]?.ref || customersForDropdown[0]?.id) : selectedCustomer;

  console.log('🔍 [EloraAI] Customer Selection:', {
    selectedCustomer,
    shouldAutoSelectCustomer,
    effectiveCustomer,
    customersForDropdownCount: customersForDropdown?.length,
    firstCustomer: customersForDropdown?.[0],
  });

  // Get customer_ref for API calls (this is the ASI API customer ref like "20190116172547S80079")
  const selectedCustomerRef = useMemo(() => {
    if (effectiveCustomer === 'all') return null;
    // effectiveCustomer IS the customer ref (from ASI API customer.ref)
    console.log('✅ [EloraAI] Selected Customer Ref:', effectiveCustomer);
    return effectiveCustomer;
  }, [effectiveCustomer]);

  // Site filter state for viewing data (not for processing)
  const [viewSiteFilter, setViewSiteFilter] = useState('all');
  // Customer combobox open state (for searchable dropdown)
  const [customerComboboxOpen, setCustomerComboboxOpen] = useState(false);
  
  // Analysis date range state (for "Process All Vehicles" button)
  // Default: today only (same as cron job)
  const [analysisDateRange, setAnalysisDateRange] = useState({
    start: moment().format('YYYY-MM-DD'),
    end: moment().format('YYYY-MM-DD')
  });
  const [showAnalysisDatePicker, setShowAnalysisDatePicker] = useState(false);

  // Auto-select and lock customer for non-super-admin
  useEffect(() => {
    const companyRef = permissions.userProfile?.company_elora_customer_ref?.trim();
    if (isSuperAdmin || !companyRef) return;
    
    // Auto-select company customer for non-super admins
    if (selectedCustomer !== companyRef) {
      console.log('🔒 [EloraAI] Auto-selecting company customer:', companyRef);
      setSelectedCustomer(companyRef);
    }
  }, [isSuperAdmin, permissions.userProfile?.company_elora_customer_ref, selectedCustomer, setSelectedCustomer]);

  // Fetch AI data with customer/date filters (no site filter for fetching - we get all sites)
  // Use date range for filtering historical data
  
  // For super admins selecting a customer, find the company_id for that customer from database
  const { data: selectedCompanyData } = useQuery({
    queryKey: ['company-for-customer', selectedCustomerRef],
    queryFn: async () => {
      if (!selectedCustomerRef) return null;
      const { data } = await supabaseClient
        .from('companies')
        .select('id')
        .eq('elora_customer_ref', selectedCustomerRef)
        .maybeSingle();
      return data;
    },
    enabled: isSuperAdmin && !!selectedCustomerRef,
  });
  
  const selectedCompanyId = isSuperAdmin 
    ? (selectedCompanyData?.id || null) 
    : companyId;
  
  // Fetch predictions: Use date range instead of single date
  console.log('🔍 [EloraAI] Query Parameters:', {
    selectedCompanyId,
    selectedCustomerRef,
    dateRange,
  });
  
  const { data: allPredictions = [], isLoading: predictionsLoading } = useQuery({
    ...aiPredictionsOptions(
      selectedCompanyId, 
      dateRange.start, // startDate for filtering
      dateRange.end, // endDate for filtering
      selectedCustomerRef, 
      null
    ),
    enabled: !!selectedCustomerRef && !!selectedCompanyId,
  });

  const { data: allRecommendations = [], isLoading: recsLoading } = useQuery({
    ...aiRecommendationsOptions(
      selectedCompanyId, 
      selectedCustomerRef, 
      null, // siteRef
      dateRange.start, // startDate for filtering
      dateRange.end // endDate for filtering
    ),
    enabled: !!selectedCustomerRef && !!selectedCompanyId,
  });

  const { data: allWashWindows = [] } = useQuery({
    ...aiWashWindowsOptions(
      selectedCompanyId, 
      selectedCustomerRef, 
      null, // siteRef
      dateRange.start, // startDate for filtering
      dateRange.end // endDate for filtering
    ),
    enabled: !!selectedCustomerRef && !!selectedCompanyId,
  });

  const { data: allDriverPatterns = [] } = useQuery({
    ...aiDriverPatternsOptions(
      selectedCompanyId, 
      selectedCustomerRef, 
      null, // siteRef
      dateRange.start, // startDate for filtering
      dateRange.end // endDate for filtering
    ),
    enabled: !!selectedCustomerRef && !!selectedCompanyId,
  });

  const { data: allSiteInsights = [] } = useQuery({
    ...aiSiteInsightsOptions(
      selectedCompanyId, 
      dateRange.start, // startDate for filtering
      dateRange.end, // endDate for filtering
      selectedCustomerRef, 
      null
    ),
    enabled: !!selectedCustomerRef && !!selectedCompanyId,
  });

  const { data: patternSummary = null } = useQuery({
    ...aiPatternSummaryOptions(
      selectedCompanyId, 
      selectedCustomerRef, 
      null, // siteRef
      dateRange.start, // startDate for filtering
      dateRange.end // endDate for filtering
    ),
    enabled: !!selectedCustomerRef && !!selectedCompanyId,
  });

  // Filter displayed data by site (client-side filtering)
  const predictions = useMemo(() => {
    if (viewSiteFilter === 'all') return allPredictions;
    return allPredictions.filter(p => p.site_ref === viewSiteFilter);
  }, [allPredictions, viewSiteFilter]);

  const recommendations = useMemo(() => {
    if (viewSiteFilter === 'all') return allRecommendations;
    return allRecommendations.filter(r => r.site_ref === viewSiteFilter);
  }, [allRecommendations, viewSiteFilter]);

  const washWindows = useMemo(() => {
    if (viewSiteFilter === 'all') return allWashWindows;
    return allWashWindows.filter(w => w.site_ref === viewSiteFilter);
  }, [allWashWindows, viewSiteFilter]);

  const driverPatterns = useMemo(() => {
    if (viewSiteFilter === 'all') return allDriverPatterns;
    return allDriverPatterns.filter(d => d.site_ref === viewSiteFilter);
  }, [allDriverPatterns, viewSiteFilter]);

  const siteInsights = useMemo(() => {
    if (viewSiteFilter === 'all') return allSiteInsights;
    return allSiteInsights.filter(s => s.site_ref === viewSiteFilter);
  }, [allSiteInsights, viewSiteFilter]);

  const [activeTab, setActiveTab] = useState('overview');
  const [runFleetLoading, setRunFleetLoading] = useState(false);

  const atRiskCount = predictions.filter((p) => ['critical', 'high'].includes(p.risk_level)).length;
  const criticalCount = predictions.filter((p) => p.risk_level === 'critical').length;
  const highCount = predictions.filter((p) => p.risk_level === 'high').length;
  const pendingRecs = recommendations.filter((r) => r.status === 'pending').length;
  const highPriorityRecs = recommendations.filter((r) => r.priority === 'high' || r.priority === 'critical').length;

  const invalidateAiQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['tenant', companyId, 'aiPredictions'] });
    queryClient.invalidateQueries({ queryKey: ['tenant', companyId, 'aiRecommendations'] });
    queryClient.invalidateQueries({ queryKey: ['tenant', companyId, 'aiWashWindows'] });
    queryClient.invalidateQueries({ queryKey: ['tenant', companyId, 'aiDriverPatterns'] });
    queryClient.invalidateQueries({ queryKey: ['tenant', companyId, 'aiSiteInsights'] });
    queryClient.invalidateQueries({ queryKey: ['tenant', companyId, 'aiPatternSummary'] });
  };

  const runFleetAnalysisAll = async () => {
    if (!canRunFleetAnalysis) return;
    if (!selectedCustomerRef) {
      toast.error('Please select a customer', { description: 'You must select a customer before processing vehicles.' });
      return;
    }

    setRunFleetLoading(true);
    let offset = 0;
    let totalProcessed = 0;
    let lastMessage = null;

    try {
      // Validate that this customer exists in our companies table (has been onboarded)
      const { data: companyData, error: companyError } = await supabaseClient
        .from('companies')
        .select('id, name, elora_customer_ref')
        .eq('elora_customer_ref', selectedCustomerRef)
        .maybeSingle();

      if (companyError) {
        throw new Error(`Failed to validate customer: ${companyError.message}`);
      }

      if (!companyData) {
        toast.error('Customer not onboarded', {
          description: `The customer "${selectedCustomerRef}" does not exist in the system. Please onboard this customer in Company Settings before analyzing their data.`,
          duration: 6000,
        });
        setRunFleetLoading(false);
        return;
      }

      console.log('✓ Customer validated:', companyData);

      // Use the analysis date range (defaults to today, but can be changed by super admin)
      const analysisStart = analysisDateRange.start;
      const analysisEnd = analysisDateRange.end;
      
      console.log(`🗓️ Running analysis for date range: ${analysisStart} to ${analysisEnd}`);
      
      while (true) {
        const payload = {
          company_id: companyData.id, // ← FIX: Include company_id for super admin
          customer_ref: selectedCustomerRef,
          site_ref: null, // Process ALL sites for this customer
          from_date: analysisStart,
          to_date: analysisEnd,
          offset
        };

        const res = await callEdgeFunction('analyze-fleet', payload);
        const data = res?.data ?? res ?? {};
        const analyzed = data?.analyzed ?? 0;
        const hasMore = data?.has_more ?? false;
        const total = data?.total ?? 0;
        const message = data?.message;

        if (message) lastMessage = message;
        totalProcessed += analyzed;

        if (analyzed > 0) {
          toast.success('Processing fleet…', {
            description: `Processed ${totalProcessed} of ${total} vehicles.${hasMore ? ' Continuing…' : ''}`,
          });
        }

        invalidateAiQueries();

        if (!hasMore || analyzed === 0) break;
        offset = data?.next_offset ?? offset + analyzed;
      }

      if (totalProcessed > 0) {
        toast.success('Fleet analysis complete', {
          description: `All ${totalProcessed} vehicles have been analyzed.`,
        });
      } else if (lastMessage) {
        toast.error('No vehicles to analyze', { description: lastMessage });
      } else {
        toast.error('Fleet analysis complete', { description: 'No vehicles were analyzed.' });
      }

      invalidateAiQueries();
    } catch (err) {
      toast.error('Analysis failed', { description: err?.message || 'Could not complete fleet analysis' });
    } finally {
      setRunFleetLoading(false);
    }
  };

  // Show empty state if no customer selected
  const showEmptyState = !selectedCustomerRef;

  // Use FULL customer data (not filtered by site) to decide if we have any insights at all
  const hasAnyCustomerData =
    allPredictions.length > 0 ||
    allRecommendations.length > 0 ||
    allWashWindows.length > 0 ||
    allDriverPatterns.length > 0 ||
    allSiteInsights.length > 0 ||
    patternSummary != null;

  // Only show "No insights - run Process All Vehicles" when customer has NO data at all
  const showNoDataState =
    selectedCustomerRef &&
    !hasAnyCustomerData &&
    !predictionsLoading &&
    !recsLoading &&
    !runFleetLoading;

  // Customer has data but current site filter shows nothing (e.g. selected a site with no vehicles)
  const hasDataButSiteFilterEmpty =
    hasAnyCustomerData &&
    viewSiteFilter !== 'all' &&
    predictions.length === 0 &&
    recommendations.length === 0 &&
    washWindows.length === 0 &&
    driverPatterns.length === 0 &&
    siteInsights.length === 0;

  return (
    <div className="space-y-6 p-6">
      {/* Filter Section - Customer and Date range with labels */}
      <Card className="border-muted/50">
        <CardContent className="py-4">
          <div className="flex flex-col gap-6 sm:flex-row sm:flex-wrap sm:items-end">
            {/* Customer selection with label + searchable combobox */}
            <div className="flex flex-col gap-2 min-w-0 sm:min-w-[260px]">
              <Label htmlFor="elora-customer-filter" className="text-sm font-medium text-foreground">
                Customer
              </Label>
              {shouldAutoSelectCustomer ? (
                <div
                  id="elora-customer-filter"
                  className="flex h-10 min-w-0 items-center rounded-md border border-input bg-muted/30 px-3 text-sm font-medium text-foreground"
                >
                  {customersForDropdown[0]?.name}
                </div>
              ) : (
                <Popover open={customerComboboxOpen} onOpenChange={setCustomerComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="elora-customer-filter"
                      variant="outline"
                      role="combobox"
                      aria-expanded={customerComboboxOpen}
                      className="w-full justify-between font-normal sm:w-[260px]"
                      disabled={customersLoading || sitesLoading}
                    >
                      {customersLoading || sitesLoading ? (
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading...
                        </span>
                      ) : (
                        <>
                          <span className="truncate">
                            {selectedCustomer === 'all'
                              ? 'All Customers'
                              : customersForDropdown.find((c) => c.id === selectedCustomer)?.name ?? 'All Customers'}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[260px] p-0" align="start">
                    <Command shouldFilter={true}>
                      <CommandInput placeholder="Search customers..." className="h-9" />
                      <CommandList className="max-h-[280px]">
                        <CommandEmpty>No customer found.</CommandEmpty>
                        <CommandGroup>
                          {isSuperAdmin && (
                            <CommandItem
                              value="All Customers"
                              onSelect={() => {
                                setSelectedCustomer('all');
                                setViewSiteFilter('all');
                                setCustomerComboboxOpen(false);
                              }}
                            >
                              <Check className={`mr-2 h-4 w-4 ${selectedCustomer === 'all' ? 'opacity-100' : 'opacity-0'}`} />
                              All Customers
                            </CommandItem>
                          )}
                          {customersForDropdown.map((customer) => (
                            <CommandItem
                              key={customer.id}
                              value={customer.name}
                              onSelect={() => {
                                setSelectedCustomer(customer.id);
                                setViewSiteFilter('all');
                                setCustomerComboboxOpen(false);
                              }}
                              className={!customer.isOnboarded ? 'opacity-60' : ''}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${selectedCustomer === customer.id ? 'opacity-100' : 'opacity-0'}`}
                              />
                              <span className="flex-1">{customer.name}</span>
                              {isSuperAdmin && !customer.isOnboarded && (
                                <span className="ml-2 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                                  Not onboarded
                                </span>
                              )}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
            </div>

            {/* Date range with label */}
            <div className="flex flex-col gap-2 min-w-0 sm:min-w-[260px]">
              <Label htmlFor="elora-date-range" className="text-sm font-medium text-foreground">
                Date range
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="elora-date-range"
                    variant="outline"
                    className="w-full justify-start text-left font-normal sm:w-[260px]"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                    {dateRange?.start && dateRange?.end ? (
                      <span className="truncate">
                        {format(new Date(dateRange.start), 'dd/MM/yyyy')} – {format(new Date(dateRange.end), 'dd/MM/yyyy')}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Pick a date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    defaultMonth={dateRange?.start ? new Date(dateRange.start) : undefined}
                    selected={
                      dateRange?.start && dateRange?.end
                        ? { from: new Date(dateRange.start), to: new Date(dateRange.end) }
                        : undefined
                    }
                    onSelect={(range) => {
                      if (!range?.from) return;
                      const start = format(range.from, 'yyyy-MM-dd');
                      const end = range.to ? format(range.to, 'yyyy-MM-dd') : start;
                      setDateRange({ start, end });
                    }}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Reset filters */}
            <div className="flex flex-col gap-2 sm:justify-end">
              <Label className="text-sm font-medium text-transparent select-none">Reset</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={resetMainFilters}
                className="gap-2 sm:w-auto"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Header: title + Powered by ELORA AI + Process button */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>Powered by ELORA AI</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-1">Elora AI</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Intelligent wash optimization & predictions</p>
        </div>
        {canRunFleetAnalysis && selectedCustomerRef && (
          <div className="flex flex-col gap-2 sm:items-end">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Analysis Date Range Picker (for Process All Vehicles) */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground font-normal">Analysis Date</Label>
                <Popover open={showAnalysisDatePicker} onOpenChange={setShowAnalysisDatePicker}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                      {analysisDateRange.start === analysisDateRange.end
                        ? format(new Date(analysisDateRange.start), 'dd/MM/yyyy')
                        : `${format(new Date(analysisDateRange.start), 'dd/MM/yyyy')} – ${format(new Date(analysisDateRange.end), 'dd/MM/yyyy')}`}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <div className="p-3 border-b">
                      <p className="text-sm font-medium">Analysis Date Range</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Select the date range for wash data to analyze. AI will generate insights based on this period.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2 w-full"
                        onClick={() => {
                          const today = moment().format('YYYY-MM-DD');
                          setAnalysisDateRange({ start: today, end: today });
                        }}
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Reset to Today
                      </Button>
                    </div>
                    <Calendar
                      mode="range"
                      defaultMonth={analysisDateRange?.start ? new Date(analysisDateRange.start) : undefined}
                      selected={
                        analysisDateRange?.start && analysisDateRange?.end
                          ? { from: new Date(analysisDateRange.start), to: new Date(analysisDateRange.end) }
                          : undefined
                      }
                      onSelect={(range) => {
                        if (!range?.from) return;
                        const start = format(range.from, 'yyyy-MM-dd');
                        const end = range.to ? format(range.to, 'yyyy-MM-dd') : start;
                        setAnalysisDateRange({ start, end });
                      }}
                      numberOfMonths={2}
                      disabled={(date) => date > new Date()}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground font-normal">Run Analysis</Label>
                <Button
                  size="sm"
                  onClick={runFleetAnalysisAll}
                  disabled={runFleetLoading}
                  className="h-9"
                >
                  {runFleetLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  <span className="ml-2">Process All Vehicles</span>
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-right">
              Generate AI insights for all vehicles in the selected date range
            </p>
          </div>
        )}
      </div>

      {/* Empty State: No customer selected */}
      {showEmptyState && (
        <Card>
          <CardContent className="pt-6 pb-12 text-center">
            <Sparkles className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Select a customer to view AI insights</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Choose a customer from the filters above to view AI-powered compliance predictions, recommendations, and behavioral patterns.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Empty State: No data yet for this customer - prompt to process */}
      {showNoDataState && (
        <Card>
          <CardContent className="pt-6 pb-12 text-center">
            <Sparkles className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No insights available yet</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
              Click &quot;Process All Vehicles&quot; to generate AI-powered insights for this customer (all sites). Results will appear here.
            </p>
            {canRunFleetAnalysis && (
              <Button onClick={runFleetAnalysisAll} disabled={runFleetLoading}>
                {runFleetLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                Process All Vehicles
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Site filter has no data - show friendly message, don't prompt to process again */}
      {hasDataButSiteFilterEmpty && (
        <Card>
          <CardContent className="pt-6 pb-8 text-center">
            <p className="text-muted-foreground text-sm">
              No insights for the selected site. Try <strong>All Sites</strong> or choose another site in the filter above.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setViewSiteFilter('all')}
            >
              Show All Sites
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Show tabs only when customer has data (and we're not in "site filter empty" only state) */}
      {selectedCustomerRef && hasAnyCustomerData && !hasDataButSiteFilterEmpty && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-muted/60 rounded-lg p-1 h-auto flex flex-wrap gap-1">
            <TabsTrigger value="overview" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="risk" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Risk Predictions
            </TabsTrigger>
            <TabsTrigger value="recommendations" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Lightbulb className="h-4 w-4 mr-2" />
              Recommendations
            </TabsTrigger>
            <TabsTrigger value="patterns" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <BarChart3 className="h-4 w-4 mr-2" />
              Patterns
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <AIInsightsOverview
              atRiskCount={atRiskCount}
              pendingRecs={pendingRecs}
              highPriorityRecs={highPriorityRecs}
              predictions={predictions}
              recommendations={recommendations}
              washWindows={washWindows}
              driverPatterns={driverPatterns}
              siteInsights={siteInsights}
              isLoading={predictionsLoading || recsLoading}
              isSuperAdmin={isSuperAdmin}
              onViewAllAtRisk={() => setActiveTab('risk')}
              onRefresh={invalidateAiQueries}
              sitesForCustomer={sitesForCustomer}
              viewSiteFilter={viewSiteFilter}
              onSiteFilterChange={setViewSiteFilter}
            />
          </TabsContent>

          <TabsContent value="risk" className="mt-4">
            <AIInsightsRiskPredictions
              predictions={predictions}
              isLoading={predictionsLoading}
              isSuperAdmin={isSuperAdmin}
              canSendAlerts={canRunFleetAnalysis}
              onRefresh={invalidateAiQueries}
              sitesForCustomer={sitesForCustomer}
              viewSiteFilter={viewSiteFilter}
              onSiteFilterChange={setViewSiteFilter}
            />
          </TabsContent>

          <TabsContent value="recommendations" className="mt-4">
            <AIInsightsRecommendations
              recommendations={recommendations}
              isLoading={recsLoading}
              onRefresh={invalidateAiQueries}
              sitesForCustomer={sitesForCustomer}
              viewSiteFilter={viewSiteFilter}
              onSiteFilterChange={setViewSiteFilter}
            />
          </TabsContent>

          <TabsContent value="patterns" className="mt-4">
            <AIInsightsPatterns 
              companyId={companyId} 
              patternSummary={patternSummary}
              sitesForCustomer={sitesForCustomer}
              viewSiteFilter={viewSiteFilter}
              onSiteFilterChange={setViewSiteFilter}
              dateRange={dateRange}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
