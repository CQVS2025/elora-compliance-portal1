import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, HelpCircle } from 'lucide-react';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const ITEMS = [
  { label: 'Settings', icon: Settings, path: '/Settings' },
  { label: 'Get Help', icon: HelpCircle, path: '/Settings', hash: '#help' },
];

/**
 * Secondary sidebar navigation: Settings, Get Help.
 */
export default function NavSecondary() {
  const navigate = useNavigate();

  return (
    <SidebarGroup>
      <SidebarGroupLabel>More</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {ITEMS.map((item) => {
            const Icon = item.icon;
            const path = item.hash ? `${item.path}${item.hash}` : item.path;

            return (
              <SidebarMenuItem key={item.label}>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton
                        asChild
                        onClick={() => navigate(item.path)}
                      >
                        <a
                          href={path}
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
