import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryClientInstance } from '@/lib/query-client';
import { queryKeys } from '../keys';

/**
 * Role Tab Settings Mutations
 *
 * Mutations for managing role-based tab visibility (super admin only).
 */

export function useSaveRoleTabSettings() {
  return useMutation({
    mutationFn: async ({ role, visibleTabs }) => {
      const { data, error } = await supabase
        .from('role_tab_settings')
        .upsert(
          { role, visible_tabs: visibleTabs, updated_at: new Date().toISOString() },
          { onConflict: 'role' }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({ queryKey: queryKeys.global.roleTabSettings() });
    },
  });
}

export function useResetRoleTabSettings() {
  return useMutation({
    mutationFn: async (role) => {
      const { error } = await supabase
        .from('role_tab_settings')
        .delete()
        .eq('role', role);
      if (error) throw error;
      return { role };
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({ queryKey: queryKeys.global.roleTabSettings() });
    },
  });
}
