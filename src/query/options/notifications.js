import { queryOptions } from '@tanstack/react-query';
import { callEdgeFunction } from '@/lib/supabase';
import { queryKeys } from '../keys';

/**
 * Notifications Query Options
 * 
 * User notifications with tenant context.
 */

/**
 * Fetch user notifications
 */
export const notificationsOptions = (companyId, userEmail) =>
  queryOptions({
    queryKey: queryKeys.tenant.notifications(companyId, userEmail),
    queryFn: async ({ signal }) => {
      if (!userEmail) return [];
      
      const response = await callEdgeFunction('checkNotifications', { userEmail });
      return response?.notifications ?? response?.data ?? response ?? [];
    },
    staleTime: 30000, // 30 seconds - notifications are real-time
    gcTime: 5 * 60 * 1000,
    enabled: !!companyId && !!userEmail,
    // Refetch notifications more aggressively
    refetchInterval: 60000, // Refetch every minute when mounted
  });
