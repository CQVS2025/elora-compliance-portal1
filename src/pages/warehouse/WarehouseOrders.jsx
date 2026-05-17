import React, { useEffect, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Truck, Save, Check, MapPin, Loader2, Warehouse as WarehouseIcon } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { warehouseOrdersOptions } from '@/query/options/marketplace';
import { useUpdateOrderFulfilment } from '@/query/mutations/marketplace';
import { toastError, toastSuccess } from '@/lib/toast';
import { OrderStatusBadge } from '@/components/marketplace/OrderStatusBadge';
import { SiteAccessAnswers } from '@/components/marketplace/SiteAccessAnswers';

/**
 * Warehouse-user dispatch dashboard.
 *
 * The user only sees orders for the warehouse they're mapped to (via
 * marketplace_warehouse_users). They can record dispatch / ETA / tracking
 * and update status to dispatched/delivered.
 *
 * Prices, customer pricing, and other commercial data are NOT shown.
 */
export default function WarehouseOrders() {
  const { userProfile, user } = useAuth();
  const companyId = userProfile?.company_id;
  const [warehouseId, setWarehouseId] = useState(null);

  // Resolve the user's warehouse mapping
  useEffect(() => {
    let alive = true;
    if (user?.id) {
      supabase
        .from('marketplace_warehouse_users')
        .select('warehouse_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()
        .then(({ data }) => { if (alive) setWarehouseId(data?.warehouse_id ?? null); });
    }
    return () => { alive = false; };
  }, [user?.id]);

  const { data: orders = [], isLoading } = useQuery(warehouseOrdersOptions(companyId, warehouseId));
  const fulfilment = useUpdateOrderFulfilment(companyId);

  const [tab, setTab] = useState('approved');
  const filtered = useMemo(
    () => (tab === 'all' ? orders : orders.filter((o) => o.status === tab)),
    [orders, tab]
  );

  const counts = useMemo(() => {
    const c = { all: orders.length };
    for (const o of orders) c[o.status] = (c[o.status] ?? 0) + 1;
    return c;
  }, [orders]);

  if (!warehouseId) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card>
          <CardContent className="py-12 text-center">
            <WarehouseIcon className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-base font-medium mb-1">No warehouse assigned</p>
            <p className="text-sm text-muted-foreground">Ask Elora admin to map your user to a warehouse before you can see orders here.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-start gap-3">
        <div className="p-2 rounded-md bg-primary/10 text-primary"><Truck className="w-5 h-5" /></div>
        <div>
          <h1 className="text-xl font-semibold">Warehouse dispatch</h1>
          <p className="text-sm text-muted-foreground">
            Orders assigned to your warehouse. Update dispatch, ETA, and tracking; buyers are notified automatically.
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList>
          <TabsTrigger value="approved">Awaiting dispatch {counts.approved ? <Badge variant="secondary" className="ml-1 text-[10px]">{counts.approved}</Badge> : null}</TabsTrigger>
          <TabsTrigger value="paid">Paid {counts.paid ? <Badge variant="secondary" className="ml-1 text-[10px]">{counts.paid}</Badge> : null}</TabsTrigger>
          <TabsTrigger value="dispatched">In transit {counts.dispatched ? <Badge variant="secondary" className="ml-1 text-[10px]">{counts.dispatched}</Badge> : null}</TabsTrigger>
          <TabsTrigger value="delivered">Delivered {counts.delivered ? <Badge variant="secondary" className="ml-1 text-[10px]">{counts.delivered}</Badge> : null}</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No orders in this tab.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => (
            <WarehouseOrderCard key={o.id} order={o} fulfilment={fulfilment} />
          ))}
        </div>
      )}
    </div>
  );
}

function WarehouseOrderCard({ order, fulfilment }) {
  const [edit, setEdit] = useState({
    supplier_dispatch_date: order.supplier_dispatch_date ?? '',
    supplier_eta_date: order.supplier_eta_date ?? '',
    supplier_tracking_carrier: order.supplier_tracking_carrier ?? '',
    supplier_tracking_url: order.supplier_tracking_url ?? '',
    supplier_notes: order.supplier_notes ?? '',
  });
  const [expanded, setExpanded] = useState(order.status === 'approved' || order.status === 'paid');

  const save = async (extra = {}) => {
    try {
      await fulfilment.mutateAsync({ order_id: order.id, ...edit, ...extra });
      toastSuccess('update', 'fulfilment');
    } catch (e) {
      toastError(e, 'saving');
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              {order.order_number}
              <OrderStatusBadge status={order.status} />
            </CardTitle>
            <CardDescription className="flex items-center gap-1 mt-1">
              <MapPin className="w-3 h-3" />
              {order.delivery_address?.suburb} {order.delivery_address?.state} {order.delivery_postcode}
              {order.delivery_contact_name && ` • ${order.delivery_contact_name}`}
              {order.delivery_contact_phone && ` • ${order.delivery_contact_phone}`}
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'Hide' : 'Update'}
          </Button>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <Field label="Dispatch date">
              <Input type="date" value={edit.supplier_dispatch_date ?? ''} onChange={(e) => setEdit({ ...edit, supplier_dispatch_date: e.target.value || null })} />
            </Field>
            <Field label="ETA">
              <Input type="date" value={edit.supplier_eta_date ?? ''} onChange={(e) => setEdit({ ...edit, supplier_eta_date: e.target.value || null })} />
            </Field>
            <Field label="Carrier">
              <Input value={edit.supplier_tracking_carrier ?? ''} onChange={(e) => setEdit({ ...edit, supplier_tracking_carrier: e.target.value })} />
            </Field>
            <Field label="Tracking URL">
              <Input value={edit.supplier_tracking_url ?? ''} onChange={(e) => setEdit({ ...edit, supplier_tracking_url: e.target.value })} placeholder="https://…" />
            </Field>
            <Field label="Notes for buyer" full>
              <Textarea rows={2} value={edit.supplier_notes ?? ''} onChange={(e) => setEdit({ ...edit, supplier_notes: e.target.value })} />
            </Field>
          </div>
          {order.delivery_notes && (
            <div className="mt-3 p-3 rounded bg-muted/40 text-xs">
              <p className="font-medium mb-1">Buyer's delivery notes</p>
              <p className="text-muted-foreground whitespace-pre-line">{order.delivery_notes}</p>
            </div>
          )}
          {order.site_access_answers && Object.keys(order.site_access_answers).length > 0 && (
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer text-muted-foreground">Site-access answers</summary>
              <div className="mt-2 bg-muted/40 p-3 rounded">
                <SiteAccessAnswers answers={order.site_access_answers} productIds={[]} />
              </div>
            </details>
          )}
          <div className="flex justify-end gap-2 pt-3">
            {(order.status === 'approved' || order.status === 'paid') && edit.supplier_dispatch_date && (
              <Button variant="outline" onClick={() => save({ status: 'dispatched' })} disabled={fulfilment.isPending}>
                {fulfilment.isPending
                  ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  : <Truck className="w-4 h-4 mr-1.5" />}
                Mark dispatched
              </Button>
            )}
            {order.status === 'dispatched' && (
              <Button variant="outline" onClick={() => save({ status: 'delivered' })} disabled={fulfilment.isPending}>
                {fulfilment.isPending
                  ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  : <Check className="w-4 h-4 mr-1.5" />}
                Mark delivered
              </Button>
            )}
            <Button onClick={() => save()} disabled={fulfilment.isPending}>
              {fulfilment.isPending
                ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                : <Save className="w-4 h-4 mr-1.5" />}
              Save
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function Field({ label, full = false, children }) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
