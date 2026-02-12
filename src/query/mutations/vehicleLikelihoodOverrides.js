import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '../keys';
import { toast } from 'sonner';

/**
 * Upsert vehicle likelihood override.
 * Uses company_id, vehicle_ref, likelihood, and updated_by (user email).
 */
export function useSetVehicleLikelihood(companyId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ vehicleRef, likelihood, userEmail }) => {
      if (!companyId) {
        throw new Error('Company context required to save likelihood');
      }
      const { error } = await supabase
        .from('vehicle_likelihood_overrides')
        .upsert(
          {
            company_id: companyId,
            vehicle_ref: vehicleRef,
            likelihood,
            updated_by: userEmail || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'company_id,vehicle_ref' }
        );

      if (error) throw error;
      return { vehicleRef, likelihood };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.tenant.vehicleLikelihoodOverrides(companyId),
      });
      toast.success('Likelihood updated');
    },
    onError: (err) => {
      toast.error(err?.message || 'Failed to save likelihood');
    },
  });
}
