import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '../keys';

/**
 * Map form payload to DB columns
 */
function toDbRow(payload, companyId) {
  return {
    company_id: companyId,
    contact_name: payload.contactName?.trim() || '',
    contact_company_id: payload.companyId || null,
    email: payload.email?.trim() || '',
    role_title: payload.roleTitle?.trim() || null,
    report_types: Array.isArray(payload.reportTypes) ? payload.reportTypes : [],
    frequency: payload.frequency || 'weekly',
    send_day: payload.sendDay ?? 5,
    starting_from: payload.startingFrom || new Date().toISOString().slice(0, 10),
    last_sent: payload.lastSent || null,
    active: payload.active !== false,
    notes: payload.notes?.trim() || null,
  };
}

/**
 * Create a report schedule
 */
export function useCreateReportSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ companyId, payload }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let resolvedCompanyId = companyId;
      if (!resolvedCompanyId) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('company_id')
          .eq('id', user.id)
          .single();
        resolvedCompanyId = profile?.company_id ?? null;
      }
      if (!resolvedCompanyId) throw new Error('Could not determine company');

      const row = toDbRow(payload, resolvedCompanyId);
      const { data, error } = await supabase
        .from('report_schedules')
        .insert(row)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tenant', variables.companyId ?? 'all', 'reportSchedules'] });
    },
  });
}

/**
 * Update a report schedule
 */
export function useUpdateReportSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, companyId, payload }) => {
      const fullRow = toDbRow(payload, companyId);
      const { company_id, ...row } = fullRow;
      const { data, error } = await supabase
        .from('report_schedules')
        .update({ ...row, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tenant', variables.companyId ?? 'all', 'reportSchedules'] });
    },
  });
}

/**
 * Toggle schedule active status (enable/disable schedule)
 */
export function useToggleReportScheduleActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, active, companyId }) => {
      const { data, error } = await supabase
        .from('report_schedules')
        .update({ active, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tenant', variables.companyId ?? 'all', 'reportSchedules'] });
    },
  });
}

/**
 * Mark schedule as sent or not sent (client tracks whether they've sent the report)
 */
export function useMarkReportScheduleSent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, markedAsSent, companyId }) => {
      const last_sent = markedAsSent ? new Date().toISOString() : null;
      const { data, error } = await supabase
        .from('report_schedules')
        .update({ last_sent, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tenant', variables.companyId ?? 'all', 'reportSchedules'] });
    },
  });
}

/**
 * Delete a report schedule
 */
export function useDeleteReportSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }) => {
      const { error } = await supabase
        .from('report_schedules')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tenant', variables.companyId ?? 'all', 'reportSchedules'] });
    },
  });
}

