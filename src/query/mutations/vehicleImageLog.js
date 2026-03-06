import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '../keys';
import { toast } from '@/lib/toast';
import { VEHICLE_IMAGES_BUCKET } from '@/query/options/vehicleImageLog';

/**
 * Upload an image to Supabase Storage (vehicle-images bucket) and insert a vehicle_image_log row.
 * Storage path: {vehicle_ref}/{uuid}.{ext}
 */
async function uploadVehicleImage({ vehicleRef, file, userId }) {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${vehicleRef}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(VEHICLE_IMAGES_BUCKET)
    .upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false });
  if (uploadError) throw uploadError;
  const { data: row, error: insertError } = await supabase
    .from('vehicle_image_log')
    .insert({
      vehicle_ref: vehicleRef,
      file_path: path,
      uploaded_by: userId || null,
    })
    .select('id, vehicle_ref, file_path, uploaded_at, uploaded_by')
    .single();
  if (insertError) throw insertError;
  return row;
}

/**
 * Delete an image from Supabase Storage (vehicle-images bucket) and remove the vehicle_image_log row.
 */
async function deleteVehicleImage({ id, filePath }) {
  if (filePath) {
    const { error } = await supabase.storage.from(VEHICLE_IMAGES_BUCKET).remove([filePath]);
    if (error) throw error;
  }
  const { error } = await supabase.from('vehicle_image_log').delete().eq('id', id);
  if (error) throw error;
  return { id };
}

export function useUploadVehicleImage(vehicleRef) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, userId }) => uploadVehicleImage({ vehicleRef, file, userId }),
    onSuccess: (_, __, context) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant.vehicleImageLog(vehicleRef) });
      toast.success('Image uploaded');
    },
    onError: (err) => {
      toast.error(err?.message || 'Upload failed');
    },
  });
}

export function useDeleteVehicleImage(vehicleRef) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteVehicleImage,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant.vehicleImageLog(vehicleRef) });
      toast.success('Image removed');
    },
    onError: (err) => {
      toast.error(err?.message || 'Delete failed');
    },
  });
}
