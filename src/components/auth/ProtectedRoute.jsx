import React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * ProtectedRoute Component
 *
 * Wraps routes that require authentication and/or specific roles.
 * - User must be logged in (requireAuth) or is redirected to Login.
 * - If allowedRoles is set, user must have a profile and one of those roles; otherwise access is denied.
 */
export default function ProtectedRoute({
  children,
  allowedRoles = [],
  redirectTo = '/',
  requireAuth = true
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { userProfile, isLoadingAuth, authError, isAuthenticated, checkAuth } = useAuth();

  // Show loading spinner while checking authentication
  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-muted/40 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Handle authentication errors (timeout, connection issues, etc.)
  if (authError) {
    return (
      <div className="min-h-screen bg-muted/40 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">
              {authError.type === 'timeout' ? 'Connection Timeout' : 'Authentication Error'}
            </h2>
            <p className="text-muted-foreground mb-6">
              {authError.type === 'timeout'
                ? 'The authentication check timed out. Please check your connection and try again.'
                : authError.message || 'An error occurred while verifying your credentials.'}
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => navigate('/', { replace: true })}>
                Go Home
              </Button>
              <Button onClick={() => checkAuth()}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Require login: redirect to Login if not authenticated
  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/Login" state={{ from: location }} replace />;
  }

  // Role-protected routes: require profile and allowed role
  if (allowedRoles.length > 0) {
    // No profile = cannot verify role; deny access (e.g. still loading or invalid state)
    if (!userProfile) {
      return <Navigate to={redirectTo} replace />;
    }
    const userRole = userProfile.role;
    const hasAccess = allowedRoles.includes(userRole);
    if (!hasAccess) {
      return (
        <div className="min-h-screen bg-muted/40 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6 text-center">
              <Shield className="w-16 h-16 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-bold text-foreground mb-2">Access Denied</h2>
              <p className="text-muted-foreground mb-2">
                You don&apos;t have permission to access this page.
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                Required role: {allowedRoles.join(' or ')}
                <br />
                Your role: {userRole ?? '—'}
              </p>
              <Button onClick={() => navigate(redirectTo, { replace: true })}>
                Return to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }
  }

  return <>{children}</>;
}

/**
 * Role-based route protection shortcuts
 */

// Admin-only routes (super_admin and admin)
export function AdminRoute({ children, redirectTo = '/' }) {
  return (
    <ProtectedRoute 
      allowedRoles={['super_admin', 'admin']} 
      redirectTo={redirectTo}
    >
      {children}
    </ProtectedRoute>
  );
}

// Super Admin-only routes
export function SuperAdminRoute({ children, redirectTo = '/admin' }) {
  return (
    <ProtectedRoute 
      allowedRoles={['super_admin']} 
      redirectTo={redirectTo}
    >
      {children}
    </ProtectedRoute>
  );
}

// Manager and above (super_admin, admin, manager)
export function ManagerRoute({ children, redirectTo = '/' }) {
  return (
    <ProtectedRoute 
      allowedRoles={['super_admin', 'admin', 'manager']} 
      redirectTo={redirectTo}
    >
      {children}
    </ProtectedRoute>
  );
}

// Any authenticated user
export function AuthenticatedRoute({ children, redirectTo = '/Login' }) {
  return (
    <ProtectedRoute 
      requireAuth={true}
      redirectTo={redirectTo}
    >
      {children}
    </ProtectedRoute>
  );
}

/**
 * PublicRoute Component
 * 
 * For pages that should only be accessible when NOT authenticated (like Login)
 * Redirects authenticated users to the dashboard
 */
export function PublicRoute({ children, redirectTo = '/' }) {
  const { isAuthenticated, isLoadingAuth } = useAuth();

  // Show loading spinner while checking authentication
  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-muted/40 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If user is authenticated, redirect them away from public pages (like login)
  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  // User is not authenticated - show the public page
  return <>{children}</>;
}

