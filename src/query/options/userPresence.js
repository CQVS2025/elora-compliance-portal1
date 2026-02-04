import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '../keys';
import { isOnline } from '@/lib/userPresence';

/**
 * Fetch all user presence (for admin). RLS restricts to admin's company or super_admin sees all.
 * Returns map: { [userId]: { last_login_at, last_seen_at, isOnline } }
 */
export function userPresenceOptions() {
  return queryOptions({
    queryKey: queryKeys.global.userPresence(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_presence')
        .select('user_id, last_login_at, last_seen_at');
      if (error) throw error;
      const map = {};
      (data || []).forEach((row) => {
        map[row.user_id] = {
          last_login_at: row.last_login_at,
          last_seen_at: row.last_seen_at,
          isOnline: isOnline(row.last_seen_at),
        };
      });
      return map;
    },
    staleTime: 20 * 1000,
    refetchInterval: 20 * 1000, // Refresh every 20s for live-ish presence
  });
}
