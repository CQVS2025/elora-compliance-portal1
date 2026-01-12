import React from 'react';
import { Calendar, Lock, AlertCircle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  restrictedCustomerName = null,
}) {
  const periods = ['Today', 'Week', 'Month'];

  return (
    <div className="space-y-4">
      {/* Restricted User Banner */}
      {lockCustomerFilter && restrictedCustomerName && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-amber-900 mb-1">
              Restricted Access - Viewing {restrictedCustomerName} Only
            </h3>
            <p className="text-sm text-amber-700">
              Your account has restricted access. You can only view data for {restrictedCustomerName}.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
        <div className="flex flex-wrap items-center gap-4">
        {/* Customer Dropdown */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="relative">
                <Select
                  value={selectedCustomer}
                  onValueChange={setSelectedCustomer}
                  disabled={lockCustomerFilter}
                >
                  <SelectTrigger
                    className="w-[180px] border-slate-200"
                    style={{ '--tw-ring-color': 'var(--client-primary)' }}
                    disabled={lockCustomerFilter}
                  >
                    <SelectValue placeholder="Select Customer" />
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
                  <Lock className="w-4 h-4 text-amber-600 absolute right-9 top-1/2 -translate-y-1/2 pointer-events-none" />
                )}
              </div>
            </TooltipTrigger>
            {lockCustomerFilter && (
              <TooltipContent>
                <p>Customer filter is locked for your account</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>

        {/* Site Dropdown */}
        <Select 
          value={selectedSite} 
          onValueChange={setSelectedSite}
        >
          <SelectTrigger className="w-[180px] border-slate-200" style={{ '--tw-ring-color': 'var(--client-primary)' }}>
            <SelectValue placeholder="Select Site" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sites</SelectItem>
            {sites.filter(site => site.name !== 'All Sites').map((site) => (
              <SelectItem key={site.id} value={site.id}>
                {site.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date Range */}
        <div className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-md bg-white">
          <Calendar className="w-4 h-4 text-slate-400" />
          <Input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            className="border-0 p-0 h-auto w-32 focus-visible:ring-0 text-sm"
          />
          <span className="text-slate-300">|</span>
          <Input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            className="border-0 p-0 h-auto w-32 focus-visible:ring-0 text-sm"
          />
        </div>

        {/* Period Buttons */}
        <div className="flex rounded-lg overflow-hidden border border-slate-200">
          {periods.map((period) => (
            <Button
              key={period}
              variant="ghost"
              size="sm"
              onClick={() => setActivePeriod(period)}
              className={`rounded-none px-4 transition-all duration-300 ${
                activePeriod === period
                  ? 'text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
              style={activePeriod === period ? { 
                backgroundColor: 'var(--client-primary)',
              } : {}}
            >
              {period}
            </Button>
          ))}
        </div>
      </div>
    </div>
    </div>
  );
}