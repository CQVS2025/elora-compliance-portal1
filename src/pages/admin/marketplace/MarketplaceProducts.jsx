import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Package, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { adminProductListOptions } from '@/query/options/marketplace';
import { useDeleteProduct } from '@/query/mutations/marketplace';
import { toastError, toastSuccess } from '@/lib/toast';
import { useConfirm } from '@/hooks/useConfirm';
import { MarketplaceImage } from '@/components/marketplace/MarketplaceImage';
import { HazardBadge } from '@/components/marketplace/HazardBadge';

export default function MarketplaceProducts() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const companyId = userProfile?.company_id;
  const { data: products = [], isLoading } = useQuery(adminProductListOptions(companyId));
  const remove = useDeleteProduct(companyId);
  const { confirm, ConfirmDialog } = useConfirm();

  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.slug?.toLowerCase().includes(q) ||
        p.manufacturer?.toLowerCase().includes(q)
    );
  }, [products, search]);

  const handleDelete = async (product) => {
    const ok = await confirm({
      title: `Delete "${product.name}"?`,
      description: 'This permanently removes the product along with every packaging price, image and SDS document attached to it. Cart items referencing this product will be cleaned up automatically.',
      confirmLabel: 'Delete product',
      destructive: true,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(product.id);
      toastSuccess('delete', 'product');
    } catch (e) {
      toastError(e, 'deleting product');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-md bg-primary/10 text-primary">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Products</h1>
            <p className="text-sm text-muted-foreground">
              Manage the marketplace catalogue. Each product has packaging variants, hazard info, SDS PDFs and photos.
            </p>
          </div>
        </div>
        <Button onClick={() => navigate('/admin/marketplace/products/new')}>
          <Plus className="w-4 h-4 mr-1.5" /> New product
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All products</CardTitle>
          <CardDescription>
            {products.filter((p) => p.is_active).length} active / {products.length} total
          </CardDescription>
          <div className="mt-3 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, slug, or manufacturer…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Loading products…</p>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <p className="mb-2">{search ? 'No products match your search.' : 'No products yet.'}</p>
              {!search && (
                <Button variant="outline" size="sm" onClick={() => navigate('/admin/marketplace/products/new')}>
                  <Plus className="w-4 h-4 mr-1.5" /> Add your first product
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((p) => {
                const cover = (p.images || []).find((i) => i.is_cover) || p.images?.[0];
                const priceCount = (p.prices || []).filter((pp) => pp.is_available).length;
                return (
                  <Card key={p.id} className="overflow-hidden hover:shadow-apple-md transition-shadow">
                    <div className="aspect-[4/3] bg-muted">
                      <MarketplaceImage
                        storagePath={cover?.storage_path}
                        alt={p.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-sm leading-tight">{p.name}</p>
                          {p.manufacturer && (
                            <p className="text-xs text-muted-foreground">{p.manufacturer}</p>
                          )}
                        </div>
                        {!p.is_active && <Badge variant="secondary">inactive</Badge>}
                      </div>
                      <div className="flex items-center gap-2">
                        <HazardBadge classification={p.classification} />
                        <span className="text-xs text-muted-foreground">
                          {priceCount} variant{priceCount === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div className="flex gap-1.5 pt-2">
                        <Button size="sm" variant="outline" asChild className="flex-1">
                          <Link to={`/admin/marketplace/products/${p.id}`}>
                            <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(p)}
                          disabled={remove.isPending}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      {ConfirmDialog}
    </div>
  );
}
