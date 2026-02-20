import React from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { MapPin, User, Calendar, Image } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const PRIORITY_COLORS = { urgent: 'destructive', high: 'destructive', medium: 'secondary', low: 'outline' };
const STATUS_COLORS = { open: 'destructive', in_progress: 'default', resolved: 'default' };
const STATUS_LABELS = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved' };

function getInitials(name) {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .map((s) => s[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function OperationsLogFeedView({
  entries,
  onSelectEntry,
  page,
  total,
  onPageChange,
  pageSize = 6,
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="space-y-4 min-w-0">
      <div className="text-muted-foreground text-sm">
        Showing {from}-{to} of {total} entries
      </div>
      <div className="space-y-3">
        {entries.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className="w-full rounded-lg border bg-card p-4 text-left shadow-sm transition-colors hover:bg-accent/50"
            onClick={() => onSelectEntry?.(entry.id)}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium truncate">{entry.title}</span>
                  <Badge variant={STATUS_COLORS[entry.status] ?? 'secondary'} className="shrink-0">
                    {STATUS_LABELS[entry.status] ?? entry.status}
                  </Badge>
                  <Badge variant={PRIORITY_COLORS[entry.priority] ?? 'outline'} className="shrink-0 uppercase">
                    {entry.priority}
                  </Badge>
                </div>
                {entry.brief && (
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{entry.brief}</p>
                )}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="size-4" />
                {entry.siteDisplayName ?? entry.site_ref ?? '—'}
              </span>
              {entry.assigned_to && (
                <span className="flex items-center gap-1">
                  <User className="size-4" />
                  {entry.assigned_to}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="size-4" />
                Created {format(new Date(entry.created_at), 'd MMM yyyy')}
              </span>
              <span className="ml-auto">{formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}</span>
            </div>
            {entry.due_date && entry.status !== 'resolved' && (
              <div className="mt-1 text-sm text-muted-foreground">Due: {format(new Date(entry.due_date), 'd MMM')}</div>
            )}
            {entry.status === 'resolved' && entry.resolved_at && (
              <div className="mt-1 text-sm text-muted-foreground">
                Resolved {format(new Date(entry.resolved_at), 'd MMM yyyy')}
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {entry.operations_log_attachments?.length > 0 && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Image className="size-3.5" />
                  {entry.operations_log_attachments.length} photo{entry.operations_log_attachments.length !== 1 ? 's' : ''}
                </span>
              )}
              {entry.category?.name && (
                <Badge variant="outline" className="text-xs">{entry.category.name}</Badge>
              )}
              {entry.vehicleLinksWithNames?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {entry.vehicleLinksWithNames.map((l) => (
                    <Badge key={l.id ?? l.vehicle_id} variant="secondary" className="text-xs">
                      {l.displayName}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            {entry.assigned_to && (
              <div className="mt-2 flex justify-end">
                <Avatar className="size-6">
                  <AvatarFallback className="text-xs">{getInitials(entry.assigned_to)}</AvatarFallback>
                </Avatar>
              </div>
            )}
          </button>
        ))}
      </div>
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-end gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
