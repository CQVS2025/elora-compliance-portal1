import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2 } from 'lucide-react';

const GLASSY_WRAPPER = 'rounded-2xl border border-border bg-card/80 backdrop-blur-md shadow-sm overflow-hidden';

/** Full-page glassy skeleton: 4 stat cards + table (Overview style) */
export function OverviewGlassySkeleton() {
  return (
    <div className={`space-y-6 ${GLASSY_WRAPPER} p-6`}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-10 rounded-lg" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-9 w-24 mb-2" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="border-border">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <div className="flex gap-3 mt-2">
            <Skeleton className="h-10 w-72" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><Skeleton className="h-4 w-20" /></TableHead>
                  <TableHead><Skeleton className="h-4 w-16" /></TableHead>
                  <TableHead><Skeleton className="h-4 w-14" /></TableHead>
                  <TableHead><Skeleton className="h-4 w-18" /></TableHead>
                  <TableHead><Skeleton className="h-4 w-12" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((j) => (
                  <TableRow key={j}>
                    <TableCell><Skeleton className="h-4 w-full max-w-[140px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-14" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-10" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-16" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** Glassy skeleton: 4 cards + chart area (Per Truck / Per Site style) */
export function CardsAndChartsGlassySkeleton() {
  return (
    <div className={`space-y-6 ${GLASSY_WRAPPER} p-6`}>
      <div className="flex justify-end">
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border-border">
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20 mb-2" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="border-border">
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-48 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full rounded-lg" />
        </CardContent>
      </Card>
      <Card className="border-border">
        <CardHeader>
          <Skeleton className="h-6 w-36" />
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><Skeleton className="h-4 w-24" /></TableHead>
                  <TableHead><Skeleton className="h-4 w-16" /></TableHead>
                  <TableHead><Skeleton className="h-4 w-14" /></TableHead>
                  <TableHead><Skeleton className="h-4 w-12" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[1, 2, 3, 4, 5].map((j) => (
                  <TableRow key={j}>
                    <TableCell><Skeleton className="h-4 w-full max-w-[120px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-14" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-10" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** Glassy skeleton: Site Comparison (dropdowns + cards + chart) */
export function SiteComparisonGlassySkeleton() {
  return (
    <div className={`space-y-6 ${GLASSY_WRAPPER} p-6`}>
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-10 w-[220px]" />
        <span className="text-muted-foreground text-sm">vs</span>
        <Skeleton className="h-10 w-[220px]" />
        <Skeleton className="h-9 w-8 rounded" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border-border">
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-28" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-7 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="border-border">
        <CardHeader>
          <Skeleton className="h-6 w-44" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[280px] w-full rounded-lg" />
        </CardContent>
      </Card>
      <Card className="border-border">
        <CardHeader>
          <Skeleton className="h-6 w-36" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <Skeleton className="h-4 w-28" />
                <div className="flex gap-4">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** Glassy skeleton: Pricing Calculator (selects + param cards) */
export function PricingCalculatorGlassySkeleton() {
  return (
    <div className={`space-y-6 ${GLASSY_WRAPPER} p-6`}>
      <div>
        <Skeleton className="h-6 w-48 mb-3" />
        <div className="flex flex-wrap gap-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-[220px]" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-10 w-[220px]" />
          </div>
          <div className="flex gap-6 ml-4">
            <div><Skeleton className="h-3 w-24 mb-1" /><Skeleton className="h-6 w-12" /></div>
            <div><Skeleton className="h-3 w-28 mb-1" /><Skeleton className="h-6 w-16" /></div>
            <div><Skeleton className="h-3 w-24 mb-1" /><Skeleton className="h-6 w-14" /></div>
          </div>
        </div>
      </div>
      <div>
        <Skeleton className="h-4 w-56 mb-2" />
        <div className="flex flex-wrap gap-4">
          <Skeleton className="h-24 flex-1 min-w-[100px] rounded-lg" />
          <Skeleton className="h-24 flex-1 min-w-[100px] rounded-lg" />
          <Skeleton className="h-24 flex-1 min-w-[100px] rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border">
          <CardHeader><Skeleton className="h-5 w-40" /><Skeleton className="h-3 w-32 mt-1" /></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-24 w-full rounded-lg" />
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-24 w-full rounded-lg" />
            <div className="flex gap-3">
              <Skeleton className="h-10 w-44" />
              <Skeleton className="h-10 w-32" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** Overlay shown while an action is in progress (export, email, PDF, send proposal, etc.) */
export function ActionLoaderOverlay({ show, message = 'Working...' }) {
  if (!show) return null;
  return (
    <div className="absolute inset-0 bg-background/60 backdrop-blur-sm z-10 flex items-center justify-center rounded-2xl">
      <div className="flex items-center gap-3 bg-card px-6 py-3 rounded-xl shadow-lg border border-border">
        <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
        <span className="text-sm font-medium text-foreground">{message}</span>
      </div>
    </div>
  );
}
