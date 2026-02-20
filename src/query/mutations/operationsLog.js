import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '../keys';

/**
 * Create operations log entry with vehicle links
 */
export function useCreateOperationsLogEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ companyId, payload, vehicleIds = [] }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let resolvedCompanyId = companyId;
      if (!resolvedCompanyId && payload.customer_ref) {
        const { data: company } = await supabase
          .from('companies')
          .select('id')
          .eq('elora_customer_ref', payload.customer_ref)
          .maybeSingle();
        resolvedCompanyId = company?.id ?? null;
      }
      if (!resolvedCompanyId) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('company_id')
          .eq('id', user.id)
          .single();
        resolvedCompanyId = profile?.company_id ?? null;
      }
      if (!resolvedCompanyId) throw new Error('Could not determine company for this entry');

      const { data: entry, error: entryError } = await supabase
        .from('operations_log_entries')
        .insert({
          company_id: resolvedCompanyId,
          customer_ref: payload.customer_ref,
          site_ref: payload.site_ref,
          title: payload.title,
          brief: payload.brief || null,
          description: payload.description,
          category_id: payload.category_id,
          priority: payload.priority,
          product_id: payload.product_id || null,
          product_quantity: payload.product_quantity ?? null,
          status: 'open',
          assigned_to: payload.assigned_to || null,
          due_date: payload.due_date || null,
          created_by: user.id,
        })
        .select('id')
        .single();

      if (entryError) throw entryError;
      if (!entry?.id) throw new Error('Failed to create entry');

      if (vehicleIds.length > 0) {
        const links = vehicleIds.map((vehicle_id) => ({ entry_id: entry.id, vehicle_id }));
        const { error: linksError } = await supabase.from('operations_log_vehicle_links').insert(links);
        if (linksError) throw linksError;
      }

      return entry;
    },
    onSuccess: (_, variables) => {
      const companyId = variables.companyId ?? 'global';
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant.operationsLogEntries(companyId) });
    },
  });
}

/**
 * Update operations log entry (patch fields)
 */
export function useUpdateOperationsLogEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ entryId, payload, vehicleIds }) => {
      const updates = { ...payload, updated_at: new Date().toISOString() };
      const { data, error } = await supabase
        .from('operations_log_entries')
        .update(updates)
        .eq('id', entryId)
        .select()
        .single();

      if (error) throw error;

      if (Array.isArray(vehicleIds)) {
        await supabase.from('operations_log_vehicle_links').delete().eq('entry_id', entryId);
        if (vehicleIds.length > 0) {
          const links = vehicleIds.map((vehicle_id) => ({ entry_id: entryId, vehicle_id }));
          await supabase.from('operations_log_vehicle_links').insert(links);
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant'], exact: false });
    },
  });
}

/**
 * Update entry status (open → in_progress → resolved)
 */
export function useUpdateOperationsLogStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ entryId, status }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const payload = { status, updated_at: new Date().toISOString() };
      if (status === 'resolved') {
        payload.resolved_at = new Date().toISOString();
        payload.resolved_by = user.id;
      }

      const { data, error } = await supabase
        .from('operations_log_entries')
        .update(payload)
        .eq('id', entryId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant'], exact: false });
    },
  });
}

/**
 * Register attachment after upload to storage
 */
export function useAddOperationsLogAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ entryId, storagePath, fileName, mimeType, fileSize }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('operations_log_attachments')
        .insert({
          entry_id: entryId,
          storage_path: storagePath,
          file_name: fileName,
          mime_type: mimeType || null,
          file_size: fileSize || null,
          uploaded_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant'], exact: false });
    },
  });
}

/**
 * Delete attachment record (and optionally remove from storage)
 */
export function useDeleteOperationsLogAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ attachmentId }) => {
      const { error } = await supabase
        .from('operations_log_attachments')
        .delete()
        .eq('id', attachmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant'], exact: false });
    },
  });
}
