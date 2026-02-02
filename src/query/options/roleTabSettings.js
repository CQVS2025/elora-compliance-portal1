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
        .select('role, visible_tabs, visible_email_report_types');
      if (error) throw error;
      // Convert to map: { role: { visible_tabs: [], visible_email_report_types: [] | null } }
      const map = {};
      (data || []).forEach((row) => {
        map[row.role] = {
          visible_tabs: row.visible_tabs || [],
          visible_email_report_types: row.visible_email_report_types ?? null,
        };
      });
      return map;
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
