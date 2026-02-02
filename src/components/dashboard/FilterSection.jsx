import React from 'react';
import { Calendar as CalendarIcon, Lock, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
/**
 * shadcn-style Filter Section: Customer, Site, Date range.
 * Role-based visibility and locks preserved.
 */
export default function FilterSection({
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

  return (
    <div className="space-y-4">
      {(lockCustomerFilter && restrictedCustomerName) || (lockSiteFilter && restrictedSiteName) ? (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-amber-900 dark:text-amber-200 mb-0.5">
              {lockSiteFilter && restrictedSiteName
                ? `Viewing ${restrictedSiteName} Only`
                : `Viewing ${restrictedCustomerName} Only`}
            </h3>
            <p className="text-sm text-amber-700 dark:text-amber-400/80">
              {lockSiteFilter
                ? 'Your account is configured to view data for this site only.'
                : 'Your account is configured to view data for this customer.'}
            </p>
          </div>
        </motion.div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Select
            value={selectedCustomer}
            onValueChange={setSelectedCustomer}
            disabled={lockCustomerFilter}
          >
            <SelectTrigger
              className={`min-w-[180px] ${lockCustomerFilter ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <SelectValue placeholder="All Customers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Customers</SelectItem>
              {customers.map((customer) => (
                <SelectItem key={customer.id} value={customer.id}>
                  {customer.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {lockCustomerFilter && (
            <Lock className="w-4 h-4 text-amber-500 absolute right-10 top-1/2 -translate-y-1/2 pointer-events-none" />
          )}
        </div>

        <div className="relative">
          <Select
            value={selectedSite}
            onValueChange={setSelectedSite}
            disabled={lockSiteFilter}
          >
            <SelectTrigger
              className={`min-w-[160px] ${lockSiteFilter ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <SelectValue placeholder="All Sites" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sites</SelectItem>
              {sites.filter((site) => site.name !== 'All Sites').map((site) => (
                <SelectItem key={site.id} value={site.id}>
                  {site.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {lockSiteFilter && (
            <Lock className="w-4 h-4 text-amber-500 absolute right-10 top-1/2 -translate-y-1/2 pointer-events-none" />
          )}
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="min-w-[240px] justify-start text-left font-normal"
            >
              <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
              {dateRange?.start && dateRange?.end ? (
                <>
                  {format(new Date(dateRange.start), 'dd/MM/yyyy')} - {format(new Date(dateRange.end), 'dd/MM/yyyy')}
                </>
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
                setDateRange({ ...dateRange, start, end });
              }}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>

        <AnimatePresence mode="wait">
          {showLoading && (
            <motion.div
              key="loading-pill"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="relative flex items-center gap-2.5 px-4 py-2 rounded-full bg-muted border border-border"
            >
              <Loader2 className="w-4 h-4 text-muted-foreground animate-spin flex-shrink-0" strokeWidth={2.25} />
              <span className="text-xs font-medium text-muted-foreground">
                {isDataLoading && !isFiltering ? 'Loading data…' : 'Updating…'}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
