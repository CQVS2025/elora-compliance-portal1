import { useState, useEffect, useCallback } from 'react';

const FILTER_STORAGE_KEY = 'elora-dashboard-filters';

const getDefaultFilters = () => ({
  selectedCustomer: 'all',
  selectedSite: 'all',
  selectedDriverIds: [],
  dateRange: {
    start: null,
    end: null,
  },
  activePeriod: 'Month',
});

/**
 * Reads the same dashboard filters persisted by the main Compliance Dashboard (sessionStorage).
 * Used by Washout Compliance so data reflects the top-level customer/site selection.
 */
export function getStoredDashboardFilters() {
  try {
    const raw = typeof sessionStorage !== 'undefined' && sessionStorage.getItem(FILTER_STORAGE_KEY);
    if (!raw) return getDefaultFilters();
    const parsed = JSON.parse(raw);
    const defaults = getDefaultFilters();
    return {
      selectedCustomer: parsed.selectedCustomer ?? defaults.selectedCustomer,
      selectedSite: parsed.selectedSite ?? defaults.selectedSite,
      selectedDriverIds: Array.isArray(parsed.selectedDriverIds) ? parsed.selectedDriverIds : defaults.selectedDriverIds,
      dateRange: parsed.dateRange && typeof parsed.dateRange === 'object' && parsed.dateRange.start && parsed.dateRange.end
        ? { start: parsed.dateRange.start, end: parsed.dateRange.end }
        : defaults.dateRange,
      activePeriod: parsed.activePeriod ?? defaults.activePeriod,
    };
  } catch {
    return getDefaultFilters();
  }
}

/**
 * Hook that returns the current dashboard filters from sessionStorage and updates when the window regains focus
 * (e.g. user switched to Compliance, changed filter, came back to Washout).
 */
export function useDashboardFilters() {
  const [filters, setFilters] = useState(getStoredDashboardFilters);

  const refresh = useCallback(() => {
    setFilters(getStoredDashboardFilters());
  }, []);

  useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  return { ...filters, refresh };
}
