import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings as SettingsIcon, Save, Loader2, DollarSign, Percent, Mail, Phone, Building2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { marketplaceSettingsOptions } from '@/query/options/marketplace';
import { useUpdateMarketplaceSettings } from '@/query/mutations/marketplace';
import { toastError, toastSuccess } from '@/lib/toast';

/**
 * Marketplace settings page (singleton config row).
 *
 * Matches the spirit of Chem Connect's Business Settings page: currency, GST
 * rate, MOQ, payment terms, support contact, platform display name. Each
 * row that ends up rendered in checkout / emails reads from here instead of
 * being hardcoded.
 *
 * Super_admin only (UI gate; RLS on the table also restricts writes).
 */
export default function MarketplaceSettings() {
  const { userProfile } = useAuth();
  const isSuperAdmin = userProfile?.role === 'super_admin';
  const { data, isLoading } = useQuery(marketplaceSettingsOptions());
  const update = useUpdateMarketplaceSettings();

  const [form, setForm] = useState(null);
  useEffect(() => {
    if (data) {
      setForm({
        platform_name: data.platform_name ?? 'Elora Marketplace',
        support_email: data.support_email ?? '',
        support_phone: data.support_phone ?? '',
        currency: data.currency ?? 'AUD',
        gst_rate: Number(data.gst_rate ?? 0.10),
        min_order_amount: Number(data.min_order_amount ?? 0),
        default_payment_terms_days: Number(data.default_payment_terms_days ?? 30),
        early_access_capacity: Number(data.early_access_capacity ?? 0),
      });
    }
  }, [data]);

  const isDirty = data && form && Object.keys(form).some((k) => {
    if (k === 'gst_rate' || k === 'min_order_amount' || k === 'default_payment_terms_days' || k === 'early_access_capacity') {
      return Number(form[k]) !== Number(data[k] ?? 0);
    }
    return (form[k] ?? '') !== (data[k] ?? '');
  });

  async function save() {
    if (!form) return;
    if (!isSuperAdmin) return toastError(new Error('Super admin only.'));
    try {
      await update.mutateAsync({
        platform_name: form.platform_name.trim() || 'Elora Marketplace',
        support_email: form.support_email.trim() || null,
        support_phone: form.support_phone.trim() || null,
        currency: form.currency.trim().toUpperCase() || 'AUD',
        gst_rate: Number(form.gst_rate),
        min_order_amount: Number(form.min_order_amount) || 0,
        default_payment_terms_days: Math.max(0, Math.floor(Number(form.default_payment_terms_days))) || 30,
        early_access_capacity: Math.max(0, Math.floor(Number(form.early_access_capacity))) || 0,
      });
      toastSuccess('update', 'marketplace settings');
    } catch (e) {
      toastError(e, 'saving settings');
    }
  }

  if (isLoading || !form) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">Loading settings…</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-md bg-primary/10 text-primary shrink-0"><SettingsIcon className="w-5 h-5" /></div>
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Marketplace settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Platform-wide configuration. Changes apply to every new order and email.
          </p>
        </div>
      </div>

      {!isSuperAdmin && (
        <Card>
          <CardContent className="py-3 text-xs italic text-muted-foreground">
            View-only. Only Elora super_admin can change these values.
          </CardContent>
        </Card>
      )}

      {/* Platform */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Building2 className="w-4 h-4" /> Platform</CardTitle>
          <CardDescription>Display name and admin contact details shown on receipts, emails, and the buyer footer.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label="Platform name">
            <Input
              value={form.platform_name}
              onChange={(e) => setForm({ ...form, platform_name: e.target.value })}
              disabled={!isSuperAdmin}
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Support email" icon={<Mail className="w-3 h-3" />}>
              <Input
                type="email"
                placeholder="support@elora.com"
                value={form.support_email}
                onChange={(e) => setForm({ ...form, support_email: e.target.value })}
                disabled={!isSuperAdmin}
              />
            </Field>
            <Field label="Support phone" icon={<Phone className="w-3 h-3" />}>
              <Input
                placeholder="+61 2 0000 0000"
                value={form.support_phone}
                onChange={(e) => setForm({ ...form, support_phone: e.target.value })}
                disabled={!isSuperAdmin}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Business */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><DollarSign className="w-4 h-4" /> Business</CardTitle>
          <CardDescription>Currency, tax, minimum order, and payment terms applied to every order.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Currency (ISO 4217)">
              <Input
                value={form.currency}
                maxLength={3}
                onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase().slice(0, 3) })}
                disabled={!isSuperAdmin}
              />
              <p className="text-[11px] text-muted-foreground mt-0.5">e.g. AUD, USD, NZD. Used on invoices and the order summary.</p>
            </Field>
            <Field label="GST rate" icon={<Percent className="w-3 h-3" />}>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  max="1"
                  value={form.gst_rate}
                  onChange={(e) => setForm({ ...form, gst_rate: e.target.value })}
                  disabled={!isSuperAdmin}
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  = {(Number(form.gst_rate || 0) * 100).toFixed(1)}%
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Stored as a decimal. 0.10 = 10% Australian GST.</p>
            </Field>
            <Field label="Min order subtotal (ex-GST)">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.min_order_amount}
                onChange={(e) => setForm({ ...form, min_order_amount: e.target.value })}
                disabled={!isSuperAdmin}
              />
              <p className="text-[11px] text-muted-foreground mt-0.5">0 = no minimum. Buyers whose cart subtotal is below this can't check out.</p>
            </Field>
            <Field label="Default payment terms (days)">
              <Input
                type="number"
                step="1"
                min="0"
                value={form.default_payment_terms_days}
                onChange={(e) => setForm({ ...form, default_payment_terms_days: e.target.value })}
                disabled={!isSuperAdmin}
              />
              <p className="text-[11px] text-muted-foreground mt-0.5">Used as the Xero invoice DueDate offset for PO orders.</p>
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="sticky bottom-4 sm:bottom-6 z-10">
        <Card className="border-primary/30">
          <CardContent className="py-3 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-muted-foreground">
              {isDirty ? 'You have unsaved changes.' : 'All changes saved.'}
            </p>
            <Button onClick={save} disabled={!isDirty || update.isPending || !isSuperAdmin}>
              {update.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
              Save settings
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, icon, children }) {
  return (
    <div>
      <Label className="text-xs flex items-center gap-1.5">{icon}{label}</Label>
      {children}
    </div>
  );
}
