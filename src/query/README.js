/**
 * =================================================================================
 * TANSTACK QUERY IMPLEMENTATION GUIDE
 * =================================================================================
 * 
 * This application has been upgraded to use TanStack Query (React Query v5) with
 * production-ready patterns optimized for multi-tenant architecture and Supabase
 * Edge Functions.
 * 
 * =================================================================================
 * KEY BENEFITS
 * =================================================================================
 * 
 * ✅ Automatic caching with intelligent stale times
 * ✅ Background refetching for always-fresh data
 * ✅ Optimistic updates for instant UI feedback
 * ✅ Request deduplication (no duplicate API calls)
 * ✅ Automatic retries with exponential backoff
 * ✅ Tenant-isolated cache (multi-tenant safe)
 * ✅ Built-in loading and error states
 * ✅ DevTools for debugging (development only)
 * ✅ ESLint rules to catch bugs early
 * 
 * =================================================================================
 * NEW STRUCTURE
 * =================================================================================
 * 
 * src/
 *   lib/
 *     query-client.js          ← Enhanced QueryClient config
 *   api/
 *     edgeFetch.js             ← Production-ready Edge Function wrapper
 *   query/
 *     keys.js                  ← Centralized query key management
 *     options/                 ← Query options factories (one per domain)
 *       vehicles.js
 *       customers.js
 *       sites.js
 *       dashboard.js
 *       favorites.js
 *       compliance.js
 *       notifications.js
 *       permissions.js
 *       branding.js
 *       users.js
 *       companies.js
 *       preferences.js
 *       index.js               ← Barrel exports
 *     mutations/               ← Mutation hooks (one per domain)
 *       favorites.js
 *       compliance.js
 *       notifications.js
 *       preferences.js
 *       permissions.js
 *       branding.js
 *       admin.js
 *       index.js               ← Barrel exports
 * 
 * =================================================================================
 * MIGRATION PATTERN (OLD → NEW)
 * =================================================================================
 * 
 * OLD PATTERN (inline queries):
 * ------------------------------
 * const { data, isLoading } = useQuery({
 *   queryKey: ['vehicles', customerId],
 *   queryFn: async () => {
 *     const response = await supabaseClient.elora.vehicles({ customer_id: customerId });
 *     return response?.data ?? response ?? [];
 *   },
 *   staleTime: 30000,
 * });
 * 
 * NEW PATTERN (queryOptions factory):
 * ------------------------------------
 * import { vehiclesOptions } from '@/query/options';
 * 
 * const { data, isLoading } = useQuery(
 *   vehiclesOptions(companyId, { customerId })
 * );
 * 
 * =================================================================================
 * TENANT-AWARE QUERY KEYS
 * =================================================================================
 * 
 * All tenant-scoped data uses this key structure:
 * 
 *   ['tenant', companyId, 'resource', filters]
 * 
 * Examples:
 *   ['tenant', '123', 'vehicles', { customerId: '456' }]
 *   ['tenant', '123', 'dashboard', { startDate: '2024-01-01' }]
 *   ['tenant', '123', 'notifications', 'user@example.com']
 * 
 * User-scoped data (not tenant-specific):
 *   ['user', userEmail, 'favorites']
 *   ['user', userEmail, 'complianceTargets', customerRef]
 * 
 * Benefits:
 * - Easy to invalidate all tenant data: invalidate(['tenant', companyId])
 * - No cache bleeding between tenants
 * - Clear data ownership
 * 
 * =================================================================================
 * MUTATIONS PATTERN
 * =================================================================================
 * 
 * OLD PATTERN (inline mutations):
 * --------------------------------
 * const mutation = useMutation({
 *   mutationFn: async (data) => {
 *     return await supabaseClient.favorites.toggle(data);
 *   },
 *   onSuccess: () => {
 *     queryClient.invalidateQueries(['favorites']);
 *   }
 * });
 * 
 * NEW PATTERN (mutation hooks):
 * ------------------------------
 * import { useToggleFavorite } from '@/query/mutations';
 * 
 * const mutation = useToggleFavorite();
 * // Mutation automatically invalidates the right queries
 * 
 * =================================================================================
 * MIGRATED COMPONENTS
 * =================================================================================
 * 
 * ✅ Dashboard.jsx                    ← Main dashboard
 * ✅ FavoriteVehicles.jsx             ← Favorites widget
 * ✅ CustomComplianceTargets.jsx      ← Compliance targets
 * ✅ App.jsx                          ← DevTools added
 * ✅ AuthContext.jsx                  ← Cache clearing on logout
 * ✅ eslint.config.js                 ← Query ESLint rules
 * 
 * COMPONENTS TO MIGRATE (when needed):
 * - MobileDashboard.jsx
 * - SiteAnalytics.jsx
 * - Leaderboard.jsx
 * - NotificationCenter.jsx
 * - UserManagement.jsx
 * - CompanyManagement.jsx
 * - BrandingManagement.jsx
 * - PermissionsManagement.jsx
 * - EmailDigestPreferences.jsx
 * - DeviceHealth.jsx
 * - UsageCosts.jsx
 * - And more...
 * 
 * =================================================================================
 * HOW TO MIGRATE A COMPONENT
 * =================================================================================
 * 
 * 1. Find the component that uses useQuery/useMutation
 * 2. Import the appropriate queryOptions/mutation hook from query folder
 * 3. Get companyId from permissions.userProfile?.company_id
 * 4. Replace inline useQuery with:
 *    const { data } = useQuery(optionsFactory(companyId, filters))
 * 5. Replace inline useMutation with mutation hook from mutations folder
 * 6. Remove old fetch functions and imports
 * 7. Test the component
 * 
 * Example:
 * --------
 * // OLD
 * const { data } = useQuery({
 *   queryKey: ['sites'],
 *   queryFn: () => fetchSites(),
 * });
 * 
 * // NEW
 * import { sitesOptions } from '@/query/options';
 * const companyId = permissions.userProfile?.company_id;
 * const { data } = useQuery(sitesOptions(companyId));
 * 
 * =================================================================================
 * DEVTOOLS
 * =================================================================================
 * 
 * In development mode, press the React Query icon in the bottom-right corner
 * to open DevTools. You can:
 * 
 * - Inspect all queries and their states
 * - See query keys and data
 * - Manually refetch queries
 * - Clear cache
 * - Monitor network activity
 * - Debug stale/fresh states
 * 
 * =================================================================================
 * ESLINT RULES
 * =================================================================================
 * 
 * The following TanStack Query ESLint rules are enabled:
 * 
 * - @tanstack/query/exhaustive-deps        ← Catches missing dependencies
 * - @tanstack/query/no-rest-destructuring  ← Prevents common mistakes
 * - @tanstack/query/stable-query-client    ← Ensures stable QueryClient
 * 
 * Run `npm run lint` to check for issues.
 * 
 * =================================================================================
 * CACHE MANAGEMENT
 * =================================================================================
 * 
 * Automatic cache clearing:
 * - On logout: All cache cleared automatically
 * - On tenant switch: Call clearTenantCache(oldCompanyId)
 * - On major updates: Call invalidateTenantCache(companyId)
 * 
 * Manual cache operations:
 * ------------------------
 * import { queryClientInstance } from '@/lib/query-client';
 * 
 * // Invalidate specific query
 * queryClientInstance.invalidateQueries({ queryKey: ['tenant', companyId, 'vehicles'] });
 * 
 * // Remove specific query from cache
 * queryClientInstance.removeQueries({ queryKey: ['tenant', companyId, 'vehicles'] });
 * 
 * // Clear all cache
 * queryClientInstance.clear();
 * 
 * =================================================================================
 * STALE TIMES (CURRENT SETTINGS)
 * =================================================================================
 * 
 * Global default: 30 seconds
 * 
 * Per-resource overrides:
 * - Customers:      5 minutes   (rarely change)
 * - Sites:          5 minutes   (rarely change)
 * - Vehicles:       1 minute    (moderate frequency)
 * - Dashboard:      30 seconds  (real-time data)
 * - Scans:          30 seconds  (real-time data)
 * - Refills:        1 minute    (moderate frequency)
 * - Devices:        2 minutes   (status updates)
 * - Favorites:      1 minute    (user-specific)
 * - Notifications:  30 seconds  (real-time + auto-refetch every 1min)
 * - Permissions:    5 minutes   (rarely change)
 * - Branding:       10 minutes  (very stable)
 * 
 * =================================================================================
 * PERFORMANCE TIPS
 * =================================================================================
 * 
 * 1. Use select to transform data:
 *    const { data } = useQuery({
 *      ...vehiclesOptions(companyId),
 *      select: (data) => data.filter(v => v.isActive)
 *    });
 * 
 * 2. Prefetch data for smooth navigation:
 *    const queryClient = useQueryClient();
 *    queryClient.prefetchQuery(vehiclesOptions(companyId));
 * 
 * 3. Optimistic updates for instant UI:
 *    const mutation = useMutation({
 *      onMutate: async (newData) => {
 *        await queryClient.cancelQueries({ queryKey });
 *        const previousData = queryClient.getQueryData(queryKey);
 *        queryClient.setQueryData(queryKey, newData);
 *        return { previousData };
 *      },
 *      onError: (err, newData, context) => {
 *        queryClient.setQueryData(queryKey, context.previousData);
 *      }
 *    });
 * 
 * 4. Infinite queries for pagination:
 *    Use infiniteQueryOptions for scroll-based loading
 * 
 * 5. Parallel queries:
 *    const results = useQueries({
 *      queries: [
 *        vehiclesOptions(companyId),
 *        sitesOptions(companyId),
 *      ]
 *    });
 * 
 * =================================================================================
 * TROUBLESHOOTING
 * =================================================================================
 * 
 * Problem: Queries not refetching
 * Solution: Check staleTime - data may still be considered "fresh"
 * 
 * Problem: Too many refetches
 * Solution: Increase staleTime for that query
 * 
 * Problem: Cache not clearing on tenant switch
 * Solution: Ensure companyId is in the query key
 * 
 * Problem: Mutations not updating UI
 * Solution: Check that mutation invalidates the correct query keys
 * 
 * Problem: TypeScript errors
 * Solution: All files are .js - no TypeScript migration needed
 * 
 * =================================================================================
 * FURTHER READING
 * =================================================================================
 * 
 * Official docs: https://tanstack.com/query/latest/docs/react/overview
 * Query keys:    https://tanstack.com/query/latest/docs/react/guides/query-keys
 * Mutations:     https://tanstack.com/query/latest/docs/react/guides/mutations
 * DevTools:      https://tanstack.com/query/latest/docs/react/devtools
 * ESLint:        https://tanstack.com/query/latest/docs/eslint/eslint-plugin-query
 * 
 * =================================================================================
 */

// This file serves as documentation only - no code to export
export {};
