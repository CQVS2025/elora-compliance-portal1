import { queryOptions } from '@tanstack/react-query';
import { callEdgeFunction } from '@/lib/supabase';
import { queryKeys } from '../keys';

/**
 * Compliance Query Options
 * 
 * Compliance targets and goals (user-specific).
 */

/**
 * Fetch compliance targets for a customer
 */
export const complianceTargetsOptions = (userEmail, customerRef) =>
  queryOptions({
    queryKey: queryKeys.user.complianceTargets(userEmail, customerRef),
    queryFn: async ({ signal }) => {
      if (!userEmail) return [];
      
      const response = await callEdgeFunction('elora_get_compliance_targets', {
        userEmail,
        customerRef,
      });
      return response?.targets ?? response?.data ?? response ?? [];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000,
    enabled: !!userEmail && !!customerRef,
  });
