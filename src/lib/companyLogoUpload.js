import { supabase } from '@/lib/supabase';

const BUCKET = 'EloraBucket';
const FOLDER = 'company-logos';
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Upload a company logo to Supabase storage (same bucket as profile avatars).
 * @param {File} file - Image file
 * @param {{ companyId?: string | null }} options - If companyId is provided, use it in path; otherwise use 'temp' for new companies
 * @returns {Promise<string>} Public URL of the uploaded logo
 */
export async function uploadCompanyLogo(file, { companyId = null } = {}) {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('Please select an image file.');
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error('Please select an image smaller than 5MB.');
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const folder = companyId ? String(companyId) : 'temp';
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const filePath = `${FOLDER}/${folder}/${unique}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, { cacheControl: '3600', upsert: false });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  return urlData.publicUrl;
}

/**
 * Remove an existing company logo from storage if it was uploaded to our bucket.
 * Call this when replacing a logo so we don't leave orphaned files.
 * @param {string} publicUrl - Full public URL of the logo (e.g. from companies.logo_url)
 */
export async function removeCompanyLogoFromStorage(publicUrl) {
  if (!publicUrl || typeof publicUrl !== 'string') return;
  try {
    const match = publicUrl.includes('/EloraBucket/') && publicUrl.split('/EloraBucket/')[1];
    if (match) {
      await supabase.storage.from(BUCKET).remove([match]);
    }
  } catch (e) {
    console.warn('Could not delete old company logo from storage:', e);
  }
}
