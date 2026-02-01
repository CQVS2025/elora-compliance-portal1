import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '../keys';

/**
 * Role Tab Settings Query Options
 *
 * Fetches role-based tab visibility overrides (super admin configurable).
 * When no override exists for a role, use getAccessibleTabs defaults.
 */

export const roleTabSettingsOptions = () =>
  queryOptions({
    queryKey: queryKeys.global.roleTabSettings(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('role_tab_settings')
        .select('role, visible_tabs');
      if (error) throw error;
      // Convert to map: { role: visible_tabs[] }
      const map = {};
      (data || []).forEach((row) => {
        if (row.visible_tabs && row.visible_tabs.length > 0) {
          map[row.role] = row.visible_tabs;
        }
      });
      return map;
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
