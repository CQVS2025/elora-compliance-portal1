import { useMutation } from '@tanstack/react-query';
import { callEdgeFunction } from '@/lib/supabase';
import { queryClientInstance } from '@/lib/query-client';
import { queryKeys } from '../keys';

/**
 * Branding Mutations
 * 
 * Mutations for managing white-label branding (admin only).
 */

/**
 * Save branding configuration
 */
export function useSaveBranding() {
  return useMutation({
    mutationFn: async (brandingData) => {
      const response = await callEdgeFunction('elora_save_branding', brandingData);
      return response;
    },
    onSuccess: (data, variables) => {
      // Invalidate branding for this company
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.branding(variables.company_id),
      });
      
      // Also invalidate domain-based branding if applicable
      if (variables.email_domain) {
        queryClientInstance.invalidateQueries({
          queryKey: queryKeys.tenant.brandingByDomain(variables.email_domain),
        });
      }
      if (variables.custom_domain) {
        queryClientInstance.invalidateQueries({
          queryKey: queryKeys.global.brandingByCustomDomain(variables.custom_domain),
        });
      }
    },
  });
}
