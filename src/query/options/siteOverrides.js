import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '../keys';

/**
 * Fetch all site overrides (for merging with Elora API sites)
 */
export const siteOverridesOptions = () =>
  queryOptions({
    queryKey: queryKeys.global.siteOverrides(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_overrides')
        .select('*');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 2 * 60 * 1000,
  });
