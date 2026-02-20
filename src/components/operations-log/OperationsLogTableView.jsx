import React, { useState } from 'react';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

const PRIORITY_COLORS = { urgent: 'destructive', high: 'destructive', medium: 'secondary', low: 'outline' };
const STATUS_COLORS = { open: 'destructive', in_progress: 'default', resolved: 'default' };
const STATUS_LABELS = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved' };

function getInitials(name) {
  if (!name) return '?';
  return name.split(/\s+/).map((s) => s[0]).join('').toUpperCase().slice(0, 2);
}

export function OperationsLogTableView({
  entries,
  onSelectEntry,
  page,
  total,
  onPageChange,
  pageSize = 10,
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const [sortField, setSortField] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');

  const sorted = React.useMemo(() => {
    const list = [...entries];
    list.sort((a, b) => {
      let va = a[sortField];
      let vb = b[sortField];
      if (sortField === 'created_at' || sortField === 'due_date' || sortField === 'resolved_at') {
        va = va ? new Date(va).getTime() : 0;
        vb = vb ? new Date(vb).getTime() : 0;
      } else {
        va = String(va ?? '').toLowerCase();
        vb = String(vb ?? '').toLowerCase();
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [entries, sortField, sortDir]);

  const toggleSort = (field) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else setSortField(field);
  };

  return (
    <div className="space-y-4 min-w-0">
      <div className="rounded-md border overflow-x-auto">
        <Table className="min-w-[640px]">
          <TableHeader>
            <TableRow>
              <TableHead>
                <button type="button" className="font-medium" onClick={() => toggleSort('title')}>
                  Title
                </button>
              </TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assigned</TableHead>
              <TableHead>
                <button type="button" className="font-medium" onClick={() => toggleSort('due_date')}>
                  Due
                </button>
              </TableHead>
              <TableHead>
                <button type="button" className="font-medium" onClick={() => toggleSort('created_at')}>
                  Created
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((entry) => (
              <TableRow
                key={entry.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onSelectEntry?.(entry.id)}
              >
                <TableCell className="font-medium max-w-[200px] truncate">{entry.title}</TableCell>
                <TableCell>{entry.siteDisplayName ?? entry.site_ref ?? '—'}</TableCell>
                <TableCell>{entry.category?.name ?? '—'}</TableCell>
                <TableCell>
                  <Badge variant={PRIORITY_COLORS[entry.priority] ?? 'outline'} className="uppercase">
                    {entry.priority}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_COLORS[entry.status] ?? 'secondary'}>
                    {STATUS_LABELS[entry.status] ?? entry.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {entry.assigned_to ? (
                    <div className="flex items-center gap-2">
                      <Avatar className="size-6">
                        <AvatarFallback className="text-xs">{getInitials(entry.assigned_to)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{entry.assigned_to}</span>
                    </div>
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell>
                  {entry.status === 'resolved' ? 'Done' : entry.due_date ? format(new Date(entry.due_date), 'd MMM') : '—'}
                </TableCell>
                <TableCell>{entry.created_at ? format(new Date(entry.created_at), 'd MMM yyyy') : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
