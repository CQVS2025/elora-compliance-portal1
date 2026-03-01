import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import { Package, ShoppingCart, ClipboardList, Loader2, Check, X, Download, User, FileCheck, ChevronDown, ChevronUp, List, LayoutGrid } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  allPartsOptions,
  partRequestsOptions,
  orderRequestsOptions,
  orderRequestWithItemsOptions,
  agentStockOptions,
  stockTakesOptions,
  stockTakeWithItemsOptions,
} from '@/query/options';
import { queryKeys } from '@/query/keys';
import { toast } from '@/lib/toast';
import { edgeFetch } from '@/api/edgeFetch';

const PART_IMAGES_BUCKET = 'part-images';

function partImageUrl(part) {
  if (!part?.image_path) return null;
  const { data } = supabase.storage.from(PART_IMAGES_BUCKET).getPublicUrl(part.image_path);
  return data?.publicUrl ?? null;
}

/** Agent view: Stock Take (Current Stock + Need to Order per part), Request Parts (multi-line + priority) */
function AgentView({ userProfile }) {
  const queryClient = useQueryClient();
  const companyId = userProfile?.company_id ?? null;
  const userId = userProfile?.id;

  const [stockTakeLocal, setStockTakeLocal] = useState({}); // part_id -> { current_stock_qty, need_to_order }
  const [requestSearch, setRequestSearch] = useState('');
  const [requestQuantities, setRequestQuantities] = useState({}); // part_id -> qty
  const [requestPriority, setRequestPriority] = useState('MEDIUM');
  const [requestNotes, setRequestNotes] = useState('');

  const { data: parts = [], isLoading: partsLoading } = useQuery(allPartsOptions());
  const { data: agentStockRows = [] } = useQuery(agentStockOptions(userId));

  const activeParts = useMemo(() => parts.filter((p) => p.is_active !== false), [parts]);
  const stockTakeMerged = useMemo(() => {
    const map = {};
    activeParts.forEach((p) => {
      const row = agentStockRows.find((r) => r.part_id === p.id);
      const current = stockTakeLocal[p.id] ?? (row ? { current_stock_qty: row.current_stock_qty, need_to_order: row.need_to_order } : { current_stock_qty: 0, need_to_order: 0 });
      map[p.id] = current;
    });
    return map;
  }, [activeParts, agentStockRows, stockTakeLocal]);

  const countedProgress = useMemo(() => {
    const entries = Object.entries(stockTakeMerged).filter(
      ([_, v]) => (v?.current_stock_qty ?? 0) > 0 || (v?.need_to_order ?? 0) > 0
    );
    return entries.length;
  }, [stockTakeMerged]);

  const stockTakeMutation = useMutation({
    mutationFn: async () => {
      for (const [partId, v] of Object.entries(stockTakeMerged)) {
        const current = Number(v?.current_stock_qty) || 0;
        const need = Number(v?.need_to_order) || 0;
        const { error } = await supabase.from('agent_stock').upsert(
          {
            user_id: userId,
            part_id: partId,
            current_stock_qty: current,
            need_to_order: need,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,part_id' }
        );
        if (error) throw error;
      }
      const { data: st, error: e1 } = await supabase
        .from('stock_takes')
        .insert({ created_by: userId, company_id: companyId, taken_at: new Date().toISOString() })
        .select('id')
        .single();
      if (!e1 && st) {
        const items = Object.entries(stockTakeMerged)
          .filter(([, v]) => (Number(v?.current_stock_qty) || 0) > 0 || (Number(v?.need_to_order) || 0) > 0)
          .map(([partId, v]) => ({
            stock_take_id: st.id,
            part_id: partId,
            quantity_counted: Number(v?.current_stock_qty) || 0,
          }));
        if (items.length > 0) await supabase.from('stock_take_items').insert(items);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.global.agentStock(userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.global.stockTakes() });
      toast.success('Stock take saved', { description: 'Manager can see your current stock.' });
    },
    onError: (err) => {
      toast.error(err?.message || 'Failed to save stock take');
    },
  });

  const setStockTakeCell = (partId, field, value) => {
    setStockTakeLocal((prev) => ({
      ...prev,
      [partId]: {
        ...(prev[partId] ?? { current_stock_qty: 0, need_to_order: 0 }),
        [field]: value === '' ? 0 : Math.max(0, parseInt(value, 10) || 0),
      },
    }));
  };

  const requestLines = useMemo(() => {
    const q = requestSearch.trim().toLowerCase();
    return activeParts.filter(
      (p) => !q || p.description?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q)
    );
  }, [activeParts, requestSearch]);

  const requestOrderLines = useMemo(
    () => Object.entries(requestQuantities).filter(([, qty]) => qty != null && Number(qty) > 0),
    [requestQuantities]
  );

  const orderRequestMutation = useMutation({
    mutationFn: async () => {
      const { data: order, error: e0 } = await supabase
        .from('order_requests')
        .insert({
          requested_by: userId,
          company_id: companyId,
          priority: requestPriority,
          notes: requestNotes || null,
          status: 'pending',
        })
        .select('id')
        .single();
      if (e0) throw e0;
      const partIds = requestOrderLines.map(([id]) => id);
      const partMap = Object.fromEntries(parts.filter((p) => partIds.includes(p.id)).map((p) => [p.id, p]));
      const items = requestOrderLines.map(([partId, qty]) => ({
        order_request_id: order.id,
        part_id: partId,
        qty_requested: Number(qty) || 1,
        unit_price_cents_snapshot: partMap[partId]?.unit_price_cents ?? null,
        item_status: 'pending',
      }));
      const { error: e1 } = await supabase.from('order_request_items').insert(items);
      if (e1) throw e1;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.global.orderRequests() });
      setRequestQuantities({});
      setRequestNotes('');
      toast.success('Request submitted', { description: 'Manager will be notified.' });
    },
    onError: (err) => {
      toast.error(err?.message || 'Failed to submit request');
    },
  });

  return (
    <div className="space-y-6">
      <Tabs defaultValue="stock-take">
        <TabsList>
          <TabsTrigger value="stock-take">Stock Take</TabsTrigger>
          <TabsTrigger value="request-parts">Request Parts</TabsTrigger>
        </TabsList>
        <TabsContent value="stock-take" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="size-5" />
                Stock Take
              </CardTitle>
              <CardDescription>Record current stock and need to order per part. Manager can see your current stock.</CardDescription>
              <p className="text-sm font-medium text-muted-foreground">{countedProgress}/{activeParts.length} counted</p>
            </CardHeader>
            <CardContent>
              {partsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="size-8 animate-spin" /></div>
              ) : (
                <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                  <Table>
<TableHeader>
                    <TableRow>
                        <TableHead className="w-[120px]">Image</TableHead>
                        <TableHead>Part description</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead className="w-[100px]">Current Stock</TableHead>
                        <TableHead className="w-[100px]">Need to Order</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeParts.map((part) => (
                        <TableRow key={part.id}>
                          <TableCell className="w-[120px] p-2 align-top">
                            {partImageUrl(part) ? (
                              <img src={partImageUrl(part)} alt="" className="size-24 min-w-[6rem] min-h-[6rem] object-contain rounded border bg-muted" />
                            ) : (
                              <div className="size-24 min-w-[6rem] min-h-[6rem] rounded border bg-muted flex items-center justify-center text-muted-foreground text-xs">—</div>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{part.description}</TableCell>
                          <TableCell><Badge variant="secondary">{part.category}</Badge></TableCell>
                          <TableCell>{part.unit}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              className="w-20"
                              value={stockTakeMerged[part.id]?.current_stock_qty ?? ''}
                              onChange={(e) => setStockTakeCell(part.id, 'current_stock_qty', e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              className="w-20"
                              value={stockTakeMerged[part.id]?.need_to_order ?? ''}
                              onChange={(e) => setStockTakeCell(part.id, 'need_to_order', e.target.value)}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <Button className="mt-4" onClick={() => stockTakeMutation.mutate()} disabled={stockTakeMutation.isPending}>
                {stockTakeMutation.isPending && <Loader2 className="size-4 animate-spin mr-2" />}
                Save stock take
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="request-parts" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="size-5" />
                Request Parts
              </CardTitle>
              <CardDescription>Add quantities for parts you need; set priority and notes, then submit. No prices shown (agent view).</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-4">
                  <Input
                    placeholder="Search parts..."
                    value={requestSearch}
                    onChange={(e) => setRequestSearch(e.target.value)}
                    className="max-w-sm"
                  />
                  <div className="max-h-[400px] overflow-y-auto border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[120px]">Image</TableHead>
                          <TableHead>Part</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead className="w-[100px]">Qty</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {requestLines.map((part) => (
                          <TableRow key={part.id}>
                            <TableCell className="w-[120px] p-2 align-top">
                              {partImageUrl(part) ? (
                                <img src={partImageUrl(part)} alt="" className="size-24 min-w-[6rem] min-h-[6rem] object-contain rounded border bg-muted" />
                              ) : (
                                <div className="size-24 min-w-[6rem] min-h-[6rem] rounded border bg-muted flex items-center justify-center text-muted-foreground text-xs">—</div>
                              )}
                            </TableCell>
                            <TableCell className="font-medium">{part.description}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{part.category}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                className="w-20"
                                value={requestQuantities[part.id] ?? ''}
                                onChange={(e) => {
                                  const v = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                                  setRequestQuantities((prev) => ({ ...prev, [part.id]: v === '' ? undefined : (Number.isNaN(v) ? 0 : Math.max(0, v)) }));
                                }}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                <div className="space-y-4 border-l pl-6">
                  <Label>Order Summary</Label>
                  <div className="grid gap-2">
                    <Label className="text-muted-foreground text-sm">Priority</Label>
                    <Select value={requestPriority} onValueChange={setRequestPriority}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOW">LOW</SelectItem>
                        <SelectItem value="MEDIUM">MEDIUM</SelectItem>
                        <SelectItem value="HIGH">HIGH</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-muted-foreground text-sm">Notes</Label>
                    <Input value={requestNotes} onChange={(e) => setRequestNotes(e.target.value)} placeholder="e.g. urgent" />
                  </div>
                  <Button onClick={() => orderRequestMutation.mutate()} disabled={requestOrderLines.length === 0 || orderRequestMutation.isPending}>
                    {orderRequestMutation.isPending && <Loader2 className="size-4 animate-spin mr-2" />}
                    Submit request
                  </Button>
                  {requestOrderLines.length > 0 && <p className="text-xs text-muted-foreground">{requestOrderLines.length} line(s)</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

const ORDER_STATUSES = ['pending', 'approved', 'rejected', 'ordered', 'in_transit', 'delivered'];
const ITEM_STATUSES = ['pending', 'ordered', 'backordered', 'in_transit', 'delivered'];

/** Manager view: dashboard cards, Order Requests (approve/reject + status + item status), Stock Takes by agent, Export */
function ManagerView({ userProfile, isSuperAdmin = false }) {
  const queryClient = useQueryClient();
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [selectedAgentId, setSelectedAgentId] = useState(null);
  const [selectedStockTakeId, setSelectedStockTakeId] = useState(null);
  const [showSubmissionHistory, setShowSubmissionHistory] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'card' — superadmin only

  useEffect(() => {
    const hash = window.location.hash;
    const m = hash && hash.startsWith('#stock-take-') ? hash.slice('#stock-take-'.length) : null;
    if (m) setSelectedStockTakeId(m);
  }, []);
  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash;
      const m = hash && hash.startsWith('#stock-take-') ? hash.slice('#stock-take-'.length) : null;
      setSelectedStockTakeId((prev) => (m ? m : prev));
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const { data: orderRequests = [], isLoading: ordersLoading } = useQuery(orderRequestsOptions({ status: null }));
  const { data: orderDetail } = useQuery({
    ...orderRequestWithItemsOptions(selectedOrderId),
    enabled: !!selectedOrderId,
  });
  const { data: stockTakes = [] } = useQuery(stockTakesOptions({ limit: 100 }));
  const { data: stockTakeDetail } = useQuery({
    ...stockTakeWithItemsOptions(selectedStockTakeId),
    enabled: !!selectedStockTakeId,
  });
  const { data: agentStockAll = [] } = useQuery(agentStockOptions(null));

  const agentUserIds = useMemo(() => [...new Set((agentStockAll ?? []).map((r) => r.user_id).filter(Boolean))], [agentStockAll]);
  const { data: agentProfiles = [] } = useQuery({
    queryKey: [...queryKeys.global.agentStock(null), 'profiles', agentUserIds],
    queryFn: async () => {
      if (agentUserIds.length === 0) return [];
      const { data, error } = await supabase.from('user_profiles').select('id, full_name').in('id', agentUserIds);
      if (error) throw error;
      return data ?? [];
    },
    enabled: agentUserIds.length > 0,
    staleTime: 60 * 1000,
  });
  const agentNameById = useMemo(() => Object.fromEntries((agentProfiles ?? []).map((p) => [p.id, p.full_name || null])), [agentProfiles]);

  const pendingOrders = orderRequests.filter((r) => r.status === 'pending');
  const pendingStockTakesCount = stockTakes.length;
  const pendingOrderIds = useMemo(() => pendingOrders.map((o) => o.id), [pendingOrders]);
  const { data: pendingItems = [] } = useQuery({
    queryKey: [...queryKeys.global.orderRequests(), 'pending-items', pendingOrderIds],
    queryFn: async () => {
      if (pendingOrderIds.length === 0) return [];
      const { data, error } = await supabase.from('order_request_items').select('qty_requested, unit_price_cents_snapshot').in('order_request_id', pendingOrderIds);
      if (error) throw error;
      return data ?? [];
    },
    enabled: pendingOrderIds.length > 0,
  });
  const pendingValueCents = useMemo(
    () => pendingItems.reduce((s, i) => s + (i.qty_requested || 0) * (i.unit_price_cents_snapshot || 0), 0),
    [pendingItems]
  );

  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const { error } = await supabase.from('order_requests').update({
        status,
        ...(status === 'approved' || status === 'rejected' ? { approved_by: userProfile?.id, decided_at: new Date().toISOString() } : {}),
        updated_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.global.orderRequests() });
      if (selectedOrderId) queryClient.invalidateQueries({ queryKey: [...queryKeys.global.orderRequests(), 'detail', selectedOrderId] });
      // Notify the delivery manager (agent) who submitted the request
      edgeFetch('sendOrderStatusNotification', {
        orderRequestId: variables.id,
        newStatus: variables.status,
        deciderName: userProfile?.full_name || undefined,
      }, { throwOnError: false }).then((result) => {
        if (result?.error) {
          console.warn('Order status notification failed:', result.error);
          toast.error('Status updated but notification email could not be sent.');
        }
      }).catch(() => {});
    },
  });

  const updateItemStatusMutation = useMutation({
    mutationFn: async ({ itemId, item_status }) => {
      const { error } = await supabase.from('order_request_items').update({ item_status, updated_at: new Date().toISOString() }).eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.global.orderRequests() });
      if (selectedOrderId) queryClient.invalidateQueries({ queryKey: [...queryKeys.global.orderRequests(), 'detail', selectedOrderId] });
    },
  });

  const agentsWithStock = useMemo(() => {
    const byUser = {};
    agentStockAll.forEach((r) => {
      if (!byUser[r.user_id]) byUser[r.user_id] = { user_id: r.user_id, rows: [] };
      byUser[r.user_id].rows.push(r);
    });
    return Object.values(byUser);
  }, [agentStockAll]);

  const exportToExcel = async () => {
    const ids = orderRequests.map((o) => o.id);
    if (ids.length === 0) {
      const ws = XLSX.utils.json_to_sheet([{ 'Request ID': '', 'Requested by': '', 'Requested at': '', Priority: '', Notes: '', Status: '', Part: '', Qty: '', 'Item status': '', 'Unit price': '' }]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Order Requests');
      XLSX.writeFile(wb, `order-requests-${new Date().toISOString().slice(0, 10)}.xlsx`);
      return;
    }
    const { data: items } = await supabase.from('order_request_items').select('order_request_id, part_id, qty_requested, item_status, unit_price_cents_snapshot, parts(description)').in('order_request_id', ids);
    const orderMap = Object.fromEntries(orderRequests.map((o) => [o.id, o]));
    const rows = (items ?? []).map((item) => {
      const o = orderMap[item.order_request_id];
      return {
        'Request ID': o?.id ?? '',
        'Requested by': o?.requested_by_name ?? '',
        'Requested at': o?.created_at ? new Date(o.created_at).toLocaleString() : '',
        Priority: o?.priority ?? '',
        Notes: o?.notes ?? '',
        Status: o?.status ?? '',
        Part: item.parts?.description ?? item.part_id ?? '',
        Qty: item.qty_requested ?? '',
        'Item status': item.item_status ?? '',
        'Unit price': item.unit_price_cents_snapshot != null ? (item.unit_price_cents_snapshot / 100).toFixed(2) : '',
      };
    });
    orderRequests.forEach((o) => {
      if (!rows.some((r) => r['Request ID'] === o.id)) {
        rows.push({
          'Request ID': o.id,
          'Requested by': o?.requested_by_name ?? '',
          'Requested at': o.created_at ? new Date(o.created_at).toLocaleString() : '',
          Priority: o.priority,
          Notes: o.notes || '',
          Status: o.status,
          Part: '',
          Qty: '',
          'Item status': '',
          'Unit price': '',
        });
      }
    });
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 'Request ID': '', 'Requested by': '', 'Requested at': '', Priority: '', Notes: '', Status: '', Part: '', Qty: '', 'Item status': '', 'Unit price': '' }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Order Requests');
    XLSX.writeFile(wb, `order-requests-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingOrders.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Stock Takes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingStockTakesCount}</div>
            <p className="text-xs text-muted-foreground">Submission count</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Order Value (pending)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(pendingValueCents / 100).toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="order-requests">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="order-requests">Order Requests</TabsTrigger>
            <TabsTrigger value="stock-takes">Stock Takes</TabsTrigger>
          </TabsList>
          {isSuperAdmin && (
            <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v)} className="border rounded-lg p-0.5 bg-muted/50">
              <ToggleGroupItem value="list" aria-label="List view" className="gap-1.5 px-3">
                <List className="size-4" />
                List
              </ToggleGroupItem>
              <ToggleGroupItem value="card" aria-label="Card view" className="gap-1.5 px-3">
                <LayoutGrid className="size-4" />
                Card
              </ToggleGroupItem>
            </ToggleGroup>
          )}
        </div>
        <TabsContent value="order-requests" className="mt-6">
          <div className="flex justify-end mb-2">
            <Button variant="outline" size="sm" onClick={exportToExcel}>
              <Download className="size-4 mr-2" />
              Export All to Excel
            </Button>
          </div>
          {ordersLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="size-8 animate-spin" /></div>
          ) : (
            <div className={isSuperAdmin && viewMode === 'card' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4' : 'space-y-4'}>
              {orderRequests.map((order) => {
                const isCardView = isSuperAdmin && viewMode === 'card';
                const requesterName = order.requested_by_name || 'Unknown';
                const isExpanded = selectedOrderId === order.id;
                const isUpdatingThisOrder = updateOrderStatusMutation.isPending && updateOrderStatusMutation.variables?.id === order.id;
                return (
                  <Card key={order.id} className={isCardView ? 'flex flex-col overflow-hidden' : ''}>
                    <CardHeader className={isCardView ? 'pb-2' : 'pb-2'}>
                      <div className={isCardView ? 'space-y-3' : 'flex flex-wrap items-center justify-between gap-2'}>
                        {isCardView ? (
                          <>
                            <div className="flex items-center gap-3">
                              <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                                {requesterName.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <CardTitle className="text-base truncate">{requesterName}</CardTitle>
                                <CardDescription className="text-xs">
                                  Request {order.id.slice(0, 8)}… · {new Date(order.created_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                                </CardDescription>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              <Badge variant={order.priority === 'HIGH' ? 'destructive' : order.priority === 'MEDIUM' ? 'default' : 'secondary'} className="text-xs">
                                {order.priority}
                              </Badge>
                              <Badge variant={order.status === 'pending' ? 'outline' : order.status === 'approved' || order.status === 'delivered' ? 'default' : 'secondary'}>
                                {order.status}
                              </Badge>
                              {order.site_ref && <span className="text-xs text-muted-foreground truncate">· {order.site_ref}</span>}
                            </div>
                            {order.notes && <p className="text-xs text-muted-foreground line-clamp-2">{order.notes}</p>}
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              {order.status === 'pending' && (
                                <>
                                  <Button size="sm" className="h-8" onClick={() => updateOrderStatusMutation.mutate({ id: order.id, status: 'approved' })} disabled={isUpdatingThisOrder}>
                                    {isUpdatingThisOrder && updateOrderStatusMutation.variables?.status === 'approved' ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                                  </Button>
                                  <Button size="sm" variant="destructive" className="h-8" onClick={() => updateOrderStatusMutation.mutate({ id: order.id, status: 'rejected' })} disabled={isUpdatingThisOrder}>
                                    {isUpdatingThisOrder && updateOrderStatusMutation.variables?.status === 'rejected' ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
                                  </Button>
                                </>
                              )}
                              {order.status !== 'pending' && (
                                <Select value={order.status} onValueChange={(v) => updateOrderStatusMutation.mutate({ id: order.id, status: v })}>
                                  <SelectTrigger className="h-8 w-[120px]" disabled={isUpdatingThisOrder}><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {ORDER_STATUSES.filter((s) => !['pending'].includes(s)).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              )}
                              <Button variant="outline" size="sm" className="h-8 ml-auto" onClick={() => setSelectedOrderId(isExpanded ? null : order.id)}>
                                {isExpanded ? 'Hide items' : 'View items'}
                              </Button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <CardTitle className="text-base">{order.requested_by_name ? `${order.requested_by_name} · Request ${order.id.slice(0, 8)}…` : `Request ${order.id.slice(0, 8)}…`}</CardTitle>
                              <CardDescription>
                                {new Date(order.created_at).toLocaleString()} · Priority: {order.priority} {order.site_ref ? `· Site: ${order.site_ref}` : ''}
                              </CardDescription>
                              {order.notes && <p className="text-sm text-muted-foreground mt-1">{order.notes}</p>}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={order.status === 'pending' ? 'outline' : order.status === 'approved' || order.status === 'delivered' ? 'default' : 'secondary'}>{order.status}</Badge>
                              {order.status === 'pending' && (
                                <>
                                  <Button size="sm" onClick={() => updateOrderStatusMutation.mutate({ id: order.id, status: 'approved' })} disabled={isUpdatingThisOrder}>
                                    {isUpdatingThisOrder && updateOrderStatusMutation.variables?.status === 'approved' ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                                  </Button>
                                  <Button size="sm" variant="destructive" onClick={() => updateOrderStatusMutation.mutate({ id: order.id, status: 'rejected' })} disabled={isUpdatingThisOrder}>
                                    {isUpdatingThisOrder && updateOrderStatusMutation.variables?.status === 'rejected' ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
                                  </Button>
                                </>
                              )}
                              {order.status !== 'pending' && (
                                <Select value={order.status} onValueChange={(v) => updateOrderStatusMutation.mutate({ id: order.id, status: v })}>
                                  <SelectTrigger className="w-[140px]" disabled={isUpdatingThisOrder}><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {ORDER_STATUSES.filter((s) => !['pending'].includes(s)).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              )}
                              <Button variant="ghost" size="sm" onClick={() => setSelectedOrderId(selectedOrderId === order.id ? null : order.id)}>
                                {selectedOrderId === order.id ? 'Hide' : 'View'} items
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    </CardHeader>
                    {selectedOrderId === order.id && (
                      <CardContent className={isCardView ? 'border-t pt-4' : ''}>
                        {order.id === orderDetail?.id && orderDetail?.items?.length > 0 ? (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Part</TableHead>
                                <TableHead>Qty</TableHead>
                                <TableHead>Price</TableHead>
                                <TableHead>Item status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {orderDetail.items.map((item) => (
                                <TableRow key={item.id}>
                                  <TableCell>{item.parts?.description ?? item.part_id}</TableCell>
                                  <TableCell>{item.qty_requested}</TableCell>
                                  <TableCell>{item.unit_price_cents_snapshot != null ? `$${(item.unit_price_cents_snapshot / 100).toFixed(2)}` : '—'}</TableCell>
                                  <TableCell>
                                    <Select
                                      value={item.item_status}
                                      onValueChange={(v) => updateItemStatusMutation.mutate({ itemId: item.id, item_status: v })}
                                    >
                                      <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        {ITEM_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        ) : selectedOrderId === order.id && (
                          <div className="py-4">
                            <Loader2 className="size-6 animate-spin mx-auto" />
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
          {!ordersLoading && orderRequests.length === 0 && <p className="text-center text-muted-foreground py-8">No order requests yet.</p>}
        </TabsContent>
        <TabsContent value="stock-takes" className="mt-6 space-y-6">
          {/* Primary: Agent stock levels (what they have + need to order – no request submitted) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="size-5" />
                Agent stock levels
              </CardTitle>
              <CardDescription>
                What each agent has on hand and has marked as need to order. This is the data they keep on their end—no request submitted. Expand an agent to see their full part list.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {agentsWithStock.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No agent stock data yet. Agents record their stock in the Parts & requests (Agent) view.</p>
              ) : (
                <div className={isSuperAdmin && viewMode === 'card' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4' : 'space-y-3'}>
                  {agentsWithStock.map((ag) => {
                    const isExpanded = selectedAgentId === ag.user_id;
                    const agentName = agentNameById[ag.user_id] ?? ag.user_id?.slice(0, 8) + '…';
                    const needOrderCount = ag.rows.filter((r) => (r.need_to_order ?? 0) > 0).length;
                    const hasStockCount = ag.rows.filter((r) => (r.current_stock_qty ?? 0) > 0).length;
                    const isCardView = isSuperAdmin && viewMode === 'card';
                    const sortedRows = [...ag.rows].sort((a, b) => {
                      const hasVal = (r) => (r.current_stock_qty ?? 0) > 0 || (r.need_to_order ?? 0) > 0;
                      return (hasVal(b) ? 1 : 0) - (hasVal(a) ? 1 : 0);
                    });
                    const topRows = isCardView ? sortedRows.filter((r) => (r.current_stock_qty ?? 0) > 0 || (r.need_to_order ?? 0) > 0).slice(0, 5) : [];
                    return (
                      <Card key={ag.user_id} className={`overflow-hidden ${isCardView ? 'flex flex-col' : ''}`}>
                        <CardHeader className={isCardView ? 'pb-3' : 'py-3 px-4'}>
                          <div className={isCardView ? 'space-y-3' : 'flex items-center justify-between gap-2'}>
                            <div className={`flex items-center gap-3 ${isCardView ? 'flex-col text-center' : ''}`}>
                              <div className={`flex items-center justify-center rounded-full font-medium text-sm shrink-0 ${isCardView ? 'size-14 text-lg bg-primary/10 text-primary' : 'size-9 bg-muted text-muted-foreground'}`}>
                                {agentName.charAt(0).toUpperCase()}
                              </div>
                              <div className={isCardView ? 'min-w-0' : ''}>
                                <p className="font-medium">{agentName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {isCardView ? (
                                    <span className="flex flex-wrap justify-center gap-x-2 gap-y-1 mt-1">
                                      <span>{ag.rows.length} parts</span>
                                      {hasStockCount > 0 && <Badge variant="secondary" className="text-xs">{hasStockCount} on hand</Badge>}
                                      {needOrderCount > 0 && <Badge variant="outline" className="text-xs">{needOrderCount} need order</Badge>}
                                    </span>
                                  ) : (
                                    <>
                                      {ag.rows.length} part(s) tracked
                                      {hasStockCount > 0 && ` · ${hasStockCount} with stock on hand`}
                                      {needOrderCount > 0 && ` · ${needOrderCount} marked need to order`}
                                    </>
                                  )}
                                </p>
                              </div>
                            </div>
                            {!isCardView && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedAgentId(isExpanded ? null : ag.user_id)}
                                className="shrink-0"
                              >
                                {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                                <span className="ml-1">{isExpanded ? 'Collapse' : 'View full list'}</span>
                              </Button>
                            )}
                            {isCardView && (
                              <>
                                {topRows.length > 0 && !isExpanded && (
                                  <div className="rounded-md border bg-muted/30 p-2 space-y-1 text-left">
                                    {topRows.map((r) => (
                                      <div key={r.id} className="flex justify-between gap-2 text-xs">
                                        <span className="truncate">{r.parts?.description ?? r.part_id}</span>
                                        <span className="shrink-0 text-muted-foreground">{r.current_stock_qty} / {r.need_to_order}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full"
                                  onClick={() => setSelectedAgentId(isExpanded ? null : ag.user_id)}
                                >
                                  {isExpanded ? <ChevronUp className="size-4 mr-1" /> : <ChevronDown className="size-4 mr-1" />}
                                  {isExpanded ? 'Collapse' : 'View full list'}
                                </Button>
                              </>
                            )}
                          </div>
                        </CardHeader>
                        {isExpanded && (
                          <CardContent className={`pt-0 ${isCardView ? 'px-4 pb-4 border-t' : 'px-4 pb-4'}`}>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Part</TableHead>
                                  <TableHead className="text-right w-28">Current stock</TableHead>
                                  <TableHead className="text-right w-28">Need to order</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {sortedRows.map((r) => (
                                  <TableRow key={r.id}>
                                    <TableCell>{r.parts?.description ?? r.part_id}</TableCell>
                                    <TableCell className="text-right">{r.current_stock_qty}</TableCell>
                                    <TableCell className="text-right">{r.need_to_order}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </CardContent>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Secondary: Submission history (collapsible) */}
          <Card className="border-muted/50">
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileCheck className="size-4 text-muted-foreground" />
                  <CardTitle className="text-base">Submission history</CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSubmissionHistory(!showSubmissionHistory)}
                  className="shrink-0"
                >
                  {showSubmissionHistory ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                  <span className="ml-1">{showSubmissionHistory ? 'Hide' : 'Show'} past submissions</span>
                </Button>
              </div>
              <CardDescription className="text-xs">
                When agents saved their stock take (counts). For reference only.
              </CardDescription>
            </CardHeader>
            {showSubmissionHistory && (
              <CardContent className="pt-0 px-4 pb-4">
                {stockTakes.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No submissions yet.</p>
                ) : (
                  <div className={isSuperAdmin && viewMode === 'card' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3' : 'space-y-3'}>
                    {stockTakes.slice(0, 50).map((st) => {
                      const isExpanded = selectedStockTakeId === st.id;
                      const submittedAt = new Date(st.taken_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
                      const isSubmissionCardView = isSuperAdmin && viewMode === 'card';
                      const submitterName = st.created_by_name || 'Unknown';
                      return (
                        <Card key={st.id} id={`stock-take-${st.id}`} className={`overflow-hidden border-muted/50 ${isSubmissionCardView ? 'flex flex-col' : ''}`}>
                          <CardHeader className={isSubmissionCardView ? 'py-3 px-4' : 'py-2 px-3'}>
                            <div className={isSubmissionCardView ? 'space-y-2' : 'flex items-center justify-between gap-2'}>
                              <div className={`flex items-center gap-2 ${isSubmissionCardView ? 'flex-col text-center' : ''}`}>
                                <div className={`flex items-center justify-center rounded-full bg-muted/80 text-muted-foreground font-medium shrink-0 ${isSubmissionCardView ? 'size-10 text-sm' : 'size-7 text-xs'}`}>
                                  {submitterName.charAt(0).toUpperCase()}
                                </div>
                                <div className={isSubmissionCardView ? 'min-w-0' : ''}>
                                  <p className="text-sm font-medium">{submitterName}</p>
                                  <p className="text-xs text-muted-foreground">{submittedAt}</p>
                                </div>
                              </div>
                              <Button
                                variant={isSubmissionCardView ? 'outline' : 'ghost'}
                                size="sm"
                                className={`shrink-0 ${isSubmissionCardView ? 'w-full' : 'h-8 text-xs'}`}
                                onClick={() => {
                                  const next = isExpanded ? null : st.id;
                                  setSelectedStockTakeId(next);
                                  if (next) window.location.hash = `#stock-take-${next}`;
                                  else window.history.replaceState(null, '', window.location.pathname);
                                }}
                              >
                                {isExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                                <span className="ml-1">{isExpanded ? 'Hide' : 'Details'}</span>
                              </Button>
                            </div>
                          </CardHeader>
                          {isExpanded && (
                            <CardContent className="pt-0 px-3 pb-3">
                              {stockTakeDetail?.id === st.id && stockTakeDetail?.items?.length > 0 ? (
                                <>
                                  <p className="text-xs text-muted-foreground mb-2">{stockTakeDetail.items.length} part(s) counted</p>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Part</TableHead>
                                        <TableHead className="text-right w-28">Qty counted</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {stockTakeDetail.items.map((item) => (
                                        <TableRow key={item.id}>
                                          <TableCell className="text-sm">{item.parts?.description ?? item.part_id}</TableCell>
                                          <TableCell className="text-right text-sm">{item.quantity_counted}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </>
                              ) : stockTakeDetail?.id === st.id && (!stockTakeDetail.items || stockTakeDetail.items.length === 0) ? (
                                <p className="text-xs text-muted-foreground py-2">No line items.</p>
                              ) : (
                                <div className="py-4 flex justify-center">
                                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                                </div>
                              )}
                            </CardContent>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function StockOrders() {
  const { userProfile } = useAuth();
  const role = userProfile?.role;
  const isAgent = role === 'delivery_manager' || role === 'driver';
  const isManager = role === 'manager' || role === 'admin';
  const isSuperAdmin = role === 'super_admin';

  if (!userProfile) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Super admin: same as manager (Orders & stock takes only; no Agent tab)
  if (isSuperAdmin) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Stock & Orders</h1>
          <p className="text-muted-foreground">Review order requests and stock takes. No Supplier POs.</p>
        </div>
        <ManagerView userProfile={userProfile} isSuperAdmin />
      </div>
    );
  }

  if (isAgent) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Stock & Orders</h1>
          <p className="text-muted-foreground">Browse parts, request parts, and record stock takes.</p>
        </div>
        <AgentView userProfile={userProfile} />
      </div>
    );
  }

  if (isManager) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Stock & Orders</h1>
          <p className="text-muted-foreground">Review order requests and stock takes. No Supplier POs.</p>
        </div>
        <ManagerView userProfile={userProfile} />
      </div>
    );
  }

  return (
    <div className="p-6">
      <p className="text-muted-foreground">You don’t have access to Stock & Orders.</p>
    </div>
  );
}
