import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useFirstAccessiblePath, usePermissions } from '@/components/auth/PermissionGuard';
import { Button } from '@/components/ui/button';
import { ShieldX } from 'lucide-react';

export default function NoAccess() {
  const { logout } = useAuth();
  const { firstPath, hasNoAccess } = useFirstAccessiblePath();
  const { isLoading } = usePermissions();

  if (!isLoading && !hasNoAccess && firstPath) {
    return <Navigate to={firstPath} replace />;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-muted/40">
      <div className="max-w-md w-full p-8 bg-card rounded-lg shadow-sm border text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-destructive/10">
          <ShieldX className="w-8 h-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground mb-3">No access to services</h1>
        <p className="text-muted-foreground mb-6">
          You don&apos;t have access to any of the services of this platform. Please contact admin support to request access.
        </p>
        <Button variant="outline" onClick={() => logout()}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
