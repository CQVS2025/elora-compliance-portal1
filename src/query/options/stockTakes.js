import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '../keys';

/**
 * Stock take sessions (for Manager view: list all; for Agent: my stock takes)
 */
export function stockTakesOptions({ limit = 50 } = {}) {
  return queryOptions({
    queryKey: [...queryKeys.global.stockTakes(), limit],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('stock_takes')
        .select('id, created_by, company_id, taken_at, created_at')
        .order('taken_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      const list = rows ?? [];
      const createdByIds = [...new Set(list.map((s) => s.created_by).filter(Boolean))];
      if (createdByIds.length === 0) return list;
      const { data: profiles } = await supabase.from('user_profiles').select('id, full_name').in('id', createdByIds);
      const nameById = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name || null]));
      return list.map((s) => ({ ...s, created_by_name: nameById[s.created_by] ?? null }));
    },
    staleTime: 60 * 1000,
  });
}

/**
 * Single stock take with items (for detail view)
 */
export function stockTakeWithItemsOptions(stockTakeId) {
  return queryOptions({
    queryKey: [...queryKeys.global.stockTakes(), 'detail', stockTakeId],
    queryFn: async () => {
      const { data: st, error: e1 } = await supabase
        .from('stock_takes')
        .select('*')
        .eq('id', stockTakeId)
        .single();
      if (e1) throw e1;
      if (!st) return null;
      const { data: items, error: e2 } = await supabase
        .from('stock_take_items')
        .select(`
          id,
          part_id,
          quantity_counted,
          parts(id, description, category, unit, image_path)
        `)
        .eq('stock_take_id', stockTakeId);
      if (e2) throw e2;
      return { ...st, items: items ?? [] };
    },
    enabled: !!stockTakeId,
    staleTime: 60 * 1000,
  });
}
