import { queryOptions } from '@tanstack/react-query';
import { callEdgeFunction, supabase } from '@/lib/supabase';
import { queryKeys } from '../keys';

/**
 * Users Query Options (Admin)
 * 
 * User management queries for admin users with tenant isolation.
 */

/**
 * Fetch all users for a company (admin view)
 */
export const usersOptions = (companyId) =>
  queryOptions({
    queryKey: queryKeys.tenant.users(companyId),
    queryFn: async ({ signal }) => {
      // Fetch from user_profiles table
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('company_id', companyId)
        .order('email');
      
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000,
    enabled: !!companyId,
  });

/**
 * Fetch single user
 */
export const userOptions = (companyId, userId) =>
  queryOptions({
    queryKey: queryKeys.tenant.user(companyId, userId),
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .eq('company_id', companyId)
        .single();
      
      if (error) throw error;
      return data;
    },
    staleTime: 2 * 60 * 1000,
    enabled: !!companyId && !!userId,
  });
