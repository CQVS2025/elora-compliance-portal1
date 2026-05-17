import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search, Save, Building2, FileText, Loader2, Mail, Trash2,
  ShieldCheck, Power, PowerOff, Edit3, ChevronDown, ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { marketplaceCompaniesOptions } from '@/query/options/marketplace';
import {
  useUpdateCompanyMarketplace,
  useRegisterCompanyInXero,
  useUpdateCompanyXeroContact,
  useArchiveCompanyXeroContact,
} from '@/query/mutations/marketplace';
import { toastError, toastSuccess } from '@/lib/toast';
import { useConfirm } from '@/hooks/useConfirm';
import { XeroContactDialog } from '@/components/marketplace/XeroContactDialog';

/**
 * Customer Marketplace Access page.
 *
 * Each company is rendered as a self-contained card with three sections:
 *   1. Identity   — name, slug/domain, status pills
 *   2. Access     — marketplace toggle + invoice email (the "onboarding switch")
 *   3. Xero       — register / edit details / disable / delete in Xero
 *                   (gated on marketplace_enabled — onboarding flows top-down)
 *
 * Mobile: every section stacks vertically with comfortable spacing.
 * Desktop: identity + access on the left half, Xero block on the right.
 */
export default function MarketplaceCompanies() {
  const { userProfile } = useAuth();
  const companyId = userProfile?.company_id;
  const isSuperAdmin = userProfile?.role === 'super_admin';

  const { data: companies = [], isLoading } = useQuery(marketplaceCompaniesOptions(companyId));
  const updateCompany = useUpdateCompanyMarketplace(companyId);
  const registerXero = useRegisterCompanyInXero(companyId);
  const updateXeroContact = useUpdateCompanyXeroContact(companyId);
  const archiveXeroContact = useArchiveCompanyXeroContact(companyId);
  const { confirm, ConfirmDialog } = useConfirm();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | enabled | disabled | xero
  const [drafts, setDrafts] = useState({});
  const [xeroBusyId, setXeroBusyId] = useState(null);
  const [xeroDialog, setXeroDialog] = useState({ open: false, company: null, mode: 'register' });
  const [expanded, setExpanded] = useState({});
  const toggleExpanded = (id) => setExpanded((m) => ({ ...m, [id]: !m[id] }));

  // ---- Filtering / search --------------------------------------------------
  const filtered = useMemo(() => {
    let list = companies;
    if (filter === 'enabled') list = list.filter((c) => c.marketplace_enabled);
    else if (filter === 'disabled') list = list.filter((c) => !c.marketplace_enabled);
    else if (filter === 'xero') list = list.filter((c) => c.xero_invoicing_enabled);
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((c) =>
      c.name?.toLowerCase().includes(q) ||
      c.email_domain?.toLowerCase().includes(q) ||
      c.slug?.toLowerCase().includes(q)
    );
  }, [companies, filter, search]);

  const enabledCount = companies.filter((c) => c.marketplace_enabled).length;
  const xeroCount = companies.filter((c) => c.xero_invoicing_enabled).length;

  const expandAll = () => setExpanded(Object.fromEntries(filtered.map((c) => [c.id, true])));
  const collapseAll = () => setExpanded({});

  // ---- Draft helpers -------------------------------------------------------
  const setDraft = (id, patch) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...(prev[id] ?? {}), ...patch } }));

  const draftValue = (company, field) => {
    const draft = drafts[company.id];
    if (draft && field in draft) return draft[field];
    return company[field];
  };

  const isDirty = (company) => {
    const draft = drafts[company.id];
    if (!draft) return false;
    return Object.keys(draft).some((k) => draft[k] !== company[k]);
  };

  const handleSave = async (company) => {
    const draft = drafts[company.id];
    if (!draft) return;
    try {
      await updateCompany.mutateAsync({ targetCompanyId: company.id, ...draft });
      setDrafts((prev) => {
        const { [company.id]: _, ...rest } = prev;
        return rest;
      });
      toastSuccess('update', `marketplace settings for ${company.name}`);
    } catch (e) {
      toastError(e, 'updating company marketplace settings');
    }
  };

  // ---- Xero handlers -------------------------------------------------------
  const openRegisterDialog = (company) => setXeroDialog({ open: true, company, mode: 'register' });
  const openEditDialog = (company) => setXeroDialog({ open: true, company, mode: 'edit' });

  async function handleXeroDialogSave({ details }) {
    const { company, mode } = xeroDialog;
    if (!company) return;
    setXeroBusyId(company.id);
    try {
      if (mode === 'edit') {
        await updateXeroContact.mutateAsync({ targetCompanyId: company.id, details });
        toastSuccess(`Updated ${company.name} in Xero.`);
      } else {
        const res = await registerXero.mutateAsync({ targetCompanyId: company.id, enabled: true, details });
        toastSuccess(
          res?.reused
            ? `${company.name} is already registered in Xero. Invoicing re-enabled with the new details.`
            : `${company.name} registered in Xero (${res?.tenant_name ?? 'org'}).`,
        );
      }
      setXeroDialog({ open: false, company: null, mode: 'register' });
    } catch (e) {
      toastError(e, mode === 'edit' ? 'updating Xero contact' : 'registering company in Xero');
    } finally {
      setXeroBusyId(null);
    }
  }

  async function disableXero(company) {
    const ok = await confirm({
      title: `Disable Xero invoicing for ${company.name}?`,
      description: 'Future PO approvals will NOT generate a Xero invoice. The existing Xero contact link is preserved so re-enable later is just one click.',
      confirmLabel: 'Disable',
      destructive: true,
    });
    if (!ok) return;
    setXeroBusyId(company.id);
    try {
      await registerXero.mutateAsync({ targetCompanyId: company.id, enabled: false });
      toastSuccess(`Xero invoicing disabled for ${company.name}.`);
    } catch (e) {
      toastError(e, 'disabling Xero invoicing');
    } finally {
      setXeroBusyId(null);
    }
  }

  async function reenableXero(company) {
    setXeroBusyId(company.id);
    try {
      await registerXero.mutateAsync({ targetCompanyId: company.id, enabled: true });
      toastSuccess(`Xero invoicing re-enabled for ${company.name}.`);
    } catch (e) {
      toastError(e, 'enabling Xero invoicing');
    } finally {
      setXeroBusyId(null);
    }
  }

  async function deleteFromXero(company) {
    const ok = await confirm({
      title: `Remove ${company.name} from Xero?`,
      description: 'The Xero contact will be ARCHIVED on Xero (soft-delete; Xero never hard-deletes contacts). The local link is cleared so this company returns to "Not in Xero" state. Past invoices for this contact stay intact in Xero.',
      confirmLabel: 'Remove from Xero',
      destructive: true,
    });
    if (!ok) return;
    setXeroBusyId(company.id);
    try {
      const res = await archiveXeroContact.mutateAsync({ targetCompanyId: company.id });
      if (res?.xero_archived) {
        toastSuccess(`${company.name} archived in Xero and unlinked locally.`);
      } else if (res?.upstream_error) {
        toastSuccess(`Local link cleared. Xero archive failed: ${res.upstream_error}`);
      } else {
        toastSuccess(`${company.name} unlinked from Xero.`);
      }
    } catch (e) {
      toastError(e, 'removing company from Xero');
    } finally {
      setXeroBusyId(null);
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-md bg-primary/10 text-primary shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Customer Marketplace Access</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Onboard buyers in two steps: turn on marketplace access, then register them in Xero so invoices can fire.
            </p>
          </div>
        </div>
        {/* Stat strip */}
        <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
          <Stat label="Total" value={companies.length} />
          <Stat label="Marketplace on" value={enabledCount} accent="emerald" />
          <Stat label="Xero on" value={xeroCount} accent="violet" />
        </div>
      </div>

      {/* Toolbar */}
      <Card className="mb-4">
        <CardContent className="pt-4 pb-3 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search company name, slug, or domain…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList className="grid grid-cols-4 w-full sm:w-auto sm:inline-grid">
              <TabsTrigger value="all">All ({companies.length})</TabsTrigger>
              <TabsTrigger value="enabled">On ({enabledCount})</TabsTrigger>
              <TabsTrigger value="disabled">Off ({companies.length - enabledCount})</TabsTrigger>
              <TabsTrigger value="xero">Xero ({xeroCount})</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {/* Companies list */}
      {isLoading ? (
        <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">Loading companies…</CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">No companies match.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          <div className="flex justify-end gap-1.5">
            <Button size="sm" variant="ghost" onClick={expandAll} className="text-xs">
              <ChevronDown className="w-3.5 h-3.5 mr-1" /> Expand all
            </Button>
            <Button size="sm" variant="ghost" onClick={collapseAll} className="text-xs">
              <ChevronRight className="w-3.5 h-3.5 mr-1" /> Collapse all
            </Button>
          </div>
          {filtered.map((c) => (
            <CompanyCard
              key={c.id}
              c={c}
              isSuperAdmin={isSuperAdmin}
              draftValue={draftValue}
              setDraft={setDraft}
              isDirty={isDirty}
              onSave={handleSave}
              saving={updateCompany.isPending}
              xeroBusy={xeroBusyId === c.id}
              onRegister={openRegisterDialog}
              onEdit={openEditDialog}
              onDisable={disableXero}
              onReenable={reenableXero}
              onDelete={deleteFromXero}
              isExpanded={!!expanded[c.id]}
              onToggle={() => toggleExpanded(c.id)}
            />
          ))}
        </div>
      )}

      {ConfirmDialog}

      <XeroContactDialog
        open={xeroDialog.open}
        onOpenChange={(o) => setXeroDialog((d) => ({ ...d, open: o }))}
        company={xeroDialog.company}
        mode={xeroDialog.mode}
        busy={xeroBusyId === xeroDialog.company?.id}
        onSave={handleXeroDialogSave}
      />
    </div>
  );
}

// ----------------------------------------------------------------------------

function Stat({ label, value, accent }) {
  const accentMap = {
    emerald: 'text-emerald-700 dark:text-emerald-300',
    violet: 'text-violet-700 dark:text-violet-300',
  };
  return (
    <div className="rounded-md border border-border bg-background p-2.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
      <p className={`text-lg font-semibold mt-0.5 ${accent ? accentMap[accent] : ''}`}>{value}</p>
    </div>
  );
}

function CompanyCard({
  c, isSuperAdmin, draftValue, setDraft, isDirty, onSave, saving,
  xeroBusy, onRegister, onEdit, onDisable, onReenable, onDelete,
  isExpanded, onToggle,
}) {
  const enabled = !!draftValue(c, 'marketplace_enabled');
  const invoiceEmail = draftValue(c, 'marketplace_invoice_email') ?? '';
  const xeroEnabled = !!c.xero_invoicing_enabled;
  const xeroLinked = !!c.xero_contact_id;
  const dirty = isDirty(c);

  // Onboarding gate: cannot register in Xero until marketplace access is
  // saved as ON. Draft state alone doesn't count — the row must be committed.
  const marketplaceSavedOn = !!c.marketplace_enabled;
  const canTouchXero = isSuperAdmin && c.is_active && marketplaceSavedOn;

  return (
    <Card className={`overflow-hidden ${enabled ? 'border-emerald-200/70 dark:border-emerald-900/40' : ''}`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-start justify-between gap-3 flex-wrap p-4 sm:p-5 text-left hover:bg-muted/40 transition-colors"
        aria-expanded={isExpanded}
      >
        <div className="flex items-start gap-2 min-w-0">
          <span className="mt-0.5 text-muted-foreground shrink-0">
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-base truncate">{c.name}</p>
              {!c.is_active && <Badge variant="secondary">inactive</Badge>}
              {dirty && <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">unsaved</Badge>}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate">
              {c.email_domain ?? c.slug ?? '-'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {enabled
            ? <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                <Power className="w-3 h-3 mr-1" /> Marketplace
              </Badge>
            : <Badge variant="outline" className="text-muted-foreground">
                <PowerOff className="w-3 h-3 mr-1" /> Marketplace off
              </Badge>}
          {xeroEnabled
            ? <Badge variant="outline" className="border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300">
                <ShieldCheck className="w-3 h-3 mr-1" /> Xero on
              </Badge>
            : xeroLinked
              ? <Badge variant="outline" className="text-muted-foreground">Xero linked, off</Badge>
              : <Badge variant="outline" className="text-muted-foreground">Not in Xero</Badge>}
        </div>
      </button>
      {isExpanded && (
      <CardContent className="px-4 sm:px-5 pb-4 sm:pb-5 pt-0 space-y-4">
        {/* Two-column body on desktop; stacked on mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* LEFT — Access controls */}
          <div className="rounded-md border border-border bg-muted/20 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Power className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-sm font-medium">Marketplace access</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{enabled ? 'On' : 'Off'}</span>
                <Switch
                  checked={enabled}
                  onCheckedChange={(v) => setDraft(c.id, { marketplace_enabled: v })}
                  disabled={!c.is_active}
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground flex items-center gap-1.5 mb-1">
                <Mail className="w-3 h-3" /> Invoice email <span className="opacity-60">(optional)</span>
              </label>
              <Input
                type="email"
                placeholder="ap@buyer.com"
                value={invoiceEmail}
                onChange={(e) => setDraft(c.id, { marketplace_invoice_email: e.target.value })}
                className="h-9 text-sm"
              />
            </div>
            <div className="flex justify-end">
              <Button
                size="sm"
                variant={dirty ? 'default' : 'outline'}
                disabled={!dirty || saving}
                onClick={() => onSave(c)}
                className="w-full sm:w-auto"
              >
                <Save className="w-3.5 h-3.5 mr-1.5" />
                {dirty ? 'Save changes' : 'Saved'}
              </Button>
            </div>
          </div>

          {/* RIGHT — Xero controls */}
          <div className={`rounded-md border p-3 space-y-3 ${canTouchXero ? 'border-border bg-muted/20' : 'border-dashed border-border bg-muted/10'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-sm font-medium">Xero invoicing</span>
              </div>
              {!isSuperAdmin && (
                <span className="text-[11px] italic text-muted-foreground">super_admin only</span>
              )}
            </div>

            {!marketplaceSavedOn && (
              <p className="text-[11px] text-muted-foreground italic leading-relaxed">
                Enable <strong>Marketplace access</strong> first (and click Save). You can only push a buyer to Xero after they're onboarded into the marketplace.
              </p>
            )}

            {marketplaceSavedOn && !xeroLinked && (
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                This buyer is not yet a contact in your Xero org. Register them with their ABN, address, primary person etc. Invoices will then fire automatically on PO approval.
              </p>
            )}

            {marketplaceSavedOn && xeroLinked && (
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Linked contact ID: <span className="font-mono text-foreground">{c.xero_contact_id}</span>
              </p>
            )}

            {/* Actions */}
            {isSuperAdmin && (
              <div className="flex flex-wrap gap-1.5">
                {!xeroLinked && (
                  <Button
                    size="sm"
                    disabled={!canTouchXero || xeroBusy}
                    onClick={() => onRegister(c)}
                    className="flex-1 sm:flex-none"
                  >
                    {xeroBusy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />}
                    Register in Xero
                  </Button>
                )}
                {xeroLinked && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!canTouchXero || xeroBusy}
                      onClick={() => onEdit(c)}
                    >
                      <Edit3 className="w-3.5 h-3.5 mr-1.5" /> Edit details
                    </Button>
                    {xeroEnabled ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canTouchXero || xeroBusy}
                        onClick={() => onDisable(c)}
                      >
                        {xeroBusy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <PowerOff className="w-3.5 h-3.5 mr-1.5" />}
                        Pause
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canTouchXero || xeroBusy}
                        onClick={() => onReenable(c)}
                      >
                        {xeroBusy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Power className="w-3.5 h-3.5 mr-1.5" />}
                        Resume
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!isSuperAdmin || xeroBusy}
                      onClick={() => onDelete(c)}
                      className="text-rose-600 hover:text-rose-700 border-rose-200 dark:border-rose-900 dark:text-rose-400"
                    >
                      {xeroBusy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />}
                      Remove
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
      )}
    </Card>
  );
}
