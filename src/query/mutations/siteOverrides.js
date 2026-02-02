import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '../keys';

export function useSaveSiteOverride() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload) => {
      const row = {
        site_ref: payload.site_ref,
        customer_ref: payload.customer_ref ?? null,
        customer_name: payload.customer_name ?? null,
        name: payload.name ?? null,
        street_address: payload.street_address ?? null,
        city: payload.city ?? null,
        state: payload.state ?? null,
        postal_code: payload.postal_code ?? null,
        country: payload.country ?? 'Australia',
        contact_person: payload.contact_person ?? null,
        contact_phone: payload.contact_phone ?? null,
        contact_email: payload.contact_email ?? null,
        logo_url: payload.logo_url ?? null,
        is_active: payload.is_active ?? true,
        notes: payload.notes ?? null,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('site_overrides')
        .upsert(row, { onConflict: 'site_ref', ignoreDuplicates: false })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.global.siteOverrides() });
    },
  });
}
