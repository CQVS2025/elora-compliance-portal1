import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { Package, Plus, Edit, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { allProductsOptions, allProductsPaginatedOptions } from '@/query/options';
import { queryKeys } from '@/query/keys';

function formatPrice(cents) {
  if (cents == null) return '—';
  return `$${(cents / 100).toFixed(2)}`;
}

function parsePrice(value) {
  const s = String(value).replace(/[^0-9.]/g, '');
  const n = parseFloat(s);
  if (Number.isNaN(n) || n < 0) return null;
  return Math.round(n * 100);
}

const DEFAULT_PAGE_SIZE = 20;

export default function ProductsManagement() {
  const { userProfile } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  if (userProfile && userProfile.role !== 'super_admin') {
    return <Navigate to="/admin" replace />;
  }
  const [editingProduct, setEditingProduct] = useState(null);
  const [name, setName] = useState('');
  const [priceInput, setPriceInput] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState('active');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const { data: paginated, isLoading } = useQuery(
    allProductsPaginatedOptions({ page, pageSize })
  );
  const products = paginated?.products ?? [];
  const total = paginated?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const saveMutation = useMutation({
    mutationFn: async ({ id, name: n, price_cents: pc, quantity: q, status: s }) => {
      const qty = Math.max(0, parseInt(q, 10) || 1);
      if (id) {
        const { error } = await supabase
          .from('products')
          .update({ name: n, price_cents: pc, quantity: qty, status: s, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (error) throw error;
        return { id };
      }
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('products')
        .insert({ name: n, price_cents: pc, quantity: qty, status: s, created_by: user?.id })
        .select('id')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.global.products() });
      queryClient.invalidateQueries({ queryKey: [...queryKeys.global.products(), 'all', 'paginated'] });
      setDialogOpen(false);
      setEditingProduct(null);
      resetForm();
    },
    onError: (e) => console.error(e),
  });

  const resetForm = () => {
    setName('');
    setPriceInput('');
    setQuantity(1);
    setStatus('active');
    setEditingProduct(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (p) => {
    setEditingProduct(p);
    setName(p.name);
    setPriceInput(p.price_cents != null ? (p.price_cents / 100).toFixed(2) : '');
    setQuantity(Math.max(0, p.quantity ?? 1));
    setStatus(p.status || 'active');
    setDialogOpen(true);
  };

  const handleSave = () => {
    const priceCents = parsePrice(priceInput);
    if (!name.trim()) return;
    if (priceCents === null) return;
    saveMutation.mutate({
      id: editingProduct?.id,
      name: name.trim(),
      price_cents: priceCents,
      quantity: quantity,
      status: status,
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="text-muted-foreground">Manage products for dropdown and future forms. Price is numeric only.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 size-4" />
          Add Product
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="size-5" />
                All products
              </CardTitle>
              <CardDescription>Active and inactive. Used in Operations Log and future Create New Form.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {total === 0 ? '0' : (page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total}
              </span>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}
              >
                <SelectTrigger className="h-8 w-[72px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">per page</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{formatPrice(p.price_cents)}</TableCell>
                    <TableCell>{p.quantity ?? 1}</TableCell>
                    <TableCell>
                      <Badge variant={p.status === 'active' ? 'default' : 'secondary'}>{p.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                        <Edit className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!isLoading && products.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No products yet. Add one to get started.</p>
          )}
          {!isLoading && totalPages > 1 && (
            <div className="flex items-center justify-end gap-2 pt-4 border-t mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
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
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Edit product' : 'Add product'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Product name" />
            </div>
            <div className="grid gap-2">
              <Label>Price (numeric only, e.g. 30.00)</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="grid gap-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                min={0}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 0)}
                placeholder="1"
              />
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={!name.trim() || parsePrice(priceInput) === null || saveMutation.isPending}
            >
              {saveMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              {editingProduct ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
