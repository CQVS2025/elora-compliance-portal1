import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Settings, LogOut, User, Bell, Menu, X, Shield } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import NotificationCenter from '@/components/notifications/NotificationCenter';

/**
 * Apple-style Header Component
 * Minimal, floating header with glassmorphism effect
 */
export default function AppleHeader() {
  const navigate = useNavigate();
  const { user, userProfile, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Track scroll for header shadow
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fetch branding based on user's email domain
  const { data: clientBranding } = useQuery({
    queryKey: ['clientBranding', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const emailDomain = user.email.split('@')[1];
      const { data, error } = await supabase
        .from('client_branding')
        .select('*')
        .eq('client_email_domain', emailDomain)
        .maybeSingle(); // Use maybeSingle() instead of single() to handle 0 rows gracefully
      if (error) {
        console.warn('Error fetching client branding:', error);
        return null;
      }
      return data;
    },
    enabled: !!user?.email,
    staleTime: 5 * 60 * 1000,
  });

  const branding = useMemo(() => {
    if (clientBranding) return clientBranding;
    return {
      company_name: 'ELORA',
      logo_url: null,
    };
  }, [clientBranding]);

  // Update page title
  useEffect(() => {
    if (branding) {
      document.title = `${branding.company_name} - Fleet Compliance`;
    }
  }, [branding]);

  const displayName = userProfile?.full_name || user?.email?.split('@')[0] || 'User';
  const initials = displayName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

  const handleLogout = async () => {
    await logout();
    navigate('/Login');
  };

  return (
    <header
      className={`
        sticky top-0 z-50
        backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80
        border-b transition-all duration-300
        ${scrolled ? 'border-gray-200/50 dark:border-zinc-800/50 shadow-apple' : 'border-transparent'}
      `}
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="h-16 flex items-center justify-between">
          {/* Left: Logo & Brand */}
          <div className="flex items-center gap-4">
            {/* Logo circle */}
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/')}
              className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center cursor-pointer shadow-lg shadow-emerald-500/30"
            >
              {branding.logo_url ? (
                <img src={branding.logo_url} alt="" className="w-6 h-6 object-contain" />
              ) : (
                <span className="text-white font-bold text-sm">E</span>
              )}
            </motion.div>

            {/* Brand name */}
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                {branding.company_name}
              </h1>
            </div>
          </div>

          {/* Center: Portal title (desktop only) */}
          <div className="hidden lg:block">
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
              Fleet Compliance Portal
            </p>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {/* Notifications */}
            <NotificationCenter />

            {/* User Menu */}
            <UserMenu
              isOpen={isMenuOpen}
              setIsOpen={setIsMenuOpen}
              displayName={displayName}
              email={user?.email}
              initials={initials}
              userRole={userProfile?.role}
              userProfile={userProfile}
              onNavigate={navigate}
              onLogout={handleLogout}
            />
          </div>
        </div>
      </div>
    </header>
  );
}

/**
 * User Menu Dropdown
 */
function UserMenu({ isOpen, setIsOpen, displayName, email, initials, userRole, userProfile, onNavigate, onLogout }) {
  // Check if user has admin access - check both userRole prop and userProfile object
  const role = userRole || userProfile?.role;
  const isAdmin = role === 'admin' || role === 'super_admin';
  const [avatarError, setAvatarError] = React.useState(false);
  
  // Debug log to see what role is being passed
  console.log('UserMenu Debug:', { 
    userRole, 
    userProfile, 
    role, 
    isAdmin,
    profileRole: userProfile?.role 
  });

  // Reset avatar error when profile changes
  React.useEffect(() => {
    setAvatarError(false);
  }, [userProfile?.avatar_url]);

  return (
    <div className="relative">
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="
          flex items-center gap-3 h-10 px-3 rounded-full
          hover:bg-gray-100 dark:hover:bg-zinc-800
          transition-colors
        "
      >
        {userProfile?.avatar_url && !avatarError ? (
          <div className="w-8 h-8 rounded-full overflow-hidden shadow-sm border border-gray-200 dark:border-zinc-700">
            <img
              key={userProfile.avatar_url}
              src={userProfile.avatar_url}
              alt="Profile avatar"
              className="w-full h-full object-cover"
              onError={() => setAvatarError(true)}
            />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm">
            <span className="text-white font-semibold text-sm">{initials}</span>
          </div>
        )}
        <span className="text-sm font-medium text-gray-900 dark:text-white hidden md:block">
          {displayName}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

            {/* Dropdown */}
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="
                absolute right-0 top-12 z-50
                w-64 rounded-2xl
                bg-white dark:bg-zinc-900
                shadow-xl shadow-black/10
                border border-gray-200/50 dark:border-zinc-800
                overflow-hidden
              "
            >
              {/* User info */}
              <div className="p-4 border-b border-gray-100 dark:border-zinc-800">
                <p className="font-semibold text-gray-900 dark:text-white">{displayName}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{email}</p>
              </div>

              {/* Menu items */}
              <div className="p-2">
                <MenuButton
                  icon={User}
                  onClick={() => {
                    setIsOpen(false);
                    onNavigate('/Profile');
                  }}
                >
                  Profile
                </MenuButton>
                <MenuButton
                  icon={Settings}
                  onClick={() => {
                    setIsOpen(false);
                    onNavigate('/Settings');
                  }}
                >
                  Settings
                </MenuButton>
              </div>

              {/* Admin Section - Only show for admin/super_admin */}
              {isAdmin && (
                <div className="p-2 border-t border-gray-100 dark:border-zinc-800">
                  <MenuButton
                    icon={Shield}
                    onClick={() => {
                      setIsOpen(false);
                      onNavigate('/admin');
                    }}
                  >
                    Admin Console
                    {role === 'super_admin' && (
                      <span className="ml-auto text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                        SUPER
                      </span>
                    )}
                  </MenuButton>
                </div>
              )}
              
              {/* Debug info - remove after testing */}
              {!userProfile && (
                <div className="p-2 border-t border-gray-100 dark:border-zinc-800">
                  <div className="px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                    Profile loading...
                  </div>
                </div>
              )}

              {/* Logout */}
              <div className="p-2 border-t border-gray-100 dark:border-zinc-800">
                <MenuButton icon={LogOut} variant="danger" onClick={onLogout}>
                  Logout
                </MenuButton>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Menu Button Component
 */
function MenuButton({ children, icon: Icon, onClick, variant = 'default' }) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
        transition-colors
        ${
          variant === 'danger'
            ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
        }
      `}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  );
}
