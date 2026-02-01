import { useMutation } from '@tanstack/react-query';
import { callEdgeFunction } from '@/lib/supabase';
import { queryClientInstance } from '@/lib/query-client';
import { queryKeys } from '../keys';

/**
 * Compliance Mutations
 * 
 * Mutations for managing compliance targets.
 */

/**
 * Save compliance target
 */
export function useSaveComplianceTarget() {
  return useMutation({
    mutationFn: async (targetData) => {
      const response = await callEdgeFunction('elora_save_compliance_target', targetData);
      return response;
    },
    onSuccess: (data, variables) => {
      // Invalidate compliance targets for this customer
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.user.complianceTargets(
          variables.userEmail,
          variables.customerRef
        ),
      });
    },
  });
}

/**
 * Delete compliance target
 */
export function useDeleteComplianceTarget() {
  return useMutation({
    mutationFn: async ({ targetId, userEmail, customerRef }) => {
      const response = await callEdgeFunction('elora_delete_compliance_target', {
        id: targetId,
      });
      return response;
    },
    onSuccess: (data, variables) => {
      // Invalidate compliance targets
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.user.complianceTargets(
          variables.userEmail,
          variables.customerRef
        ),
      });
    },
  });
}
