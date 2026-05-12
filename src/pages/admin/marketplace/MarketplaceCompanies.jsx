import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Save, Building2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { marketplaceCompaniesOptions } from '@/query/options/marketplace';
import { useUpdateCompanyMarketplace } from '@/query/mutations/marketplace';
import { toastError, toastSuccess } from '@/lib/toast';

/**
 * Per-company marketplace toggle + invoice email management.
 *
 * Default state: marketplace_enabled = false. Admin opts each customer in.
 */
export default function MarketplaceCompanies() {
  const { userProfile } = useAuth();
  const companyId = userProfile?.company_id;
  const { data: companies = [], isLoading } = useQuery(marketplaceCompaniesOptions(companyId));
  const updateCompany = useUpdateCompanyMarketplace(companyId);

  const [search, setSearch] = useState('');
  const [drafts, setDrafts] = useState({});

  const filtered = useMemo(() => {
    if (!search.trim()) return companies;
    const q = search.toLowerCase();
    return companies.filter((c) =>
      c.name?.toLowerCase().includes(q) ||
      c.email_domain?.toLowerCase().includes(q) ||
      c.slug?.toLowerCase().includes(q)
    );
  }, [companies, search]);

  const setDraft = (id, patch) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...(prev[id] ?? {}), ...patch } }));
  };

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
      await updateCompany.mutateAsync({
        targetCompanyId: company.id,
        ...draft,
      });
      setDrafts((prev) => {
        const { [company.id]: _, ...rest } = prev;
        return rest;
      });
      toastSuccess('update', `marketplace settings for ${company.name}`);
    } catch (e) {
      toastError(e, 'updating company marketplace settings');
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-md bg-primary/10 text-primary">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Customer Marketplace Access</h1>
            <p className="text-sm text-muted-foreground">
              Toggle the marketplace on or off per customer company. Disabled companies don't see the marketplace tab at all.
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Companies</CardTitle>
          <CardDescription>
            {companies.filter((c) => c.marketplace_enabled).length} of {companies.length} have marketplace access
          </CardDescription>
          <div className="mt-3 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search company name, slug, or domain…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Loading companies…</p>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No companies match.</p>
          ) : (
            <div className="divide-y">
              {filtered.map((c) => {
                const enabled = draftValue(c, 'marketplace_enabled');
                const invoiceEmail = draftValue(c, 'marketplace_invoice_email') ?? '';
                return (
                  <div key={c.id} className="py-4 first:pt-0 last:pb-0 grid grid-cols-1 md:grid-cols-12 gap-3 items-start md:items-center">
                    <div className="md:col-span-4">
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.email_domain ?? c.slug}
                        {!c.is_active && <Badge variant="secondary" className="ml-2">inactive</Badge>}
                      </p>
                    </div>
                    <div className="md:col-span-2 flex items-center gap-2">
                      <Switch
                        checked={!!enabled}
                        onCheckedChange={(v) => setDraft(c.id, { marketplace_enabled: v })}
                        disabled={!c.is_active}
                      />
                      <span className="text-sm">{enabled ? 'Enabled' : 'Disabled'}</span>
                    </div>
                    <div className="md:col-span-4">
                      <Input
                        placeholder="invoice email (optional, used in M2)"
                        type="email"
                        value={invoiceEmail}
                        onChange={(e) => setDraft(c.id, { marketplace_invoice_email: e.target.value })}
                      />
                    </div>
                    <div className="md:col-span-2 flex md:justify-end">
                      <Button
                        size="sm"
                        variant={isDirty(c) ? 'default' : 'outline'}
                        disabled={!isDirty(c) || updateCompany.isPending}
                        onClick={() => handleSave(c)}
                      >
                        <Save className="w-4 h-4 mr-1.5" />
                        Save
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
