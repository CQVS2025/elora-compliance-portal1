import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, ChevronRight, ShoppingBag, AlertCircle } from 'lucide-react';
import DataPagination from '@/components/ui/DataPagination';

const PAGE_SIZE = 10;
import { useAuth } from '@/lib/AuthContext';
import { adminOrdersOptions } from '@/query/options/marketplace';
import { formatAUD } from '@/lib/marketplaceFormat';
import { OrderStatusBadge } from '@/components/marketplace/OrderStatusBadge';

const TABS = [
  { value: 'pending_approval', label: 'Pending approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'paid', label: 'Paid' },
  { value: 'dispatched', label: 'Dispatched' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'all', label: 'All' },
];

export default function MarketplaceAdminOrders() {
  const { userProfile } = useAuth();
  const companyId = userProfile?.company_id;
  const { data: allOrders = [], isLoading } = useQuery(adminOrdersOptions(companyId));

  const [tab, setTab] = useState('pending_approval');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const counts = useMemo(() => {
    const c = { all: allOrders.length };
    for (const o of allOrders) c[o.status] = (c[o.status] ?? 0) + 1;
    return c;
  }, [allOrders]);

  const filtered = useMemo(() => {
    let list = tab === 'all' ? allOrders : allOrders.filter((o) => o.status === tab);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (o) =>
          o.order_number?.toLowerCase().includes(q) ||
          o.buyer_company?.name?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [allOrders, tab, search]);

  useEffect(() => { setPage(1); }, [tab, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage]
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-start gap-3">
        <div className="p-2 rounded-md bg-primary/10 text-primary">
          <ShoppingBag className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Orders</h1>
          <p className="text-sm text-muted-foreground">
            Approve POs, review payments, and track fulfilment across every order.
          </p>
        </div>
      </div>

      {counts.pending_approval > 0 && (
        <Card className="mb-4 border-amber-300 bg-amber-50/40 dark:border-amber-800 dark:bg-amber-950/20">
          <CardContent className="py-3 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0" />
            <p className="text-sm">
              <strong>{counts.pending_approval}</strong> order{counts.pending_approval === 1 ? '' : 's'} awaiting your review.
            </p>
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
              {t.label}
              {counts[t.value] != null && counts[t.value] > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{counts[t.value]}</Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search order number or customer name"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Loading orders…</p>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No orders match this filter.</p>
          ) : (
            <div className="divide-y">
              {paged.map((o) => (
                <Link
                  key={o.id}
                  to={`/admin/marketplace/orders/${o.id}`}
                  className="flex items-center gap-3 px-4 py-4 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">{o.order_number}</p>
                      <OrderStatusBadge status={o.status} />
                      <Badge variant="outline" className="text-[10px]">
                        {o.payment_method === 'purchase_order' ? 'PO' : 'Stripe'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {o.buyer_company?.name ?? 'Unknown company'} • {new Date(o.created_at).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}
                      {o.delivery_postcode && ` • Postcode ${o.delivery_postcode}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold">{formatAUD(o.total_amount)}</p>
                    <p className="text-[11px] text-muted-foreground uppercase">{o.currency ?? 'AUD'} inc.</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
          {!isLoading && filtered.length > 0 && (
            <div className="px-4 pb-4">
              <DataPagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filtered.length}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
