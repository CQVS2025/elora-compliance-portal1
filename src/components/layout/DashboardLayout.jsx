import React from 'react';
import { useLocation } from 'react-router-dom';
import { SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, Sidebar } from '@/components/ui/sidebar';
import { Home, Building2 } from 'lucide-react';
import NavMain from '@/components/NavMain';
import NavUser from '@/components/NavUser';
import SiteHeader from '@/components/SiteHeader';
import { useAuth } from '@/lib/AuthContext';

const PATH_TO_HEADER = {
  '/': { title: 'Compliance', description: 'Fleet compliance overview' },
  '/Dashboard': { title: 'Compliance', description: 'Fleet compliance overview' },
  '/dashboard': { title: 'Compliance', description: 'Fleet compliance overview' },
  '/usage-costs': { title: 'Usage Costs', description: 'Cost and usage analytics' },
  '/refills': { title: 'Refills', description: 'Refill management' },
  '/device-health': { title: 'Device Health', description: 'Device status' },
  '/sites': { title: 'Sites', description: 'Site management' },
  '/reports': { title: 'Reports', description: 'Reports and exports' },
  '/email-reports': { title: 'Email Reports', description: 'Scheduled and digest emails' },
  '/branding': { title: 'Branding', description: 'Customize branding' },
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
  '/admin/tab-visibility': { title: 'Tab Visibility', description: 'Override which tabs each role can see' },
};

/** Breadcrumb items for admin section: [ { label, path } ]. path null = current page. */
function getAdminBreadcrumbs(pathname) {
  if (!pathname.startsWith('/admin')) return null;
  const base = { label: 'Admin Console', path: '/admin' };
  if (pathname === '/admin') return [base];
  const sub = PATH_TO_HEADER[pathname];
  if (sub) return [base, { label: sub.title, path: null }];
  return [base];
}

/**
 * Dashboard layout using dashboard-01 structure: sidebar (NavMain, NavSecondary, NavUser) + main area with SiteHeader.
 */
export default function DashboardLayout({ children, title: titleProp, description: descriptionProp }) {
  const location = useLocation();
  const { userProfile } = useAuth();
  const pathHeader = PATH_TO_HEADER[location.pathname];
  const title = titleProp ?? pathHeader?.title ?? 'Dashboard';
  const description = descriptionProp ?? pathHeader?.description ?? null;
  const breadcrumbs = getAdminBreadcrumbs(location.pathname);
  const companyName = userProfile?.company_name;
  const companyLogoUrl = userProfile?.company_logo_url;
  const isSuperAdmin = userProfile?.role === 'super_admin';

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
                      companyLogoUrl
                        ? 'h-14 w-14 min-h-[3.5rem] min-w-[3.5rem] bg-background'
                        : 'aspect-square size-9 bg-primary text-primary-foreground'
                    }`}
                  >
                    {companyLogoUrl ? (
                      <img
                        src={companyLogoUrl}
                        alt=""
                        className="h-full w-full object-contain p-1.5 group-data-[collapsible=icon]:p-0.5"
                      />
                    ) : (
                      <Home className="size-4" />
                    )}
                  </div>
                  <div className="grid min-w-0 flex-1 gap-0.5 text-left group-data-[collapsible=icon]:hidden">
                    <span className="truncate text-sm font-semibold leading-snug">Fleet Compliance</span>
                    <span className="truncate text-xs leading-snug text-muted-foreground">Portal</span>
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

        <div className="flex flex-1 flex-col">
          <SiteHeader title={title} description={description} breadcrumbs={breadcrumbs} />
          <main className="relative z-0 flex-1 overflow-y-auto overflow-x-hidden bg-muted/40 [scrollbar-gutter:stable]">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
