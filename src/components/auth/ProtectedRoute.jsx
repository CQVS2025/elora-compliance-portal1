import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * ProtectedRoute Component
 * 
 * Wraps routes that require authentication and/or specific roles.
 * Handles loading states, auth errors, and unauthorized access gracefully.
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - The component to render if authorized
 * @param {string[]} props.allowedRoles - Array of roles that can access this route
 * @param {string} props.redirectTo - Path to redirect unauthorized users (default: '/')
 * @param {boolean} props.requireAuth - Whether authentication is required (default: true)
 */
export default function ProtectedRoute({ 
  children, 
  allowedRoles = [], 
  redirectTo = '/',
  requireAuth = true 
}) {
  const location = useLocation();
  const { user, userProfile, isLoadingAuth, authError, isAuthenticated, checkAuth } = useAuth();

  // Show loading spinner while checking authentication
  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#7CB342] animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Handle authentication errors (timeout, connection issues, etc.)
  if (authError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-800 mb-2">
              {authError.type === 'timeout' ? 'Connection Timeout' : 'Authentication Error'}
            </h2>
            <p className="text-slate-600 mb-6">
              {authError.type === 'timeout'
                ? 'The authentication check timed out. Please check your connection and try again.'
                : authError.message || 'An error occurred while verifying your credentials.'}
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => window.location.href = '/'}>
                Go Home
              </Button>
              <Button onClick={() => checkAuth()} className="bg-[#7CB342] hover:bg-[#689F38]">
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if authentication is required
  if (requireAuth && !isAuthenticated) {
    // Redirect to login page, preserving the intended destination
    return <Navigate to="/Login" state={{ from: location }} replace />;
  }

  // Check role-based access if roles are specified
  if (allowedRoles.length > 0 && userProfile) {
    const userRole = userProfile.role;
    const hasAccess = allowedRoles.includes(userRole);

    if (!hasAccess) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6 text-center">
              <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-slate-800 mb-2">Access Denied</h2>
              <p className="text-slate-600 mb-2">
                You don't have permission to access this page.
              </p>
              <p className="text-sm text-slate-500 mb-6">
                Required role: {allowedRoles.join(', ')}
                <br />
                Your role: {userRole}
              </p>
              <Button onClick={() => window.location.href = redirectTo}>
                Return to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }
  }

  // User is authenticated and authorized - render the protected content
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

