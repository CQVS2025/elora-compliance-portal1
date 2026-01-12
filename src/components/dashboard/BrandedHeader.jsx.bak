import React, { useEffect, useMemo } from 'react';
import { ChevronDown, Settings, LogOut, User } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import NotificationCenter from '@/components/notifications/NotificationCenter';

async function fetchUserAndBranding() {
  const user = await base44.auth.me();
  const emailDomain = user.email.split('@')[1];

  // Fetch branding for this domain
  const branding = await base44.entities.Client_Branding.filter({
    client_email_domain: emailDomain
  });

  return {
    user,
    branding: branding.length > 0 ? branding[0] : null
  };
}

export default function BrandedHeader({ onNotificationClick }) {
  const { data, isLoading } = useQuery({
    queryKey: ['userAndBranding'],
    queryFn: fetchUserAndBranding,
    staleTime: 0,
    cacheTime: 0
  });

  const user = data?.user;
  const clientBranding = data?.branding;
  const emailDomain = user?.email?.split('@')[1];

  // Default fallback branding
  const branding = useMemo(() => {
    if (clientBranding) {
      return clientBranding;
    }
    return {
      company_name: 'ELORA Solutions',
      logo_url: null,
      primary_color: '#2563eb',
      secondary_color: '#1e40af'
    };
  }, [clientBranding]);

  // Inject CSS variables for theming AND update page title/favicon dynamically
  useEffect(() => {
    if (branding) {
      // Set CSS theme colors
      document.documentElement.style.setProperty('--client-primary', branding.primary_color);
      document.documentElement.style.setProperty('--client-secondary', branding.secondary_color);

      // Update page title dynamically
      document.title = `${branding.company_name} - Fleet Compliance Portal`;

      // Update favicon dynamically if logo exists
      if (branding.logo_url) {
        const favicon = document.querySelector("link[rel*='icon']");
        if (favicon) {
          favicon.href = branding.logo_url;
        }
      }
    }
  }, [branding]);

  const initials = user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';

  if (isLoading) {
    return (
      <header className="sticky top-0 z-50 w-full h-[72px] bg-slate-800">
        <div className="h-full px-6 flex items-center justify-center">
          <div className="animate-pulse text-white">Loading...</div>
        </div>
      </header>
    );
  }

  return (
    <>
      {/* Modern Branded Header */}
      <header
        className="sticky top-0 z-50 w-full backdrop-blur-md"
        style={{
          background: `linear-gradient(135deg, ${branding.primary_color}F5 0%, ${branding.primary_color}E8 100%)`,
          boxShadow: '0 4px 24px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)'
        }}
      >
        <div className="h-[80px] px-8 flex items-center justify-between relative">
          {/* Left Section - Enhanced Branding */}
          <div className="flex items-center gap-4">
            {/* Logo Container with Modern Glass Effect */}
            <div
              className="group relative flex items-center gap-4 px-6 py-3 rounded-2xl transition-all duration-500 hover:scale-[1.02]"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.08) 100%)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.25)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.1), inset 0 1px 1px rgba(255,255,255,0.3)'
              }}
            >
              {/* Subtle gradient overlay on hover */}
              <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  background: `linear-gradient(135deg, ${branding.secondary_color}30 0%, transparent 100%)`
                }}
              />

              {/* Company Name */}
              <div className="relative z-10">
                <h1 className="text-white font-bold text-2xl tracking-tight leading-tight drop-shadow-lg">
                  {branding.company_name}
                </h1>
                {emailDomain === 'cqvs.com.au' && (
                  <p className="text-[9px] font-bold uppercase tracking-[0.15em] mt-0.5 text-white/70">
                    Powered by CQVS
                  </p>
                )}
              </div>

              {/* Logo */}
              {branding.logo_url && (
                <>
                  <div
                    className="w-px h-10 mx-2"
                    style={{ background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.3), transparent)' }}
                  />
                  <img
                    src={branding.logo_url}
                    alt={branding.company_name}
                    className="h-[44px] object-contain drop-shadow-lg transition-transform duration-300 group-hover:scale-105"
                  />
                </>
              )}
            </div>
          </div>

          {/* Center Section - Portal Title (Desktop Only) */}
          <div className="hidden lg:flex flex-col items-center absolute left-1/2 transform -translate-x-1/2">
            <h2 className="text-white text-2xl font-bold tracking-tight drop-shadow-md">
              Fleet Compliance Portal
            </h2>
            <div
              className="h-1 w-16 mt-2 rounded-full"
              style={{
                background: `linear-gradient(90deg, transparent, ${branding.secondary_color}, transparent)`,
                boxShadow: `0 0 8px ${branding.secondary_color}80`
              }}
            />
          </div>

          {/* Right Section - User Actions */}
          <div className="flex items-center gap-2">
            {/* Notifications - Using real NotificationCenter instead of hardcoded mock data */}
            <NotificationCenter />

            {/* User Profile */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="group flex items-center gap-3 pl-3 pr-4 py-2 rounded-xl transition-all duration-300 hover:scale-[1.02]"
                  style={{
                    background: 'rgba(255,255,255,0.15)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255,255,255,0.25)',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
                  }}
                >
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-base shadow-lg ring-2 ring-white/30 transition-transform duration-300 group-hover:scale-105"
                    style={{
                      background: `linear-gradient(135deg, ${branding.secondary_color} 0%, ${branding.secondary_color}CC 100%)`,
                      boxShadow: `0 4px 16px ${branding.secondary_color}40`
                    }}
                  >
                    {initials}
                  </div>
                  <div className="hidden lg:block text-left">
                    <span className="text-white font-semibold text-sm block leading-tight drop-shadow">
                      {user?.full_name || 'User'}
                    </span>
                    <span className="text-white/70 text-xs">Account</span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-white/90 transition-transform duration-300 group-hover:rotate-180" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56 p-2 rounded-2xl shadow-2xl border-0"
                style={{
                  background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)'
                }}
              >
                <div className="px-3 py-3 mb-1">
                  <p className="text-sm font-bold text-slate-900">{user?.full_name || 'User'}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{user?.email}</p>
                </div>
                <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent my-2" />
                <DropdownMenuItem className="cursor-pointer py-3 px-4 rounded-xl hover:bg-gradient-to-r hover:from-slate-100 hover:to-slate-50 transition-all">
                  <User className="w-4 h-4 mr-3 text-slate-600" />
                  <span className="font-medium text-slate-700">Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer py-3 px-4 rounded-xl hover:bg-gradient-to-r hover:from-slate-100 hover:to-slate-50 transition-all">
                  <Settings className="w-4 h-4 mr-3 text-slate-600" />
                  <span className="font-medium text-slate-700">Settings</span>
                </DropdownMenuItem>
                <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent my-2" />
                <DropdownMenuItem
                  className="cursor-pointer py-3 px-4 rounded-xl text-red-600 hover:bg-gradient-to-r hover:from-red-50 hover:to-red-100 transition-all font-semibold"
                  onClick={() => base44.auth.logout()}
                >
                  <LogOut className="w-4 h-4 mr-3" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Modern Accent Line with Gradient */}
        <div
          className="h-1 w-full"
          style={{
            background: `linear-gradient(90deg,
              ${branding.secondary_color}00 0%,
              ${branding.secondary_color} 20%,
              ${branding.secondary_color} 80%,
              ${branding.secondary_color}00 100%)`,
            boxShadow: `0 0 12px ${branding.secondary_color}60`
          }}
        />
      </header>
    </>
  );
}