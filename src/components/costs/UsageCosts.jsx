import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePermissions } from '@/components/auth/PermissionGuard';
import { LayoutDashboard, Truck, MapPin, GitCompare, Calculator, Lightbulb, Wallet, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import UsageCostsOverview from './UsageCostsOverview';
import UsageCostsPerTruck from './UsageCostsPerTruck';
import UsageCostsPerSite from './UsageCostsPerSite';
import UsageCostsSiteComparison from './UsageCostsSiteComparison';
import UsageCostsPricingCalculator from './UsageCostsPricingCalculator';
import UsageCostsScenarioBuilder from './UsageCostsScenarioBuilder';
import UsageCostsBudgetTracker from './UsageCostsBudgetTracker';

const USAGE_COST_TABS = [
  { value: 'overview',           label: 'Overview',           Component: UsageCostsOverview,          icon: LayoutDashboard },
  { value: 'per-truck',          label: 'Per Truck Costs',    Component: UsageCostsPerTruck,          icon: Truck },
  { value: 'per-site',           label: 'Per Site Costs',     Component: UsageCostsPerSite,           icon: MapPin },
  { value: 'site-comparison',    label: 'Site Comparison',    Component: UsageCostsSiteComparison,    icon: GitCompare },
  { value: 'pricing-calculator', label: 'Pricing Calculator', Component: UsageCostsPricingCalculator, icon: Calculator },
  { value: 'scenario-builder',   label: 'Scenario Builder',   Component: UsageCostsScenarioBuilder,   icon: Lightbulb },
  { value: 'budget-tracker',     label: 'Budget Tracker',     Component: UsageCostsBudgetTracker,     icon: Wallet },
];

const TAB_PARAM = 'tab';

// ─────────────────────────────────────────────────────────────────────────────
// Shared dropdown — mobile (<lg) AND tablet (md–lg), hidden at lg+ via prop
// ─────────────────────────────────────────────────────────────────────────────
function TabDropdown({ tabs, activeTab, onSelect, className }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const active = tabs.find((t) => t.value === activeTab) ?? tabs[0];
  const Icon = active?.icon ?? LayoutDashboard;

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className={cn('relative w-full', className)}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'w-full flex items-center justify-between gap-3',
          'px-4 py-3.5 rounded-xl',
          'bg-white dark:bg-slate-900',
          'border border-blue-200 dark:border-blue-800',
          'shadow-sm',
          'text-blue-700 dark:text-blue-300 font-semibold text-sm',
          'transition-all duration-150',
          open && 'ring-2 ring-blue-400/40 dark:ring-blue-600/40'
        )}
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <Icon className="w-5 h-5 shrink-0 text-blue-500 dark:text-blue-400" />
          <span className="truncate">{active?.label}</span>
        </span>
        <ChevronDown
          className={cn(
            'w-4 h-4 shrink-0 text-blue-400 dark:text-blue-500 transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown list */}
      {open && (
        <ul
          role="listbox"
          className={cn(
            'absolute z-50 top-[calc(100%+6px)] left-0 right-0',
            'bg-white dark:bg-slate-900',
            'border border-blue-100 dark:border-blue-800',
            'rounded-xl overflow-hidden',
            'shadow-xl shadow-black/10 dark:shadow-black/40'
          )}
        >
          {tabs.map((tab) => {
            const TabIcon = tab.icon;
            const isActive = tab.value === activeTab;
            return (
              <li
                key={tab.value}
                role="option"
                aria-selected={isActive}
                onClick={() => { onSelect(tab.value); setOpen(false); }}
                className={cn(
                  'flex items-center gap-3 px-4 py-3.5 cursor-pointer text-sm font-medium',
                  'transition-colors duration-100',
                  'border-b border-slate-100 dark:border-slate-800 last:border-0',
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-blue-50/60 dark:hover:bg-blue-950/30 hover:text-blue-700 dark:hover:text-blue-300'
                )}
              >
                <TabIcon
                  className={cn(
                    'w-4 h-4 shrink-0',
                    isActive ? 'text-blue-500 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'
                  )}
                />
                <span className="flex-1">{tab.label}</span>
                {isActive && <Check className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Desktop tab bar — lg+ only.
// Uses plain <button> elements instead of shadcn TabsTrigger/TabsList so we
// have 100% control over height and padding — no internal height overrides
// from shadcn can clip the tabs.
// ─────────────────────────────────────────────────────────────────────────────
function DesktopTabBar({ tabs, activeTab, onSelect }) {
  return (
    <div
      role="tablist"
      className={cn(
        'hidden lg:flex flex-wrap justify-center items-center gap-2',
        // Solid background so the bar is always visible
        'bg-slate-100/80 dark:bg-slate-800/70',
        'border border-slate-200 dark:border-slate-700',
        'rounded-xl',
        // Explicit padding on all sides — enough room so wrapping rows are
        // never cut off at the bottom
        'p-3',
      )}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(tab.value)}
            className={cn(
              // Fixed, explicit height so nothing is ambiguous
              'inline-flex items-center gap-2.5',
              'px-5 py-3 h-11 rounded-lg cursor-pointer',
              'text-sm font-semibold whitespace-nowrap',
              'transition-all duration-200 ease-out',
              // Inactive / default state – always blue-toned
              'text-blue-600 dark:text-blue-300',
              'hover:text-blue-700 dark:hover:text-blue-200',
              'hover:bg-white dark:hover:bg-slate-900/60',
              // Active state (conditional, not data-* so we own it fully)
              isActive
                ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 font-bold shadow-sm ring-1 ring-blue-200 dark:ring-blue-800'
                : ''
            )}
          >
            <Icon
              className={cn(
                'w-[18px] h-[18px] shrink-0',
                isActive ? 'text-blue-600 dark:text-blue-400' : 'text-blue-500 dark:text-blue-300'
              )}
            />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root component
// ─────────────────────────────────────────────────────────────────────────────
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
      <div className="rounded-xl border border-border bg-muted/30 p-6 text-center">
        <p className="text-sm font-medium text-foreground">No usage cost sections are available</p>
        <p className="text-xs text-muted-foreground mt-1">
          Your role or company has disabled all sections. Contact your administrator to enable Overview, Per Truck Costs, or other sections.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 min-w-0 w-full overflow-hidden">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">

        {/* Mobile + Tablet: dropdown (below lg breakpoint) */}
        <TabDropdown
          tabs={allowedTabs}
          activeTab={activeTab}
          onSelect={setActiveTab}
          className="lg:hidden"
        />

        {/* Desktop: custom plain-button tab bar (lg and above) */}
        <DesktopTabBar
          tabs={allowedTabs}
          activeTab={activeTab}
          onSelect={setActiveTab}
        />

        {/* Tab content panels */}
        {allowedTabs.map((tab) => (
          <TabsContent
            key={tab.value}
            value={tab.value}
            className="mt-4 focus-visible:outline-none"
          >
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