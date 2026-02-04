import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home,
  DollarSign,
  Droplets,
  Activity,
  MapPin,
  FileText,
  Mail,
  Palette,
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
import { cn } from '@/lib/utils';

const ALL_TABS = [
  { value: 'compliance', label: 'Compliance', icon: Home, path: '/' },
  { value: 'costs', label: 'Usage Costs', icon: DollarSign, path: '/usage-costs' },
  { value: 'refills', label: 'Refills', icon: Droplets, path: '/refills' },
  { value: 'devices', label: 'Device Health', icon: Activity, path: '/device-health' },
  { value: 'sites', label: 'Sites', icon: MapPin, path: '/sites' },
  { value: 'reports', label: 'Reports', icon: FileText, path: '/reports' },
  { value: 'email-reports', label: 'Email Reports', icon: Mail, path: '/email-reports' },
  { value: 'branding', label: 'Branding', icon: Palette, path: '/branding' },
];

/**
 * Main sidebar navigation: Compliance, Usage Costs, Refills, etc.
 * Filtered by role using useAvailableTabs.
 */
export default function NavMain() {
  const navigate = useNavigate();
  const location = useLocation();
  const availableTabs = useAvailableTabs(ALL_TABS);
  const currentPath = location.pathname;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Navigation</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {availableTabs.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.path;

            return (
              <SidebarMenuItem key={item.value}>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                      >
                        <a
                          href={item.path}
                          className="flex items-center gap-2"
                          onClick={(e) => {
                            e.preventDefault();
                            navigate(item.path);
                          }}
                        >
                          <Icon className="size-4" />
                          <span>{item.label}</span>
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
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
