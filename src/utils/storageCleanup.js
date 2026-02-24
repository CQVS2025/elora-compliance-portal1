/**
 * Comprehensive Storage Cleanup Utility
 * Clears all session-related data from localStorage, sessionStorage, cookies, and cache
 */

/**
 * Clear all application-related storage
 * @param {string} userEmail - Optional user email to clear user-specific data
 */
export function clearAllStorage(userEmail = null) {
  try {
    // Clear sessionStorage FIRST (this is where Supabase auth tokens are stored)
    if (typeof window !== 'undefined' && window.sessionStorage) {
      // Clear user-specific items
      if (userEmail) {
        const userEmailKey = userEmail.replace(/[@.]/g, '_');
        Object.keys(sessionStorage).forEach(key => {
          if (key.includes(userEmail) || key.includes(userEmailKey)) {
            sessionStorage.removeItem(key);
          }
        });
      }
      
      // Clear ALL Supabase auth tokens (this is critical)
      sessionStorage.removeItem('sb-auth-token');
      sessionStorage.removeItem('supabase.auth.token');
      
      // Clear common app keys
      sessionStorage.removeItem('userEmail');
      sessionStorage.removeItem('authToken');
      sessionStorage.removeItem('sessionData');
      // Top-level dashboard filters: reset so next session (e.g. after login) starts with defaults
      sessionStorage.removeItem('elora-dashboard-filters');
      
      // Clear all Supabase-related keys
      Object.keys(sessionStorage).forEach(key => {
        if (
          key.startsWith('sb-') ||
          key.startsWith('supabase.') ||
          key.includes('supabase') ||
          key.includes('auth')
        ) {
          sessionStorage.removeItem(key);
        }
      });
      
      // If no email provided, clear ALL app-related keys (more aggressive cleanup)
      if (!userEmail) {
        Object.keys(sessionStorage).forEach(key => {
          // Clear any keys that look like they're from our app
          if (
            key.includes('userEmail') ||
            key.includes('token') ||
            key.includes('session')
          ) {
            sessionStorage.removeItem(key);
          }
        });
      }
    }

    // Clear localStorage (for user preferences, not auth tokens)
    if (typeof window !== 'undefined' && window.localStorage) {
      // Clear user-specific items if email provided
      if (userEmail) {
        // Remove onboarding completion
        localStorage.removeItem(`onboarding_completed_${userEmail}`);
        
        // Remove dashboard layout
        localStorage.removeItem(`dashboard_layout_${userEmail}`);
        
        // Remove any other user-specific keys
        const userEmailKey = userEmail.replace(/[@.]/g, '_');
        Object.keys(localStorage).forEach(key => {
          if (key.includes(userEmail) || key.includes(userEmailKey)) {
            localStorage.removeItem(key);
          }
        });
      }
      
      // Clear common app keys
      localStorage.removeItem('userEmail');
      localStorage.removeItem('rememberMe');
      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
      
      // Clear all Supabase-related keys
      Object.keys(localStorage).forEach(key => {
        if (
          key.startsWith('sb-') || // Supabase keys
          key.startsWith('supabase.') ||
          key.includes('supabase') ||
          key.includes('auth') ||
          key.includes('onboarding') ||
          key.includes('dashboard_layout')
        ) {
          localStorage.removeItem(key);
        }
      });
      
      // If no email provided, clear ALL app-related keys (more aggressive cleanup)
      if (!userEmail) {
        Object.keys(localStorage).forEach(key => {
          // Clear any keys that look like they're from our app
          if (
            key.includes('userEmail') ||
            key.includes('rememberMe') ||
            key.includes('token') ||
            key.includes('session')
          ) {
            localStorage.removeItem(key);
          }
        });
      }
    }

    // Clear cookies
      if (typeof document !== 'undefined' && document.cookie) {
        // Get all cookies
        const cookies = document.cookie.split(';');
        const hostname = window.location.hostname;
        const domainParts = hostname.split('.');
        const baseDomain = domainParts.length > 1 
          ? '.' + domainParts.slice(-2).join('.') 
          : hostname;
        
        cookies.forEach(cookie => {
          const eqPos = cookie.indexOf('=');
          const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
          
          // Clear auth-related cookies
          if (
            name.includes('auth') ||
            name.includes('session') ||
            name.includes('token') ||
            name.includes('supabase') ||
            name.startsWith('sb-')
          ) {
            // Clear cookie by setting it to expire in the past
            // Try multiple paths and domains to ensure complete removal
            const pastDate = 'Thu, 01 Jan 1970 00:00:00 GMT';
            document.cookie = `${name}=;expires=${pastDate};path=/`;
            document.cookie = `${name}=;expires=${pastDate};path=/;domain=${hostname}`;
            if (baseDomain !== hostname) {
              document.cookie = `${name}=;expires=${pastDate};path=/;domain=${baseDomain}`;
            }
            document.cookie = `${name}=;expires=${pastDate};path=/;domain=.${hostname}`;
          }
        });
      }

    // Clear IndexedDB (Supabase might use it)
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      try {
        // Clear Supabase IndexedDB if it exists
        indexedDB.databases().then(databases => {
          databases.forEach(db => {
            if (db.name && (db.name.includes('supabase') || db.name.includes('auth'))) {
              indexedDB.deleteDatabase(db.name);
            }
          });
        }).catch(() => {
          // Ignore errors
        });
      } catch (e) {
        // IndexedDB might not be available
        console.warn('Could not clear IndexedDB:', e);
      }
    }

    console.log('All storage cleared successfully');
    return true;
  } catch (error) {
    console.error('Error clearing storage:', error);
    return false;
  }
}

/**
 * Clear React Query cache
 * @param {object} queryClient - React Query client instance
 */
export function clearQueryCache(queryClient) {
  try {
    if (queryClient) {
      queryClient.clear();
      queryClient.removeQueries();
      console.log('React Query cache cleared');
    }
  } catch (error) {
    console.error('Error clearing query cache:', error);
  }
}

/**
 * Complete logout cleanup - clears everything
 * @param {object} queryClient - React Query client instance (optional)
 * @param {string} userEmail - User email (optional)
 */
export async function performCompleteLogout(queryClient = null, userEmail = null) {
  // Clear all storage
  clearAllStorage(userEmail);
  
  // Clear React Query cache if provided
  if (queryClient) {
    clearQueryCache(queryClient);
  }
  
  // Force a small delay to ensure cleanup completes
  await new Promise(resolve => setTimeout(resolve, 100));
  
  return true;
}

