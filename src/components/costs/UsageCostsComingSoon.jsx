import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Construction } from 'lucide-react';

export default function UsageCostsComingSoon({ title }) {
  return (
    <div className="flex items-center justify-center py-16">
      <Card className="max-w-md w-full border-dashed">
        <CardContent className="pt-8 pb-8 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
            <Construction className="w-7 h-7 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
          <p className="text-sm text-muted-foreground">This section is coming soon.</p>
        </CardContent>
      </Card>
    </div>
  );
}
