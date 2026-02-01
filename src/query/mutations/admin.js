import { useMutation } from '@tanstack/react-query';
import { callEdgeFunction, supabase } from '@/lib/supabase';
import { queryClientInstance } from '@/lib/query-client';
import { queryKeys } from '../keys';

/**
 * Admin Mutations
 * 
 * Mutations for admin user/company management.
 */

/**
 * Create new user
 */
export function useCreateUser() {
  return useMutation({
    mutationFn: async (userData) => {
      const response = await callEdgeFunction('createUser', userData);
      return response;
    },
    onSuccess: (data, variables) => {
      // Invalidate users list for this company
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.users(variables.company_id),
      });
    },
  });
}

/**
 * Create Heidelberg user (special case)
 */
export function useCreateHeidelbergUser() {
  return useMutation({
    mutationFn: async (userData) => {
      const response = await callEdgeFunction('createHeidelbergUser', userData);
      return response;
    },
    onSuccess: (data, variables) => {
      // Invalidate users list
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.users(variables.company_id),
      });
    },
  });
}

/**
 * Update user password (admin action)
 */
export function useUpdateUserPassword() {
  return useMutation({
    mutationFn: async (passwordData) => {
      const response = await callEdgeFunction('adminUpdateUserPassword', passwordData);
      return response;
    },
  });
}

/**
 * Delete user (admin action)
 */
export function useDeleteUser() {
  return useMutation({
    mutationFn: async ({ userId, companyId }) => {
      const response = await callEdgeFunction('adminDeleteUser', { userId });
      return response;
    },
    onSuccess: (data, variables) => {
      // Invalidate users list
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.users(variables.companyId),
      });
      
      // Remove specific user from cache
      queryClientInstance.removeQueries({
        queryKey: queryKeys.tenant.user(variables.companyId, variables.userId),
      });
    },
  });
}

/**
 * Toggle user status (active/inactive)
 */
export function useToggleUserStatus() {
  return useMutation({
    mutationFn: async ({ userId, companyId, isActive }) => {
      const { data, error } = await supabase
        .from('user_profiles')
        .update({ status: isActive ? 'active' : 'inactive' })
        .eq('id', userId);
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      // Invalidate users list
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.users(variables.companyId),
      });
    },
  });
}

/**
 * Create company with initial admin user
 */
export function useCreateCompanyWithUser() {
  return useMutation({
    mutationFn: async (companyData) => {
      const response = await callEdgeFunction('createCompanyWithUser', companyData);
      return response;
    },
    onSuccess: (data, variables) => {
      // Invalidate companies list (super admin view)
      queryClientInstance.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return (
            Array.isArray(key) &&
            key[0] === 'tenant' &&
            key[2] === 'companies'
          );
        },
      });
    },
  });
}

/**
 * Delete company (super admin action)
 */
export function useDeleteCompany() {
  return useMutation({
    mutationFn: async ({ companyId }) => {
      const response = await callEdgeFunction('adminDeleteCompany', { companyId });
      return response;
    },
    onSuccess: (data, variables) => {
      // Invalidate companies list
      queryClientInstance.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return (
            Array.isArray(key) &&
            key[0] === 'tenant' &&
            key[2] === 'companies'
          );
        },
      });
      
      // Clear all cache for deleted company
      queryClientInstance.removeQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return (
            Array.isArray(key) &&
            key[0] === 'tenant' &&
            key[1] === variables.companyId
          );
        },
      });
    },
  });
}

/**
 * Toggle company status
 */
export function useToggleCompanyStatus() {
  return useMutation({
    mutationFn: async ({ companyId, isActive }) => {
      const { data, error } = await supabase
        .from('companies')
        .update({ status: isActive ? 'active' : 'inactive' })
        .eq('id', companyId);
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      // Invalidate companies list
      queryClientInstance.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return (
            Array.isArray(key) &&
            key[0] === 'tenant' &&
            key[2] === 'companies'
          );
        },
      });
    },
  });
}

/**
 * Delete user's own account
 */
export function useDeleteMyAccount() {
  return useMutation({
    mutationFn: async () => {
      const response = await callEdgeFunction('deleteMyAccount', {});
      return response;
    },
    onSuccess: () => {
      // Clear all cache on account deletion
      queryClientInstance.clear();
    },
  });
}
