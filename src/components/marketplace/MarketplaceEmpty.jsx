import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { PackageSearch } from 'lucide-react';

export function MarketplaceEmpty({ title = 'Nothing here yet', description, action }) {
  return (
    <Card>
      <CardContent className="py-12 flex flex-col items-center justify-center text-center">
        <PackageSearch className="w-10 h-10 text-muted-foreground mb-3" />
        <p className="text-base font-medium mb-1">{title}</p>
        {description ? (
          <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
        ) : null}
        {action ? <div className="mt-4">{action}</div> : null}
      </CardContent>
    </Card>
  );
}

export default MarketplaceEmpty;
