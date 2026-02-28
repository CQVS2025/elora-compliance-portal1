import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePermissions } from '@/components/auth/PermissionGuard';
import { LayoutDashboard, Truck, MapPin, GitCompare, Calculator, Lightbulb, Wallet } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import UsageCostsOverview from './UsageCostsOverview';
import UsageCostsPerTruck from './UsageCostsPerTruck';
import UsageCostsPerSite from './UsageCostsPerSite';
import UsageCostsSiteComparison from './UsageCostsSiteComparison';
import UsageCostsPricingCalculator from './UsageCostsPricingCalculator';
import UsageCostsScenarioBuilder from './UsageCostsScenarioBuilder';
import UsageCostsBudgetTracker from './UsageCostsBudgetTracker';

const USAGE_COST_TABS = [
  { value: 'overview', label: 'Overview', Component: UsageCostsOverview, icon: LayoutDashboard },
  { value: 'per-truck', label: 'Per Truck Costs', Component: UsageCostsPerTruck, icon: Truck },
  { value: 'per-site', label: 'Per Site Costs', Component: UsageCostsPerSite, icon: MapPin },
  { value: 'site-comparison', label: 'Site Comparison', Component: UsageCostsSiteComparison, icon: GitCompare },
  { value: 'pricing-calculator', label: 'Pricing Calculator', Component: UsageCostsPricingCalculator, icon: Calculator },
  { value: 'scenario-builder', label: 'Scenario Builder', Component: UsageCostsScenarioBuilder, icon: Lightbulb },
  { value: 'budget-tracker', label: 'Budget Tracker', Component: UsageCostsBudgetTracker, icon: Wallet },
];

const TAB_PARAM = 'tab';

export default function UsageCosts({ selectedCustomer, selectedSite, dateRange }) {
  const { effectiveCostSubtabs = [] } = usePermissions();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get(TAB_PARAM);
  const allowedTabs = useMemo(() => {
    if (effectiveCostSubtabs.length === 0) return [];
    return USAGE_COST_TABS.filter((t) => effectiveCostSubtabs.includes(t.value));
  }, [effectiveCostSubtabs]);
  const validValues = useMemo(() => allowedTabs.map((t) => t.value), [allowedTabs]);
  const activeTab = validValues.includes(tabFromUrl) ? tabFromUrl : (validValues[0] ?? 'overview');
  const setActiveTab = (value) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === 'overview') next.delete(TAB_PARAM);
        else next.set(TAB_PARAM, value);
        return next;
      },
      { replace: true }
    );
  };

  if (allowedTabs.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-6 text-center">
        <p className="text-sm font-medium text-foreground">No usage cost sections are available</p>
        <p className="text-xs text-muted-foreground mt-1">Your role or company has disabled all sections. Contact your administrator to enable Overview, Per Truck Costs, or other sections.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 min-w-0 w-full overflow-hidden">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex flex-wrap h-auto min-h-[3.25rem] gap-2 bg-muted/50 p-2 w-full rounded-xl">
          {allowedTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex items-center gap-2 px-5 py-3 text-base font-medium min-h-[2.75rem] data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg"
              >
                <Icon className="w-5 h-5 shrink-0" />
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
        {allowedTabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-4 focus-visible:outline-none">
            <tab.Component
              selectedCustomer={selectedCustomer}
              selectedSite={selectedSite}
              dateRange={dateRange}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
