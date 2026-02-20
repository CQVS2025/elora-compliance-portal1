import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

/** Match real summary stat cards: Card with CardHeader (pb-2 px-3 sm:px-6) + CardContent (px-3 sm:px-6), title + big number + subtitle */
export function SummaryCardsSkeleton() {
  return (
    <>
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="bg-card border-border overflow-hidden">
          <CardHeader className="pb-2 px-3 sm:px-6">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <Skeleton className="h-4 w-24" />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <Skeleton className="h-8 w-12 mb-2" />
            <Skeleton className="h-3 w-28" />
          </CardContent>
        </Card>
      ))}
    </>
  );
}

/** Match real By Category / Open Items by Site cards: same Card + header + ChartContainer h-[280px] */
export function ByCategoryBySiteSkeleton() {
  return (
    <>
      {[1, 2].map((i) => (
        <Card key={i} className="bg-card border-border overflow-hidden">
          <CardHeader className="pb-2 px-3 sm:px-6">
            <CardTitle className="text-sm font-medium text-foreground">
              <Skeleton className="h-4 w-28" />
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              <Skeleton className="h-3 w-48 mt-1" />
            </p>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 min-w-0">
            <Skeleton className="h-[280px] w-full rounded-lg" />
          </CardContent>
        </Card>
      ))}
    </>
  );
}

/** Match Feed view: "Showing X-Y of Z" line + list of cards with same rounded-lg border bg-card p-4 */
export function ActivityFeedSkeleton() {
  return (
    <div className="space-y-4 min-w-0">
      <Skeleton className="h-4 w-40" />
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="rounded-lg border bg-card p-4 shadow-sm space-y-3 min-h-[100px]">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <Skeleton className="h-5 w-[60%] min-w-[120px] max-w-[240px]" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-14 rounded-full" />
                <Skeleton className="h-5 w-12 rounded-full" />
              </div>
            </div>
            <Skeleton className="h-3 w-full max-w-md" />
            <div className="flex flex-wrap gap-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-28" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Match Table view: same rounded-md border wrapper + table with min-w-[640px], equal column widths */
export function ActivityTableSkeleton() {
  return (
    <div className="space-y-4 min-w-0">
      <Skeleton className="h-4 w-40" />
      <div className="rounded-md border overflow-x-auto">
        <Table className="min-w-[640px] table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[18%]"><Skeleton className="h-4 w-12" /></TableHead>
              <TableHead className="w-[12%]"><Skeleton className="h-4 w-8" /></TableHead>
              <TableHead className="w-[12%]"><Skeleton className="h-4 w-14" /></TableHead>
              <TableHead className="w-[10%]"><Skeleton className="h-4 w-12" /></TableHead>
              <TableHead className="w-[10%]"><Skeleton className="h-4 w-10" /></TableHead>
              <TableHead className="w-[14%]"><Skeleton className="h-4 w-14" /></TableHead>
              <TableHead className="w-[12%]"><Skeleton className="h-4 w-8" /></TableHead>
              <TableHead className="w-[12%]"><Skeleton className="h-4 w-14" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-full max-w-[140px]" /></TableCell>
                <TableCell><Skeleton className="h-4 w-full max-w-[80px]" /></TableCell>
                <TableCell><Skeleton className="h-4 w-full max-w-[90px]" /></TableCell>
                <TableCell><Skeleton className="h-5 w-14 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-5 w-14 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-4 w-full max-w-[100px]" /></TableCell>
                <TableCell><Skeleton className="h-4 w-full max-w-[70px]" /></TableCell>
                <TableCell><Skeleton className="h-4 w-full max-w-[90px]" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/** Match Board view: same grid grid-cols-1 md:grid-cols-3, same column styling rounded-lg border bg-muted/30 p-3, same card style inside */
export function ActivityBoardSkeleton() {
  return (
    <div className="space-y-4 min-w-0">
      <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-3">
        {['Open', 'In Progress', 'Resolved'].map((label) => (
          <div key={label} className="rounded-lg border bg-muted/30 p-3 space-y-2 min-h-[200px]">
            <div className="flex justify-between items-center mb-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-6 rounded-full" />
            </div>
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-md border bg-card p-3 space-y-2 min-h-[88px]">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-[80%]" />
                  <div className="flex gap-1 flex-wrap">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Match Calendar view: nav row + 7 weekday headers + 7x5 grid with min-h-[60px] sm:min-h-[80px], minHeight 300 */
export function ActivityCalendarSkeleton() {
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return (
    <div className="space-y-4 animate-in fade-in duration-200 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9 shrink-0" />
          <Skeleton className="h-6 w-[200px] sm:w-[280px]" />
          <Skeleton className="h-9 w-9 shrink-0" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Skeleton className="h-9 w-[180px]" />
          <Skeleton className="h-9 w-16 shrink-0" />
        </div>
      </div>
      <div className="rounded-lg border overflow-hidden min-w-0 bg-card">
        <div className="grid grid-cols-7 border-b bg-muted/50 min-w-[280px]">
          {weekDays.map((d) => (
            <div key={d} className="p-2 text-center border-r last:border-r-0">
              <Skeleton className="h-3 w-8 mx-auto" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 auto-rows-fr min-w-[280px]" style={{ minHeight: 400 }}>
          {Array.from({ length: 35 }).map((_, i) => (
            <div
              key={i}
              className="min-h-[80px] sm:min-h-[100px] border-b border-r last:border-r-0 p-1 sm:p-2 flex flex-col"
            >
              <Skeleton className="h-6 sm:h-7 w-6 sm:w-7 rounded-full mx-auto mb-1" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-8 w-full rounded-md" />
                <Skeleton className="h-8 w-full rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Match Entry Detail modal layout: badges, title, location block, assigned/dates, description, status row */
export function EntryDetailSkeleton() {
  return (
    <div className="space-y-5 sm:space-y-6 animate-in fade-in duration-200 min-w-0">
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-14 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="min-w-0">
        <Skeleton className="h-6 w-[75%] max-w-[280px] mb-2" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <div className="rounded-lg border bg-card p-3 sm:p-4 space-y-3 min-w-0">
        <Skeleton className="h-3 w-32" />
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          <div className="flex items-start gap-3">
            <Skeleton className="h-9 w-9 rounded-md shrink-0" />
            <div className="min-w-0 space-y-1 flex-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-28" />
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Skeleton className="h-9 w-9 rounded-md shrink-0" />
            <div className="min-w-0 space-y-1 flex-1">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        </div>
      </div>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
        <div className="rounded-lg border p-3 flex items-center gap-3 min-w-0">
          <Skeleton className="h-9 w-9 rounded-full shrink-0" />
          <div className="space-y-1 min-w-0">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <div className="rounded-lg border p-3 flex items-center gap-3 min-w-0">
          <Skeleton className="h-5 w-5 shrink-0" />
          <div className="space-y-1 min-w-0">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-36" />
          </div>
        </div>
      </div>
      <div className="rounded-lg border p-4 space-y-2 min-w-0">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-[85%]" />
        <Skeleton className="h-4 w-[70%]" />
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 min-w-0">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-full sm:w-[180px]" />
      </div>
      <Skeleton className="h-3 w-56" />
    </div>
  );
}

export function FiltersRowSkeleton() {
  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full">
      <Skeleton className="h-9 w-full sm:w-[200px] min-w-0" />
      <Skeleton className="h-9 w-full sm:w-[180px] min-w-0" />
      <Skeleton className="h-9 w-full sm:w-[200px] min-w-0" />
      <Skeleton className="h-9 w-full sm:w-[140px] min-w-0" />
      <Skeleton className="h-9 w-full sm:w-[160px] min-w-0" />
      <Skeleton className="h-9 w-full sm:w-[160px] min-w-0" />
      <Skeleton className="h-9 w-20 shrink-0" />
    </div>
  );
}
