import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '../keys';

/**
 * Fetch report schedules for a company (tenant-scoped).
 * Super admin sees all via RLS; others see only their company's schedules.
 */
export const reportSchedulesOptions = (companyId) =>
  queryOptions({
    queryKey: queryKeys.tenant.reportSchedules(companyId ?? 'all'),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('report_schedules')
        .select('*')
        .order('contact_name');

      if (error) throw error;
      return data ?? [];
    },
    staleTime: 2 * 60 * 1000,
    enabled: true,
  });
