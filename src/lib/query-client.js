import { QueryClient } from '@tanstack/react-query';

/**
 * Production-Ready QueryClient Configuration
 * 
 * Optimized for:
 * - Multi-tenant architecture (tenant-aware cache isolation)
 * - Supabase Edge Functions (network-aware retries)
 * - Real-time data (smart stale times)
 * - Performance (garbage collection)
 */

export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			// Stale time: How long data is considered "fresh"
			// After this, data is marked stale and refetched in background
			staleTime: 30000, // 30 seconds - good for dashboard data

			// Cache time (gcTime): How long unused data stays in cache
			// Prevents memory bloat while keeping frequently accessed data
			gcTime: 5 * 60 * 1000, // 5 minutes

			// Retry configuration - smart retries for Edge Functions
			retry: (failureCount, error) => {
				// Don't retry on auth errors (401, 403) - user needs to login
				if (error?.message?.includes('401') || error?.message?.includes('403')) {
					return false;
				}
				// Don't retry on client errors (4xx except 429)
				if (error?.message?.includes('400') || error?.message?.includes('404') || error?.message?.includes('409')) {
					return false;
				}
				// Retry network errors and 5xx server errors (max 2 retries)
				return failureCount < 2;
			},

			// Retry delay with exponential backoff
			retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

			// Don't refetch on window focus (too aggressive for forms/editing)
			refetchOnWindowFocus: false,

			// Refetch on reconnect (user came back online)
			refetchOnReconnect: true,

			// Don't refetch on mount if data is fresh
			refetchOnMount: true,

			// Network mode: Use cache when offline, fail when no network
			networkMode: 'online',
		},
		mutations: {
			// Retry mutations only on network errors (not validation errors)
			retry: (failureCount, error) => {
				// Never retry client errors (4xx) - these are validation/auth errors
				if (error?.message?.includes('400') || error?.message?.includes('401') || 
				    error?.message?.includes('403') || error?.message?.includes('404') || 
				    error?.message?.includes('409') || error?.message?.includes('422')) {
					return false;
				}
				// Retry network/server errors once
				return failureCount < 1;
			},

			// Network mode for mutations
			networkMode: 'online',
		},
	},
});

/**
 * Helper: Clear tenant-specific cache on tenant switch
 * Call this when user switches company/customer context
 */
export function clearTenantCache(companyId) {
	// Remove all queries that start with ['tenant', companyId]
	queryClientInstance.removeQueries({
		predicate: (query) => {
			const key = query.queryKey;
			return Array.isArray(key) && key[0] === 'tenant' && key[1] === companyId;
		},
	});
}

/**
 * Helper: Invalidate all tenant data (forces refetch)
 * Use this after major data changes (e.g., bulk updates)
 */
export function invalidateTenantCache(companyId) {
	queryClientInstance.invalidateQueries({
		predicate: (query) => {
			const key = query.queryKey;
			return Array.isArray(key) && key[0] === 'tenant' && key[1] === companyId;
		},
	});
}

/**
 * Helper: Clear all cache (use on logout)
 */
export function clearAllCache() {
	queryClientInstance.clear();
}