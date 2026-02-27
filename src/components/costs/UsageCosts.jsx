import React, { useState } from 'react';
import { LayoutDashboard, Truck, MapPin, GitCompare, Calculator, Lightbulb, Wallet, FileText } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import UsageCostsOverview from './UsageCostsOverview';
import UsageCostsPerTruck from './UsageCostsPerTruck';
import UsageCostsPerSite from './UsageCostsPerSite';
import UsageCostsSiteComparison from './UsageCostsSiteComparison';
import UsageCostsPricingCalculator from './UsageCostsPricingCalculator';
import UsageCostsScenarioBuilder from './UsageCostsScenarioBuilder';
import UsageCostsBudgetTracker from './UsageCostsBudgetTracker';
import UsageCostsClientReports from './UsageCostsClientReports';

const USAGE_COST_TABS = [
  { value: 'overview', label: 'Overview', Component: UsageCostsOverview, icon: LayoutDashboard },
  { value: 'per-truck', label: 'Per Truck Costs', Component: UsageCostsPerTruck, icon: Truck },
  { value: 'per-site', label: 'Per Site Costs', Component: UsageCostsPerSite, icon: MapPin },
  { value: 'site-comparison', label: 'Site Comparison', Component: UsageCostsSiteComparison, icon: GitCompare },
  { value: 'pricing-calculator', label: 'Pricing Calculator', Component: UsageCostsPricingCalculator, icon: Calculator },
  { value: 'scenario-builder', label: 'Scenario Builder', Component: UsageCostsScenarioBuilder, icon: Lightbulb },
  { value: 'budget-tracker', label: 'Budget Tracker', Component: UsageCostsBudgetTracker, icon: Wallet },
  { value: 'client-reports', label: 'Client Reports', Component: UsageCostsClientReports, icon: FileText },
];

export default function UsageCosts({ selectedCustomer, selectedSite, dateRange }) {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="space-y-4 min-w-0 w-full overflow-hidden">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex flex-wrap h-auto min-h-[3.25rem] gap-2 bg-muted/50 p-2 w-full rounded-xl">
          {USAGE_COST_TABS.map((tab) => {
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
        {USAGE_COST_TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-4 focus-visible:outline-none">
            {['overview', 'per-truck', 'per-site', 'site-comparison', 'pricing-calculator', 'scenario-builder', 'budget-tracker'].includes(tab.value) ? (
              <tab.Component
                selectedCustomer={selectedCustomer}
                selectedSite={selectedSite}
                dateRange={dateRange}
              />
            ) : (
              <tab.Component />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
