import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Truck, Upload, Save, Trash2, Plus, AlertTriangle, FileText, Loader2,
  Download, Clipboard, X, FileSpreadsheet, ChevronDown, ChevronRight, Layers,
  Package, ArrowRight, Pencil, Check,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { rateSheetsOptions, warehousesOptions } from '@/query/options/marketplace';
import {
  useUpsertRateSheet,
  useDeleteRateSheet,
  useUpsertRateSheetBracket,
  useDeleteRateSheetBracket,
} from '@/query/mutations/marketplace';
import { callEdgeFunction } from '@/lib/supabase';
import { toastError, toastSuccess } from '@/lib/toast';
import { useConfirm } from '@/hooks/useConfirm';
import { parseFreightMatrix, buildSampleFreightMatrixCsv } from '@/lib/freightMatrixCsv';
import { queryKeys } from '@/query/keys';

const UNIT_TYPES = [
  { value: 'per_litre', label: 'Per litre' },
  { value: 'flat_per_consignment', label: 'Flat per consignment' },
  { value: 'per_kg', label: 'Per kilogram' },
  { value: 'per_pallet', label: 'Per pallet' },
  { value: 'per_zone', label: 'Per zone' },
];
const OUT_OF_RANGE = [
  { value: 'use_last_bracket', label: 'Use last bracket' },
  { value: 'block_order', label: 'Block order' },
  { value: 'quote_on_application', label: 'Quote on application' },
];

/**
 * Marketplace freight admin page.
 *
 *  - List + CRUD rate sheets (per warehouse)
 *  - Manage brackets manually (add/edit/delete)
 *  - CSV bulk upload via marketplace_freight_matrix_upload Edge Function
 *    (dry-run preview + apply, with optional Replace existing brackets)
 *
 * RLS lets any marketplace admin manage rate sheets. Surfaced via the
 * left-nav Marketplace Admin section.
 */
export default function MarketplaceFreight() {
  const { userProfile } = useAuth();
  const companyId = userProfile?.company_id;
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: sheets = [], isLoading } = useQuery(rateSheetsOptions(companyId));
  const { data: warehouses = [] } = useQuery(warehousesOptions(companyId));
  const upsertSheet = useUpsertRateSheet(companyId);
  const deleteSheet = useDeleteRateSheet(companyId);
  const upsertBracket = useUpsertRateSheetBracket(companyId);
  const deleteBracket = useDeleteRateSheetBracket(companyId);
  const { confirm, ConfirmDialog } = useConfirm();

  const [editingSheetId, setEditingSheetId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [expandedSheetIds, setExpandedSheetIds] = useState({});
  const toggleExpanded = (id) => setExpandedSheetIds((m) => ({ ...m, [id]: !m[id] }));
  const expandAll = () => setExpandedSheetIds(Object.fromEntries(sheets.map((s) => [s.id, true])));
  const collapseAll = () => setExpandedSheetIds({});

  // ---------- Multi-column CSV upload state ----------
  const [csvWarehouseId, setCsvWarehouseId] = useState('');
  const [csvText, setCsvText] = useState('');
  const [csvFileName, setCsvFileName] = useState(null);
  const [csvFileSize, setCsvFileSize] = useState(0);
  const [parseWarnings, setParseWarnings] = useState([]);
  const [parsedRowCount, setParsedRowCount] = useState(0);
  const [columnDrafts, setColumnDrafts] = useState([]); // per-column review
  const [csvBusy, setCsvBusy] = useState(false);
  const csvFileInputRef = useRef(null);

  const startNewSheet = () => {
    setEditingSheetId('new');
    setDraft({
      name: '',
      description: '',
      warehouse_id: warehouses[0]?.id ?? '',
      unit_type: 'per_litre',
      origin_postcode: '',
      min_charge: 0,
      out_of_range_behavior: 'use_last_bracket',
      is_active: true,
    });
  };

  const startEdit = (sheet) => {
    setEditingSheetId(sheet.id);
    setDraft({
      id: sheet.id,
      name: sheet.name ?? '',
      description: sheet.description ?? '',
      warehouse_id: sheet.warehouse_id,
      unit_type: sheet.unit_type,
      origin_postcode: sheet.origin_postcode ?? '',
      min_charge: sheet.min_charge ?? 0,
      out_of_range_behavior: sheet.out_of_range_behavior ?? 'use_last_bracket',
      is_active: sheet.is_active,
    });
  };

  const cancelEdit = () => {
    setEditingSheetId(null);
    setDraft(null);
  };

  async function saveSheet() {
    if (!draft?.name?.trim()) return toastError(new Error('Name is required'));
    if (!draft.warehouse_id) return toastError(new Error('Warehouse is required'));
    try {
      const saved = await upsertSheet.mutateAsync(draft);
      toastSuccess(draft.id ? 'update' : 'create', `rate sheet ${saved?.name ?? ''}`);
      cancelEdit();
    } catch (e) { toastError(e, 'saving rate sheet'); }
  }

  async function removeSheet(sheet) {
    const ok = await confirm({
      title: `Delete rate sheet "${sheet.name}"?`,
      description: 'All brackets in this sheet are deleted with it. Any product currently mapped to this sheet falls back to the warehouse default. This cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteSheet.mutateAsync(sheet.id);
      toastSuccess('delete', `rate sheet ${sheet.name}`);
    } catch (e) { toastError(e, 'deleting rate sheet'); }
  }

  // ---------- Multi-column CSV upload helpers ----------
  function parseCsvText(text) {
    const result = parseFreightMatrix(text);
    setParseWarnings(result.warnings ?? []);
    setParsedRowCount(result.rowCount ?? 0);
    setColumnDrafts(
      (result.columns ?? []).map((c) => ({
        ...c,
        name: c.suggestedName,
        unit_type: c.suggestedUnitType,
        is_active: c.suggestedIsActive,
        // Default to including only post-cutover (active) columns — admin
        // can re-enable pre-cutover ones if they want to keep history.
        include: c.suggestedIsActive,
      })),
    );
  }

  async function readCsvFile(file) {
    if (!file) return;
    setCsvFileName(file.name);
    setCsvFileSize(file.size);
    const text = await file.text();
    setCsvText(text);
    parseCsvText(text);
  }

  function clearCsv() {
    setCsvText('');
    setCsvFileName(null);
    setCsvFileSize(0);
    setColumnDrafts([]);
    setParseWarnings([]);
    setParsedRowCount(0);
    if (csvFileInputRef.current) csvFileInputRef.current.value = '';
  }

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) { setCsvText(text); parseCsvText(text); }
    } catch {
      toastError(new Error('Unable to read clipboard. Paste manually into the text box.'));
    }
  }

  function downloadTemplate(blank = false) {
    const csv = blank
      ? 'from_km,to_km,Bulk,Pack\n0,100,,\n101,200,,\n'
      : buildSampleFreightMatrixCsv();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = blank ? 'elora-freight-template.csv' : 'elora-freight-sample.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function updateColumnDraft(idx, patch) {
    setColumnDrafts((ds) => ds.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  }

  const includedCount = columnDrafts.filter((d) => d.include).length;
  const totalBrackets = columnDrafts
    .filter((d) => d.include)
    .reduce((sum, d) => sum + d.brackets.length, 0);

  async function importBatch() {
    if (!csvWarehouseId) return toastError(new Error('Pick a warehouse first'));
    const sheetsToCreate = columnDrafts
      .filter((d) => d.include && d.brackets.length > 0 && d.name.trim())
      .map((d) => ({
        name: d.name.trim(),
        unit_type: d.unit_type,
        is_active: d.is_active,
        brackets: d.brackets,
      }));
    if (sheetsToCreate.length === 0) {
      return toastError(new Error('Pick at least one column to import.'));
    }
    setCsvBusy(true);
    try {
      const res = await callEdgeFunction('marketplace_freight_matrix_bulk_import', {
        warehouse_id: csvWarehouseId,
        sheets: sheetsToCreate,
      });
      toastSuccess(`Imported ${res?.created ?? sheetsToCreate.length} rate sheet${sheetsToCreate.length === 1 ? '' : 's'}.`);
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant.marketplaceRateSheets(companyId) });
      clearCsv();
    } catch (e) { toastError(e, 'importing freight matrix'); }
    finally { setCsvBusy(false); }
  }

  function formatBytes(b) {
    if (!b) return '';
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-md bg-primary/10 text-primary"><Truck className="w-5 h-5" /></div>
          <div>
            <h1 className="text-xl font-semibold">Freight rate sheets</h1>
            <p className="text-sm text-muted-foreground">
              Distance-bracketed freight tariffs per warehouse. Upload a CSV matrix in bulk or edit brackets row-by-row.
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => navigate('/admin/marketplace/freight/products')}>
          <Package className="w-4 h-4 mr-1.5" /> Per-product setup <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
        </Button>
      </div>

      {/* ============================================================== */}
      {/* Bulk import (supplier-managed freight matrix)                    */}
      {/* ============================================================== */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="w-4 h-4" /> Bulk import freight matrix
              </CardTitle>
              <CardDescription>
                Paste or upload the supplier's CSV. Each rate column (e.g. <em>Bulk</em>,{' '}
                <em>Pack Existing</em>, <em>Pack New</em>) becomes one rate sheet. Review and tweak below before importing.
              </CardDescription>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => downloadTemplate(false)}>
                <Download className="w-3.5 h-3.5 mr-1.5" /> Sample template
              </Button>
              <Button size="sm" variant="outline" onClick={() => downloadTemplate(true)}>
                <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" /> Blank template
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <Label className="text-xs">CSV text (tab- or comma-separated)</Label>
              <Textarea
                rows={5}
                placeholder={'from_km,to_km,Bulk,Pack\n0,100,0.067,60\n101,200,0.078,70\n…'}
                value={csvText}
                onChange={(e) => { setCsvText(e.target.value); parseCsvText(e.target.value); }}
                className="font-mono text-xs"
              />
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="outline" onClick={pasteFromClipboard}>
                  <Clipboard className="w-3.5 h-3.5 mr-1.5" /> Paste from clipboard
                </Button>
                {csvText && (
                  <Button size="sm" variant="outline" onClick={clearCsv}>
                    <X className="w-3.5 h-3.5 mr-1.5" /> Clear
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Warehouse for the imported sheets *</Label>
                <Select value={csvWarehouseId} onValueChange={setCsvWarehouseId}>
                  <SelectTrigger><SelectValue placeholder="Pick a warehouse…" /></SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => (<SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">…or upload a .csv file</Label>
                <Input
                  ref={csvFileInputRef}
                  type="file"
                  accept=".csv,text/csv,text/plain,text/tab-separated-values"
                  onChange={(e) => e.target.files?.[0] && readCsvFile(e.target.files[0])}
                />
                {csvFileName && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    <FileText className="w-3 h-3 inline mr-1" /> {csvFileName} · {formatBytes(csvFileSize)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {parseWarnings.length > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 p-2 space-y-0.5">
              {parseWarnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-700 dark:text-amber-300 flex items-start gap-1.5">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> {w}
                </p>
              ))}
            </div>
          )}

          {columnDrafts.length > 0 && (
            <div className="rounded-md border border-border overflow-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground bg-muted/40">
                  <tr>
                    <th className="text-left p-2 w-8" />
                    <th className="text-left p-2">Column → rate sheet name</th>
                    <th className="text-left p-2 w-44">Unit type</th>
                    <th className="text-left p-2 w-20">Active</th>
                    <th className="text-left p-2 w-20">Brackets</th>
                  </tr>
                </thead>
                <tbody>
                  {columnDrafts.map((d, idx) => (
                    <tr key={d.header + idx} className="border-t border-border/50">
                      <td className="p-2">
                        <Checkbox
                          checked={d.include}
                          onCheckedChange={(v) => updateColumnDraft(idx, { include: Boolean(v) })}
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          className="h-8 text-xs"
                          value={d.name}
                          onChange={(e) => updateColumnDraft(idx, { name: e.target.value })}
                          disabled={!d.include}
                        />
                        <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{d.header}</p>
                      </td>
                      <td className="p-2">
                        <Select
                          value={d.unit_type}
                          onValueChange={(v) => updateColumnDraft(idx, { unit_type: v })}
                          disabled={!d.include}
                        >
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {UNIT_TYPES.map((u) => (<SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2">
                        <Switch
                          checked={d.is_active}
                          onCheckedChange={(v) => updateColumnDraft(idx, { is_active: v })}
                          disabled={!d.include}
                        />
                      </td>
                      <td className="p-2 text-muted-foreground">{d.brackets.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {columnDrafts.length > 0 && (
            <div className="flex justify-between items-center pt-1">
              <p className="text-xs text-muted-foreground">
                {includedCount} of {columnDrafts.length} columns selected · {totalBrackets} brackets across {parsedRowCount} rows
              </p>
              <Button
                onClick={importBatch}
                disabled={csvBusy || !csvWarehouseId || includedCount === 0}
              >
                {csvBusy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Upload className="w-4 h-4 mr-1.5" />}
                Import {includedCount} rate sheet{includedCount === 1 ? '' : 's'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============================================================== */}
      {/* Rate sheets list                                                 */}
      {/* ============================================================== */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Rate sheets</CardTitle>
              <CardDescription>
                One sheet per warehouse / freight model. Each sheet has distance brackets (km) and a unit type.
              </CardDescription>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {sheets.length > 0 && (
                <>
                  <Button size="sm" variant="ghost" onClick={expandAll} className="text-xs">
                    <ChevronDown className="w-3.5 h-3.5 mr-1" /> Expand all
                  </Button>
                  <Button size="sm" variant="ghost" onClick={collapseAll} className="text-xs">
                    <ChevronRight className="w-3.5 h-3.5 mr-1" /> Collapse all
                  </Button>
                </>
              )}
              <Button size="sm" onClick={startNewSheet} disabled={editingSheetId !== null}>
                <Plus className="w-4 h-4 mr-1.5" /> New rate sheet
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {editingSheetId === 'new' && (
            <SheetEditor
              draft={draft}
              setDraft={setDraft}
              warehouses={warehouses}
              onCancel={cancelEdit}
              onSave={saveSheet}
              busy={upsertSheet.isPending}
            />
          )}

          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading rate sheets…</p>
          ) : sheets.length === 0 && editingSheetId !== 'new' ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No rate sheets yet. Click <strong>New rate sheet</strong> to start.
            </p>
          ) : (
            sheets.map((sheet) => {
              const isExpanded = !!expandedSheetIds[sheet.id];
              const bracketCount = sheet.brackets?.length ?? 0;
              const isEditing = editingSheetId === sheet.id;
              return (
                <div key={sheet.id} className="rounded-md border border-border overflow-hidden">
                  {isEditing ? (
                    <div className="p-3">
                      <SheetEditor
                        draft={draft}
                        setDraft={setDraft}
                        warehouses={warehouses}
                        onCancel={cancelEdit}
                        onSave={saveSheet}
                        busy={upsertSheet.isPending}
                      />
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => toggleExpanded(sheet.id)}
                        className="w-full flex items-start justify-between gap-3 flex-wrap p-3 text-left hover:bg-muted/40 transition-colors"
                        aria-expanded={isExpanded}
                      >
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <span className="mt-0.5 text-muted-foreground shrink-0">
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{sheet.name}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                              <span>{sheet.warehouse?.name ?? '-'}</span>
                              <span>·</span>
                              <span>{UNIT_TYPES.find((u) => u.value === sheet.unit_type)?.label}</span>
                              <Badge variant="outline" className="font-mono text-[10px]">
                                <Layers className="w-2.5 h-2.5 mr-1" />{bracketCount} bracket{bracketCount === 1 ? '' : 's'}
                              </Badge>
                              {sheet.origin_postcode && <Badge variant="outline">origin {sheet.origin_postcode}</Badge>}
                              {sheet.min_charge > 0 && <Badge variant="outline">min ${sheet.min_charge}</Badge>}
                              {!sheet.is_active && <Badge variant="secondary">inactive</Badge>}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <Button variant="outline" size="sm" onClick={() => startEdit(sheet)} disabled={deleteSheet.isPending}>Edit</Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeSheet(sheet)}
                            disabled={deleteSheet.isPending}
                            className="text-rose-600 border-rose-200 dark:border-rose-900 dark:text-rose-400"
                          >
                            {deleteSheet.isPending
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Trash2 className="w-3.5 h-3.5" />}
                          </Button>
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="px-3 pb-3 border-t border-border bg-muted/20">
                          <div className="pt-3">
                            <BracketsEditor
                              sheet={sheet}
                              onUpsert={(b) => upsertBracket.mutateAsync(b)}
                              onDelete={async (id) => {
                                const ok = await confirm({
                                  title: 'Delete bracket?',
                                  confirmLabel: 'Delete',
                                  destructive: true,
                                });
                                if (!ok) return;
                                try { await deleteBracket.mutateAsync(id); }
                                catch (e) { toastError(e, 'deleting bracket'); }
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {ConfirmDialog}
    </div>
  );
}

// ----------------------------------------------------------------------------

function SheetEditor({ draft, setDraft, warehouses, onCancel, onSave, busy }) {
  if (!draft) return null;
  const set = (patch) => setDraft({ ...draft, ...patch });
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Name *</Label>
          <Input value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Sydney metro tanker" />
        </div>
        <div>
          <Label className="text-xs">Warehouse *</Label>
          <Select value={draft.warehouse_id} onValueChange={(v) => set({ warehouse_id: v })}>
            <SelectTrigger><SelectValue placeholder="Pick a warehouse…" /></SelectTrigger>
            <SelectContent>
              {warehouses.map((w) => (<SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Unit type</Label>
          <Select value={draft.unit_type} onValueChange={(v) => set({ unit_type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {UNIT_TYPES.map((u) => (<SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Out-of-range behaviour</Label>
          <Select value={draft.out_of_range_behavior} onValueChange={(v) => set({ out_of_range_behavior: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {OUT_OF_RANGE.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Origin postcode (optional)</Label>
          <Input value={draft.origin_postcode} onChange={(e) => set({ origin_postcode: e.target.value })} placeholder="Falls back to warehouse postcode" />
        </div>
        <div>
          <Label className="text-xs">Min charge (AUD)</Label>
          <Input type="number" min="0" step="0.01" value={draft.min_charge} onChange={(e) => set({ min_charge: Number(e.target.value) })} />
        </div>
        <div className="md:col-span-2">
          <Label className="text-xs">Description</Label>
          <Textarea rows={2} value={draft.description ?? ''} onChange={(e) => set({ description: e.target.value })} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={draft.is_active} onCheckedChange={(v) => set({ is_active: v })} />
          Active
        </label>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button onClick={onSave} disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
          Save sheet
        </Button>
      </div>
    </div>
  );
}

function BracketsEditor({ sheet, onUpsert, onDelete }) {
  const [newBracket, setNewBracket] = useState({ distance_from_km: 0, distance_to_km: '', rate: 0, zone_name: '' });
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [savingId, setSavingId] = useState(null);

  const sorted = useMemo(
    () => [...(sheet.brackets ?? [])].sort((a, b) => Number(a.distance_from_km) - Number(b.distance_from_km)),
    [sheet.brackets],
  );

  function startEdit(b) {
    setEditingId(b.id);
    setEditDraft({
      distance_from_km: b.distance_from_km ?? 0,
      distance_to_km: b.distance_to_km == null ? '' : b.distance_to_km,
      rate: b.rate ?? 0,
      zone_name: b.zone_name ?? '',
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
  }

  async function saveEdit(id) {
    setSavingId(id);
    try {
      await onUpsert({
        id,
        rate_sheet_id: sheet.id,
        distance_from_km: Number(editDraft.distance_from_km),
        distance_to_km: editDraft.distance_to_km === '' ? null : Number(editDraft.distance_to_km),
        rate: Number(editDraft.rate),
        zone_name: editDraft.zone_name?.trim() ? editDraft.zone_name.trim() : null,
      });
      toastSuccess('update', 'bracket');
      cancelEdit();
    } catch (e) {
      toastError(e, 'updating bracket');
    } finally {
      setSavingId(null);
    }
  }

  async function addRow() {
    setBusy(true);
    try {
      await onUpsert({
        rate_sheet_id: sheet.id,
        distance_from_km: Number(newBracket.distance_from_km),
        distance_to_km: newBracket.distance_to_km === '' ? null : Number(newBracket.distance_to_km),
        rate: Number(newBracket.rate),
        zone_name: newBracket.zone_name || null,
      });
      setNewBracket({ distance_from_km: 0, distance_to_km: '', rate: 0, zone_name: '' });
      toastSuccess('add', 'bracket');
    } catch (e) { toastError(e, 'adding bracket'); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Brackets ({sorted.length}). Click the pencil to edit any row.</p>
      {sorted.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No brackets yet.</p>
      ) : (
        <div className="max-h-72 overflow-auto rounded border border-border bg-background">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground sticky top-0 bg-background/95 backdrop-blur z-10">
              <tr>
                <th className="text-left py-1.5 px-2">From (km)</th>
                <th className="text-left py-1.5 px-2">To (km)</th>
                <th className="text-left py-1.5 px-2">Rate</th>
                <th className="text-left py-1.5 px-2">Zone</th>
                <th className="px-2 w-24" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((b) => {
                const isEditing = editingId === b.id;
                const isSaving = savingId === b.id;
                if (isEditing) {
                  return (
                    <tr key={b.id} className="border-t border-border/50 bg-primary/5">
                      <td className="py-1 px-1.5">
                        <Input
                          type="number" min="0" step="0.1"
                          className="h-7 text-xs font-mono"
                          value={editDraft.distance_from_km}
                          onChange={(e) => setEditDraft({ ...editDraft, distance_from_km: e.target.value })}
                        />
                      </td>
                      <td className="py-1 px-1.5">
                        <Input
                          type="number" min="0" step="0.1"
                          className="h-7 text-xs font-mono"
                          placeholder="open"
                          value={editDraft.distance_to_km}
                          onChange={(e) => setEditDraft({ ...editDraft, distance_to_km: e.target.value })}
                        />
                      </td>
                      <td className="py-1 px-1.5">
                        <Input
                          type="number" min="0" step="0.0001"
                          className="h-7 text-xs font-mono"
                          value={editDraft.rate}
                          onChange={(e) => setEditDraft({ ...editDraft, rate: e.target.value })}
                        />
                      </td>
                      <td className="py-1 px-1.5">
                        <Input
                          className="h-7 text-xs"
                          placeholder="(none)"
                          value={editDraft.zone_name}
                          onChange={(e) => setEditDraft({ ...editDraft, zone_name: e.target.value })}
                        />
                      </td>
                      <td className="py-1 px-1.5 text-right whitespace-nowrap">
                        <Button variant="ghost" size="sm" className="h-7 px-1.5 text-emerald-600 hover:text-emerald-700" onClick={() => saveEdit(b.id)} disabled={isSaving} title="Save">
                          {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 px-1.5 text-muted-foreground" onClick={cancelEdit} disabled={isSaving} title="Cancel">
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={b.id} className="border-t border-border/50 font-mono hover:bg-muted/40">
                    <td className="py-1 px-2">{b.distance_from_km}</td>
                    <td className="py-1 px-2">{b.distance_to_km ?? <span className="text-muted-foreground">open</span>}</td>
                    <td className="py-1 px-2">{b.rate}</td>
                    <td className="py-1 px-2 text-muted-foreground">{b.zone_name ?? ''}</td>
                    <td className="py-1 px-1.5 text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" className="h-6 px-1.5 text-muted-foreground hover:text-primary" onClick={() => startEdit(b)} disabled={editingId !== null} title="Edit">
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 px-1.5 text-muted-foreground hover:text-rose-600" onClick={() => onDelete(b.id)} disabled={editingId !== null} title="Delete">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="grid grid-cols-12 gap-1.5 items-end pt-1">
        <Input className="col-span-3 text-xs" type="number" min="0" step="0.1" value={newBracket.distance_from_km} onChange={(e) => setNewBracket({ ...newBracket, distance_from_km: e.target.value })} placeholder="From km" />
        <Input className="col-span-3 text-xs" type="number" min="0" step="0.1" value={newBracket.distance_to_km} onChange={(e) => setNewBracket({ ...newBracket, distance_to_km: e.target.value })} placeholder="To km (blank = open)" />
        <Input className="col-span-2 text-xs" type="number" min="0" step="0.0001" value={newBracket.rate} onChange={(e) => setNewBracket({ ...newBracket, rate: e.target.value })} placeholder="Rate" />
        <Input className="col-span-2 text-xs" value={newBracket.zone_name} onChange={(e) => setNewBracket({ ...newBracket, zone_name: e.target.value })} placeholder="Zone (opt)" />
        <Button className="col-span-2" size="sm" onClick={addRow} disabled={busy || editingId !== null}>
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1" />}
          Add
        </Button>
      </div>
    </div>
  );
}
