import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2, ShieldOff } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { useMarketplaceAccess } from '@/hooks/useMarketplaceAccess';

/**
 * MarketplaceRoute — gates routes under /marketplace/*.
 *
 * Allowed when the user can see the marketplace (admin OR their company has
 * marketplace_enabled = true). Anyone else is redirected to /no-access.
 *
 * `requireAdmin` further restricts to marketplace admins (used for /admin/marketplace/*).
 */
export default function MarketplaceRoute({ children, requireAdmin = false }) {
  const location = useLocation();
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const { canSee, canAdminister, isLoading: gateLoading } = useMarketplaceAccess();

  if (isLoadingAuth || gateLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm">Checking marketplace access…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/Login" state={{ from: location }} replace />;
  }

  const allowed = requireAdmin ? canAdminister : canSee;

  if (!allowed) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <ShieldOff className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h2 className="text-lg font-semibold mb-1">Marketplace not available</h2>
            <p className="text-sm text-muted-foreground mb-5">
              {requireAdmin
                ? 'You don\'t have permission to administer the marketplace.'
                : 'The marketplace isn\'t enabled for your account. Contact your Elora administrator.'}
            </p>
            <Button asChild variant="outline" size="sm">
              <a href="/">Back to dashboard</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return children;
}

export const MarketplaceAdminRoute = ({ children }) => (
  <MarketplaceRoute requireAdmin>{children}</MarketplaceRoute>
);

export const MarketplaceBuyerRoute = ({ children }) => (
  <MarketplaceRoute requireAdmin={false}>{children}</MarketplaceRoute>
);
