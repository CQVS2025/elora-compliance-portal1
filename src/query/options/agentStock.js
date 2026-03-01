import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '../keys';

/**
 * Agent stock (current_stock_qty, need_to_order) for one user or all (manager)
 */
export function agentStockOptions(userId = null) {
  return queryOptions({
    queryKey: [...queryKeys.global.agentStock(userId)],
    queryFn: async () => {
      let q = supabase
        .from('agent_stock')
        .select(`
          id,
          user_id,
          part_id,
          current_stock_qty,
          need_to_order,
          updated_at,
          parts(id, description, category, unit, image_path)
        `);
      if (userId) q = q.eq('user_id', userId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60 * 1000,
  });
}
