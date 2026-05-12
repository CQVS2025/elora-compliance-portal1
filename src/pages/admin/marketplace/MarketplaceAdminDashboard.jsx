import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Store, Package, Building2, Warehouse, BadgeDollarSign, ShieldCheck, AlertTriangle, Save } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import {
  adminProductListOptions,
  marketplaceCompaniesOptions,
  warehousesOptions,
  marketplaceSettingsOptions,
} from '@/query/options/marketplace';
import { useUpdateMarketplaceSettings } from '@/query/mutations/marketplace';
import { isSuperAdmin } from '@/lib/permissions';
import { toastError, toastSuccess } from '@/lib/toast';

/**
 * Marketplace Admin landing page.
 *
 * - For super_admins: shows a "Marketplace ownership" panel at the top with
 *   the current seller company. If not yet designated, prompts them to pick
 *   one. Until this is set, only super_admins (and explicit user_permissions
 *   grants) can administer the marketplace.
 * - 2x2 grid of cards linking to Products / Customer Pricing / Customer
 *   Access / Warehouses with quick stats.
 */
export default function MarketplaceAdminDashboard() {
  const { userProfile } = useAuth();
  const companyId = userProfile?.company_id;
  const userIsSuperAdmin = isSuperAdmin(userProfile);

  const { data: products = [] } = useQuery(adminProductListOptions(companyId));
  const { data: companies = [] } = useQuery(marketplaceCompaniesOptions(companyId));
  const { data: warehouses = [] } = useQuery(warehousesOptions(companyId));
  const { data: settings } = useQuery(marketplaceSettingsOptions());

  const enabledCompanies = companies.filter((c) => c.marketplace_enabled).length;
  const activeProducts = products.filter((p) => p.is_active).length;

  const sections = [
    {
      title: 'Products',
      description: 'Catalogue, packaging, hazard info, SDS, photos.',
      href: '/admin/marketplace/products',
      icon: Package,
      stat: `${activeProducts}/${products.length}`,
      statLabel: 'active',
    },
    {
      title: 'Customer Pricing',
      description: 'Per-customer price overrides per packaging size.',
      href: '/admin/marketplace/pricing',
      icon: BadgeDollarSign,
      stat: `${enabledCompanies}`,
      statLabel: 'enabled customers',
    },
    {
      title: 'Customer Access',
      description: 'Toggle marketplace on/off and set invoice email per customer.',
      href: '/admin/marketplace/companies',
      icon: Building2,
      stat: `${companies.length}`,
      statLabel: 'companies',
    },
    {
      title: 'Warehouses',
      description: 'Warehouse setup and dispatch staff. Multi-warehouse-ready.',
      href: '/admin/marketplace/warehouses',
      icon: Warehouse,
      stat: `${warehouses.filter((w) => w.is_active).length}`,
      statLabel: 'active',
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8 flex items-start gap-4">
        <div className="p-3 rounded-lg bg-primary/10 text-primary">
          <Store className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Marketplace</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage the in-portal marketplace: products, pricing, customer access, and warehouses.
          </p>
        </div>
      </div>

      {/* Marketplace ownership — visible to super_admins only */}
      {userIsSuperAdmin && (
        <SellerCompanyPanel
          settings={settings}
          companies={companies}
          className="mb-5"
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
        {sections.map(({ title, description, href, icon: Icon, stat, statLabel }) => (
          <Link key={href} to={href} className="block group">
            <Card className="transition-shadow hover:shadow-apple-md h-full">
              <CardHeader className="flex flex-row items-start gap-3 space-y-0">
                <div className="p-2 rounded-md bg-muted text-foreground/80 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base">{title}</CardTitle>
                  <CardDescription className="text-sm mt-0.5">{description}</CardDescription>
                </div>
                <div className="text-right">
                  <p className="text-xl font-semibold">{stat}</p>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{statLabel}</p>
                </div>
              </CardHeader>
              <CardContent />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

/**
 * Panel that shows the designated seller company and lets the super_admin
 * change it.
 *
 *  - When seller_company_id IS NULL → red-bordered alert urging them to pick.
 *  - When set → green-bordered confirmation with an "Edit" toggle to change.
 */
function SellerCompanyPanel({ settings, companies, className }) {
  const sellerId = settings?.seller_company_id ?? null;
  const sellerCompany = companies.find((c) => c.id === sellerId) ?? null;

  const [editing, setEditing] = useState(!sellerId); // start open when unset
  const [picked, setPicked] = useState(sellerId ?? '');

  const update = useUpdateMarketplaceSettings();

  const handleSave = async () => {
    if (!picked) {
      toastError(new Error('Choose a company before saving.'), 'designating seller');
      return;
    }
    try {
      await update.mutateAsync({ seller_company_id: picked });
      toastSuccess('update', 'marketplace seller company');
      setEditing(false);
    } catch (e) {
      toastError(e, 'designating seller company');
    }
  };

  if (!sellerId && !editing) {
    setEditing(true);
  }

  if (sellerId && !editing) {
    return (
      <Card
        className={`border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30 ${className ?? ''}`}
      >
        <CardContent className="py-4 flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-700 dark:text-emerald-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm">
              <span className="text-muted-foreground">Marketplace seller company: </span>
              <strong>{sellerCompany?.name ?? 'Unknown'}</strong>
              {sellerCompany?.is_active === false && (
                <Badge variant="secondary" className="ml-2">inactive</Badge>
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Admins of this company are marketplace administrators. Admins of any other company are buyers, not marketplace admins.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setEditing(true); setPicked(sellerId); }}
          >
            Change
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Editing or unset: designation form
  const isFirstTime = !sellerId;
  return (
    <Card
      className={`${isFirstTime
        ? 'border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/30'
        : 'border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/30'} ${className ?? ''}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start gap-2">
          {isFirstTime
            ? <AlertTriangle className="w-5 h-5 text-amber-700 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            : <ShieldCheck className="w-5 h-5 text-blue-700 dark:text-blue-400 mt-0.5 flex-shrink-0" />}
          <div>
            <CardTitle className="text-base">
              {isFirstTime ? 'Designate the marketplace seller company' : 'Change marketplace seller company'}
            </CardTitle>
            <CardDescription className="mt-0.5">
              {isFirstTime
                ? 'Choose the company that owns the marketplace. Until this is set, only super_admins can administer products, pricing, and warehouses. Admins of buyer companies are NOT marketplace admins.'
                : 'Switching the seller company immediately changes who is a marketplace admin. Admins of the new company gain access on next login; admins of the old one lose it.'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={picked} onValueChange={setPicked}>
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="Choose a company…" />
            </SelectTrigger>
            <SelectContent>
              {companies.length === 0 ? (
                <div className="p-2 text-xs text-muted-foreground">No companies in the system yet.</div>
              ) : companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}{c.is_active === false ? ' (inactive)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleSave} disabled={update.isPending || !picked}>
            <Save className="w-4 h-4 mr-1.5" /> Save
          </Button>
          {sellerId && (
            <Button variant="ghost" onClick={() => { setEditing(false); setPicked(sellerId); }}>
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
