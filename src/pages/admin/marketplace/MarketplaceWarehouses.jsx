import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Warehouse } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { warehousesOptions } from '@/query/options/marketplace';
import { useUpsertWarehouse, useDeleteWarehouse } from '@/query/mutations/marketplace';
import { toastError, toastSuccess } from '@/lib/toast';
import { useConfirm } from '@/hooks/useConfirm';

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
  const { data: warehouses = [], isLoading } = useQuery(warehousesOptions(companyId));
  const upsert = useUpsertWarehouse(companyId);
  const remove = useDeleteWarehouse(companyId);
  const { confirm, ConfirmDialog } = useConfirm();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);

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
              {warehouses.map((w) => (
                <div key={w.id} className="py-4 first:pt-0 last:pb-0 grid grid-cols-1 md:grid-cols-12 gap-2 items-start">
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
                  <div className="md:col-span-3 text-xs text-muted-foreground">
                    {w.is_supplier_managed ? 'Supplier-managed freight' : 'Non-supplier-managed'}
                  </div>
                  <div className="md:col-span-2 flex md:justify-end gap-1">
                    <Button size="sm" variant="outline" onClick={() => startEdit(w)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDelete(w)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
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
            <div className="col-span-2 flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={!!form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                Active
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={!!form.is_supplier_managed} onCheckedChange={(v) => setForm({ ...form, is_supplier_managed: v })} />
                Supplier-managed freight
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
