import { useMutation } from '@tanstack/react-query';
import { callEdgeFunction } from '@/lib/supabase';
import { queryClientInstance } from '@/lib/query-client';
import { queryKeys } from '../keys';

/**
 * Permissions Mutations
 * 
 * Mutations for managing user permissions (admin only).
 */

/**
 * Save user permissions
 */
export function useSavePermissions() {
  return useMutation({
    mutationFn: async (permissionsData) => {
      const response = await callEdgeFunction('elora_save_permissions', permissionsData);
      return response;
    },
    onSuccess: (data, variables) => {
      // Invalidate permissions for this company
      queryClientInstance.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return (
            Array.isArray(key) &&
            key[0] === 'tenant' &&
            key[2] === 'permissions'
          );
        },
      });
    },
  });
}

/**
 * Delete user permissions
 */
export function useDeletePermissions() {
  return useMutation({
    mutationFn: async ({ id, companyId }) => {
      const { supabase } = await import('@/lib/supabase');
      const { data, error } = await supabase
        .from('user_permissions')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      // Invalidate permissions list
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.permissionsList(variables.companyId),
      });
    },
  });
}
