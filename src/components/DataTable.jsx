import React, { useMemo, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Search, Columns } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const PAGE_SIZES = [10, 20, 50, 100];

function SortableRow({ id, children, disabled }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && 'opacity-50 bg-muted')}
      {...attributes}
      {...listeners}
    >
      {children}
    </TableRow>
  );
}

/** Flatten column groups into a single list of leaf columns (for body cells and visibility). */
function flattenColumns(columns) {
  const out = [];
  for (const col of columns) {
    if (col.columns?.length) {
      for (const child of col.columns) out.push(child);
    } else {
      out.push(col);
    }
  }
  return out;
}

/**
 * Full-featured data table: search, column visibility, pagination, row selection, optional DnD sortable rows.
 * columns: [{ id, header, accessorKey?, cell?(row) }] or [{ id, header, columns: [{ id, header, ... }] }] for grouped headers
 * data: array of rows
 * getRowId: (row) => string (default: row.id ?? index)
 * sortable: boolean - enable drag-and-drop row reorder; onReorder(newData) called when order changes
 */
export default function DataTable({
  columns = [],
  data = [],
  getRowId = (row, index) => row?.id ?? String(index),
  searchPlaceholder = 'Search...',
  searchValue: controlledSearch,
  onSearchChange,
  pageSize: controlledPageSize,
  onPageSizeChange,
  disablePagination = false,
  footerMessage = null,
  columnVisibility: controlledColumnVisibility,
  onColumnVisibilityChange,
  defaultHiddenColumns = [],
  selectedRowIds,
  onSelectionChange,
  sortable = false,
  onReorder,
  onRowClick,
  className,
  title,
  headerExtra,
}) {
  const [internalSearch, setInternalSearch] = useState('');
  const [internalPage, setInternalPage] = useState(1);
  const [internalPageSize, setInternalPageSize] = useState(controlledPageSize ?? 10);
  const leafColumns = useMemo(() => flattenColumns(columns), [columns]);
  const hiddenSet = useMemo(() => new Set(defaultHiddenColumns), [defaultHiddenColumns]);
  const [internalColumnVisibility, setInternalColumnVisibility] = useState(
    () => leafColumns.reduce((acc, col) => ({ ...acc, [col.id]: !hiddenSet.has(col.id) }), {})
  );
  const [internalSelection, setInternalSelection] = useState(new Set());

  const search = controlledSearch !== undefined ? controlledSearch : internalSearch;
  const setSearch = onSearchChange ?? setInternalSearch;
  const pageSize = controlledPageSize !== undefined ? controlledPageSize : internalPageSize;
  const columnVisibility = controlledColumnVisibility ?? internalColumnVisibility;
  const setColumnVisibility = onColumnVisibilityChange ?? setInternalColumnVisibility;
  const selection = selectedRowIds ?? internalSelection;
  const setSelection = onSelectionChange ?? setInternalSelection;

  const visibleColumns = useMemo(
    () => leafColumns.filter((col) => columnVisibility[col.id] !== false),
    [leafColumns, columnVisibility]
  );

  const hasGroupHeader = useMemo(() => columns.some((col) => col.columns?.length), [columns]);

  const filteredData = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter((row) =>
      leafColumns.some((col) => {
        const val = col.accessorKey ? row[col.accessorKey] : row[col.id];
        return String(val ?? '').toLowerCase().includes(q);
      })
    );
  }, [data, search, leafColumns]);

  const totalPages = disablePagination ? 1 : Math.max(1, Math.ceil(filteredData.length / pageSize));
  const page = disablePagination ? 1 : Math.min(internalPage, totalPages);
  const paginatedData = useMemo(
    () =>
      disablePagination
        ? filteredData
        : filteredData.slice((page - 1) * pageSize, page * pageSize),
    [filteredData, page, pageSize, disablePagination]
  );

  const toggleColumn = (colId) => {
    setColumnVisibility((prev) => ({ ...prev, [colId]: !prev[colId] }));
  };

  const toggleRow = (id) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const ids = paginatedData.map((row, i) => getRowId(row, i));
    const allSelected = ids.every((id) => selection.has(id));
    setSelection(allSelected ? new Set() : new Set(ids));
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorder) return;
    const oldIndex = filteredData.findIndex((row, i) => getRowId(row, i) === active.id);
    const newIndex = filteredData.findIndex((row, i) => getRowId(row, i) === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const newData = arrayMove([...filteredData], oldIndex, newIndex);
    onReorder(newData);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const rowIds = useMemo(
    () => paginatedData.map((row, i) => getRowId(row, i)),
    [paginatedData, getRowId]
  );

  const tableBody = (
    <TableBody>
      {sortable && onReorder ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
            {paginatedData.map((row, index) => {
              const rowId = getRowId(row, (page - 1) * pageSize + index);
              const RowWrapper = sortable ? SortableRow : TableRow;
              const rowProps = sortable ? { id: rowId, disabled: false } : {};
              const sharedCells = (
                <>
                  {onSelectionChange || selectedRowIds ? (
                    <TableCell className="w-10" onClick={onRowClick ? (e) => e.stopPropagation() : undefined}>
                      <Checkbox
                        checked={selection.has(rowId)}
                        onCheckedChange={() => toggleRow(rowId)}
                        aria-label="Select row"
                      />
                    </TableCell>
                  ) : null}
                  {visibleColumns.map((col) => (
                    <TableCell key={col.id} onClick={col.id === 'favorite' && onRowClick ? (e) => e.stopPropagation() : undefined}>
                      {col.cell ? col.cell(row) : (row[col.accessorKey ?? col.id] ?? '—')}
                    </TableCell>
                  ))}
                </>
              );
              return sortable ? (
                <RowWrapper key={rowId} {...rowProps}>
                  {sharedCells}
                </RowWrapper>
              ) : (
                <TableRow
                  key={rowId}
                  className={onRowClick ? 'cursor-pointer hover:bg-muted/50' : undefined}
                  onClick={onRowClick ? () => onRowClick(row, index) : undefined}
                >
                  {sharedCells}
                </TableRow>
              );
            })}
          </SortableContext>
        </DndContext>
      ) : (
        paginatedData.map((row, index) => {
          const rowId = getRowId(row, (page - 1) * pageSize + index);
          return (
            <TableRow
              key={rowId}
              className={onRowClick ? 'cursor-pointer hover:bg-muted/50' : undefined}
              onClick={onRowClick ? () => onRowClick(row, index) : undefined}
            >
              {onSelectionChange || selectedRowIds ? (
                <TableCell className="w-10" onClick={(e) => onRowClick && e.stopPropagation()}>
                  <Checkbox
                    checked={selection.has(rowId)}
                    onCheckedChange={() => toggleRow(rowId)}
                    aria-label="Select row"
                  />
                </TableCell>
              ) : null}
              {visibleColumns.map((col) => (
                <TableCell key={col.id} onClick={col.id === 'favorite' && onRowClick ? (e) => e.stopPropagation() : undefined}>
                  {col.cell ? col.cell(row) : (row[col.accessorKey ?? col.id] ?? '—')}
                </TableCell>
              ))}
            </TableRow>
          );
        })
      )}
    </TableBody>
  );

  return (
    <Card className={cn('max-w-full min-w-0', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        {title && <h3 className="text-lg font-semibold">{title}</h3>}
        <div className="flex items-center gap-2 flex-wrap">
          {headerExtra}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setInternalPage(1);
              }}
              className="pl-8 w-[200px]"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Toggle columns">
                <Columns className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[180px]">
              {leafColumns.map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={columnVisibility[col.id] !== false}
                  onCheckedChange={() => toggleColumn(col.id)}
                >
                  {col.header}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-hidden">
        <div className="w-full overflow-x-auto overflow-y-visible" style={{ maxWidth: '100%' }}>
          <Table className="min-w-max [&_td]:text-center [&_td]:align-middle [&_td]:px-4 [&_td]:py-3">
          <TableHeader className="sticky top-0 z-10 bg-muted/60 shadow-sm [&_th]:text-center [&_th]:align-middle [&_th]:px-4 [&_th]:py-3 [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-foreground [&_th]:border-b-2 [&_th]:border-border">
            {hasGroupHeader ? (
              <>
                <TableRow className="border-b border-border/50">
                  {onSelectionChange || selectedRowIds ? (
                    <TableHead rowSpan={2} className="w-10 [&]:text-center">
                      <div className="flex justify-center">
                        <Checkbox
                          checked={
                            paginatedData.length > 0 &&
                            paginatedData.every((row, i) =>
                              selection.has(getRowId(row, (page - 1) * pageSize + i))
                            )
                          }
                          onCheckedChange={toggleAll}
                          aria-label="Select all"
                        />
                      </div>
                    </TableHead>
                  ) : null}
                  {columns.map((col) => {
                    if (col.columns?.length) {
                      const visibleChildren = col.columns.filter((c) => columnVisibility[c.id] !== false);
                      if (visibleChildren.length === 0) return null;
                      return (
                        <TableHead key={col.id} colSpan={visibleChildren.length}>
                          {col.header}
                        </TableHead>
                      );
                    }
                    if (columnVisibility[col.id] === false) return null;
                    return (
                      <TableHead key={col.id} rowSpan={2}>
                        {col.header}
                      </TableHead>
                    );
                  })}
                </TableRow>
                <TableRow className="border-b border-border/50">
                  {columns.map((col) => {
                    if (!col.columns?.length) return null;
                    return col.columns
                      .filter((c) => columnVisibility[c.id] !== false)
                      .map((c) => (
                        <TableHead key={c.id} className="font-normal text-muted-foreground text-[11px] normal-case tracking-normal">
                          {c.header}
                        </TableHead>
                      ));
                  })}
                </TableRow>
              </>
            ) : (
              <TableRow className="border-b border-border/50">
                {onSelectionChange || selectedRowIds ? (
                  <TableHead className="w-10">
                    <div className="flex justify-center">
                      <Checkbox
                        checked={
                          paginatedData.length > 0 &&
                          paginatedData.every((row, i) =>
                            selection.has(getRowId(row, (page - 1) * pageSize + i))
                          )
                        }
                        onCheckedChange={toggleAll}
                        aria-label="Select all"
                      />
                    </div>
                  </TableHead>
                ) : null}
                {visibleColumns.map((col) => (
                  <TableHead key={col.id}>{col.header}</TableHead>
                ))}
              </TableRow>
            )}
          </TableHeader>
          {tableBody}
        </Table>
        </div>
        <div className="flex items-center justify-between border-t px-4 py-2">
          {disablePagination ? (
            <p className="text-sm text-muted-foreground">
              {footerMessage ?? `Showing ${filteredData.length} vehicle${filteredData.length !== 1 ? 's' : ''}`}
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {filteredData.length} row{filteredData.length !== 1 ? 's' : ''}
              </p>
              <div className="flex items-center gap-4">
                <select
                  className="h-8 rounded-md border border-input bg-background text-foreground px-2 text-sm"
                  value={pageSize}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setPageSize(v);
                    setInternalPage(1);
                  }}
                >
                  {PAGE_SIZES.map((s) => (
                    <option key={s} value={s}>
                      {s} per page
                    </option>
                  ))}
                </select>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (page > 1) setInternalPage((p) => p - 1);
                        }}
                        className={page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        aria-disabled={page <= 1}
                      />
                    </PaginationItem>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((p) => p === 1 || p === totalPages || (p >= page - 2 && p <= page + 2))
                      .map((p, i, arr) => (
                        <React.Fragment key={p}>
                          {i > 0 && arr[i - 1] !== p - 1 && (
                            <PaginationItem>
                              <span className="px-2">…</span>
                            </PaginationItem>
                          )}
                          <PaginationItem>
                            <PaginationLink
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                setInternalPage(p);
                              }}
                              isActive={page === p}
                              className="cursor-pointer"
                            >
                              {p}
                            </PaginationLink>
                          </PaginationItem>
                        </React.Fragment>
                      ))}
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (page < totalPages) setInternalPage((p) => p + 1);
                        }}
                        className={page >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        aria-disabled={page >= totalPages}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
