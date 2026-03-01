import React, { useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { Package, Plus, Edit, Trash2, Loader2, Upload, ImageIcon } from 'lucide-react';
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
import { allPartsOptions, allPartsPaginatedOptions } from '@/query/options';
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

const UNITS = ['Each', 'Metre'];
const DEFAULT_PAGE_SIZE = 20;
const ALL_CATEGORIES_VALUE = '__all__'; // Radix Select forbids value=""
const PART_IMAGES_BUCKET = 'part-images';
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB (matches bucket limit)
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

export default function PartsCatalogManagement() {
  const { userProfile } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = React.useRef(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('Each');
  const [priceInput, setPriceInput] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierSku, setSupplierSku] = useState('');
  const [supplierStockStatus, setSupplierStockStatus] = useState('');
  const [productUrl, setProductUrl] = useState('');
  const [imagePath, setImagePath] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState('');
  const [displayOrder, setDisplayOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');

  if (userProfile && userProfile.role !== 'super_admin') {
    return <Navigate to="/admin" replace />;
  }

  const { data: paginated, isLoading } = useQuery(
    allPartsPaginatedOptions({ page, pageSize, category: categoryFilter || null, search: search || '' })
  );
  const { data: allParts } = useQuery(allPartsOptions());
  const parts = paginated?.parts ?? [];
  const total = paginated?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const categories = useMemo(() => {
    const set = new Set((allParts ?? []).map((p) => p.category).filter(Boolean));
    return Array.from(set).sort();
  }, [allParts]);

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      const row = {
        display_order: payload.display_order,
        description: payload.description.trim(),
        category: payload.category.trim(),
        unit: payload.unit,
        unit_price_cents: payload.unit_price_cents,
        supplier_name: payload.supplier_name?.trim() || null,
        supplier_sku: payload.supplier_sku?.trim() || null,
        supplier_stock_status: payload.supplier_stock_status?.trim() || null,
        product_url: payload.product_url?.trim() || null,
        image_path: payload.image_path?.trim() || null,
        is_active: payload.is_active,
        updated_at: new Date().toISOString(),
      };
      if (payload.id) {
        const { error } = await supabase.from('parts').update(row).eq('id', payload.id);
        if (error) throw error;
        return { id: payload.id };
      }
      const { data, error } = await supabase.from('parts').insert(row).select('id').single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.global.parts() });
      setDialogOpen(false);
      setEditingPart(null);
      resetForm();
    },
    onError: (e) => console.error(e),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('parts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.global.parts() });
    },
    onError: (e) => console.error(e),
  });

  async function uploadPartImage(file) {
    if (!file || !ALLOWED_IMAGE_TYPES.includes(file.type)) {
      throw new Error('Please select a PNG, JPEG, or WebP image.');
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error('Image must be under 2MB.');
    }
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage
      .from(PART_IMAGES_BUCKET)
      .upload(path, file, { cacheControl: '3600', upsert: false });
    if (error) throw error;
    return path;
  }

  function removePartImageFromStorage(path) {
    if (!path || path.startsWith('http')) return;
    supabase.storage.from(PART_IMAGES_BUCKET).remove([path]).catch(() => {});
  }

  async function onImageFileChange(e) {
    const file = e.target?.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImageError('');
    setImageUploading(true);
    try {
      const previousPath = imagePath;
      const path = await uploadPartImage(file);
      setImagePath(path);
      if (previousPath) removePartImageFromStorage(previousPath);
    } catch (err) {
      setImageError(err.message || 'Upload failed.');
    } finally {
      setImageUploading(false);
    }
  }

  function clearPartImage() {
    if (imagePath) removePartImageFromStorage(imagePath);
    setImagePath('');
    setImageError('');
  }

  function resetForm() {
    setDescription('');
    setCategory('');
    setUnit('Each');
    setPriceInput('');
    setSupplierName('');
    setSupplierSku('');
    setSupplierStockStatus('');
    setProductUrl('');
    setImagePath('');
    setImageError('');
    setDisplayOrder(0);
    setIsActive(true);
    setEditingPart(null);
  }

  function openCreate() {
    resetForm();
    setDialogOpen(true);
  }

  function openEdit(p) {
    setEditingPart(p);
    setDescription(p.description ?? '');
    setCategory(p.category ?? '');
    setUnit(p.unit ?? 'Each');
    setPriceInput(p.unit_price_cents != null ? (p.unit_price_cents / 100).toFixed(2) : '');
    setSupplierName(p.supplier_name ?? '');
    setSupplierSku(p.supplier_sku ?? '');
    setSupplierStockStatus(p.supplier_stock_status ?? '');
    setProductUrl(p.product_url ?? '');
    setImagePath(p.image_path ?? '');
    setDisplayOrder(p.display_order ?? 0);
    setIsActive(p.is_active !== false);
    setDialogOpen(true);
  }

  function handleSave() {
    if (!description.trim() || !category.trim()) return;
    const priceCents = parsePrice(priceInput);
    saveMutation.mutate({
      id: editingPart?.id,
      description: description.trim(),
      category: category.trim(),
      unit,
      unit_price_cents: priceCents,
      supplier_name: supplierName || null,
      supplier_sku: supplierSku || null,
      supplier_stock_status: supplierStockStatus || null,
      product_url: productUrl || null,
      image_path: imagePath || null,
      display_order: displayOrder,
      is_active: isActive,
    });
  }

  function imageUrl(part) {
    if (!part?.image_path) return null;
    const { data } = supabase.storage.from(PART_IMAGES_BUCKET).getPublicUrl(part.image_path);
    return data?.publicUrl ?? null;
  }

  function formImagePreviewUrl() {
    if (!imagePath) return null;
    const { data } = supabase.storage.from(PART_IMAGES_BUCKET).getPublicUrl(imagePath);
    return data?.publicUrl ?? null;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Parts Catalog</h1>
          <p className="text-muted-foreground">Manage the master parts list for Stock & Orders. Add, edit, or remove parts.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 size-4" />
          Add Part
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="size-5" />
                All parts
              </CardTitle>
              <CardDescription>Used by Stock Take and Request Parts. Edit name, price, category, image, and add new parts.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Search description..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="max-w-[200px] h-8"
              />
              <Select value={categoryFilter || ALL_CATEGORIES_VALUE} onValueChange={(v) => { setCategoryFilter(v === ALL_CATEGORIES_VALUE ? '' : v); setPage(1); }}>
                <SelectTrigger className="h-8 w-[180px]">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_CATEGORIES_VALUE}>All categories</SelectItem>
                  {categories.filter(Boolean).map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">
                {total === 0 ? '0' : (page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total}
              </span>
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
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
                  <TableHead className="w-12"></TableHead>
                  <TableHead>#</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parts.map((p, idx) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      {imageUrl(p) ? (
                        <img src={imageUrl(p)} alt="" className="size-10 object-contain rounded border bg-muted" />
                      ) : (
                        <div className="size-10 rounded border bg-muted flex items-center justify-center text-muted-foreground text-xs">—</div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">
                      {(page - 1) * pageSize + idx + 1}
                    </TableCell>
                    <TableCell className="font-medium max-w-[280px] truncate" title={p.description}>{p.description}</TableCell>
                    <TableCell><Badge variant="secondary">{p.category}</Badge></TableCell>
                    <TableCell>{p.unit}</TableCell>
                    <TableCell>{formatPrice(p.unit_price_cents)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[160px] truncate" title={p.supplier_name}>
                      {p.supplier_name ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.is_active ? 'default' : 'secondary'}>{p.is_active ? 'Active' : 'Inactive'}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                          <Edit className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { if (window.confirm('Delete this part?')) deleteMutation.mutate(p.id); }}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!isLoading && parts.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No parts yet. Add one or run the Excel import script.</p>
          )}
          {!isLoading && totalPages > 1 && (
            <div className="flex items-center justify-end gap-2 pt-4 border-t mt-4">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPart ? 'Edit part' : 'Add part'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Description *</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Part description" />
            </div>
            <div className="grid gap-2">
              <Label>Category *</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Pneumatic Push Fit Fittings" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Unit</Label>
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Unit price (e.g. 3.41)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Supplier name</Label>
              <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="e.g. Process Systems" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Supplier SKU</Label>
                <Input value={supplierSku} onChange={(e) => setSupplierSku(e.target.value)} placeholder="e.g. YPL08-02" />
              </div>
              <div className="grid gap-2">
                <Label>Supplier stock status</Label>
                <Input value={supplierStockStatus} onChange={(e) => setSupplierStockStatus(e.target.value)} placeholder="In Stock, Back Order, etc." />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Product URL</Label>
              <Input value={productUrl} onChange={(e) => setProductUrl(e.target.value)} placeholder="https://..." type="url" />
            </div>
            <div className="grid gap-2">
              <Label>Image</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED_IMAGE_TYPES.join(',')}
                className="hidden"
                onChange={onImageFileChange}
              />
              <div className="flex items-center gap-3 flex-wrap">
                {formImagePreviewUrl() ? (
                  <>
                    <img
                      src={formImagePreviewUrl()}
                      alt="Part"
                      className="size-20 object-contain rounded border bg-muted"
                    />
                    <div className="flex flex-col gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={imageUploading}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {imageUploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                        {imageUploading ? ' Uploading…' : ' Change image'}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={clearPartImage}>
                        Remove image
                      </Button>
                    </div>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={imageUploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {imageUploading ? <Loader2 className="size-4 animate-spin" /> : <ImageIcon className="size-4" />}
                    {imageUploading ? ' Uploading…' : ' Attach image'}
                  </Button>
                )}
              </div>
              {imageError && <p className="text-sm text-destructive">{imageError}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Display order</Label>
                <Input
                  type="number"
                  min={0}
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(parseInt(e.target.value, 10) || 0)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Active</Label>
                <Select value={isActive ? 'active' : 'inactive'} onValueChange={(v) => setIsActive(v === 'active')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={!description.trim() || !category.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              {editingPart ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
