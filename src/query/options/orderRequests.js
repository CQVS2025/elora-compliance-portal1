import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '../keys';

/**
 * Order requests (header list for Manager; with items for detail)
 */
export function orderRequestsOptions({ status = null } = {}) {
  return queryOptions({
    queryKey: [...queryKeys.global.orderRequests(), status],
    queryFn: async () => {
      let q = supabase
        .from('order_requests')
        .select(`
          id,
          requested_by,
          company_id,
          site_ref,
          priority,
          notes,
          status,
          approved_by,
          decided_at,
          created_at,
          updated_at
        `)
        .order('created_at', { ascending: false });
      if (status) q = q.eq('status', status);
      const { data: rows, error } = await q;
      if (error) throw error;
      const list = rows ?? [];
      const requestedByIds = [...new Set(list.map((r) => r.requested_by).filter(Boolean))];
      if (requestedByIds.length === 0) return list;
      const { data: profiles } = await supabase.from('user_profiles').select('id, full_name').in('id', requestedByIds);
      const nameById = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name || null]));
      return list.map((r) => ({ ...r, requested_by_name: nameById[r.requested_by] ?? null }));
    },
    staleTime: 60 * 1000,
  });
}

/**
 * Single order request with items and part details (for Manager detail / export)
 */
export function orderRequestWithItemsOptions(orderRequestId) {
  return queryOptions({
    queryKey: [...queryKeys.global.orderRequests(), 'detail', orderRequestId],
    queryFn: async () => {
      const { data: order, error: e1 } = await supabase
        .from('order_requests')
        .select('*')
        .eq('id', orderRequestId)
        .single();
      if (e1) throw e1;
      if (!order) return null;
      const { data: items, error: e2 } = await supabase
        .from('order_request_items')
        .select(`
          id,
          part_id,
          qty_requested,
          item_status,
          unit_price_cents_snapshot,
          parts(id, description, category, unit)
        `)
        .eq('order_request_id', orderRequestId);
      if (e2) throw e2;
      return { ...order, items: items ?? [] };
    },
    enabled: !!orderRequestId,
    staleTime: 60 * 1000,
  });
}
