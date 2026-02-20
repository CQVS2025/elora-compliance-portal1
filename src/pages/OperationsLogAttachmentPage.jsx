import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Expand } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';

export default function OperationsLogAttachmentPage() {
  const { id: entryId } = useParams();
  const [searchParams] = useSearchParams();
  const pathParam = searchParams.get('path');
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!pathParam) {
      setError('Missing attachment path');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, error: err } = await supabase.storage
          .from('operations-log')
          .createSignedUrl(pathParam, 3600);
        if (err) throw err;
        if (!cancelled && data?.signedUrl) {
          setUrl(data.signedUrl);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || 'Failed to load attachment');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pathParam]);

  const isPdf = pathParam?.toLowerCase().endsWith('.pdf');

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] flex flex-col bg-background">
      <div className="shrink-0 border-b bg-card px-4 sm:px-6 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" asChild>
            <Link to={entryId ? `/operations-log/entry/${entryId}` : '/operations-log'}>
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <span className="text-sm font-medium text-muted-foreground truncate">Attachment</span>
        </div>
        {url && !isPdf && (
          <Button variant="outline" size="sm" asChild>
            <a href={url} target="_blank" rel="noopener noreferrer">
              <Expand className="size-4 mr-2" />
              Open full size
            </a>
          </Button>
        )}
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center p-4 overflow-auto">
        {loading && (
          <Card className="border-0 shadow-none">
            <CardContent className="flex flex-col items-center justify-center gap-4 py-16">
              <Loader2 className="size-12 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Loading attachment…</span>
            </CardContent>
          </Card>
        )}
        {error && (
          <Card className="max-w-md">
            <CardContent className="pt-6 text-center">
              <p className="font-medium text-destructive">Could not load attachment</p>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
              <Button variant="outline" className="mt-6" asChild>
                <Link to={entryId ? `/operations-log/entry/${entryId}` : '/operations-log'}>Back to entry</Link>
              </Button>
            </CardContent>
          </Card>
        )}
        {url && !loading && !error && (
          <div className="w-full h-full flex items-center justify-center min-h-[60vh]">
            {isPdf ? (
              <iframe
                src={url}
                title="PDF attachment"
                className="w-full flex-1 min-h-[70vh] rounded-lg border bg-muted shadow-sm"
              />
            ) : (
              <img
                src={url}
                alt="Attachment"
                className="max-w-full w-auto max-h-[85vh] object-contain rounded-lg shadow-sm"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
