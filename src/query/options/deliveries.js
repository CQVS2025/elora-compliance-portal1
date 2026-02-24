import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '../keys';

/**
 * Delivery drivers (from Notion sync) for filter tabs
 */
export const deliveryDriversOptions = () =>
  queryOptions({
    queryKey: queryKeys.global.deliveryDrivers(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_drivers')
        .select('id, name, slug, color')
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

/**
 * Delivery deliveries in a date range, optionally filtered by driver slug
 */
export function deliveryDeliveriesOptions({ from, to, driverSlug = null }) {
  return queryOptions({
    queryKey: queryKeys.global.deliveryDeliveries({ from, to, driverSlug }),
    queryFn: async () => {
      let q = supabase
        .from('delivery_deliveries')
        .select('*')
        .eq('archived', false)
        .gte('date_start', from)
        .lte('date_start', to)
        .order('date_start');

      if (driverSlug) {
        const { data: driverRow } = await supabase
          .from('delivery_drivers')
          .select('id')
          .eq('slug', driverSlug)
          .maybeSingle();
        if (driverRow?.id) {
          q = q.eq('driver_id', driverRow.id);
        }
      }

      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(from && to),
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
