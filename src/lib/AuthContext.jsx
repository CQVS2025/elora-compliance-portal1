import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { supabase } from './supabase';
import { performCompleteLogout } from '@/utils/storageCleanup';
import { queryClientInstance } from '@/lib/query-client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [profileLoadAttempts, setProfileLoadAttempts] = useState(0);
  const MAX_PROFILE_LOAD_ATTEMPTS = 3;
  
  // Use ref to track current profile without causing re-renders
  const userProfileRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    let currentProfileId = null;

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session);
        
        if (!isMounted) return;

        // Handle INITIAL_SESSION - this fires on mount
        if (event === 'INITIAL_SESSION') {
          if (session?.user) {
            currentProfileId = session.user.id;
            const result = await loadUserProfile(session.user, true);
            if (!result.success) {
              console.error('Profile load failed in initial session:', result.error);
            }
          } else {
            setIsAuthenticated(false);
          }
          setIsLoadingAuth(false);
          return;
        }

        // Handle TOKEN_REFRESHED - don't reload profile if already loaded
        if (event === 'TOKEN_REFRESHED') {
          console.log('Token refreshed, keeping existing profile');
          if (session?.user && currentProfileId === session.user.id) {
            // Just update the user object, keep the profile
            setUser(session.user);
            setIsAuthenticated(true);
            // Clear any stale errors
            setAuthError(null);
            return;
          }
        }

        // Handle other auth state changes (SIGNED_IN, SIGNED_OUT, etc.)
        if (session?.user) {
          // Only reload profile if we don't have one or user changed
          if (!currentProfileId || currentProfileId !== session.user.id) {
            currentProfileId = session.user.id;
            const result = await loadUserProfile(session.user, false);
            if (!result.success) {
              console.error('Profile load failed in auth state change:', result.error);
            }
          } else {
            // Profile already loaded, just update user and clear errors
            setUser(session.user);
            setIsAuthenticated(true);
            setAuthError(null);
          }
        } else {
          currentProfileId = null;
          setUser(null);
          setUserProfile(null);
          setIsAuthenticated(false);
          setProfileLoadAttempts(0);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const checkAuth = async () => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);

      // Add timeout for session check to prevent hanging
      const sessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Session check timeout')), 15000)
      );

      const { data: { session }, error } = await Promise.race([sessionPromise, timeoutPromise]);

      if (error) {
        console.error('Session error:', error);
        setAuthError({
          type: 'session_error',
          message: error.message
        });
        setIsLoadingAuth(false);
        return;
      }

      if (session?.user) {
        const result = await loadUserProfile(session.user);
        // Don't show error popup on initial load if profile eventually loads
        if (!result.success) {
          console.error('Profile load failed in checkAuth:', result.error);
        }
      } else {
        setIsAuthenticated(false);
      }

      setIsLoadingAuth(false);
    } catch (error) {
      console.error('Auth check failed:', error);
      setAuthError({
        type: 'timeout',
        message: error.message || 'Connection timeout - please check your network and refresh'
      });
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
    }
  };

  const loadUserProfile = async (user, isInitialLoad = false) => {
    try {
      setUser(user);

      // Check retry limit for non-initial loads
      if (!isInitialLoad && profileLoadAttempts >= MAX_PROFILE_LOAD_ATTEMPTS) {
        console.warn('Max profile load attempts reached, keeping existing session');
        // Don't show error if we already have a profile loaded
        if (userProfileRef.current) {
          setIsAuthenticated(true);
          return { success: true };
        }
        const errorMsg = 'Unable to refresh profile data. Please refresh the page.';
        setAuthError({
          type: 'profile_load_error',
          message: errorMsg
        });
        return { success: false, error: errorMsg };
      }

      // Increment attempt counter
      if (!isInitialLoad) {
        setProfileLoadAttempts(prev => prev + 1);
      }

      // Load user profile from database with timeout
      const profilePromise = supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile load timeout')), 15000)
      );

      const { data: profile, error } = await Promise.race([profilePromise, timeoutPromise]);

      if (error) {
        console.error('Failed to load profile:', error);
        
        // If it's a timeout and we already have a profile, keep using it
        if (error.message === 'Profile load timeout' && userProfileRef.current) {
          console.log('Profile load timeout, but keeping existing profile');
          setIsAuthenticated(true);
          return { success: true };
        }
        
        // User exists in auth but not in profiles table
        setUserProfile(null);
        userProfileRef.current = null;
        const errorMsg = 'User profile not found. Please contact your administrator.';
        setAuthError({
          type: 'user_not_registered',
          message: errorMsg
        });
        setIsAuthenticated(false);
        return { success: false, error: errorMsg };
      }

      // Check if user account is inactive
      if (profile.is_active === false) {
        console.log('User account is inactive:', profile.email);
        setUserProfile(null);
        userProfileRef.current = null;
        const errorMsg = 'Your account has been deactivated. Please contact your administrator.';
        setAuthError({
          type: 'account_deactivated',
          message: errorMsg
        });
        // Sign out the user immediately
        await supabase.auth.signOut();
        setIsAuthenticated(false);
        return { success: false, error: errorMsg };
      }

      setUserProfile(profile);
      userProfileRef.current = profile;
      console.log('User profile loaded:', profile);
      setIsAuthenticated(true);
      // Clear any previous auth errors since profile loaded successfully
      setAuthError(null);
      // Reset attempt counter on success
      setProfileLoadAttempts(0);
      return { success: true };
    } catch (error) {
      console.error('Failed to load user profile:', error);
      
      // If it's a timeout and we already have a profile, keep using it
      if (error.message === 'Profile load timeout' && userProfileRef.current) {
        console.log('Profile load timeout, but keeping existing profile');
        setIsAuthenticated(true);
        return { success: true };
      }
      
      setUserProfile(null);
      userProfileRef.current = null;
      const errorMsg = 'Failed to load user profile. Please try again.';
      setAuthError({
        type: 'profile_load_error',
        message: errorMsg
      });
      setIsAuthenticated(false);
      return { success: false, error: errorMsg };
    }
  };

  const login = async (email, password) => {
    try {
      setAuthError(null);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Load user profile and check if account is active
      const profileResult = await loadUserProfile(data.user);
      
      if (!profileResult.success) {
        // Profile load failed or user is inactive
        return { 
          success: false, 
          error: profileResult.error || 'Unable to complete login. Please contact your administrator.' 
        };
      }

      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      setAuthError({
        type: 'login_error',
        message: error.message
      });
      return { success: false, error: error.message };
    }
  };

  const signup = async (email, password, metadata = {}) => {
    try {
      setAuthError(null);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
        },
      });

      if (error) throw error;

      return { success: true, user: data.user };
    } catch (error) {
      console.error('Signup error:', error);
      setAuthError({
        type: 'signup_error',
        message: error.message
      });
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    try {
      // Get user email before clearing everything
      const userEmail = user?.email || userProfile?.email;
      
      // Sign out from Supabase first (this clears Supabase session)
      await supabase.auth.signOut();
      
      // Clear all storage, cookies, and cache
      await performCompleteLogout(queryClientInstance, userEmail);
      
      // Clear React state
      setUser(null);
      setUserProfile(null);
      userProfileRef.current = null;
      setIsAuthenticated(false);
      setAuthError(null);
      setProfileLoadAttempts(0);
      
      console.log('Logout completed - all data cleared');
    } catch (error) {
      console.error('Logout error:', error);
      // Even if there's an error, try to clear storage
      try {
        const userEmail = user?.email || userProfile?.email;
        await performCompleteLogout(queryClientInstance, userEmail);
        setUser(null);
        setUserProfile(null);
        userProfileRef.current = null;
        setIsAuthenticated(false);
        setAuthError(null);
        setProfileLoadAttempts(0);
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
    }
  };

  const resetPassword = async (email) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Reset password error:', error);
      return { success: false, error: error.message };
    }
  };

  const navigateToLogin = () => {
    window.location.href = '/Login';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        isAuthenticated,
        isLoadingAuth,
        authError,
        login,
        signup,
        logout,
        resetPassword,
        checkAuth,
        navigateToLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
