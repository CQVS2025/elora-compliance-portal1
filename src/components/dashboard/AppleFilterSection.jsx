import React from 'react';
import { Calendar, Lock, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PeriodSelector } from '@/components/ui/TabNav';

/**
 * Apple-style Filter Section
 * Clean, minimal filter controls following Apple Human Interface Guidelines
 */
export default function AppleFilterSection({
  customers,
  sites,
  selectedCustomer,
  setSelectedCustomer,
  selectedSite,
  setSelectedSite,
  dateRange,
  setDateRange,
  activePeriod,
  setActivePeriod,
  lockCustomerFilter = false,
  lockSiteFilter = false,
  restrictedCustomerName = null,
  restrictedSiteName = null,
  isFiltering = false,
  isDataLoading = false,
}) {
  const showLoading = isFiltering || isDataLoading;
  const periods = ['Today', 'Week', 'Month'];

  return (
    <div className="space-y-4">
      {/* Restricted User Banner */}
      {(lockCustomerFilter && restrictedCustomerName) || (lockSiteFilter && restrictedSiteName) ? (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="
            backdrop-blur-xl bg-amber-50/80 dark:bg-amber-500/10
            border border-amber-200/50 dark:border-amber-500/20
            rounded-2xl p-4 flex items-start gap-3
          "
        >
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-amber-900 dark:text-amber-200 mb-0.5">
              {lockSiteFilter && restrictedSiteName 
                ? `Viewing ${restrictedSiteName} Only`
                : `Viewing ${restrictedCustomerName} Only`
              }
            </h3>
            <p className="text-sm text-amber-700 dark:text-amber-400/80">
              {lockSiteFilter 
                ? 'Your account is configured to view data for this site only.'
                : 'Your account is configured to view data for this customer.'
              }
            </p>
          </div>
        </motion.div>
      ) : null}

      {/* Filter Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Customer Dropdown */}
        <div className="relative">
          <Select
            value={selectedCustomer}
            onValueChange={setSelectedCustomer}
            disabled={lockCustomerFilter}
          >
            <SelectTrigger
              className={`
                h-10 px-4 rounded-xl min-w-[180px]
                bg-white/80 dark:bg-zinc-900/80
                border border-gray-200/50 dark:border-zinc-800/50
                backdrop-blur-xl
                hover:bg-white dark:hover:bg-zinc-900
                transition-colors
                ${lockCustomerFilter ? 'opacity-60 cursor-not-allowed' : ''}
              `}
            >
              <SelectValue placeholder="All Customers" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-gray-200/50 dark:border-zinc-800">
              <SelectItem value="all" className="rounded-lg">All Customers</SelectItem>
              {customers.map((customer) => (
                <SelectItem key={customer.id} value={customer.id} className="rounded-lg">
                  {customer.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {lockCustomerFilter && (
            <Lock className="w-4 h-4 text-amber-500 absolute right-10 top-1/2 -translate-y-1/2 pointer-events-none" />
          )}
        </div>

        {/* Site Dropdown */}
        <div className="relative">
          <Select 
            value={selectedSite} 
            onValueChange={setSelectedSite}
            disabled={lockSiteFilter}
          >
            <SelectTrigger
              className={`
                h-10 px-4 rounded-xl min-w-[160px]
                bg-white/80 dark:bg-zinc-900/80
                border border-gray-200/50 dark:border-zinc-800/50
                backdrop-blur-xl
                hover:bg-white dark:hover:bg-zinc-900
                transition-colors
                ${lockSiteFilter ? 'opacity-60 cursor-not-allowed' : ''}
              `}
            >
              <SelectValue placeholder="All Sites" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-gray-200/50 dark:border-zinc-800">
              <SelectItem value="all" className="rounded-lg">All Sites</SelectItem>
              {sites.filter(site => site.name !== 'All Sites').map((site) => (
                <SelectItem key={site.id} value={site.id} className="rounded-lg">
                  {site.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {lockSiteFilter && (
            <Lock className="w-4 h-4 text-amber-500 absolute right-10 top-1/2 -translate-y-1/2 pointer-events-none" />
          )}
        </div>

        {/* Date Range */}
        <div className="
          flex items-center gap-2 h-10 px-4
          bg-white/80 dark:bg-zinc-900/80
          border border-gray-200/50 dark:border-zinc-800/50
          rounded-xl backdrop-blur-xl
        ">
          <Calendar className="w-4 h-4 text-gray-400" />
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            className="
              bg-transparent border-0 text-sm text-gray-700 dark:text-gray-300
              focus:outline-none focus:ring-0 w-28
            "
          />
          <span className="text-gray-300 dark:text-gray-600">-</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            className="
              bg-transparent border-0 text-sm text-gray-700 dark:text-gray-300
              focus:outline-none focus:ring-0 w-28
            "
          />
        </div>

        {/* Unified loading indicator – pill with fade and subtle pulse */}
        <AnimatePresence mode="wait">
          {showLoading && (
            <motion.div
              key="loading-pill"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="
                relative flex items-center gap-2.5 px-4 py-2 rounded-full
                bg-slate-100 dark:bg-zinc-800/95
                border border-slate-200/80 dark:border-zinc-700/80
                backdrop-blur-sm
              "
            >
              <Loader2
                className="w-4 h-4 text-slate-500 dark:text-zinc-400 animate-spin flex-shrink-0"
                strokeWidth={2.25}
              />
              <span className="text-xs font-medium text-slate-600 dark:text-zinc-300">
                {isDataLoading && !isFiltering ? 'Loading data…' : 'Updating…'}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
