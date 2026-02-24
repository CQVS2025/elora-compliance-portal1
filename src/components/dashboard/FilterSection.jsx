import React, { useMemo } from 'react';
import { Calendar as CalendarIcon, Loader2, RotateCcw, Building2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, formatDistanceToNow } from 'date-fns';
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
import { MultiSelection } from '@/components/ui/multi-selection';
/**
 * shadcn-style Filter Section: Customer, Site, Drivers/Vehicles, Date range.
 * Role-based visibility and locks preserved. Driver selection persists app-wide.
 */
export default function FilterSection({
  customers,
  sites,
  selectedCustomer,
  setSelectedCustomer,
  selectedSite,
  setSelectedSite,
  vehiclesForDriverFilter = [],
  selectedDriverIds = [],
  setSelectedDriverIds,
  devicesForFilter = [],
  selectedDeviceId = 'all',
  setSelectedDeviceId,
  dateRange,
  setDateRange,
  activePeriod,
  setActivePeriod,
  companyName = null,
  companyLogoUrl = null,
  onResetDateRange = null,
  lockCustomerFilter = false,
  lockSiteFilter = false,
  restrictedCustomerName = null,
  restrictedSiteName = null,
  isFiltering = false,
  filterQueriesFetching,
  isDataLoading = false,
  isResetting = false,
  suppressDriverDropdownLoader = false,
  lastSyncedAt = null,
}) {
  const driverOptions = useMemo(() => {
    const list = vehiclesForDriverFilter || [];
    return list
      .map((v) => {
        const ref = String(v.id ?? v.rfid ?? '');
        return ref ? { value: ref, label: v.name ?? ref } : null;
      })
      .filter(Boolean);
  }, [vehiclesForDriverFilter]);

  const deviceOptions = useMemo(() => {
    const list = devicesForFilter || [];
    return list.map((d) => {
      const ref = d.deviceRef ?? d.ref ?? d.id ?? '';
      const name = d.computerName ?? d.deviceName ?? d.computerSerialId ?? (ref || '—');
      const statusLabel = d.statusLabel ?? d.status ?? '';
      const label = statusLabel ? `${name} (${statusLabel})` : name;
      return ref ? { value: String(ref), label } : null;
    }).filter(Boolean);
  }, [devicesForFilter]);

  const isSyncing = (filterQueriesFetching ?? isFiltering) || isDataLoading;
  const showLoading = !suppressDriverDropdownLoader && isSyncing;
  const syncDate = lastSyncedAt ? (typeof lastSyncedAt === 'number' ? new Date(lastSyncedAt) : lastSyncedAt) : null;
  const syncLabel = syncDate
    ? formatDistanceToNow(syncDate, { addSuffix: false }).replace('about ', '')
    : null;

  const statusMessage = (() => {
    if (isSyncing) {
      if (syncLabel) return `Syncing — ${syncLabel} since last update`;
      return 'Syncing…';
    }
    if (syncLabel) return `Live — Synced ${syncLabel} ago`;
    return null;
  })();
  const showSyncingPill = isSyncing;
  const showLivePill = !isSyncing && !!statusMessage;
  const displayName = companyName || restrictedCustomerName;
  const showCompanyBadge = lockCustomerFilter && displayName;
  const showSiteBadgeOnly = lockSiteFilter && restrictedSiteName && !showCompanyBadge;

  return (
    <div className="space-y-4">
      {showCompanyBadge && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-5 rounded-xl border border-border bg-card px-5 py-4 shadow-sm"
        >
          <div
            className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border ${
              companyLogoUrl ? 'h-20 w-24 min-h-[5rem] min-w-[6rem] bg-card' : 'h-20 w-24 min-h-[5rem] min-w-[6rem] bg-muted'
            }`}
          >
            {companyLogoUrl ? (
              <img
                src={companyLogoUrl}
                alt=""
                className="h-full w-full object-contain p-2"
              />
            ) : (
              <Building2 className="h-10 w-10 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            
            <p className="truncate text-lg font-semibold text-foreground">
              {displayName}
            </p>
            {lockSiteFilter && restrictedSiteName && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                Site: <span className="font-medium text-foreground">{restrictedSiteName}</span>
              </p>
            )}
          </div>
        </motion.div>
      )}
      {showSiteBadgeOnly && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
        >
          Viewing site: <span className="font-medium text-foreground">{restrictedSiteName}</span>
        </motion.div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {lockCustomerFilter && displayName ? (
          <div className="flex h-10 min-w-[180px] items-center rounded-md border border-transparent px-3 text-sm font-medium text-foreground">
            {displayName}
          </div>
        ) : (
          <Select
            value={selectedCustomer}
            onValueChange={setSelectedCustomer}
          >
            <SelectTrigger className="min-w-[180px]">
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
        )}

        {lockSiteFilter && restrictedSiteName ? (
          <div className="flex h-10 min-w-[160px] items-center rounded-md border border-transparent px-3 text-sm font-medium text-foreground">
            {restrictedSiteName}
          </div>
        ) : (
          <div className="relative">
            <Select
              value={selectedSite}
              onValueChange={setSelectedSite}
            >
              <SelectTrigger className="min-w-[160px]">
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
          </div>
        )}

        {typeof setSelectedDriverIds === 'function' && (
          <div className="min-w-[200px] max-w-[280px]">
            <MultiSelection
              value={selectedDriverIds}
              options={driverOptions}
              onValueSelected={(ids) => setSelectedDriverIds(ids ?? [])}
              isLoading={showLoading}
            />
          </div>
        )}

        {typeof setSelectedDeviceId === 'function' && (
          <Select
            value={selectedDeviceId}
            onValueChange={setSelectedDeviceId}
          >
            <SelectTrigger className="min-w-[160px]">
              <SelectValue placeholder="All devices" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All devices</SelectItem>
              {deviceOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

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

        {onResetDateRange && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => onResetDateRange()}
          >
            <RotateCcw className="mr-1.5 h-4 w-4" />
            Reset
          </Button>
        )}

        <AnimatePresence mode="wait">
          {showSyncingPill ? (
            <motion.div
              key="syncing"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="relative flex items-center gap-2.5 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/30"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
              </span>
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                {statusMessage}
              </span>
            </motion.div>
          ) : showLivePill ? (
            <motion.div
              key="live"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="relative flex items-center gap-2.5 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/30"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                {statusMessage}
              </span>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
