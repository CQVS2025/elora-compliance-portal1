import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '../keys';

/**
 * Companies Query Options (Super Admin)
 * 
 * Company management queries for super admin users.
 */

/**
 * Fetch all companies (super admin view)
 */
export const companiesOptions = (companyId) =>
  queryOptions({
    queryKey: queryKeys.tenant.companies(companyId),
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000,
    enabled: !!companyId, // Only super admins can access this
  });

/**
 * Fetch single company
 */
export const companyOptions = (companyId, targetCompanyId) =>
  queryOptions({
    queryKey: queryKeys.tenant.company(companyId, targetCompanyId),
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', targetCompanyId)
        .single();
      
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!companyId && !!targetCompanyId,
  });
