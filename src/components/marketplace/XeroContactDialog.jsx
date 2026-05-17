import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Loader2 } from 'lucide-react';

const STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'];

/**
 * Xero contact details editor — used for both buyer-customer contacts
 * (Customer Marketplace Access) and supplier contacts (third-party
 * warehouses). Matches the field set Xero's own contact form exposes —
 * ABN/Tax number, primary person, phone, website, billing + delivery
 * addresses, additional contact persons.
 *
 * Props:
 *   - entity (preferred) / company (legacy alias)
 *       { name, xero_contact_details, marketplace_invoice_email,
 *         marketplace_default_address }
 *   - kind: 'customer' (default) | 'supplier'
 *           — only changes the title/help copy
 *   - mode: 'register' | 'edit'
 *   - onSave({ details }) — parent triggers the Edge Function
 */
export function XeroContactDialog({ open, onOpenChange, entity, company, kind = 'customer', mode = 'register', busy, onSave }) {
  // Backward-compat: accept `company` prop as alias for `entity`.
  const target = entity ?? company;
  const initial = useMemo(() => buildInitial(target), [target]);
  const [form, setForm] = useState(initial);

  useEffect(() => { if (open) setForm(buildInitial(target)); }, [open, target]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setNested = (key, patch) => setForm((f) => ({ ...f, [key]: { ...(f[key] ?? {}), ...patch } }));

  function copyBillingToDelivery() {
    set({ delivery_address: { ...form.billing_address } });
  }

  function addPerson() {
    set({
      contact_persons: [
        ...(form.contact_persons ?? []),
        { first_name: '', last_name: '', email_address: '', include_in_emails: true },
      ].slice(0, 5),
    });
  }
  function removePerson(idx) {
    set({ contact_persons: (form.contact_persons ?? []).filter((_, i) => i !== idx) });
  }
  function updatePerson(idx, patch) {
    set({
      contact_persons: (form.contact_persons ?? []).map((p, i) => (i === idx ? { ...p, ...patch } : p)),
    });
  }

  async function handleSave() {
    // Strip empty fields so we don't store noise.
    const cleaned = stripEmpty(form);
    await onSave?.({ details: cleaned });
  }

  if (!target) return null;
  const entityLabel = kind === 'supplier' ? 'supplier contact' : 'Xero contact';
  const title = mode === 'edit'
    ? `Edit ${entityLabel} - ${target.name}`
    : `Register ${target.name} in Xero${kind === 'supplier' ? ' as supplier' : ''}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            These fields are sent to Xero as the contact for this buyer. Used on invoices, POs, statements and receipts.
            Only the company name is required. Everything else is optional.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6 pb-2">
          <Tabs defaultValue="contact" className="w-full">
            <TabsList className="w-full grid grid-cols-2 sm:grid-cols-4 h-auto sm:h-9 gap-1 sm:gap-0">
              <TabsTrigger value="contact" className="text-xs sm:text-sm">Contact</TabsTrigger>
              <TabsTrigger value="addresses" className="text-xs sm:text-sm">Addresses</TabsTrigger>
              <TabsTrigger value="financial" className="text-xs sm:text-sm">Financial</TabsTrigger>
              <TabsTrigger value="people" className="text-xs sm:text-sm">People</TabsTrigger>
            </TabsList>

            {/* ============= Contact tab ============= */}
            <TabsContent value="contact" className="space-y-3 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Contact name *" full>
                  <Input value={target.name ?? ''} disabled readOnly />
                  <p className="text-[11px] text-muted-foreground mt-0.5">Edit on the Companies page to change.</p>
                </Field>
                <Field label="Primary first name">
                  <Input value={form.first_name ?? ''} onChange={(e) => set({ first_name: e.target.value })} />
                </Field>
                <Field label="Primary last name">
                  <Input value={form.last_name ?? ''} onChange={(e) => set({ last_name: e.target.value })} />
                </Field>
                <Field label="Email address" full>
                  <Input
                    type="email"
                    placeholder="ap@buyer.com"
                    value={form.email_address ?? ''}
                    onChange={(e) => set({ email_address: e.target.value })}
                  />
                  <p className="text-[11px] text-muted-foreground mt-0.5">Falls back to the company's marketplace invoice email if blank.</p>
                </Field>
                <Field label="Phone (country code)">
                  <Input value={form.phone?.country_code ?? ''} placeholder="61" onChange={(e) => setNested('phone', { country_code: e.target.value })} />
                </Field>
                <Field label="Phone (area code)">
                  <Input value={form.phone?.area_code ?? ''} placeholder="02" onChange={(e) => setNested('phone', { area_code: e.target.value })} />
                </Field>
                <Field label="Phone number" full>
                  <Input value={form.phone?.number ?? ''} placeholder="9000 0000" onChange={(e) => setNested('phone', { number: e.target.value })} />
                </Field>
                <Field label="Website" full>
                  <Input
                    placeholder="https://buyer.com.au"
                    value={form.website ?? ''}
                    onChange={(e) => set({ website: e.target.value })}
                  />
                </Field>
                <Field label="Account number (your reference)" full>
                  <Input
                    placeholder="e.g. BUYER-100"
                    value={form.account_number ?? ''}
                    onChange={(e) => set({ account_number: e.target.value })}
                  />
                  <p className="text-[11px] text-muted-foreground mt-0.5">Optional. Shown as "Contact Code" in Xero, useful for cross-referencing.</p>
                </Field>
              </div>
            </TabsContent>

            {/* ============= Addresses tab ============= */}
            <TabsContent value="addresses" className="space-y-4 pt-2">
              <div>
                <p className="text-sm font-medium mb-2">Billing address</p>
                <AddressFields
                  value={form.billing_address ?? {}}
                  onChange={(patch) => setNested('billing_address', patch)}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">Delivery address</p>
                  <Button size="sm" variant="ghost" className="text-xs" onClick={copyBillingToDelivery}>
                    Copy from billing
                  </Button>
                </div>
                <AddressFields
                  value={form.delivery_address ?? {}}
                  onChange={(patch) => setNested('delivery_address', patch)}
                />
              </div>
            </TabsContent>

            {/* ============= Financial tab ============= */}
            <TabsContent value="financial" className="space-y-3 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Tax number (ABN)" full>
                  <Input
                    placeholder="12 345 678 901"
                    value={form.tax_number ?? ''}
                    onChange={(e) => set({ tax_number: e.target.value })}
                  />
                  <p className="text-[11px] text-muted-foreground mt-0.5">Spaces stripped on send.</p>
                </Field>
                <Field label="Default currency">
                  <Input
                    placeholder="AUD"
                    value={form.currency ?? 'AUD'}
                    onChange={(e) => set({ currency: e.target.value.toUpperCase() })}
                  />
                </Field>
                <Field label="Internal notes" full>
                  <Textarea
                    rows={3}
                    placeholder="Optional notes about this buyer, only visible inside Xero."
                    value={form.notes ?? ''}
                    onChange={(e) => set({ notes: e.target.value })}
                  />
                </Field>
              </div>
            </TabsContent>

            {/* ============= People tab ============= */}
            <TabsContent value="people" className="space-y-3 pt-2">
              <p className="text-xs text-muted-foreground">
                Additional people on this contact. Up to 5. Toggle <strong>Include in emails</strong> to CC them on invoices.
              </p>
              {(form.contact_persons ?? []).map((p, idx) => (
                <div key={idx} className="rounded-md border border-border p-2 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input placeholder="First name" value={p.first_name ?? ''} onChange={(e) => updatePerson(idx, { first_name: e.target.value })} />
                    <Input placeholder="Last name" value={p.last_name ?? ''} onChange={(e) => updatePerson(idx, { last_name: e.target.value })} />
                    <Input type="email" placeholder="Email" value={p.email_address ?? ''} onChange={(e) => updatePerson(idx, { email_address: e.target.value })} className="col-span-2" />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs">
                      <Checkbox checked={!!p.include_in_emails} onCheckedChange={(v) => updatePerson(idx, { include_in_emails: Boolean(v) })} />
                      Include in emails
                    </label>
                    <Button variant="ghost" size="sm" onClick={() => removePerson(idx)} className="text-rose-600 hover:text-rose-700">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
              {(form.contact_persons ?? []).length < 5 && (
                <Button variant="outline" size="sm" onClick={addPerson}>
                  <Plus className="w-3.5 h-3.5 mr-1.5" /> Add another person
                </Button>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange?.(false)} disabled={busy}>Cancel</Button>
          <Button onClick={handleSave} disabled={busy}>
            {busy && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            {mode === 'edit' ? 'Save & push to Xero' : 'Register in Xero'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ----------------------------------------------------------------------------

function Field({ label, full, children }) {
  // Stack to single column on phone; respect `full` (full-width spanner)
  // only once the parent grid actually has 2 columns (sm+).
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function AddressFields({ value, onChange }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <div className="sm:col-span-2">
        <Label className="text-xs">Address line 1</Label>
        <Input value={value.line1 ?? ''} onChange={(e) => onChange({ line1: e.target.value })} />
      </div>
      <div className="sm:col-span-2">
        <Label className="text-xs">Address line 2</Label>
        <Input value={value.line2 ?? ''} onChange={(e) => onChange({ line2: e.target.value })} />
      </div>
      <div>
        <Label className="text-xs">City / suburb</Label>
        <Input value={value.city ?? value.suburb ?? ''} onChange={(e) => onChange({ city: e.target.value })} />
      </div>
      <div>
        <Label className="text-xs">State / region</Label>
        <Input list="aus-states" value={value.region ?? value.state ?? ''} onChange={(e) => onChange({ region: e.target.value })} placeholder="e.g. NSW" />
        <datalist id="aus-states">
          {STATES.map((s) => <option key={s} value={s} />)}
        </datalist>
      </div>
      <div>
        <Label className="text-xs">Postcode</Label>
        <Input value={value.postcode ?? ''} onChange={(e) => onChange({ postcode: e.target.value })} />
      </div>
      <div>
        <Label className="text-xs">Country</Label>
        <Input value={value.country ?? 'Australia'} onChange={(e) => onChange({ country: e.target.value })} />
      </div>
    </div>
  );
}

function buildInitial(company) {
  const d = company?.xero_contact_details ?? {};
  const fallbackAddr = company?.marketplace_default_address ?? null;
  return {
    first_name: d.first_name ?? '',
    last_name: d.last_name ?? '',
    email_address: d.email_address ?? company?.marketplace_invoice_email ?? '',
    tax_number: d.tax_number ?? '',
    website: d.website ?? '',
    account_number: d.account_number ?? '',
    currency: d.currency ?? 'AUD',
    notes: d.notes ?? '',
    phone: d.phone ?? { country_code: '61', area_code: '', number: '' },
    billing_address: d.billing_address ?? {},
    delivery_address: d.delivery_address ?? (fallbackAddr
      ? {
          line1: fallbackAddr.line1 ?? '',
          line2: fallbackAddr.line2 ?? '',
          city: fallbackAddr.suburb ?? '',
          region: fallbackAddr.state ?? '',
          postcode: fallbackAddr.postcode ?? '',
          country: 'Australia',
        }
      : {}),
    contact_persons: Array.isArray(d.contact_persons) ? d.contact_persons : [],
  };
}

function stripEmpty(form) {
  const out = {};
  for (const [k, v] of Object.entries(form)) {
    if (v === '' || v === null || v === undefined) continue;
    if (typeof v === 'object' && !Array.isArray(v)) {
      const inner = {};
      for (const [ik, iv] of Object.entries(v)) {
        if (iv === '' || iv === null || iv === undefined) continue;
        inner[ik] = iv;
      }
      if (Object.keys(inner).length > 0) out[k] = inner;
    } else if (Array.isArray(v)) {
      const arr = v.filter((p) => Object.values(p).some((x) => x !== '' && x !== null && x !== undefined && x !== false));
      if (arr.length > 0) out[k] = arr;
    } else {
      out[k] = v;
    }
  }
  return out;
}
