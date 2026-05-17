import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Receipt, ChevronRight, Package } from 'lucide-react';
import DataPagination from '@/components/ui/DataPagination';

const PAGE_SIZE = 10;
import { useAuth } from '@/lib/AuthContext';
import { buyerOrdersOptions } from '@/query/options/marketplace';
import { formatAUD } from '@/lib/marketplaceFormat';
import { MarketplaceEmpty } from '@/components/marketplace/MarketplaceEmpty';
import { OrderStatusBadge } from '@/components/marketplace/OrderStatusBadge';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending_approval', label: 'Pending approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'paid', label: 'Paid' },
  { value: 'dispatched', label: 'Dispatched' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

/**
 * Buyer-side order history for the user's company. Lists all orders the
 * company has placed, with status badges, totals, and a click-through to a
 * full detail page.
 */
export default function MarketplaceOrders() {
  const { userProfile } = useAuth();
  const companyId = userProfile?.company_id;
  const { data: orders = [], isLoading } = useQuery(buyerOrdersOptions(companyId));

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let list = orders;
    if (statusFilter !== 'all') list = list.filter((o) => o.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((o) => o.order_number?.toLowerCase().includes(q));
    }
    return list;
  }, [orders, statusFilter, search]);

  useEffect(() => { setPage(1); }, [statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage]
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex items-start gap-3">
        <div className="p-2 rounded-md bg-primary/10 text-primary">
          <Receipt className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">My orders</h1>
          <p className="text-sm text-muted-foreground">
            All orders placed by your company. Click into any order for line items, status updates and tracking.
          </p>
        </div>
      </div>

      <Card className="mb-5">
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-7 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by order number (e.g. EL-2026-00001)"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="md:col-span-5">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Loading your orders…</p>
      ) : filtered.length === 0 ? (
        <MarketplaceEmpty
          title={search || statusFilter !== 'all' ? 'No orders match.' : 'No orders yet.'}
          description={search || statusFilter !== 'all'
            ? 'Try clearing the filters.'
            : 'When your company places an order, it shows up here.'}
          action={(
            <Button asChild variant={search || statusFilter !== 'all' ? 'outline' : 'default'}>
              <Link to="/marketplace">Browse marketplace</Link>
            </Button>
          )}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {paged.map((o) => (
                <Link
                  key={o.id}
                  to={`/marketplace/orders/${o.id}`}
                  className="flex items-center gap-3 px-4 py-4 hover:bg-muted/40 transition-colors"
                >
                  <Package className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">{o.order_number}</p>
                      <OrderStatusBadge status={o.status} />
                      <span className="text-xs text-muted-foreground">
                        {new Date(o.created_at).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {o.payment_method === 'purchase_order' ? 'Purchase Order' : 'Stripe card payment'}
                      {o.supplier_dispatch_date && ` • Dispatched ${new Date(o.supplier_dispatch_date).toLocaleDateString('en-AU')}`}
                      {o.supplier_eta_date && ` • ETA ${new Date(o.supplier_eta_date).toLocaleDateString('en-AU')}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold">{formatAUD(o.total_amount)}</p>
                    <p className="text-[11px] text-muted-foreground uppercase">{o.currency ?? 'AUD'} inc. GST</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
            <div className="px-4 pb-4">
              <DataPagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filtered.length}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
