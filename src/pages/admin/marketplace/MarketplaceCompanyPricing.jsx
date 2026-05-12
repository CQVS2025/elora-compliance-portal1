import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, Trash2, BadgeDollarSign } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import {
  adminCompanyPricingOptions,
  marketplaceCompaniesOptions,
} from '@/query/options/marketplace';
import {
  useUpsertCompanyPricing,
  useDeleteCompanyPricing,
} from '@/query/mutations/marketplace';
import { toastError, toastSuccess } from '@/lib/toast';
import { formatAUD } from '@/lib/marketplaceFormat';

/**
 * Per-customer pricing override grid.
 *
 *   Pick a company → see all (product × packaging_size) combos with their
 *   default price + their override (if any). Edit overrides inline.
 *
 * Each row's source-of-truth value:
 *   - effective_price = override?.price ?? default.price
 *   - "Match default" button clears the override.
 */
export default function MarketplaceCompanyPricing() {
  const { userProfile } = useAuth();
  const companyId = userProfile?.company_id;

  const { data: companies = [] } = useQuery(marketplaceCompaniesOptions(companyId));
  const enabledCompanies = useMemo(
    () => companies.filter((c) => c.marketplace_enabled),
    [companies]
  );

  const [target, setTarget] = useState('');

  const { data: matrix, isLoading } = useQuery(adminCompanyPricingOptions(companyId, target));
  const upsert = useUpsertCompanyPricing(companyId, target);
  const remove = useDeleteCompanyPricing(companyId, target);

  const [drafts, setDrafts] = useState({});

  const overridesById = useMemo(() => {
    const map = new Map();
    (matrix?.overrides ?? []).forEach((o) => {
      map.set(`${o.product_id}::${o.packaging_size_id}`, o);
    });
    return map;
  }, [matrix?.overrides]);

  const setDraft = (key, patch) => setDrafts((prev) => ({ ...prev, [key]: { ...(prev[key] ?? {}), ...patch } }));

  const handleSave = async (defaultRow) => {
    const key = `${defaultRow.product_id}::${defaultRow.packaging_size_id}`;
    const draft = drafts[key];
    if (!draft) return;
    const existing = overridesById.get(key);
    const payload = {
      id: existing?.id,
      product_id: defaultRow.product_id,
      packaging_size_id: defaultRow.packaging_size_id,
      price_type: draft.price_type ?? existing?.price_type ?? defaultRow.price_type,
      price_per_litre: null,
      fixed_price: null,
    };
    if (payload.price_type === 'per_litre') {
      payload.price_per_litre = Number(draft.price_per_litre ?? existing?.price_per_litre ?? 0);
      if (!payload.price_per_litre) { toastError(new Error('Enter a per-litre price'), 'saving override'); return; }
    } else {
      payload.fixed_price = Number(draft.fixed_price ?? existing?.fixed_price ?? 0);
      if (!payload.fixed_price) { toastError(new Error('Enter a fixed price'), 'saving override'); return; }
    }
    if (draft.minimum_order_quantity != null) payload.minimum_order_quantity = Number(draft.minimum_order_quantity) || null;
    if (draft.notes != null) payload.notes = draft.notes;

    try {
      await upsert.mutateAsync(payload);
      setDrafts((p) => { const { [key]: _, ...rest } = p; return rest; });
      toastSuccess('save', 'price override');
    } catch (e) {
      toastError(e, 'saving price override');
    }
  };

  const handleClear = async (defaultRow) => {
    const key = `${defaultRow.product_id}::${defaultRow.packaging_size_id}`;
    const existing = overridesById.get(key);
    if (!existing) {
      // No override exists; just clear local draft.
      setDrafts((p) => { const { [key]: _, ...rest } = p; return rest; });
      return;
    }
    if (!confirm('Remove this override and revert to the default price?')) return;
    try {
      await remove.mutateAsync(existing.id);
      setDrafts((p) => { const { [key]: _, ...rest } = p; return rest; });
      toastSuccess('delete', 'price override');
    } catch (e) {
      toastError(e, 'removing override');
    }
  };

  const grouped = useMemo(() => {
    if (!matrix?.defaults) return [];
    const byProduct = new Map();
    matrix.defaults.forEach((row) => {
      if (!row.product?.is_active) return;
      const list = byProduct.get(row.product.id) ?? { product: row.product, rows: [] };
      list.rows.push(row);
      byProduct.set(row.product.id, list);
    });
    // sort packaging within each by sort_order
    byProduct.forEach((g) => g.rows.sort((a, b) => (a.packaging_size?.sort_order ?? 0) - (b.packaging_size?.sort_order ?? 0)));
    return Array.from(byProduct.values()).sort((a, b) => a.product.name.localeCompare(b.product.name));
  }, [matrix]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-start gap-3">
        <div className="p-2 rounded-md bg-primary/10 text-primary">
          <BadgeDollarSign className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Customer Pricing</h1>
          <p className="text-sm text-muted-foreground">
            Override default prices for a specific customer company. Each company sees only their own price; never the default and never another customer's price.
          </p>
        </div>
      </div>

      <Card className="mb-5">
        <CardContent className="pt-6">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Customer</Label>
          <div className="mt-1 max-w-sm">
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger><SelectValue placeholder="Choose a customer to manage pricing for…" /></SelectTrigger>
              <SelectContent>
                {enabledCompanies.length === 0 ? (
                  <div className="p-2 text-xs text-muted-foreground">
                    No customers have the marketplace enabled yet. Toggle one on first in <strong>Customer Access</strong>.
                  </div>
                ) : enabledCompanies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {!target ? (
        <p className="text-sm text-muted-foreground py-12 text-center">
          Select a customer to view and manage their pricing overrides.
        </p>
      ) : isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Loading pricing matrix…</p>
      ) : grouped.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No active products with default prices yet. Add products + packaging prices first.
        </p>
      ) : (
        <div className="space-y-5">
          {grouped.map(({ product, rows }) => (
            <Card key={product.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{product.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {rows.map((row) => {
                    const key = `${row.product_id}::${row.packaging_size_id}`;
                    const existing = overridesById.get(key);
                    const draft = drafts[key];
                    const priceType = draft?.price_type ?? existing?.price_type ?? row.price_type;
                    const valuePerLitre = draft?.price_per_litre ?? existing?.price_per_litre ?? '';
                    const valueFixed = draft?.fixed_price ?? existing?.fixed_price ?? '';
                    const isDirty = !!draft;
                    return (
                      <div key={key} className="py-3 grid grid-cols-12 gap-2 items-center text-sm">
                        <div className="col-span-3">
                          <p className="font-medium">{row.packaging_size?.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Default: {row.price_type === 'per_litre'
                              ? `${formatAUD(row.price_per_litre)} / L`
                              : `${formatAUD(row.fixed_price)} fixed`}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <Select value={priceType} onValueChange={(v) => setDraft(key, { price_type: v })}>
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="per_litre">Per litre</SelectItem>
                              <SelectItem value="fixed">Fixed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-3">
                          {priceType === 'per_litre' ? (
                            <Input
                              type="number"
                              step="0.0001"
                              placeholder="$/L"
                              value={valuePerLitre}
                              onChange={(e) => setDraft(key, { price_per_litre: e.target.value, fixed_price: null })}
                            />
                          ) : (
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="Fixed $"
                              value={valueFixed}
                              onChange={(e) => setDraft(key, { fixed_price: e.target.value, price_per_litre: null })}
                            />
                          )}
                        </div>
                        <div className="col-span-2">
                          {existing ? (
                            <Badge
                              variant="outline"
                              className="border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                            >
                              Override active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">Default applies</Badge>
                          )}
                        </div>
                        <div className="col-span-2 flex justify-end gap-1">
                          {existing && (
                            <Button size="sm" variant="outline" onClick={() => handleClear(row)}>
                              <Trash2 className="w-3.5 h-3.5 mr-1" /> Reset
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant={isDirty ? 'default' : 'outline'}
                            disabled={!isDirty || upsert.isPending}
                            onClick={() => handleSave(row)}
                          >
                            <Save className="w-3.5 h-3.5 mr-1" /> Save
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
