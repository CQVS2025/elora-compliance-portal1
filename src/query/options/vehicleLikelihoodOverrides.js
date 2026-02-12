import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '../keys';

/**
 * Fetch vehicle likelihood overrides for a company.
 * Returns a map of vehicle_ref -> likelihood for quick lookup.
 */
export function vehicleLikelihoodOverridesOptions(companyId) {
  return {
    queryKey: queryKeys.tenant.vehicleLikelihoodOverrides(companyId),
    queryFn: async () => {
      if (!companyId) return {};
      const { data, error } = await supabase
        .from('vehicle_likelihood_overrides')
        .select('vehicle_ref, likelihood')
        .eq('company_id', companyId);

      if (error) throw error;

      const map = {};
      (data || []).forEach((row) => {
        map[row.vehicle_ref] = row.likelihood;
      });
      return map;
    },
    enabled: !!companyId,
  };
}
