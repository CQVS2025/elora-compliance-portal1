import React from 'react';
import { ImageOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';

/**
 * Renders a marketplace image given a storage_path in the
 * marketplace-product-images bucket. Falls back to an icon if the path is
 * empty. Public bucket → uses public URL.
 */
export function MarketplaceImage({ storagePath, alt = '', className = '', sizes = '600px' }) {
  if (!storagePath) {
    return (
      <div
        className={`flex items-center justify-center bg-muted rounded-md text-muted-foreground ${className}`}
        aria-label="No image available"
      >
        <ImageOff className="w-8 h-8" />
      </div>
    );
  }
  const { data } = supabase.storage
    .from('marketplace-product-images')
    .getPublicUrl(storagePath);
  return (
    <img
      src={data?.publicUrl}
      alt={alt}
      sizes={sizes}
      loading="lazy"
      className={className}
    />
  );
}

export default MarketplaceImage;
