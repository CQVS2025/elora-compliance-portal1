import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '../keys';

/** Supabase Storage bucket for vehicle images (see migration 20260306000001_vehicle_image_log) */
const BUCKET = 'vehicle-images';

/**
 * List image log entries for a vehicle.
 * Metadata in vehicle_image_log; actual files stored in Supabase Storage (bucket: vehicle-images).
 */
export const vehicleImageLogOptions = (vehicleRef) =>
  queryOptions({
    queryKey: queryKeys.tenant.vehicleImageLog(vehicleRef),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicle_image_log')
        .select('id, vehicle_ref, file_path, uploaded_at, uploaded_by')
        .eq('vehicle_ref', vehicleRef)
        .order('uploaded_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60 * 1000,
    enabled: !!vehicleRef,
  });

/**
 * Get the public URL for an image stored in Supabase Storage (vehicle-images bucket).
 * Bucket is created as public in migration so getPublicUrl works for display.
 */
export function getVehicleImageUrl(filePath) {
  if (!filePath) return null;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  return data?.publicUrl ?? null;
}

export { BUCKET as VEHICLE_IMAGES_BUCKET };
