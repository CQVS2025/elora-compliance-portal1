import React, { useEffect, useState } from 'react';
import { Image as ImageIcon, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const isImageMime = (mime) => mime && /^image\//.test(mime);

export function OperationsLogGalleryView({ entries, onSelectEntry }) {
  const [signedUrls, setSignedUrls] = useState({});
  const [loading, setLoading] = useState(true);

  const imageItems = React.useMemo(() => {
    const items = [];
    (entries ?? []).forEach((entry) => {
      const attachments = entry?.operations_log_attachments ?? [];
      attachments.forEach((att) => {
        if (att?.storage_path && isImageMime(att?.mime_type)) {
          items.push({
            entryId: entry.id,
            entryTitle: entry.title,
            attachmentId: att.id,
            storagePath: att.storage_path,
            fileName: att.file_name,
            uploadedAt: att.uploaded_at,
          });
        }
      });
    });
    return items;
  }, [entries]);

  useEffect(() => {
    if (imageItems.length === 0) {
      setSignedUrls({});
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const map = {};
      try {
        await Promise.all(
          imageItems.map(async (item) => {
            const { data } = await supabase.storage
              .from('operations-log')
              .createSignedUrl(item.storagePath, 3600);
            if (!cancelled && data?.signedUrl) {
              map[item.storagePath] = data.signedUrl;
            }
          })
        );
        if (!cancelled) setSignedUrls((prev) => ({ ...prev, ...map }));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [imageItems]);

  if (imageItems.length === 0 && !loading) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <ImageIcon className="mx-auto size-12 opacity-50 mb-3" />
        <p className="text-sm">No photos in the operational logs for this site.</p>
        <p className="text-xs mt-1">Photos added to entries will appear here.</p>
      </div>
    );
  }

  if (loading && Object.keys(signedUrls).length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
      {imageItems.map((item) => {
        const url = signedUrls[item.storagePath];
        return (
          <button
            key={`${item.entryId}-${item.attachmentId}`}
            type="button"
            className={cn(
              'relative rounded-lg border bg-card overflow-hidden aspect-square',
              'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
              'hover:opacity-90 transition-opacity text-left'
            )}
            onClick={() => onSelectEntry?.(item.entryId)}
          >
            {url ? (
              <img
                src={url}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 text-white text-xs truncate">
              {item.entryTitle || 'Entry'} · {item.uploadedAt ? format(new Date(item.uploadedAt), 'd MMM yyyy') : ''}
            </div>
          </button>
        );
      })}
    </div>
  );
}
