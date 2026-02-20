import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Home,
  DollarSign,
  Droplets,
  Activity,
  MapPin,
  FileText,
  Mail,
  Palette,
  Sparkles,
  MessageSquare,
  ClipboardList,
} from 'lucide-react';
import { useAvailableTabs } from '@/components/auth/PermissionGuard';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const DASHBOARD_NAV_ITEM = { value: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/' };

const ALL_TABS = [
  DASHBOARD_NAV_ITEM,
  { value: 'compliance', label: 'Compliance', icon: Home, path: '/compliance' },
  { value: 'operations-log', label: 'Operations Log', icon: ClipboardList, path: '/operations-log' },
  { value: 'costs', label: 'Usage Costs', icon: DollarSign, path: '/usage-costs' },
  { value: 'refills', label: 'Tank Levels', icon: Droplets, path: '/tank-levels' },
  { value: 'devices', label: 'Device Health', icon: Activity, path: '/device-health' },
  { value: 'sites', label: 'Sites', icon: MapPin, path: '/sites' },
  { value: 'reports', label: 'Reports', icon: FileText, path: '/reports' },
  { value: 'email-reports', label: 'Email Reports', icon: Mail, path: '/email-reports' },
  { value: 'branding', label: 'Branding', icon: Palette, path: '/branding' },
];

const MAIN_TABS = ALL_TABS.filter((t) => t.value !== 'dashboard');

const INTELLIGENCE_TABS = [
  { value: 'ai-insights', label: 'Elora AI', icon: Sparkles, path: '/ai-insights', showNewBadge: false },
  { value: 'sms-alerts', label: 'Alerts History', icon: MessageSquare, path: '/sms-alerts', showNewBadge: false },
];

/**
 * Renders a single nav item with optional "New" badge.
 */
function NavItem({ item, isActive, onNavigate }) {
  const Icon = item.icon;
  return (
    <SidebarMenuItem key={item.value}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <SidebarMenuButton asChild isActive={isActive}>
              <a
                href={item.path}
                className="flex items-center gap-2"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(item.path);
                }}
              >
                <Icon className="size-4" />
                <span>{item.label}</span>
                {item.showNewBadge && (
                  <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">New</Badge>
                )}
              </a>
            </SidebarMenuButton>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>{item.label}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </SidebarMenuItem>
  );
}

/**
 * Main sidebar navigation: Navigation group + Intelligence (AI Insights).
 * Filtered by role using useAvailableTabs.
 */
export default function NavMain() {
  const navigate = useNavigate();
  const location = useLocation();
  const availableTabs = useAvailableTabs(MAIN_TABS);
  const availableIntelligenceTabs = useAvailableTabs(INTELLIGENCE_TABS);
  const currentPath = location.pathname;
  const isDashboardActive = currentPath === '/' || currentPath === '/dashboard' || currentPath === '/Dashboard';

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>Navigation</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <NavItem item={DASHBOARD_NAV_ITEM} isActive={isDashboardActive} onNavigate={navigate} />
            {availableTabs.map((item) => {
              const isActive = currentPath === item.path;
              return <NavItem key={item.value} item={item} isActive={isActive} onNavigate={navigate} />;
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      {availableIntelligenceTabs.length > 0 && (
        <SidebarGroup>
          <SidebarGroupLabel>Intelligence</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {availableIntelligenceTabs.map((item) => {
                const isActive = currentPath === item.path;
                return <NavItem key={item.value} item={item} isActive={isActive} onNavigate={navigate} />;
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}
    </>
  );
}
