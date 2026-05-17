import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Warehouse, ShieldCheck, Edit3, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/AuthContext';
import { warehousesOptions } from '@/query/options/marketplace';
import {
  useUpsertWarehouse, useDeleteWarehouse,
  useRegisterWarehouseInXero, useUpdateWarehouseXeroContact, useArchiveWarehouseXeroContact,
} from '@/query/mutations/marketplace';
import { toastError, toastSuccess } from '@/lib/toast';
import { useConfirm } from '@/hooks/useConfirm';
import { XeroContactDialog } from '@/components/marketplace/XeroContactDialog';

const EMPTY = {
  name: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  address_line1: '',
  address_line2: '',
  suburb: '',
  state: '',
  postcode: '',
  country: 'AU',
  is_supplier_managed: true,
  is_active: true,
  notes: '',
};

export default function MarketplaceWarehouses() {
  const { userProfile } = useAuth();
  const companyId = userProfile?.company_id;
  const isSuperAdmin = userProfile?.role === 'super_admin';
  const { data: warehouses = [], isLoading } = useQuery(warehousesOptions(companyId));
  const upsert = useUpsertWarehouse(companyId);
  const remove = useDeleteWarehouse(companyId);
  const registerWh = useRegisterWarehouseInXero(companyId);
  const updateWhContact = useUpdateWarehouseXeroContact(companyId);
  const archiveWhContact = useArchiveWarehouseXeroContact(companyId);
  const { confirm, ConfirmDialog } = useConfirm();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);

  // Xero supplier-contact dialog state
  const [xeroDialog, setXeroDialog] = useState({ open: false, warehouse: null, mode: 'register' });
  const [xeroBusyId, setXeroBusyId] = useState(null);

  // Adapt a warehouse row into the entity shape XeroContactDialog wants:
  // it reads `marketplace_invoice_email` and `marketplace_default_address`
  // for fallback prefill — map our warehouse columns onto those names.
  function asEntity(w) {
    if (!w) return null;
    return {
      ...w,
      marketplace_invoice_email: w.contact_email ?? null,
      marketplace_default_address: (w.address_line1 || w.postcode)
        ? {
            line1: w.address_line1 ?? '',
            line2: w.address_line2 ?? '',
            suburb: w.suburb ?? '',
            state: w.state ?? '',
            postcode: w.postcode ?? '',
          }
        : null,
    };
  }
  function openRegisterDialog(w) { setXeroDialog({ open: true, warehouse: w, mode: 'register' }); }
  function openEditDialog(w) { setXeroDialog({ open: true, warehouse: w, mode: 'edit' }); }

  async function handleXeroSave({ details }) {
    const { warehouse, mode } = xeroDialog;
    if (!warehouse) return;
    setXeroBusyId(warehouse.id);
    try {
      if (mode === 'edit') {
        await updateWhContact.mutateAsync({ warehouseId: warehouse.id, details });
        toastSuccess(`Updated ${warehouse.name} supplier contact in Xero.`);
      } else {
        const res = await registerWh.mutateAsync({ warehouseId: warehouse.id, details });
        toastSuccess(
          res?.reused
            ? `${warehouse.name} is already a Xero supplier. Contact details refreshed.`
            : `${warehouse.name} registered in Xero as a supplier (${res?.tenant_name ?? 'org'}).`,
        );
      }
      setXeroDialog({ open: false, warehouse: null, mode: 'register' });
    } catch (e) {
      toastError(e, mode === 'edit' ? 'updating supplier contact' : 'registering supplier in Xero');
    } finally {
      setXeroBusyId(null);
    }
  }

  async function removeXeroLink(w) {
    const ok = await confirm({
      title: `Remove ${w.name} from Xero?`,
      description: 'The Xero supplier contact will be archived (Xero soft-delete) and the local link cleared. The warehouse itself is preserved.',
      confirmLabel: 'Remove from Xero',
      destructive: true,
    });
    if (!ok) return;
    setXeroBusyId(w.id);
    try {
      const res = await archiveWhContact.mutateAsync({ warehouseId: w.id });
      if (res?.xero_archived) toastSuccess(`${w.name} archived in Xero and unlinked.`);
      else if (res?.upstream_error) toastSuccess(`Local link cleared. Xero archive failed: ${res.upstream_error}`);
      else toastSuccess(`${w.name} unlinked from Xero.`);
    } catch (e) {
      toastError(e, 'removing supplier from Xero');
    } finally {
      setXeroBusyId(null);
    }
  }

  const startCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  };

  const startEdit = (w) => {
    setEditing(w);
    setForm({ ...EMPTY, ...w });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toastError(new Error('Name is required'), 'saving warehouse');
      return;
    }
    try {
      await upsert.mutateAsync(editing ? { id: editing.id, ...form } : form);
      toastSuccess(editing ? 'update' : 'create', 'warehouse');
      setOpen(false);
    } catch (e) {
      toastError(e, 'saving warehouse');
    }
  };

  const handleDelete = async (w) => {
    const ok = await confirm({
      title: `Delete warehouse "${w.name}"?`,
      description: 'This cannot be undone. Any users currently mapped to this warehouse will be unassigned. Orders that already reference this warehouse keep their history.',
      confirmLabel: 'Delete warehouse',
      destructive: true,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(w.id);
      toastSuccess('delete', 'warehouse');
    } catch (e) {
      toastError(e, 'deleting warehouse');
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-md bg-primary/10 text-primary">
            <Warehouse className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Warehouses</h1>
            <p className="text-sm text-muted-foreground">
              Single warehouse at launch (Queensland). Schema is multi-warehouse-ready for future expansion.
            </p>
          </div>
        </div>
        <Button onClick={startCreate}>
          <Plus className="w-4 h-4 mr-1.5" /> Add warehouse
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All warehouses</CardTitle>
          <CardDescription>{warehouses.length} configured</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>
          ) : warehouses.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No warehouses yet. Add your first warehouse to begin.
            </p>
          ) : (
            <div className="divide-y">
              {warehouses.map((w) => {
                const xeroLinked = !!w.xero_contact_id;
                const xeroBusy = xeroBusyId === w.id;
                return (
                  <div key={w.id} className="py-4 first:pt-0 last:pb-0 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start">
                      <div className="md:col-span-4">
                        <p className="font-medium">{w.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {[w.suburb, w.state, w.postcode].filter(Boolean).join(' ')}
                          {!w.is_active && ' • inactive'}
                        </p>
                      </div>
                      <div className="md:col-span-3 text-sm">
                        {w.contact_name && <p>{w.contact_name}</p>}
                        {w.contact_email && <p className="text-xs text-muted-foreground">{w.contact_email}</p>}
                      </div>
                      <div className="md:col-span-3 text-xs text-muted-foreground space-y-1">
                        <p>
                          {w.is_supplier_managed
                            ? 'Third-party supplier (Xero PO will fire on each order)'
                            : "Elora's own warehouse (no Xero PO sent)"}
                        </p>
                        {w.is_supplier_managed && (
                          xeroLinked
                            ? <Badge variant="outline" className="border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300">
                                <ShieldCheck className="w-3 h-3 mr-1" /> Xero supplier linked
                              </Badge>
                            : <Badge variant="outline" className="text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800">
                                Not in Xero. POs will be created with a bare name
                              </Badge>
                        )}
                      </div>
                      <div className="md:col-span-2 flex md:justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => startEdit(w)} disabled={remove.isPending}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDelete(w)} disabled={remove.isPending}>
                          {remove.isPending
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    </div>

                    {/* Xero supplier-contact actions — only for third-party warehouses, super_admin only */}
                    {isSuperAdmin && w.is_supplier_managed && (
                      <div className="rounded-md border border-dashed border-border bg-muted/20 p-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs text-muted-foreground">
                            <strong className="text-foreground">Xero supplier contact</strong>
                            {xeroLinked && (
                              <span className="ml-2 font-mono">{w.xero_contact_id?.slice(0, 8)}…</span>
                            )}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {!xeroLinked ? (
                              <Button size="sm" disabled={xeroBusy} onClick={() => openRegisterDialog(w)}>
                                {xeroBusy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />}
                                Register in Xero
                              </Button>
                            ) : (
                              <>
                                <Button size="sm" variant="outline" disabled={xeroBusy} onClick={() => openEditDialog(w)}>
                                  <Edit3 className="w-3.5 h-3.5 mr-1.5" /> Edit details
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={xeroBusy}
                                  onClick={() => removeXeroLink(w)}
                                  className="text-rose-600 hover:text-rose-700 border-rose-200 dark:border-rose-900 dark:text-rose-400"
                                >
                                  {xeroBusy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />}
                                  Remove
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit warehouse' : 'New warehouse'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name *" full>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Contact name">
              <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
            </Field>
            <Field label="Contact phone">
              <Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
            </Field>
            <Field label="Contact email" full>
              <Input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
            </Field>
            <Field label="Address line 1" full>
              <Input value={form.address_line1} onChange={(e) => setForm({ ...form, address_line1: e.target.value })} />
            </Field>
            <Field label="Address line 2" full>
              <Input value={form.address_line2 ?? ''} onChange={(e) => setForm({ ...form, address_line2: e.target.value })} />
            </Field>
            <Field label="Suburb">
              <Input value={form.suburb ?? ''} onChange={(e) => setForm({ ...form, suburb: e.target.value })} />
            </Field>
            <Field label="State">
              <Input value={form.state ?? ''} onChange={(e) => setForm({ ...form, state: e.target.value })} />
            </Field>
            <Field label="Postcode">
              <Input value={form.postcode ?? ''} onChange={(e) => setForm({ ...form, postcode: e.target.value })} />
            </Field>
            <Field label="Country">
              <Input value={form.country ?? 'AU'} onChange={(e) => setForm({ ...form, country: e.target.value })} />
            </Field>
            <Field label="Notes" full>
              <Textarea rows={2} value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
            <div className="col-span-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-6">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={!!form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                Active
              </label>
              <label className="flex items-start gap-2 text-sm">
                <Switch
                  checked={!!form.is_supplier_managed}
                  onCheckedChange={(v) => setForm({ ...form, is_supplier_managed: v })}
                  className="mt-0.5"
                />
                <span>
                  Third-party supplier
                  <span className="block text-[11px] text-muted-foreground">
                    On = warehouse is run by an external supplier; a Xero PO is created on each order so we can pay them.
                    Off = Elora's own warehouse (no PO fires; we don't PO ourselves).
                  </span>
                </span>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={upsert.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {ConfirmDialog}

      <XeroContactDialog
        open={xeroDialog.open}
        onOpenChange={(o) => setXeroDialog((d) => ({ ...d, open: o }))}
        entity={asEntity(xeroDialog.warehouse)}
        kind="supplier"
        mode={xeroDialog.mode}
        busy={xeroBusyId === xeroDialog.warehouse?.id}
        onSave={handleXeroSave}
      />
    </div>
  );
}

function Field({ label, full = false, children }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
