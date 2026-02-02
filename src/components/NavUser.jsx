import React from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Settings, LogOut, Shield, ChevronDown, Building2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

/**
 * User dropdown in sidebar footer: Profile, Settings, Admin Console, Super Admin Dashboard, Logout.
 */
export default function NavUser() {
  const navigate = useNavigate();
  const { user, userProfile, logout } = useAuth();

  const displayName = userProfile?.full_name || user?.email?.split('@')[0] || 'User';
  const initials = displayName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  const userRole = userProfile?.role;
  const companyName = userProfile?.company_name;
  const companyLogoUrl = userProfile?.company_logo_url;
  const isSuperAdmin = userRole === 'super_admin';
  const isAdmin = userRole === 'admin' || userRole === 'super_admin';

  const handleLogout = async () => {
    await logout();
    navigate('/Login');
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={userProfile?.avatar_url} alt={displayName} />
                <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{displayName}</span>
                <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
              </div>
              <ChevronDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side="bottom"
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-3 px-2 py-2.5 text-left text-sm">
                <Avatar className="h-9 w-9 shrink-0 rounded-lg">
                  <AvatarImage src={userProfile?.avatar_url} alt={displayName} />
                  <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                </Avatar>
                <div className="grid min-w-0 flex-1 gap-0.5 text-left">
                  <span className="truncate font-semibold leading-snug">{displayName}</span>
                  <span className="truncate text-xs leading-snug text-muted-foreground">{user?.email}</span>
                  {(companyName || isSuperAdmin) && (
                    <>
                      <span className="my-1 block h-px w-full bg-border" aria-hidden />
                      <span className="flex items-center gap-1.5 truncate text-xs leading-snug text-muted-foreground">
                        {companyLogoUrl ? (
                          <img
                            src={companyLogoUrl}
                            alt=""
                            className="size-4 shrink-0 rounded object-contain"
                          />
                        ) : (
                          <Building2 className="size-3.5 shrink-0" />
                        )}
                        <span className="truncate">{companyName || 'All organizations'}</span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/Profile')}>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/Settings')}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            {isAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/admin')}>
                  <Shield className="mr-2 h-4 w-4" />
                  Admin Console
                  {isSuperAdmin && (
                    <span className="ml-auto text-xs font-semibold text-primary">SUPER</span>
                  )}
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
