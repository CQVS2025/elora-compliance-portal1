import { queryOptions } from '@tanstack/react-query';
import { callEdgeFunction } from '@/lib/supabase';
import { queryKeys } from '../keys';

/**
 * User Preferences Query Options
 * 
 * User-specific preferences (digest, email reports, etc.).
 */

/**
 * Fetch email digest preferences
 */
export const digestPreferencesOptions = (userEmail) =>
  queryOptions({
    queryKey: queryKeys.user.digestPreferences(userEmail),
    queryFn: async ({ signal }) => {
      if (!userEmail) return null;
      
      const response = await callEdgeFunction('elora_get_digest_preferences', {
        userEmail,
      });
      return response?.preferences ?? response?.data ?? response;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000,
    enabled: !!userEmail,
  });
