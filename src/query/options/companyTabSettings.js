import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '../keys';

/**
 * Company tab visibility (optional). When set, restricts which tabs users in this company can see.
 * NULL = no restriction.
 */

export const companyTabSettingsOptions = (companyId) =>
  queryOptions({
    queryKey: queryKeys.global.companyTabSettings(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('visible_tabs')
        .eq('id', companyId)
        .single();
      if (error) throw error;
      return data?.visible_tabs ?? null;
    },
    enabled: !!companyId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
