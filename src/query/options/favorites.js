import { queryOptions } from '@tanstack/react-query';
import { callEdgeFunction } from '@/lib/supabase';
import { queryKeys } from '../keys';

/**
 * Favorites Query Options
 * 
 * User-specific favorite vehicles (not tenant-scoped).
 */

/**
 * Fetch user's favorite vehicles
 */
export const favoritesOptions = (userEmail) =>
  queryOptions({
    queryKey: queryKeys.user.favorites(userEmail),
    queryFn: async ({ signal }) => {
      if (!userEmail) return [];
      
      const response = await callEdgeFunction('elora_get_favorites', { userEmail });
      return response?.favorites ?? response?.data ?? response ?? [];
    },
    staleTime: 60000, // 1 minute
    gcTime: 10 * 60 * 1000,
    enabled: !!userEmail,
  });
