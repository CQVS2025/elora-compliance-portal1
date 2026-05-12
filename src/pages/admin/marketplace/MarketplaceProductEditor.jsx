import React, { useEffect, useState, useRef } from 'react';
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
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Save, Plus, Trash2, ImagePlus, FileText, Star, StarOff, Loader2, Upload, Pencil, X } from 'lucide-react';
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

  if (isLoading) {
    return <div className="p-6"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/marketplace/products')}>
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Products
        </Button>
        <h1 className="text-xl font-semibold">
          {isNew ? 'New product' : detail?.product?.name || 'Product'}
        </h1>
        {!isNew && form.is_active === false && <Badge variant="secondary">inactive</Badge>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* Basic info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Product details</CardTitle>
              <CardDescription>Name, description, manufacturer, slug.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field label="Name *" full>
                <Input value={form.name} onChange={(e) => handleNameChange(e.target.value)} />
              </Field>
              <Field label="Slug (URL) *" full hint="Used in /marketplace/products/<slug>">
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
              <Field label="Short description" full>
                <Input value={form.short_description ?? ''} onChange={(e) => setForm({ ...form, short_description: e.target.value })} />
              </Field>
              <Field label="Long description" full>
                <Textarea rows={4} value={form.long_description ?? ''} onChange={(e) => setForm({ ...form, long_description: e.target.value })} />
              </Field>
              <Field label="Delivery info" full hint="Free-text shown on the product page (e.g. delivery windows, access requirements)">
                <Textarea rows={2} value={form.delivery_info ?? ''} onChange={(e) => setForm({ ...form, delivery_info: e.target.value })} />
              </Field>
              <Field label="Badge" hint='e.g. "Bestseller", "New"'>
                <Input value={form.badge ?? ''} onChange={(e) => setForm({ ...form, badge: e.target.value })} />
              </Field>
              <div className="flex items-center gap-2 pt-1">
                <Switch checked={!!form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <Label>Active (visible to buyers)</Label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => navigate('/admin/marketplace/products')}>Cancel</Button>
                <Button size="sm" onClick={handleSaveBasic} disabled={upsertProduct.isPending}>
                  <Save className="w-4 h-4 mr-1.5" /> {isNew ? 'Create' : 'Save'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Hazard / classification */}
          {!isNew && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Hazard &amp; safety</CardTitle>
                <CardDescription>Classification, dangerous-goods info, SDS notes.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Classification" full>
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
                <Field label="Safety / handling notes" full>
                  <Textarea rows={3} value={form.safety_info ?? ''} onChange={(e) => setForm({ ...form, safety_info: e.target.value })} />
                </Field>
                <div className="flex justify-end pt-1">
                  <Button size="sm" onClick={handleSaveBasic} disabled={upsertProduct.isPending}>
                    <Save className="w-4 h-4 mr-1.5" /> Save hazard info
                  </Button>
                </div>
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
            />
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {!isNew && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Photos</CardTitle>
                  <CardDescription>One image is the cover. Drag-drop coming in v2.</CardDescription>
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
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => imgInputRef.current?.click()}
                    disabled={uploadImage.isPending}
                  >
                    <ImagePlus className="w-4 h-4 mr-1.5" /> Add photo
                  </Button>
                  <div className="space-y-2">
                    {(detail?.images ?? []).map((img) => (
                      <div key={img.id} className="flex items-center gap-2 p-2 border rounded-md">
                        <div className="w-12 h-12 rounded bg-muted overflow-hidden">
                          <MarketplaceImage storagePath={img.storage_path} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs truncate">{img.alt_text || 'Untitled'}</p>
                          {img.is_cover && <Badge variant="secondary" className="text-[10px]">Cover</Badge>}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteImage.mutate(img)}
                          disabled={deleteImage.isPending}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                    {(detail?.images?.length ?? 0) === 0 && (
                      <p className="text-xs text-muted-foreground py-3 text-center">No images yet.</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">SDS &amp; documents</CardTitle>
                  <CardDescription>PDF only, 10 MB max.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
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
                    <Upload className="w-4 h-4 mr-1.5" /> Upload SDS PDF
                  </Button>
                  <div className="space-y-2">
                    {(detail?.documents ?? []).map((d) => (
                      <div key={d.id} className="flex items-center gap-2 p-2 border rounded-md">
                        <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs truncate">{d.file_name}</p>
                          <p className="text-[11px] text-muted-foreground uppercase">{d.doc_type}</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => deleteDoc.mutate(d)} disabled={deleteDoc.isPending}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                    {(detail?.documents?.length ?? 0) === 0 && (
                      <p className="text-xs text-muted-foreground py-3 text-center">No documents yet.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
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
  const [draft, setDraft] = useState({
    packaging_size_id: '',
    price_type: 'per_litre',
    price_per_litre: '',
    fixed_price: '',
    minimum_order_quantity: 1,
    is_available: true,
  });

  const sizeById = new Map(sizes.map((s) => [s.id, s]));
  const usedSizeIds = new Set((prices || []).map((p) => p.packaging_size_id));
  const availableSizes = sizes.filter((s) => !usedSizeIds.has(s.id));

  const startAdd = () => {
    setDraft({
      packaging_size_id: availableSizes[0]?.id ?? '',
      price_type: 'per_litre',
      price_per_litre: '',
      fixed_price: '',
      minimum_order_quantity: 1,
      is_available: true,
    });
    setAdding(true);
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
    try {
      await onUpsert(payload);
      toastSuccess('save', 'price');
      setAdding(false);
    } catch (e) {
      toastError(e, 'saving price');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Packaging &amp; default pricing</CardTitle>
        <CardDescription>
          One row per packaging variant. Per-litre prices multiply by the volume of the size; fixed prices are per pack.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {(prices || []).length > 0 && (
          <div className="divide-y border rounded-md">
            {(prices || []).map((p) => {
              const size = sizeById.get(p.packaging_size_id);
              const totalPerPack = p.price_type === 'per_litre' && size?.volume_litres
                ? Number(p.price_per_litre) * Number(size.volume_litres)
                : null;
              return (
                <div key={p.id} className="p-3 grid grid-cols-12 gap-2 items-center text-sm">
                  <div className="col-span-3 font-medium">{size?.name ?? 'Unknown size'}</div>
                  <div className="col-span-3 text-muted-foreground">
                    {p.price_type === 'per_litre'
                      ? `${formatAUD(p.price_per_litre)} / L`
                      : `${formatAUD(p.fixed_price)} fixed`}
                  </div>
                  <div className="col-span-3 text-muted-foreground">
                    {totalPerPack != null ? `= ${formatAUD(totalPerPack)} / pack` : `MOQ ${p.minimum_order_quantity}`}
                  </div>
                  <div className="col-span-2">
                    {p.is_available ? <Badge variant="outline" className="border-emerald-300 text-emerald-700">Available</Badge> : <Badge variant="secondary">Hidden</Badge>}
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button variant="ghost" size="sm" onClick={() => onDelete(p.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {adding ? (
          <div className="border rounded-md p-3 grid grid-cols-12 gap-2 items-end bg-muted/30">
            <div className="col-span-3">
              <Label className="text-xs">Packaging size</Label>
              <Select value={draft.packaging_size_id} onValueChange={(v) => setDraft({ ...draft, packaging_size_id: v })}>
                <SelectTrigger><SelectValue placeholder="Choose size" /></SelectTrigger>
                <SelectContent>
                  {availableSizes.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Price type</Label>
              <Select value={draft.price_type} onValueChange={(v) => setDraft({ ...draft, price_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="per_litre">Per litre</SelectItem>
                  <SelectItem value="fixed">Fixed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Price (AUD)</Label>
              {draft.price_type === 'per_litre' ? (
                <Input type="number" step="0.0001" value={draft.price_per_litre} onChange={(e) => setDraft({ ...draft, price_per_litre: e.target.value })} />
              ) : (
                <Input type="number" step="0.01" value={draft.fixed_price} onChange={(e) => setDraft({ ...draft, fixed_price: e.target.value })} />
              )}
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Min qty</Label>
              <Input type="number" min="1" value={draft.minimum_order_quantity} onChange={(e) => setDraft({ ...draft, minimum_order_quantity: e.target.value })} />
            </div>
            <div className="col-span-2 flex items-center gap-2 pt-5">
              <Switch checked={!!draft.is_available} onCheckedChange={(v) => setDraft({ ...draft, is_available: v })} />
              <span className="text-xs">Available</span>
            </div>
            <div className="col-span-1 flex justify-end gap-1 pt-5">
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
              <Button size="sm" onClick={submit}>Save</Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={startAdd} disabled={availableSizes.length === 0}>
            <Plus className="w-4 h-4 mr-1.5" />
            {availableSizes.length === 0 ? 'All packaging sizes added' : 'Add packaging variant'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ---- Checkout questions sub-card --------------------------------------------
function CheckoutQuestionsCard({ productId, questions, sizes, onUpsert, onDelete }) {
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
                <QuestionForm key={q.id} draft={draft} setDraft={setDraft} onCancel={cancel} onSubmit={submit} editing />
              ) : (
                <div key={q.id} className="p-3 flex items-center gap-3 text-sm">
                  <Badge variant="outline" className="text-[10px]">{q.question_type}</Badge>
                  <p className="flex-1">{q.question_text}</p>
                  {q.is_required && <Badge variant="secondary" className="text-[10px]">required</Badge>}
                  <Button variant="ghost" size="sm" onClick={() => startEdit(q)} title="Edit">
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onDelete(q.id)} title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )
            ))}
          </div>
        )}
        {editingId === 'new' ? (
          <QuestionForm draft={draft} setDraft={setDraft} onCancel={cancel} onSubmit={submit} />
        ) : editingId === null ? (
          <Button variant="outline" size="sm" onClick={startAdd}>
            <Plus className="w-4 h-4 mr-1.5" /> Add question
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function QuestionForm({ draft, setDraft, onCancel, onSubmit, editing = false }) {
  return (
    <div className="border rounded-md p-3 space-y-2 bg-muted/30">
      <Input
        placeholder="Question text"
        value={draft.question_text}
        onChange={(e) => setDraft({ ...draft, question_text: e.target.value })}
      />
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={draft.question_type} onValueChange={(v) => setDraft({ ...draft, question_type: v })}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="boolean">Yes / No</SelectItem>
            <SelectItem value="text">Free text</SelectItem>
            <SelectItem value="number">Number</SelectItem>
            <SelectItem value="single_select">Single choice</SelectItem>
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={!!draft.is_required} onCheckedChange={(v) => setDraft({ ...draft, is_required: v })} />
          Required
        </label>
        <div className="flex-1" />
        <Button size="sm" variant="ghost" onClick={onCancel}><X className="w-3.5 h-3.5 mr-1" />Cancel</Button>
        <Button size="sm" onClick={onSubmit}><Save className="w-3.5 h-3.5 mr-1" />{editing ? 'Save' : 'Add'}</Button>
      </div>
    </div>
  );
}
