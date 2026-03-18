import React from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, Sidebar } from '@/components/ui/sidebar';
import { Home, Building2 } from 'lucide-react';
import NavMain from '@/components/NavMain';
import NavUser from '@/components/NavUser';
import SiteHeader from '@/components/SiteHeader';
import { useAuth } from '@/lib/AuthContext';
import { usePermissions, useFirstAccessiblePath } from '@/components/auth/PermissionGuard';

const ELORA_LOGO_URL = 'https://mtjfypwrtvzhnzgatoim.supabase.co/storage/v1/object/public/EloraBucket/company-logos/89d845f5-e06f-4d47-8137-b58c79245a6c/1770066973198-3tv73wrjy56.jpg';

const PATH_TO_HEADER = {
  '/': { title: 'Dashboard', description: 'Welcome and overview' },
  '/Dashboard': { title: 'Dashboard', description: 'Welcome and overview' },
  '/dashboard': { title: 'Dashboard', description: 'Welcome and overview' },
  '/compliance': { title: 'Compliance', description: 'Fleet compliance overview' },
  '/vehicle-image-log': { title: 'Vehicle Image Log', description: 'Upload and view vehicle images' },
  '/usage-costs': { title: 'Usage Costs', description: 'Cost and usage analytics' },
  '/tank-levels': { title: 'Tank Levels', description: 'Real-time chemical inventory monitoring' },
  '/refills': { title: 'Tank Levels', description: 'Real-time chemical inventory monitoring' }, // Legacy redirect
  '/device-health': { title: 'Device Health', description: 'Device status' },
  '/sites': { title: 'Sites', description: 'Site management' },
  '/reports': { title: 'Reports', description: 'Reports and exports' },
  '/email-reports': { title: 'Email Reports', description: 'Scheduled and digest emails' },
  '/branding': { title: 'Branding', description: 'Customize branding' },
  '/ai-insights': { title: 'Elora AI', description: 'Intelligent wash optimization & predictions' },
  '/sms-alerts': { title: 'SMS Alerts', description: 'Risk prediction alert history' },
  '/alerts': { title: 'Alerts', description: 'Configure and monitor your real-time notification triggers' },
  '/operations-log': { title: 'Operations Log', description: 'Site activity tracking, notes & task management' },
  '/delivery-calendar': { title: 'Delivery Calendar', description: 'Delivery schedule from Notion' },
  '/report-schedules': { title: 'Report Schedules', description: 'Manage client report delivery, who gets what, and when' },
  '/stock-orders': { title: 'Stock & Orders', description: 'Stock take and request parts' },
  '/Settings': { title: 'Settings', description: 'Manage your account preferences' },
  '/settings': { title: 'Settings', description: 'Manage your account preferences' },
  '/Profile': { title: 'Profile', description: 'Your account profile' },
  '/profile': { title: 'Profile', description: 'Your account profile' },
  '/Leaderboard': { title: 'Driver Leaderboard', description: 'Compete, achieve, and dominate the fleet!' },
  '/leaderboard': { title: 'Driver Leaderboard', description: 'Compete, achieve, and dominate the fleet!' },
  '/admin': { title: 'Admin Console', description: 'Manage users, companies, and settings' },
  '/admin/users': { title: 'User Management', description: 'Create and manage user accounts' },
  '/admin/companies': { title: 'Company Management', description: 'Manage companies and branding' },
  '/admin/role-management': { title: 'Role Management', description: 'View role definitions and permissions' },
  '/admin/tank-configuration': { title: 'Tank Configuration', description: 'Manage tank capacities and calibration settings' },
  '/admin/products': { title: 'Products', description: 'Manage products for Operations Log and forms' },
  '/admin/parts': { title: 'Parts', description: 'Manage parts and stock' },
  '/admin/operations-log-categories': { title: 'Operations Log Categories', description: 'Keep default categories and add more' },
};

/** Paths that map to a nav tab (for tab visibility guard). Admin/settings/profile/vehicle are not restricted by tab visibility. */
const PATH_TO_TAB = {
  '/': 'dashboard',
  '/Dashboard': 'dashboard',
  '/dashboard': 'dashboard',
  '/compliance': 'compliance',
  '/vehicle-image-log': 'vehicle-image-log',
  '/usage-costs': 'costs',
  '/tank-levels': 'refills',
  '/refills': 'refills',
  '/device-health': 'devices',
  '/sites': 'sites',
  '/reports': 'reports',
  '/email-reports': 'email-reports',
  '/branding': 'branding',
  '/Leaderboard': 'leaderboard',
  '/leaderboard': 'leaderboard',
  '/ai-insights': 'ai-insights',
  '/sms-alerts': 'sms-alerts',
  '/alerts': 'alerts',
  '/operations-log': 'operations-log',
  '/delivery-calendar': 'delivery-calendar',
  '/report-schedules': 'report-schedules',
  '/stock-orders': 'stock-orders',
};

/** Resolve pathname to tab value; includes sub-routes (e.g. /operations-log/entry/5 -> operations-log, /vehicle/5 -> sites). */
function getTabForPath(pathname) {
  if (PATH_TO_TAB[pathname] != null) return PATH_TO_TAB[pathname];
  if (pathname.startsWith('/operations-log/')) return 'operations-log';
  if (pathname.startsWith('/vehicle/')) return 'sites';
  return null;
}

function getPathHeader(pathname) {
  if (pathname.startsWith('/vehicle/')) return { title: 'Vehicle details', description: 'Wash history, compliance & analytics' };
  if (pathname.match(/^\/operations-log\/entry\/[^/]+$/)) return { title: 'Entry details', description: 'Operations log entry' };
  if (pathname.match(/^\/operations-log\/entry\/[^/]+\/attachment$/)) return { title: 'Attachment', description: 'View attachment' };
  return PATH_TO_HEADER[pathname];
}

/** Breadcrumb items for admin section: [ { label, path } ]. path null = current page. */
function getAdminBreadcrumbs(pathname) {
  if (!pathname.startsWith('/admin')) return null;
  const base = { label: 'Admin Console', path: '/admin' };
  if (pathname === '/admin') return [base];
  const sub = PATH_TO_HEADER[pathname];
  if (sub) return [base, { label: sub.title, path: null }];
  return [base];
}

/** Breadcrumbs for standalone pages that should show Back to Dashboard (e.g. Settings). */
function getStandaloneBackBreadcrumbs(pathname) {
  if (pathname === '/Settings' || pathname === '/settings') {
    return [{ label: 'Dashboard', path: '/' }, { label: 'Settings', path: null }];
  }
  return null;
}

/** Breadcrumbs for non-admin nested detail pages so header shows explicit Back button. */
function getNestedDetailBreadcrumbs(pathname) {
  if (pathname.startsWith('/vehicle/')) {
    const pathHeader = getPathHeader(pathname);
    return [{ label: 'Compliance', path: '/compliance' }, { label: pathHeader?.title ?? 'Vehicle', path: null }];
  }
  if (pathname.match(/^\/operations-log\/entry\/[^/]+$/)) {
    return [{ label: 'Operations Log', path: '/operations-log' }, { label: 'Entry details', path: null }];
  }
  if (pathname.match(/^\/operations-log\/entry\/[^/]+\/attachment$/)) {
    return [{ label: 'Operations Log', path: '/operations-log' }, { label: 'Attachment', path: null }];
  }
  return null;
}

/**
 * Dashboard layout using dashboard-01 structure: sidebar (NavMain, NavSecondary, NavUser) + main area with SiteHeader.
 */
export default function DashboardLayout({ children, title: titleProp, description: descriptionProp }) {
  const location = useLocation();
  const { userProfile } = useAuth();
  const { effectiveTabValues = [] } = usePermissions();
  const { firstPath, hasDashboard, hasNoAccess } = useFirstAccessiblePath();
  const pathHeader = getPathHeader(location.pathname);
  const title = titleProp ?? pathHeader?.title ?? 'Dashboard';
  const description = descriptionProp ?? pathHeader?.description ?? null;
  const adminBreadcrumbs = getAdminBreadcrumbs(location.pathname);
  const nestedBreadcrumbs = getNestedDetailBreadcrumbs(location.pathname);
  const standaloneBreadcrumbs = getStandaloneBackBreadcrumbs(location.pathname);
  const breadcrumbs = adminBreadcrumbs ?? nestedBreadcrumbs ?? standaloneBreadcrumbs;
  const companyName = userProfile?.company_name;
  const companyLogoUrl = userProfile?.company_logo_url;
  const isSuperAdmin = userProfile?.role === 'super_admin';

  const pathname = location.pathname;
  const tabForPath = getTabForPath(pathname);
  const isDashboardPath = pathname === '/' || pathname === '/dashboard' || pathname === '/Dashboard';

  if (pathname === '/no-access') {
    // Allow no-access page to render (handled by its own route)
  } else if (isDashboardPath) {
    if (!hasDashboard) {
      if (hasNoAccess) return <Navigate to="/no-access" replace />;
      if (firstPath && firstPath !== '/') return <Navigate to={firstPath} replace />;
    }
  } else if (tabForPath != null && !effectiveTabValues.includes(tabForPath)) {
    if (hasNoAccess) return <Navigate to="/no-access" replace />;
    return <Navigate to={firstPath || '/'} replace />;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar collapsible="icon">
          <SidebarHeader className="p-3 pb-4">
            <SidebarMenu>
              <SidebarMenuItem>
                <div
                  className="flex cursor-default items-center gap-3 rounded-lg px-2 py-2.5 outline-none group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:max-w-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0.5 group-data-[collapsible=icon]:gap-0"
                  aria-label="Portal and organization"
                >
                  <div
                    className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-sidebar-border group-data-[collapsible=icon]:!h-8 group-data-[collapsible=icon]:!w-8 group-data-[collapsible=icon]:!min-h-0 group-data-[collapsible=icon]:!min-w-0 ${
                      companyLogoUrl || ELORA_LOGO_URL
                        ? 'h-20 w-20 min-h-[5rem] min-w-[5rem] bg-background'
                        : 'aspect-square size-10 bg-primary text-primary-foreground'
                    }`}
                  >
                    {(companyLogoUrl || ELORA_LOGO_URL) ? (
                      <img
                        src={companyLogoUrl || ELORA_LOGO_URL}
                        alt="ELORA"
                        className="h-full w-full object-contain p-2 group-data-[collapsible=icon]:p-0.5"
                      />
                    ) : (
                      <Home className="size-5" />
                    )}
                  </div>
                  <div className="grid min-w-0 flex-1 gap-0.5 text-left group-data-[collapsible=icon]:hidden">
                    <span className="truncate text-base font-semibold leading-snug">ELORA</span>
                    <span className="truncate text-xs leading-snug text-muted-foreground">System</span>
                    {(companyName || isSuperAdmin) && (
                      <>
                        <span className="my-1.5 block h-px w-full shrink-0 bg-sidebar-border" aria-hidden />
                        <span className="flex items-center gap-1.5 truncate text-xs leading-snug text-muted-foreground">
                          {!companyLogoUrl && (
                            <Building2 className="size-3.5 shrink-0 text-muted-foreground/80" />
                          )}
                          <span className="truncate">{companyName || 'All organizations'}</span>
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>

          <SidebarContent>
            <NavMain />
          </SidebarContent>

          <SidebarFooter>
            <NavUser />
          </SidebarFooter>
        </Sidebar>

        <div className="flex flex-1 flex-col min-w-0 overflow-hidden w-full">
          <SiteHeader title={title} description={description} breadcrumbs={breadcrumbs} />
          <main className="relative z-0 flex-1 overflow-y-auto overflow-x-hidden bg-muted/40 [scrollbar-gutter:stable] min-h-0">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
