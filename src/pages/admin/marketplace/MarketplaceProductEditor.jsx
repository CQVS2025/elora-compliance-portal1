import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save, Plus, Trash2, ImagePlus, FileText, Loader2, Upload, Pencil, X, Package, ShieldAlert, Images, ExternalLink, Eye, Download, Boxes } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import {
  adminProductDetailOptions,
  packagingSizesOptions,
} from '@/query/options/marketplace';
import {
  useUpsertProduct,
  useUpsertPackagingPrice,
  useDeletePackagingPrice,
  useUploadProductImage,
  useDeleteProductImage,
  useUploadProductDocument,
  useDeleteProductDocument,
  useUpsertCheckoutQuestion,
  useDeleteCheckoutQuestion,
} from '@/query/mutations/marketplace';
import { toastError, toastSuccess } from '@/lib/toast';
import { slugify, formatAUD } from '@/lib/marketplaceFormat';
import { MarketplaceImage } from '@/components/marketplace/MarketplaceImage';

const CLASSIFICATIONS = ['Non-DG', 'DG Class 3', 'DG Class 5', 'DG Class 6', 'DG Class 8', 'DG Class 9'];

const EMPTY_PRODUCT = {
  slug: '',
  name: '',
  short_description: '',
  long_description: '',
  delivery_info: '',
  manufacturer: '',
  classification: 'Non-DG',
  hazard_class: '',
  un_number: '',
  packing_group: '',
  cas_number: '',
  safety_info: '',
  badge: '',
  display_order: 0,
  is_active: true,
};

export default function MarketplaceProductEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const companyId = userProfile?.company_id;
  const isNew = id === 'new';

  const { data: detail, isLoading } = useQuery(adminProductDetailOptions(companyId, isNew ? null : id));
  const { data: sizes = [] } = useQuery(packagingSizesOptions());
  const upsertProduct = useUpsertProduct(companyId);

  const productId = isNew ? null : id;

  const upsertPrice = useUpsertPackagingPrice(companyId, productId);
  const deletePrice = useDeletePackagingPrice(companyId, productId);
  const uploadImage = useUploadProductImage(companyId, productId);
  const deleteImage = useDeleteProductImage(companyId, productId);
  const uploadDoc = useUploadProductDocument(companyId, productId);
  const deleteDoc = useDeleteProductDocument(companyId, productId);
  const upsertQuestion = useUpsertCheckoutQuestion(companyId, productId);
  const deleteQuestion = useDeleteCheckoutQuestion(companyId, productId);

  const [form, setForm] = useState(EMPTY_PRODUCT);
  const [slugTouched, setSlugTouched] = useState(false);
  const imgInputRef = useRef(null);
  const docInputRef = useRef(null);

  useEffect(() => {
    if (detail?.product) {
      setForm({ ...EMPTY_PRODUCT, ...detail.product });
      setSlugTouched(true);
    } else if (isNew) {
      setForm(EMPTY_PRODUCT);
      setSlugTouched(false);
    }
  }, [detail, isNew]);

  const handleNameChange = (name) => {
    setForm((f) => ({
      ...f,
      name,
      slug: slugTouched ? f.slug : slugify(name),
    }));
  };

  const isDirty = useMemo(() => {
    if (isNew) return true;
    if (!detail?.product) return false;
    return Object.keys(EMPTY_PRODUCT).some((k) => {
      const a = form[k];
      const b = detail.product[k];
      if (typeof a === 'boolean' || typeof b === 'boolean') return !!a !== !!b;
      if (typeof a === 'number' || typeof b === 'number') return Number(a ?? 0) !== Number(b ?? 0);
      return (a ?? '') !== (b ?? '');
    });
  }, [form, detail, isNew]);

  const handleSaveBasic = async () => {
    if (!form.name.trim()) {
      toastError(new Error('Name is required'), 'saving product');
      return;
    }
    if (!form.slug.trim()) {
      toastError(new Error('Slug is required'), 'saving product');
      return;
    }
    try {
      const saved = await upsertProduct.mutateAsync(detail?.product ? { id: detail.product.id, ...form } : form);
      toastSuccess(detail?.product ? 'update' : 'create', 'product');
      if (isNew && saved?.id) {
        navigate(`/admin/marketplace/products/${saved.id}`, { replace: true });
      }
    } catch (e) {
      toastError(e, 'saving product');
    }
  };

  const [openingDocKey, setOpeningDocKey] = useState(null);
  const openDocument = async (doc, { download = false } = {}) => {
    const key = `${doc.id}::${download ? 'dl' : 'view'}`;
    setOpeningDocKey(key);
    try {
      const { data, error } = await supabase.storage
        .from('marketplace-product-sds')
        .createSignedUrl(doc.storage_path, 60, download ? { download: doc.file_name } : undefined);
      if (error) throw error;
      if (!data?.signedUrl) throw new Error('No signed URL returned');
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (e) {
      toastError(e, 'opening document');
    } finally {
      setOpeningDocKey(null);
    }
  };

  if (isLoading) {
    return <div className="p-6"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  const coverImage = (detail?.images ?? []).find((i) => i.is_cover) ?? (detail?.images ?? [])[0];

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5 pb-24">
      {/* ===== Hero header ===== */}
      <Card className="overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <Button variant="ghost" size="sm" onClick={() => navigate('/admin/marketplace/products')} className="shrink-0 -ml-2">
                <ArrowLeft className="w-4 h-4 mr-1" /> Products
              </Button>
              {!isNew && coverImage && (
                <div className="w-14 h-14 rounded-md bg-muted overflow-hidden shrink-0 border border-border hidden sm:block">
                  <MarketplaceImage storagePath={coverImage.storage_path} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-semibold tracking-tight truncate">
                    {isNew ? 'New product' : (form.name || 'Untitled product')}
                  </h1>
                  {!isNew && (form.is_active
                    ? <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">Active</Badge>
                    : <Badge variant="secondary">Inactive</Badge>)}
                  {form.badge && <Badge>{form.badge}</Badge>}
                  {form.classification && form.classification !== 'Non-DG' && (
                    <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                      <ShieldAlert className="w-3 h-3 mr-1" />{form.classification}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 font-mono truncate">
                  /marketplace/products/{form.slug || '(slug pending)'}
                </p>
                {form.manufacturer && (
                  <p className="text-xs text-muted-foreground mt-0.5">by {form.manufacturer}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {!isNew && (
                <>
                  <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border bg-muted/30">
                    <span className="text-xs text-muted-foreground">{form.is_active ? 'Visible' : 'Hidden'}</span>
                    <Switch checked={!!form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                  </div>
                  {form.slug && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={`/marketplace/products/${form.slug}`} target="_blank" rel="noreferrer">
                        <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Preview
                      </a>
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ===== Body: two-column grid ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* MAIN COLUMN */}
        <div className="lg:col-span-2 space-y-5">
          {/* Product details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Package className="w-4 h-4" /> Product details</CardTitle>
              <CardDescription>Name, identity, descriptions and merchandising.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Name *">
                  <Input value={form.name} onChange={(e) => handleNameChange(e.target.value)} />
                </Field>
                <Field label="Slug (URL) *" hint="Used in /marketplace/products/<slug>">
                  <Input
                    value={form.slug}
                    onChange={(e) => { setSlugTouched(true); setForm({ ...form, slug: slugify(e.target.value) }); }}
                  />
                </Field>
                <Field label="Manufacturer">
                  <Input value={form.manufacturer ?? ''} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
                </Field>
                <Field label="Display order" hint="Lower numbers appear first">
                  <Input type="number" value={form.display_order ?? 0} onChange={(e) => setForm({ ...form, display_order: Number(e.target.value) })} />
                </Field>
              </div>
              <Field label="Short description">
                <Input value={form.short_description ?? ''} onChange={(e) => setForm({ ...form, short_description: e.target.value })} />
              </Field>
              <Field label="Long description">
                <Textarea rows={4} value={form.long_description ?? ''} onChange={(e) => setForm({ ...form, long_description: e.target.value })} />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Delivery info" hint="Free text shown on the product page">
                  <Textarea rows={2} value={form.delivery_info ?? ''} onChange={(e) => setForm({ ...form, delivery_info: e.target.value })} />
                </Field>
                <Field label="Badge" hint='Optional label (e.g. "Bestseller", "New")'>
                  <Input value={form.badge ?? ''} onChange={(e) => setForm({ ...form, badge: e.target.value })} />
                </Field>
              </div>
            </CardContent>
          </Card>

          {/* Hazard / classification */}
          {!isNew && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> Hazard &amp; safety</CardTitle>
                <CardDescription>Dangerous-goods classification and safe-handling notes.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Field label="Classification">
                    <Select value={form.classification} onValueChange={(v) => setForm({ ...form, classification: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CLASSIFICATIONS.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="UN number">
                    <Input value={form.un_number ?? ''} onChange={(e) => setForm({ ...form, un_number: e.target.value })} />
                  </Field>
                  <Field label="Hazard class">
                    <Input value={form.hazard_class ?? ''} onChange={(e) => setForm({ ...form, hazard_class: e.target.value })} />
                  </Field>
                  <Field label="Packing group">
                    <Input value={form.packing_group ?? ''} onChange={(e) => setForm({ ...form, packing_group: e.target.value })} />
                  </Field>
                  <Field label="CAS number">
                    <Input value={form.cas_number ?? ''} onChange={(e) => setForm({ ...form, cas_number: e.target.value })} />
                  </Field>
                </div>
                <Field label="Safety / handling notes">
                  <Textarea rows={3} value={form.safety_info ?? ''} onChange={(e) => setForm({ ...form, safety_info: e.target.value })} />
                </Field>
              </CardContent>
            </Card>
          )}

          {/* Packaging prices */}
          {!isNew && (
            <PackagingPricesCard
              productId={productId}
              prices={detail?.prices ?? []}
              sizes={sizes}
              onUpsert={(p) => upsertPrice.mutateAsync(p)}
              onDelete={(id) => deletePrice.mutateAsync(id)}
            />
          )}

          {/* Site-access checkout questions */}
          {!isNew && (
            <CheckoutQuestionsCard
              productId={productId}
              questions={detail?.questions ?? []}
              sizes={sizes}
              onUpsert={(q) => upsertQuestion.mutateAsync(q)}
              onDelete={(id) => deleteQuestion.mutateAsync(id)}
              upsertPending={upsertQuestion.isPending}
              deletePending={deleteQuestion.isPending}
            />
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-5">
          {!isNew && (
            <>
              {/* Photos */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2"><Images className="w-4 h-4" /> Photos</CardTitle>
                      <CardDescription className="mt-0.5">Cover image appears on the marketplace tile.</CardDescription>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">{(detail?.images ?? []).length}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    ref={imgInputRef}
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        await uploadImage.mutateAsync({
                          file,
                          isCover: (detail?.images?.length ?? 0) === 0,
                        });
                        toastSuccess('upload', 'product image');
                      } catch (err) {
                        toastError(err, 'uploading image');
                      }
                      e.target.value = '';
                    }}
                  />
                  {(detail?.images?.length ?? 0) === 0 ? (
                    <button
                      type="button"
                      onClick={() => imgInputRef.current?.click()}
                      disabled={uploadImage.isPending}
                      className="w-full aspect-video border-2 border-dashed border-border rounded-md flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:bg-muted/40 transition-colors"
                    >
                      <ImagePlus className="w-5 h-5" />
                      <span className="text-xs">Add the first photo</span>
                    </button>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        {(detail?.images ?? []).map((img) => (
                          <div key={img.id} className="group relative aspect-square rounded-md border border-border overflow-hidden bg-muted">
                            <MarketplaceImage storagePath={img.storage_path} alt="" className="w-full h-full object-cover" />
                            {img.is_cover && (
                              <Badge variant="secondary" className="absolute top-1.5 left-1.5 text-[10px] backdrop-blur-sm bg-background/90">Cover</Badge>
                            )}
                            <Button
                              variant="secondary"
                              size="icon"
                              className="absolute top-1.5 right-1.5 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity bg-background/90 hover:bg-background"
                              onClick={() => deleteImage.mutate(img)}
                              disabled={deleteImage.isPending}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => imgInputRef.current?.click()}
                          disabled={uploadImage.isPending}
                          className="aspect-square border-2 border-dashed border-border rounded-md flex flex-col items-center justify-center gap-1 text-muted-foreground hover:bg-muted/40 transition-colors"
                        >
                          {uploadImage.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                          <span className="text-[11px]">Add</span>
                        </button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Documents */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4" /> SDS &amp; documents</CardTitle>
                      <CardDescription className="mt-0.5">PDF only, 10 MB max.</CardDescription>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">{(detail?.documents ?? []).length}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <input
                    type="file"
                    accept="application/pdf"
                    ref={docInputRef}
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        await uploadDoc.mutateAsync({ file, docType: 'sds' });
                        toastSuccess('upload', 'document');
                      } catch (err) {
                        toastError(err, 'uploading document');
                      }
                      e.target.value = '';
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => docInputRef.current?.click()}
                    disabled={uploadDoc.isPending}
                  >
                    {uploadDoc.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Upload className="w-4 h-4 mr-1.5" />}
                    Upload SDS PDF
                  </Button>
                  {(detail?.documents?.length ?? 0) === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">No documents uploaded yet.</p>
                  ) : (
                    <div className="space-y-1.5 pt-1">
                      {(detail?.documents ?? []).map((d) => (
                        <div key={d.id} className="flex items-center gap-2 p-2 border border-border rounded-md hover:bg-muted/40 transition-colors">
                          <button
                            type="button"
                            onClick={() => openDocument(d)}
                            className="w-8 h-8 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 hover:bg-rose-100 dark:hover:bg-rose-950/60 transition-colors"
                            title="Open PDF in a new tab"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openDocument(d)}
                            className="flex-1 min-w-0 text-left group"
                            title="Open PDF in a new tab"
                          >
                            <p className="text-xs font-medium truncate group-hover:underline">{d.file_name}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{d.doc_type}</p>
                          </button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openDocument(d)}
                            disabled={openingDocKey != null || deleteDoc.isPending}
                            title="Open"
                          >
                            {openingDocKey === `${d.id}::view`
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Eye className="w-3.5 h-3.5" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openDocument(d, { download: true })}
                            disabled={openingDocKey != null || deleteDoc.isPending}
                            title="Download"
                          >
                            {openingDocKey === `${d.id}::dl`
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Download className="w-3.5 h-3.5" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => deleteDoc.mutate(d)}
                            disabled={deleteDoc.isPending || openingDocKey != null}
                            title="Delete"
                          >
                            {deleteDoc.isPending
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Trash2 className="w-3.5 h-3.5" />}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* ===== Sticky save bar ===== */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <p className="text-xs sm:text-sm text-muted-foreground">
            {isNew
              ? 'Fill in product details, then create to enable hazard, pricing, photos and documents.'
              : isDirty
                ? <span className="text-amber-700 dark:text-amber-400 font-medium">Unsaved changes to product details.</span>
                : 'All changes saved.'}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => navigate('/admin/marketplace/products')}>Cancel</Button>
            <Button size="sm" onClick={handleSaveBasic} disabled={upsertProduct.isPending || (!isNew && !isDirty)}>
              {upsertProduct.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
              {isNew ? 'Create product' : 'Save changes'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, full = false, hint, children }) {
  return (
    <div className={full ? '' : ''}>
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

// ---- Packaging prices sub-card -----------------------------------------------
function PackagingPricesCard({ productId, prices, sizes, onUpsert, onDelete }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({
    packaging_size_id: '',
    price_type: 'per_litre',
    price_per_litre: '',
    fixed_price: '',
    minimum_order_quantity: 1,
    is_available: true,
  });
  const [busy, setBusy] = useState(false);

  const sizeById = new Map(sizes.map((s) => [s.id, s]));
  const usedSizeIds = new Set((prices || []).map((p) => p.packaging_size_id));
  const availableSizesForAdd = sizes.filter((s) => !usedSizeIds.has(s.id));
  // For edit: include the row's own size so the Select can still show it.
  const sizesForEdit = editingId
    ? sizes.filter((s) => !usedSizeIds.has(s.id) || s.id === draft.packaging_size_id)
    : [];

  const closeAll = () => { setAdding(false); setEditingId(null); };

  const startAdd = () => {
    setEditingId(null);
    setDraft({
      packaging_size_id: availableSizesForAdd[0]?.id ?? '',
      price_type: 'per_litre',
      price_per_litre: '',
      fixed_price: '',
      minimum_order_quantity: 1,
      is_available: true,
    });
    setAdding(true);
  };

  const startEdit = (p) => {
    setAdding(false);
    setDraft({
      packaging_size_id: p.packaging_size_id,
      price_type: p.price_type ?? 'per_litre',
      price_per_litre: p.price_per_litre ?? '',
      fixed_price: p.fixed_price ?? '',
      minimum_order_quantity: p.minimum_order_quantity ?? 1,
      is_available: !!p.is_available,
    });
    setEditingId(p.id);
  };

  const submit = async () => {
    if (!draft.packaging_size_id) {
      toastError(new Error('Choose a packaging size'), 'saving price');
      return;
    }
    const payload = {
      packaging_size_id: draft.packaging_size_id,
      price_type: draft.price_type,
      price_per_litre: draft.price_type === 'per_litre' ? Number(draft.price_per_litre) || null : null,
      fixed_price: draft.price_type === 'fixed' ? Number(draft.fixed_price) || null : null,
      minimum_order_quantity: Number(draft.minimum_order_quantity) || 1,
      is_available: !!draft.is_available,
    };
    if ((payload.price_type === 'per_litre' && payload.price_per_litre == null) ||
        (payload.price_type === 'fixed' && payload.fixed_price == null)) {
      toastError(new Error('Enter a valid price'), 'saving price');
      return;
    }
    // Per-litre pricing only makes sense when the packaging has a known
    // volume; for variable-volume packs (Bulk), use fixed pricing.
    const sizeRow = sizeById.get(payload.packaging_size_id);
    if (payload.price_type === 'per_litre' && !sizeRow?.volume_litres) {
      toastError(
        new Error('Per-litre pricing requires a packaging size with a known volume. Use fixed pricing for variable-volume packs (e.g. Bulk).'),
        'saving price',
      );
      return;
    }
    if (editingId) payload.id = editingId;
    setBusy(true);
    try {
      await onUpsert(payload);
      toastSuccess(editingId ? 'update' : 'save', 'price');
      closeAll();
    } catch (e) {
      toastError(e, 'saving price');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <CardTitle className="text-base flex items-center gap-2"><Boxes className="w-4 h-4" /> Packaging &amp; default pricing</CardTitle>
            <CardDescription className="mt-0.5">
              One row per packaging variant. Per-litre prices multiply by the size volume; fixed prices are per pack.
            </CardDescription>
          </div>
          {(prices || []).length > 0 && !adding && editingId === null && availableSizesForAdd.length > 0 && (
            <Button size="sm" variant="outline" onClick={startAdd} className="shrink-0">
              <Plus className="w-4 h-4 mr-1.5" /> Add variant
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {(prices || []).length === 0 && !adding ? (
          <div className="border-2 border-dashed border-border rounded-md p-6 text-center">
            <Boxes className="w-6 h-6 mx-auto text-muted-foreground" />
            <p className="text-sm font-medium mt-2">No packaging variants yet</p>
            <p className="text-xs text-muted-foreground mt-1">Add the first packaging size to make this product orderable.</p>
            <Button size="sm" onClick={startAdd} className="mt-3" disabled={availableSizesForAdd.length === 0}>
              <Plus className="w-4 h-4 mr-1.5" /> Add packaging variant
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {(prices || []).map((p) => {
              if (editingId === p.id) {
                return (
                  <VariantForm
                    key={p.id}
                    mode="edit"
                    draft={draft}
                    setDraft={setDraft}
                    sizes={sizesForEdit}
                    busy={busy}
                    onCancel={closeAll}
                    onSubmit={submit}
                  />
                );
              }
              const size = sizeById.get(p.packaging_size_id);
              const totalPerPack = p.price_type === 'per_litre' && size?.volume_litres
                ? Number(p.price_per_litre) * Number(size.volume_litres)
                : null;
              const unitLabel = p.price_type === 'per_litre'
                ? `${formatAUD(p.price_per_litre)} / L`
                : `${formatAUD(p.fixed_price)} fixed`;
              return (
                <div
                  key={p.id}
                  className={`rounded-md border p-3 transition-colors ${p.is_available ? 'bg-background hover:bg-muted/30' : 'bg-muted/30 opacity-75'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3 sm:items-center">
                      {/* Size + status */}
                      <div className="sm:col-span-4 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium truncate">{size?.name ?? 'Unknown size'}</p>
                          {p.is_available
                            ? <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px]">Available</Badge>
                            : <Badge variant="secondary" className="text-[10px]">Hidden</Badge>}
                        </div>
                        {p.minimum_order_quantity > 1 && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">MOQ {p.minimum_order_quantity}</p>
                        )}
                      </div>
                      {/* Unit price */}
                      <div className="sm:col-span-3">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground sm:hidden">Unit price</p>
                        <p className="text-sm font-mono">{unitLabel}</p>
                      </div>
                      {/* Pack total */}
                      <div className="sm:col-span-4">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground sm:hidden">Per pack</p>
                        <p className="text-sm font-mono text-muted-foreground">
                          {totalPerPack != null ? `= ${formatAUD(totalPerPack)} / pack` : ''}
                        </p>
                      </div>
                      {/* Actions */}
                      <div className="sm:col-span-1 flex justify-start sm:justify-end gap-0.5">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => startEdit(p)} disabled={adding || editingId !== null} title="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600 hover:text-rose-700 dark:text-rose-400" onClick={() => onDelete(p.id)} disabled={adding || editingId !== null} title="Remove">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {adding && (
          <VariantForm
            mode="add"
            draft={draft}
            setDraft={setDraft}
            sizes={availableSizesForAdd}
            busy={busy}
            onCancel={closeAll}
            onSubmit={submit}
          />
        )}

        {availableSizesForAdd.length === 0 && !adding && editingId === null && (prices || []).length > 0 && (
          <p className="text-[11px] text-muted-foreground italic text-center pt-1">
            All packaging sizes added. Create more in Admin → Operations log categories → Packaging sizes.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function VariantForm({ mode, draft, setDraft, sizes, busy, onCancel, onSubmit }) {
  const isEdit = mode === 'edit';
  return (
    <div className="border border-primary/40 rounded-md p-4 bg-primary/5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium flex items-center gap-2">
          {isEdit
            ? <><Pencil className="w-4 h-4 text-primary" /> Edit packaging variant</>
            : <><Plus className="w-4 h-4 text-primary" /> New packaging variant</>}
        </p>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onCancel} disabled={busy}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Packaging size</Label>
          <Select value={draft.packaging_size_id} onValueChange={(v) => setDraft({ ...draft, packaging_size_id: v })}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Choose size" /></SelectTrigger>
            <SelectContent>
              {sizes.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Price type</Label>
          <Select value={draft.price_type} onValueChange={(v) => setDraft({ ...draft, price_type: v })}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="per_litre">Per litre</SelectItem>
              <SelectItem value="fixed">Fixed (per pack)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            {draft.price_type === 'per_litre' ? 'Price per litre (AUD)' : 'Fixed price (AUD)'}
          </Label>
          {draft.price_type === 'per_litre' ? (
            <Input type="number" step="0.0001" placeholder="0.0000" className="mt-1" value={draft.price_per_litre ?? ''} onChange={(e) => setDraft({ ...draft, price_per_litre: e.target.value })} />
          ) : (
            <Input type="number" step="0.01" placeholder="0.00" className="mt-1" value={draft.fixed_price ?? ''} onChange={(e) => setDraft({ ...draft, fixed_price: e.target.value })} />
          )}
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Minimum order qty</Label>
          <Input type="number" min="1" className="mt-1" value={draft.minimum_order_quantity} onChange={(e) => setDraft({ ...draft, minimum_order_quantity: e.target.value })} />
        </div>
      </div>
      <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={!!draft.is_available} onCheckedChange={(v) => setDraft({ ...draft, is_available: v })} />
          <span className="text-muted-foreground">Available to buyers</span>
        </label>
        <div className="flex gap-2 ml-auto">
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button size="sm" onClick={onSubmit} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
            {isEdit ? 'Save changes' : 'Save variant'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---- Checkout questions sub-card --------------------------------------------
function CheckoutQuestionsCard({ productId, questions, sizes, onUpsert, onDelete, upsertPending = false, deletePending = false }) {
  const EMPTY_Q = {
    question_text: '',
    question_type: 'boolean',
    is_required: true,
    display_order: 0,
    packaging_size_id: null,
  };
  // editingId: null = closed, 'new' = adding, '<uuid>' = editing existing
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(EMPTY_Q);

  const startAdd = () => {
    setDraft({ ...EMPTY_Q, display_order: (questions?.length ?? 0) * 10 });
    setEditingId('new');
  };

  const startEdit = (q) => {
    setDraft({
      id: q.id,
      question_text: q.question_text,
      question_type: q.question_type,
      is_required: !!q.is_required,
      display_order: q.display_order ?? 0,
      packaging_size_id: q.packaging_size_id ?? null,
    });
    setEditingId(q.id);
  };

  const cancel = () => { setEditingId(null); setDraft(EMPTY_Q); };

  const [deletingId, setDeletingId] = useState(null);
  const submit = async () => {
    if (!draft.question_text.trim()) {
      toastError(new Error('Question text required'), 'saving question');
      return;
    }
    try {
      await onUpsert(draft);
      toastSuccess(draft.id ? 'update' : 'save', 'question');
      cancel();
    } catch (e) {
      toastError(e, 'saving question');
    }
  };
  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Site-access questions</CardTitle>
        <CardDescription>Asked at checkout (rendered in M2). Optional in M1.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {(questions || []).length > 0 && (
          <div className="divide-y border rounded-md">
            {(questions || []).map((q) => (
              editingId === q.id ? (
                <QuestionForm key={q.id} draft={draft} setDraft={setDraft} onCancel={cancel} onSubmit={submit} editing busy={upsertPending} />
              ) : (
                <div key={q.id} className="p-3 flex items-center gap-3 text-sm">
                  <Badge variant="outline" className="text-[10px]">{q.question_type}</Badge>
                  <p className="flex-1">{q.question_text}</p>
                  {q.is_required && <Badge variant="secondary" className="text-[10px]">required</Badge>}
                  <Button variant="ghost" size="sm" onClick={() => startEdit(q)} disabled={editingId !== null || deletingId === q.id} title="Edit">
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(q.id)} disabled={editingId !== null || deletingId === q.id} title="Delete">
                    {deletingId === q.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Trash2 className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              )
            ))}
          </div>
        )}
        {editingId === 'new' ? (
          <QuestionForm draft={draft} setDraft={setDraft} onCancel={cancel} onSubmit={submit} busy={upsertPending} />
        ) : editingId === null ? (
          <Button variant="outline" size="sm" onClick={startAdd} disabled={deletePending || deletingId !== null}>
            <Plus className="w-4 h-4 mr-1.5" /> Add question
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function QuestionForm({ draft, setDraft, onCancel, onSubmit, editing = false, busy = false }) {
  return (
    <div className="border rounded-md p-3 space-y-2 bg-muted/30">
      <Input
        placeholder="Question text"
        value={draft.question_text}
        onChange={(e) => setDraft({ ...draft, question_text: e.target.value })}
        disabled={busy}
      />
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={draft.question_type} onValueChange={(v) => setDraft({ ...draft, question_type: v })} disabled={busy}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="boolean">Yes / No</SelectItem>
            <SelectItem value="text">Free text</SelectItem>
            <SelectItem value="number">Number</SelectItem>
            <SelectItem value="single_select">Single choice</SelectItem>
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={!!draft.is_required} onCheckedChange={(v) => setDraft({ ...draft, is_required: v })} disabled={busy} />
          Required
        </label>
        <div className="flex-1" />
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}><X className="w-3.5 h-3.5 mr-1" />Cancel</Button>
        <Button size="sm" onClick={onSubmit} disabled={busy}>
          {busy
            ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
            : <Save className="w-3.5 h-3.5 mr-1" />}
          {editing ? 'Save' : 'Add'}
        </Button>
      </div>
    </div>
  );
}
