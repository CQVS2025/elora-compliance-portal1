import { useMutation } from '@tanstack/react-query';
import { callEdgeFunction } from '@/lib/supabase';
import { queryClientInstance } from '@/lib/query-client';
import { queryKeys } from '../keys';

/**
 * Preferences Mutations
 * 
 * Mutations for managing user preferences (digest, email reports, etc.).
 */

/**
 * Save email digest preferences
 */
export function useSaveDigestPreferences() {
  return useMutation({
    mutationFn: async (preferences) => {
      const response = await callEdgeFunction('elora_save_digest_preferences', preferences);
      return response;
    },
    onSuccess: (data, variables) => {
      // Invalidate digest preferences
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.user.digestPreferences(variables.userEmail),
      });
    },
  });
}
