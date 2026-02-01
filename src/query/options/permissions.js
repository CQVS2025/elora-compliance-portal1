import { queryOptions } from '@tanstack/react-query';
import { callEdgeFunction } from '@/lib/supabase';
import { queryKeys } from '../keys';

/**
 * Permissions Query Options
 * 
 * User permissions and access control with tenant isolation.
 */

/**
 * Fetch user permissions
 */
export const permissionsOptions = (companyId, userEmail) =>
  queryOptions({
    queryKey: queryKeys.tenant.permissions(companyId, userEmail),
    queryFn: async ({ signal }) => {
      if (!userEmail) return null;
      
      const response = await callEdgeFunction('elora_get_permissions', { userEmail });
      return response?.permissions ?? response?.data ?? response;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - permissions don't change often
    gcTime: 30 * 60 * 1000,
    enabled: !!companyId && !!userEmail,
  });

/**
 * Fetch all permissions for a company (admin view)
 */
export const permissionsListOptions = (companyId) =>
  queryOptions({
    queryKey: queryKeys.tenant.permissionsList(companyId),
    queryFn: async ({ signal }) => {
      // This would call a Supabase table directly via the supabase client
      const { supabase } = await import('@/lib/supabase');
      const { data, error } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('company_id', companyId);
      
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: !!companyId,
  });
