import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { gsap, useGSAP } from '@/lib/gsap';

/**
 * Shown when Washout Compliance is viewed without BORAL QLD selected in the Compliance dashboard.
 */
export default function WashoutEmptyState({ message, title = 'Washout Compliance', subtitle = 'Fleet washout monitoring & dedagging prevention' }) {
  const wrapRef = useRef(null);
  useGSAP(() => {
    if (wrapRef.current) {
      gsap.from(wrapRef.current, { opacity: 0, y: 12, duration: 0.35, ease: 'power2.out' });
    }
  }, { scope: wrapRef });

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card border-b border-border">
        <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6">
          <h1 className="text-3xl font-bold text-foreground">{title}</h1>
          <p className="text-muted-foreground mt-1">{subtitle}</p>
        </div>
      </div>
      <main className="max-w-[1600px] mx-auto px-4 md:px-6 py-6">
        <div ref={wrapRef}>
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-foreground mb-4">{message}</p>
            <Button asChild>
              <Link to="/compliance">Go to Compliance</Link>
            </Button>
          </CardContent>
        </Card>
        </div>
      </main>
    </div>
  );
}
