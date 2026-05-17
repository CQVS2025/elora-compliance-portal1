import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft, Truck, Search, Loader2, ChevronDown, ChevronRight, Plus, Trash2, Layers,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import {
  adminProductListOptions,
  packagingSizesOptions,
  rateSheetsOptions,
  productRateSheetMappingsOptions,
} from '@/query/options/marketplace';
import {
  useUpsertProductRateSheet,
  useDeleteProductRateSheet,
} from '@/query/mutations/marketplace';
import { toastError, toastSuccess } from '@/lib/toast';
import { useConfirm } from '@/hooks/useConfirm';

const UNIT_LABELS = {
  per_litre: 'Per litre',
  flat_per_consignment: 'Flat per consignment',
  per_kg: 'Per kilogram',
  per_pallet: 'Per pallet',
  per_zone: 'Per zone',
};

/**
 * Per-product freight rate-sheet assignment.
 *
 * Default (product-level): one rate sheet covers every packaging size for
 * the product. Optional per-size override: a row keyed on
 * (product_id, packaging_size_id) takes precedence.
 *
 * Mirrors the Chem Connect supplier-fulfillment per-product config page.
 */
export default function MarketplaceFreightProducts() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const companyId = userProfile?.company_id;

  const { data: products = [], isLoading: productsLoading } = useQuery(adminProductListOptions(companyId));
  const { data: sheets = [] } = useQuery(rateSheetsOptions(companyId));
  const { data: sizes = [] } = useQuery(packagingSizesOptions());
  const { data: mappings = [] } = useQuery(productRateSheetMappingsOptions(companyId));
  const upsert = useUpsertProductRateSheet(companyId);
  const remove = useDeleteProductRateSheet(companyId);
  const { confirm, ConfirmDialog } = useConfirm();

  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState({});
  const [busyKey, setBusyKey] = useState(null); // `${productId}:${packagingSizeId|''}` while saving

  const sheetById = useMemo(() => new Map(sheets.map((s) => [s.id, s])), [sheets]);
  const sizeById = useMemo(() => new Map(sizes.map((s) => [s.id, s])), [sizes]);
  const activeSheets = useMemo(() => sheets.filter((s) => s.is_active), [sheets]);

  // Index mappings: defaultByProductId, overridesByProductId
  const defaultByProductId = useMemo(() => {
    const m = new Map();
    for (const r of mappings) {
      if (r.packaging_size_id == null) m.set(r.product_id, r);
    }
    return m;
  }, [mappings]);

  const overridesByProductId = useMemo(() => {
    const m = new Map();
    for (const r of mappings) {
      if (r.packaging_size_id != null) {
        const arr = m.get(r.product_id) ?? [];
        arr.push(r);
        m.set(r.product_id, arr);
      }
    }
    return m;
  }, [mappings]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      p.name?.toLowerCase().includes(q) ||
      p.slug?.toLowerCase().includes(q) ||
      p.manufacturer?.toLowerCase().includes(q),
    );
  }, [products, search]);

  const productSizes = (product) => {
    const ids = new Set((product.prices ?? []).filter((p) => p.is_available).map((p) => p.packaging_size_id));
    return Array.from(ids).map((id) => sizeById.get(id)).filter(Boolean);
  };

  async function saveDefault(product, rateSheetId) {
    const key = `${product.id}:`;
    setBusyKey(key);
    try {
      await upsert.mutateAsync({
        productId: product.id,
        packagingSizeId: null,
        rateSheetId,
      });
      toastSuccess(`Rate sheet set for ${product.name}.`);
    } catch (e) { toastError(e, 'saving rate sheet'); }
    finally { setBusyKey(null); }
  }

  async function clearDefault(product) {
    const ok = await confirm({
      title: `Clear freight mapping for ${product.name}?`,
      description: 'Buyers will see $0 freight on this product until you set a rate sheet again.',
      confirmLabel: 'Clear',
      destructive: true,
    });
    if (!ok) return;
    const key = `${product.id}:`;
    setBusyKey(key);
    try {
      await remove.mutateAsync({ productId: product.id, packagingSizeId: null });
      toastSuccess(`Mapping cleared for ${product.name}.`);
    } catch (e) { toastError(e, 'clearing mapping'); }
    finally { setBusyKey(null); }
  }

  async function saveOverride(product, packagingSizeId, rateSheetId) {
    const key = `${product.id}:${packagingSizeId}`;
    setBusyKey(key);
    try {
      await upsert.mutateAsync({ productId: product.id, packagingSizeId, rateSheetId });
      toastSuccess('Per-size override saved.');
    } catch (e) { toastError(e, 'saving override'); }
    finally { setBusyKey(null); }
  }

  async function clearOverride(product, packagingSizeId) {
    const ok = await confirm({
      title: 'Remove per-size override?',
      description: 'This packaging size will fall back to the product-level default.',
      confirmLabel: 'Remove override',
      destructive: true,
    });
    if (!ok) return;
    const key = `${product.id}:${packagingSizeId}`;
    setBusyKey(key);
    try {
      await remove.mutateAsync({ productId: product.id, packagingSizeId });
      toastSuccess('Override removed.');
    } catch (e) { toastError(e, 'removing override'); }
    finally { setBusyKey(null); }
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      <Button variant="ghost" size="sm" onClick={() => navigate('/admin/marketplace/freight')}>
        <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Freight
      </Button>

      <div className="flex items-start gap-3">
        <div className="p-2 rounded-md bg-primary/10 text-primary shrink-0">
          <Truck className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Per-product freight rate sheets</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Pick the rate sheet that quotes freight for each product. Optionally override per packaging size. Useful when the same product ships in <em>Bulk</em> (per-litre) and <em>Pack</em> (flat) modes.
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search product name, slug, or manufacturer…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Empty states */}
      {activeSheets.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-amber-700 dark:text-amber-300">No active rate sheets</CardTitle>
            <CardDescription>
              Create at least one rate sheet first. There's nothing to map products to yet.{' '}
              <Button variant="link" className="px-0 h-auto" onClick={() => navigate('/admin/marketplace/freight')}>
                Open the Freight admin →
              </Button>
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Product list */}
      {productsLoading ? (
        <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">Loading products…</CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">No products match.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((product) => {
            const defaultRow = defaultByProductId.get(product.id);
            const overrides = overridesByProductId.get(product.id) ?? [];
            const isExpanded = !!expanded[product.id];
            const sizesForProduct = productSizes(product);
            const usedOverrideSizeIds = new Set(overrides.map((o) => o.packaging_size_id));
            const availableSizesForOverride = sizesForProduct.filter((s) => !usedOverrideSizeIds.has(s.id));

            return (
              <Card key={product.id}>
                <CardContent className="p-4 sm:p-5 space-y-3">
                  {/* Header row: name + summary */}
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="font-semibold text-base truncate">{product.name}</p>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">
                        {product.slug}
                        {!product.is_active && <Badge variant="secondary" className="ml-2">inactive</Badge>}
                      </p>
                    </div>
                    {defaultRow ? (
                      <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                        <Layers className="w-3 h-3 mr-1" />
                        {sheetById.get(defaultRow.rate_sheet_id)?.name ?? 'sheet missing'}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800">
                        Unmapped (no freight)
                      </Badge>
                    )}
                  </div>

                  {/* Default rate sheet selector */}
                  <div className="rounded-md border border-border bg-muted/20 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-xs font-medium">Default rate sheet <span className="text-muted-foreground">(applies to every packaging size)</span></p>
                      {defaultRow && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-rose-600 hover:text-rose-700"
                          onClick={() => clearDefault(product)}
                          disabled={busyKey === `${product.id}:`}
                        >
                          <Trash2 className="w-3 h-3 mr-1" /> Clear
                        </Button>
                      )}
                    </div>
                    <RateSheetPicker
                      value={defaultRow?.rate_sheet_id ?? ''}
                      sheets={activeSheets}
                      onChange={(v) => saveDefault(product, v)}
                      busy={busyKey === `${product.id}:`}
                      disabled={activeSheets.length === 0}
                    />
                  </div>

                  {/* Per-size overrides */}
                  <div>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setExpanded((m) => ({ ...m, [product.id]: !m[product.id] }))}
                    >
                      {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      Per-size overrides ({overrides.length})
                    </button>

                    {isExpanded && (
                      <div className="mt-2 space-y-2">
                        {overrides.length === 0 && (
                          <p className="text-xs text-muted-foreground italic">No overrides. Every size uses the default above.</p>
                        )}
                        {overrides.map((o) => (
                          <div key={o.id} className="rounded-md border border-border p-2.5 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <Badge variant="outline" className="text-xs">
                                {sizeById.get(o.packaging_size_id)?.name ?? 'Unknown size'}
                              </Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-1.5 text-xs text-rose-600 hover:text-rose-700"
                                onClick={() => clearOverride(product, o.packaging_size_id)}
                                disabled={busyKey === `${product.id}:${o.packaging_size_id}`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                            <RateSheetPicker
                              value={o.rate_sheet_id}
                              sheets={activeSheets}
                              onChange={(v) => saveOverride(product, o.packaging_size_id, v)}
                              busy={busyKey === `${product.id}:${o.packaging_size_id}`}
                            />
                          </div>
                        ))}

                        {availableSizesForOverride.length > 0 && activeSheets.length > 0 && (
                          <AddOverrideRow
                            sizes={availableSizesForOverride}
                            sheets={activeSheets}
                            onAdd={(sizeId, sheetId) => saveOverride(product, sizeId, sheetId)}
                            busy={busyKey?.startsWith(`${product.id}:`) && busyKey !== `${product.id}:`}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {ConfirmDialog}
    </div>
  );
}

// ----------------------------------------------------------------------------

function RateSheetPicker({ value, sheets, onChange, busy, disabled }) {
  return (
    <div className="flex items-center gap-2">
      <Select value={value} onValueChange={onChange} disabled={busy || disabled}>
        <SelectTrigger className="text-sm">
          <SelectValue placeholder="Pick a rate sheet…" />
        </SelectTrigger>
        <SelectContent>
          {sheets.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name} <span className="text-muted-foreground">· {UNIT_LABELS[s.unit_type] ?? s.unit_type}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {busy && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
    </div>
  );
}

function AddOverrideRow({ sizes, sheets, onAdd, busy }) {
  const [sizeId, setSizeId] = useState('');
  const [sheetId, setSheetId] = useState('');

  const submit = () => {
    if (!sizeId || !sheetId) return;
    onAdd(sizeId, sheetId);
    setSizeId('');
    setSheetId('');
  };

  return (
    <div className="rounded-md border border-dashed border-border p-2.5 space-y-2">
      <p className="text-[11px] text-muted-foreground">Add an override</p>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
        <Select value={sizeId} onValueChange={setSizeId} disabled={busy}>
          <SelectTrigger className="text-sm h-9"><SelectValue placeholder="Packaging size" /></SelectTrigger>
          <SelectContent>
            {sizes.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={sheetId} onValueChange={setSheetId} disabled={busy}>
          <SelectTrigger className="text-sm h-9"><SelectValue placeholder="Rate sheet" /></SelectTrigger>
          <SelectContent>
            {sheets.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name} <span className="text-muted-foreground">· {UNIT_LABELS[s.unit_type] ?? s.unit_type}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={submit} disabled={!sizeId || !sheetId || busy} className="h-9">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1" />}
          Add
        </Button>
      </div>
    </div>
  );
}
