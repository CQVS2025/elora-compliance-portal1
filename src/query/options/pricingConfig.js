import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '../keys';

/**
 * Pricing Configuration Query
 *
 * Fetches two tables from Supabase that together replace the hard-coded PRICING_RULES:
 *
 *  1. tank_configurations – per-device calibration_rate_per_60s (actual hardware flow rate).
 *     Keyed by device_serial (from scan.deviceSerial) and site_ref (site name, fallback).
 *
 *  2. products – chemical product prices (price_cents).
 *     Used to resolve price per litre per customer via name pattern matching.
 *
 * Stale time: 30 minutes – pricing rarely changes.
 */
export const pricingConfigOptions = () =>
  queryOptions({
    queryKey: queryKeys.global.pricingConfig(),
    queryFn: async () => {
      const [tankResult, productsResult] = await Promise.all([
        supabase
          .from('tank_configurations')
          .select('site_ref, device_ref, device_serial, product_type, calibration_rate_per_60s')
          .eq('active', true),
        supabase
          .from('products')
          .select('name, price_cents, status')
          .eq('status', 'active'),
      ]);

      if (tankResult.error) {
        console.warn('[pricingConfig] tank_configurations fetch error:', tankResult.error);
      }
      if (productsResult.error) {
        console.warn('[pricingConfig] products fetch error:', productsResult.error);
      }

      return {
        tankConfigs: tankResult.data ?? [],
        products: productsResult.data ?? [],
      };
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
