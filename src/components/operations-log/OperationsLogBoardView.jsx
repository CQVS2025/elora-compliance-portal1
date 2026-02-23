import React from 'react';
import { format } from 'date-fns';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useUpdateOperationsLogStatus } from '@/query/mutations';
import { toastSuccess } from '@/lib/toast';

const STATUS_COLUMNS = ['open', 'in_progress', 'resolved'];
const STATUS_LABELS = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved' };
const PRIORITY_COLORS = { urgent: 'destructive', high: 'destructive', medium: 'secondary', low: 'outline' };

function getInitials(name) {
  if (!name) return '?';
  return name.split(/\s+/).map((s) => s[0]).join('').toUpperCase().slice(0, 2);
}

function BoardCard({ entry, status, onSelectEntry }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: entry.id,
    data: { entryId: entry.id, currentStatus: entry.status },
  });

  const style = transform
    ? { transform: CSS.Transform.toString(transform) }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'rounded-md border bg-card p-3 text-left shadow-sm transition-colors cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-60 shadow-lg ring-2 ring-primary/30 z-10',
        !isDragging && 'hover:bg-accent/50'
      )}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        e.stopPropagation();
        onSelectEntry?.(entry.id);
      }}
    >
      <p className="font-medium text-sm truncate">{entry.title}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{entry.siteDisplayName ?? entry.site_ref ?? '—'}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {(entry.vehicleLinksWithNames ?? entry.operations_log_vehicle_links ?? []).slice(0, 2).map((l) => (
          <Badge key={l.id ?? l.vehicle_id} variant="secondary" className="text-xs">
            {l.displayName ?? l.vehicle_id}
          </Badge>
        ))}
        {entry.category?.name && (
          <Badge variant="outline" className="text-xs">{entry.category.name}</Badge>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between">
        {entry.due_date && status !== 'resolved' && (
          <span className="text-xs text-muted-foreground">
            Due {format(new Date(entry.due_date), 'd MMM')}
          </span>
        )}
        {entry.status === 'resolved' && entry.resolved_at && (
          <span className="text-xs text-muted-foreground">
            ✓ {format(new Date(entry.resolved_at), 'd MMM')}
          </span>
        )}
        {entry.assigned_to && (
          <Avatar className="size-6">
            <AvatarFallback className="text-xs">{getInitials(entry.assigned_to)}</AvatarFallback>
          </Avatar>
        )}
      </div>
      {entry.operations_log_attachments?.length > 0 && (
        <span className="text-xs text-muted-foreground mt-1">
          {entry.operations_log_attachments.length} photo(s)
        </span>
      )}
    </div>
  );
}

function ColumnDroppable({ status, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-h-[120px] rounded-lg transition-colors',
        isOver && 'bg-primary/5 ring-1 ring-primary/20'
      )}
    >
      {children}
    </div>
  );
}

export function OperationsLogBoardView({
  entries,
  onSelectEntry,
  page = 1,
  total = 0,
  onPageChange,
  pageSize = 20,
}) {
  const updateStatus = useUpdateOperationsLogStatus();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const byStatus = React.useMemo(() => {
    const map = { open: [], in_progress: [], resolved: [] };
    entries.forEach((e) => {
      if (map[e.status]) map[e.status].push(e);
    });
    return map;
  }, [entries]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || over.id === active.id) return;
    const currentStatus = active.data.current?.currentStatus;
    const entryId = active.data.current?.entryId;
    if (!entryId || !currentStatus) return;

    const overId = String(over.id);

    // Resolve target status: either dropped on column (over.id is status) or on a card (over.id is entry id)
    let targetStatus = null;
    if (STATUS_COLUMNS.includes(overId)) {
      targetStatus = overId;
    } else {
      const targetEntry = entries.find((e) => String(e.id) === overId);
      if (targetEntry?.status) targetStatus = targetEntry.status;
    }

    if (targetStatus && STATUS_COLUMNS.includes(targetStatus) && targetStatus !== currentStatus) {
      updateStatus.mutate(
        { entryId, status: targetStatus },
        {
          onSuccess: () => toastSuccess('update', 'status'),
          onError: () => {},
        }
      );
    }
  };

  return (
    <div className="space-y-4 min-w-0">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-3">
          {STATUS_COLUMNS.map((status) => (
            <div key={status} className="rounded-lg border bg-muted/30 p-3">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-medium">{STATUS_LABELS[status]}</span>
                <Badge variant="secondary">{byStatus[status].length}</Badge>
              </div>
              <ColumnDroppable status={status}>
                <div className="space-y-2">
                  {byStatus[status].map((entry) => (
                    <BoardCard
                      key={entry.id}
                      entry={entry}
                      status={status}
                      onSelectEntry={onSelectEntry}
                    />
                  ))}
                </div>
              </ColumnDroppable>
            </div>
          ))}
        </div>
      </DndContext>
      {totalPages > 1 && onPageChange && (
        <div className="flex items-center justify-end gap-2 pt-4 border-t mt-4">
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
