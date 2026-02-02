import { supabase } from '@/lib/supabase';

const BUCKET = 'EloraBucket';
const FOLDER = 'site-logos';
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Upload a site logo to Supabase storage.
 * @param {File} file - Image file
 * @param {string} siteRef - Elora site ref (id)
 * @returns {Promise<string>} Public URL of the uploaded logo
 */
export async function uploadSiteLogo(file, siteRef) {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('Please select an image file.');
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error('Please select an image smaller than 5MB.');
  }
  if (!siteRef) {
    throw new Error('Site reference is required.');
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const safeRef = String(siteRef).replace(/[^a-zA-Z0-9_-]/g, '_');
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const filePath = `${FOLDER}/${safeRef}/${unique}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, { cacheControl: '3600', upsert: false });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  return urlData.publicUrl;
}

/**
 * Remove an existing site logo from storage.
 * @param {string} publicUrl - Full public URL of the logo
 */
export async function removeSiteLogoFromStorage(publicUrl) {
  if (!publicUrl || typeof publicUrl !== 'string') return;
  try {
    const match = publicUrl.includes('/EloraBucket/') && publicUrl.split('/EloraBucket/')[1];
    if (match) {
      await supabase.storage.from(BUCKET).remove([match]);
    }
  } catch (e) {
    console.warn('Could not delete old site logo from storage:', e);
  }
}
