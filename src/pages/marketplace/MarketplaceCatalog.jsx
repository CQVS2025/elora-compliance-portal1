import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Store } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { buyerCatalogOptions } from '@/query/options/marketplace';
import { MarketplaceImage } from '@/components/marketplace/MarketplaceImage';
import { HazardBadge } from '@/components/marketplace/HazardBadge';
import { PriceTag } from '@/components/marketplace/PriceTag';
import { MarketplaceEmpty } from '@/components/marketplace/MarketplaceEmpty';

const SORT_OPTIONS = [
  { value: 'order',     label: 'Default order' },
  { value: 'name-asc',  label: 'Name (A → Z)' },
  { value: 'name-desc', label: 'Name (Z → A)' },
];

/**
 * Buyer-facing marketplace catalog. Each card shows the buyer's resolved
 * price (per-customer override or default) for the lowest-priced size.
 */
export default function MarketplaceCatalog() {
  const { userProfile } = useAuth();
  const companyId = userProfile?.company_id;
  const { data: products = [], isLoading } = useQuery(buyerCatalogOptions(companyId));

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('order');
  const [classFilter, setClassFilter] = useState('all');

  const classifications = useMemo(() => {
    const set = new Set(products.map((p) => p.classification).filter(Boolean));
    return ['all', ...Array.from(set)];
  }, [products]);

  const filtered = useMemo(() => {
    let list = products;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) =>
        p.name?.toLowerCase().includes(q) ||
        p.manufacturer?.toLowerCase().includes(q) ||
        p.short_description?.toLowerCase().includes(q)
      );
    }
    if (classFilter !== 'all') {
      list = list.filter((p) => p.classification === classFilter);
    }
    if (sortBy === 'name-asc') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === 'name-desc') list = [...list].sort((a, b) => b.name.localeCompare(a.name));
    return list;
  }, [products, search, classFilter, sortBy]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-start gap-3">
        <div className="p-2 rounded-md bg-primary/10 text-primary">
          <Store className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Marketplace</h1>
          <p className="text-sm text-muted-foreground">
            Browse Elora's product catalogue. Prices shown are your negotiated rates (ex-GST).
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <Card className="mb-5">
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-7 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, manufacturer or description…"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <Select value={classFilter} onValueChange={setClassFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {classifications.map((c) => (
                    <SelectItem key={c} value={c}>{c === 'all' ? 'All hazard classes' : c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-3">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Loading catalogue…</p>
      ) : filtered.length === 0 ? (
        <MarketplaceEmpty
          title={search ? 'No products match your search.' : 'No products available right now.'}
          description={search ? 'Try a different search term or clear filters.' : 'Check back soon. Elora is adding products.'}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((p) => {
            const lowest = p.prices?.[0];
            return (
              <Link
                key={p.id}
                to={`/marketplace/products/${p.slug}`}
                className="block group"
              >
                <Card className="overflow-hidden h-full transition-shadow hover:shadow-apple-md">
                  <div className="aspect-[4/3] bg-muted">
                    <MarketplaceImage
                      storagePath={p.cover_image?.storage_path}
                      alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <CardContent className="p-4 space-y-2">
                    {p.badge && <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">{p.badge}</span>}
                    <p className="font-medium leading-tight">{p.name}</p>
                    {p.manufacturer && <p className="text-xs text-muted-foreground">{p.manufacturer}</p>}
                    <div className="flex items-center gap-2">
                      <HazardBadge classification={p.classification} />
                    </div>
                    {p.short_description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{p.short_description}</p>
                    )}
                    <div className="pt-2 border-t mt-2">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">From</p>
                      <PriceTag priceRow={lowest} showSourceTag />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
