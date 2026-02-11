import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function TankLevelCardSkeleton() {
  return (
    <Card className="border border-border">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="min-w-0 flex-1">
            <Skeleton className="h-5 w-32 mb-2" />
            <Skeleton className="h-4 w-24 mb-1" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-5 w-16 rounded shrink-0" />
        </div>
        <div className="flex flex-wrap gap-6 justify-center">
          <div className="flex flex-col items-center gap-1.5">
            <Skeleton className="w-12 h-20 rounded-b" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <Skeleton className="w-12 h-20 rounded-b" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <div className="flex items-center justify-between pt-4 mt-3 border-t border-border">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-8" />
        </div>
      </CardContent>
    </Card>
  );
}
