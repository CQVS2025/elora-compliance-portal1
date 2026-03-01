import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '../keys';

/**
 * Part requests (for Manager view: list pending/approved/rejected; for Agent: my requests)
 */
export function partRequestsOptions({ status = null, companyId = null } = {}) {
  return queryOptions({
    queryKey: [...queryKeys.global.partRequests(companyId), status],
    queryFn: async () => {
      let q = supabase
        .from('part_requests')
        .select(`
          id,
          part_id,
          requested_by,
          company_id,
          quantity,
          notes,
          status,
          decided_by,
          decided_at,
          created_at,
          updated_at,
          parts(id, description, category, unit, image_path)
        `)
        .order('created_at', { ascending: false });
      if (status) q = q.eq('status', status);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60 * 1000,
  });
}
