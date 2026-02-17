import React from 'react';
import './App.css'
import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from "@/components/theme-provider"
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { queryClientInstance } from '@/lib/query-client'
import VisualEditAgent from '@/lib/VisualEditAgent'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';
import ProtectedRoute, { AdminRoute, SuperAdminRoute, AuthenticatedRoute, PublicRoute } from '@/components/auth/ProtectedRoute';
import DashboardLayout from '@/components/layout/DashboardLayout';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'user_unassigned' || authError.type === 'company_deactivated' || authError.type === 'account_deactivated') {
      navigateToLogin();
      return null;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    } else if (authError.type === 'config_error' || authError.type === 'timeout' || authError.type === 'unknown') {
      // Show configuration or connection error
      return (
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-red-600 mb-4">Configuration Error</h2>
            <p className="text-gray-700 mb-4">{authError.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
  }

  // Render the main app with route protection
  return (
    <>
      <OnboardingWizard />
      <Routes>
        {/* Public routes - Only accessible when NOT authenticated */}
        <Route path="/Login" element={
          <PublicRoute>
            <Pages.Login />
          </PublicRoute>
        } />
        <Route path="/login" element={
          <PublicRoute>
            <Pages.Login />
          </PublicRoute>
        } />

        {/* Protected route - Main Dashboard (requires authentication). / = Dashboard home; /compliance = Compliance tab. */}
        <Route path="/" element={
          <AuthenticatedRoute>
            <DashboardLayout>
              <MainPage />
            </DashboardLayout>
          </AuthenticatedRoute>
        } />
        <Route path="/compliance" element={
          <AuthenticatedRoute>
            <DashboardLayout>
              <MainPage />
            </DashboardLayout>
          </AuthenticatedRoute>
        } />
        <Route path="/dashboard" element={
          <AuthenticatedRoute>
            <DashboardLayout>
              <MainPage />
            </DashboardLayout>
          </AuthenticatedRoute>
        } />

        {/* Dashboard section routes - same Dashboard, content by path */}
        <Route path="/usage-costs" element={
          <AuthenticatedRoute>
            <DashboardLayout>
              <MainPage />
            </DashboardLayout>
          </AuthenticatedRoute>
        } />
        <Route path="/tank-levels" element={
          <AuthenticatedRoute>
            <DashboardLayout>
              {React.createElement(Pages.TankLevels)}
            </DashboardLayout>
          </AuthenticatedRoute>
        } />
        <Route path="/refills" element={
          <AuthenticatedRoute>
            <DashboardLayout>
              {React.createElement(Pages.TankLevels)}
            </DashboardLayout>
          </AuthenticatedRoute>
        } />
        <Route path="/device-health" element={
          <AuthenticatedRoute>
            <DashboardLayout>
              <MainPage />
            </DashboardLayout>
          </AuthenticatedRoute>
        } />
        <Route path="/sites" element={
          <AuthenticatedRoute>
            <DashboardLayout>
              <MainPage />
            </DashboardLayout>
          </AuthenticatedRoute>
        } />
        <Route path="/reports" element={
          <AuthenticatedRoute>
            <DashboardLayout>
              <MainPage />
            </DashboardLayout>
          </AuthenticatedRoute>
        } />
        <Route path="/email-reports" element={
          <AuthenticatedRoute>
            <DashboardLayout>
              <MainPage />
            </DashboardLayout>
          </AuthenticatedRoute>
        } />
        <Route path="/branding" element={
          <AuthenticatedRoute>
            <DashboardLayout>
              <MainPage />
            </DashboardLayout>
          </AuthenticatedRoute>
        } />
        <Route path="/vehicle/:vehicleRef" element={
          <AuthenticatedRoute>
            <DashboardLayout>
              {React.createElement(Pages.VehicleDetail)}
            </DashboardLayout>
          </AuthenticatedRoute>
        } />
        {/* Elora AI route */}
        <Route path="/ai-insights" element={
          <AuthenticatedRoute>
            <DashboardLayout>
              {React.createElement(Pages.EloraAI)}
            </DashboardLayout>
          </AuthenticatedRoute>
        } />
        {/* SMS Alerts (Intelligence) – org admin + super_admin only, tab visibility controlled */}
        <Route path="/sms-alerts" element={
          <AuthenticatedRoute>
            <DashboardLayout>
              {React.createElement(Pages.SMSAlerts)}
            </DashboardLayout>
          </AuthenticatedRoute>
        } />

        {/* Admin routes - same layout as app, permission-based content */}
        <Route path="/admin" element={
          <AdminRoute>
            <DashboardLayout>
              <Pages.admin />
            </DashboardLayout>
          </AdminRoute>
        } />
        <Route path="/admin/users" element={
          <AdminRoute>
            <DashboardLayout>
              {React.createElement(Pages['admin/users'])}
            </DashboardLayout>
          </AdminRoute>
        } />

        <Route path="/admin/companies" element={
          <SuperAdminRoute>
            <DashboardLayout>
              {React.createElement(Pages['admin/companies'])}
            </DashboardLayout>
          </SuperAdminRoute>
        } />

        <Route path="/admin/role-management" element={
          <SuperAdminRoute>
            <DashboardLayout>
              {React.createElement(Pages['admin/role-management'])}
            </DashboardLayout>
          </SuperAdminRoute>
        } />

        <Route path="/admin/tab-visibility" element={
          <SuperAdminRoute>
            <DashboardLayout>
              {React.createElement(Pages['admin/tab-visibility'])}
            </DashboardLayout>
          </SuperAdminRoute>
        } />

        <Route path="/admin/tank-configuration" element={
          <SuperAdminRoute>
            <DashboardLayout>
              {React.createElement(Pages['admin/tank-configuration'])}
            </DashboardLayout>
          </SuperAdminRoute>
        } />

        {/* Redirect legacy super-dashboard URL to unified admin */}
        <Route path="/admin/super-dashboard" element={
          <AdminRoute>
            <Navigate to="/admin" replace />
          </AdminRoute>
        } />

        {/* Protected authenticated routes */}
        <Route path="/Dashboard" element={
          <AuthenticatedRoute>
            <DashboardLayout>
              <Pages.Dashboard />
            </DashboardLayout>
          </AuthenticatedRoute>
        } />
        <Route path="/dashboard" element={
          <AuthenticatedRoute>
            <DashboardLayout>
              <Pages.Dashboard />
            </DashboardLayout>
          </AuthenticatedRoute>
        } />

        <Route path="/Home" element={
          <AuthenticatedRoute>
            <DashboardLayout>
              <Pages.Home />
            </DashboardLayout>
          </AuthenticatedRoute>
        } />

        <Route path="/Leaderboard" element={
          <AuthenticatedRoute>
            <DashboardLayout>
              <Pages.Leaderboard />
            </DashboardLayout>
          </AuthenticatedRoute>
        } />
        <Route path="/leaderboard" element={
          <AuthenticatedRoute>
            <DashboardLayout>
              <Pages.Leaderboard />
            </DashboardLayout>
          </AuthenticatedRoute>
        } />

        <Route path="/MobileDashboard" element={
          <AuthenticatedRoute>
            <DashboardLayout>
              <Pages.MobileDashboard />
            </DashboardLayout>
          </AuthenticatedRoute>
        } />

        <Route path="/NotificationSettings" element={
          <AuthenticatedRoute>
            <DashboardLayout>
              <Pages.NotificationSettings />
            </DashboardLayout>
          </AuthenticatedRoute>
        } />
        <Route path="/notification-settings" element={
          <AuthenticatedRoute>
            <DashboardLayout>
              <Pages.NotificationSettings />
            </DashboardLayout>
          </AuthenticatedRoute>
        } />

        <Route path="/SiteAnalytics" element={
          <AuthenticatedRoute>
            <DashboardLayout>
              <Pages.SiteAnalytics />
            </DashboardLayout>
          </AuthenticatedRoute>
        } />
        <Route path="/site-analytics" element={
          <AuthenticatedRoute>
            <DashboardLayout>
              <Pages.SiteAnalytics />
            </DashboardLayout>
          </AuthenticatedRoute>
        } />

        <Route path="/EmailReportSettings" element={
          <AuthenticatedRoute>
            <DashboardLayout>
              <Pages.EmailReportSettings />
            </DashboardLayout>
          </AuthenticatedRoute>
        } />
        <Route path="/email-report-settings" element={
          <AuthenticatedRoute>
            <DashboardLayout>
              <Pages.EmailReportSettings />
            </DashboardLayout>
          </AuthenticatedRoute>
        } />

        <Route path="/Profile" element={
          <AuthenticatedRoute>
            <DashboardLayout>
              <Pages.Profile />
            </DashboardLayout>
          </AuthenticatedRoute>
        } />
        <Route path="/profile" element={
          <AuthenticatedRoute>
            <DashboardLayout>
              <Pages.Profile />
            </DashboardLayout>
          </AuthenticatedRoute>
        } />

        <Route path="/Settings" element={
          <AuthenticatedRoute>
            <DashboardLayout>
              <Pages.Settings />
            </DashboardLayout>
          </AuthenticatedRoute>
        } />
        <Route path="/settings" element={
          <AuthenticatedRoute>
            <DashboardLayout>
              <Pages.Settings />
            </DashboardLayout>
          </AuthenticatedRoute>
        } />

        {/* 404 - Page Not Found */}
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
            <NavigationTracker />
            <AuthenticatedApp />
            <Toaster />
          </ThemeProvider>
        </Router>
        <VisualEditAgent />

        {/* TanStack Query DevTools - Only in development */}
        {import.meta.env.DEV && (
          <ReactQueryDevtools
            initialIsOpen={false}
            position="bottom-right"
            buttonPosition="bottom-right"
          />
        )}
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
