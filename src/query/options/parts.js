import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '../keys';

/**
 * All parts (for admin Parts Catalog and future Stock & Orders)
 */
export function allPartsOptions() {
  return queryOptions({
    queryKey: [...queryKeys.global.parts(), 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts')
        .select('*')
        .order('display_order', { ascending: true })
        .order('description');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Paginated parts (for Admin Parts Catalog page)
 */
export function allPartsPaginatedOptions({ page = 1, pageSize = 20, category = null, search = '' } = {}) {
  return queryOptions({
    queryKey: [...queryKeys.global.parts(), 'all', 'paginated', page, pageSize, category, search],
    queryFn: async () => {
      let q = supabase
        .from('parts')
        .select('*', { count: 'exact' });
      if (category) q = q.eq('category', category);
      if (search?.trim()) q = q.ilike('description', `%${search.trim()}%`);
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const { data, error, count } = await q
        .order('display_order', { ascending: true })
        .order('description')
        .range(from, to);
      if (error) throw error;
      return { parts: data ?? [], total: count ?? 0 };
    },
    staleTime: 2 * 60 * 1000,
  });
}
