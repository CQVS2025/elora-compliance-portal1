import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ArrowLeft, Check, X, FileText, ExternalLink, Loader2, Truck, Receipt, Building2, MapPin, Save } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { adminOrderDetailOptions } from '@/query/options/marketplace';
import { useApproveOrder, useUpdateOrderFulfilment } from '@/query/mutations/marketplace';
import { useConfirm } from '@/hooks/useConfirm';
import { toastError, toastSuccess } from '@/lib/toast';
import { formatAUD } from '@/lib/marketplaceFormat';
import { OrderStatusBadge } from '@/components/marketplace/OrderStatusBadge';
import { HazardBadge } from '@/components/marketplace/HazardBadge';
import { SiteAccessAnswers } from '@/components/marketplace/SiteAccessAnswers';

/**
 * Admin order detail page — the workhorse of admin fulfilment.
 *
 * Shows the order, line items, customer, freight breakdown, status history,
 * and Xero sync activity. Admins can Approve, Reject, Cancel, and update
 * dispatch / ETA / tracking.
 */
export default function MarketplaceAdminOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const companyId = userProfile?.company_id;

  const { data, isLoading } = useQuery(adminOrderDetailOptions(companyId, id));
  const approve = useApproveOrder(companyId);
  const fulfilment = useUpdateOrderFulfilment(companyId);
  const { confirm, ConfirmDialog } = useConfirm();

  // ---- PO PDF signed URL ----
  const [poSignedUrl, setPoSignedUrl] = useState(null);
  useEffect(() => {
    let alive = true;
    if (data?.order?.po_pdf_path) {
      supabase.storage
        .from('marketplace-po-uploads')
        .createSignedUrl(data.order.po_pdf_path, 60 * 10)
        .then(({ data: signed }) => { if (alive) setPoSignedUrl(signed?.signedUrl); })
        .catch(() => {});
    }
    return () => { alive = false; };
  }, [data?.order?.po_pdf_path]);

  // ---- Rejection modal ----
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // ---- Fulfilment editor ----
  const [edit, setEdit] = useState({});
  useEffect(() => {
    if (data?.order) {
      setEdit({
        supplier_dispatch_date: data.order.supplier_dispatch_date ?? '',
        supplier_eta_date: data.order.supplier_eta_date ?? '',
        supplier_tracking_url: data.order.supplier_tracking_url ?? '',
        supplier_tracking_carrier: data.order.supplier_tracking_carrier ?? '',
        supplier_notes: data.order.supplier_notes ?? '',
      });
    }
  }, [data?.order]);

  const handleApprove = async () => {
    const ok = await confirm({
      title: `Approve ${data.order.order_number}?`,
      description: 'This moves the order to Approved. (Xero invoice and warehouse PO are generated here once the integration is wired.) The buyer receives an approval email.',
      confirmLabel: 'Approve',
    });
    if (!ok) return;
    try {
      await approve.mutateAsync({ order_id: id, action: 'approve' });
      toastSuccess('update', 'order status');
    } catch (e) {
      toastError(e, 'approving order');
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toastError(new Error('Provide a reason for the rejection.'), 'rejecting');
      return;
    }
    try {
      await approve.mutateAsync({ order_id: id, action: 'reject', reason: rejectReason });
      toastSuccess('update', 'order status');
      setRejectOpen(false);
      setRejectReason('');
    } catch (e) {
      toastError(e, 'rejecting order');
    }
  };

  const handleCancel = async () => {
    const ok = await confirm({
      title: `Cancel ${data.order.order_number}?`,
      description: 'The order will be marked Cancelled. Refunds for Stripe orders need to be processed manually in Stripe.',
      confirmLabel: 'Cancel order',
      destructive: true,
    });
    if (!ok) return;
    try {
      await approve.mutateAsync({ order_id: id, action: 'cancel' });
      toastSuccess('update', 'order');
    } catch (e) {
      toastError(e, 'cancelling order');
    }
  };

  const handleSaveFulfilment = async (extraPatch = {}) => {
    try {
      await fulfilment.mutateAsync({ order_id: id, ...edit, ...extraPatch });
      toastSuccess('update', 'fulfilment');
    } catch (e) {
      toastError(e, 'saving fulfilment');
    }
  };

  if (isLoading) {
    return <div className="p-12 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!data?.order) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/marketplace/orders')}>
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Orders
        </Button>
        <Card className="mt-4"><CardContent className="py-12 text-center"><p>Order not found.</p></CardContent></Card>
      </div>
    );
  }

  const { order, items, history, xero_log } = data;
  const canApprove = order.status === 'pending_approval';
  const canReject = order.status === 'pending_approval';
  const canCancel = ['pending_approval', 'approved', 'paid'].includes(order.status);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate('/admin/marketplace/orders')} className="mb-4">
        <ArrowLeft className="w-4 h-4 mr-1.5" /> All orders
      </Button>

      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold">{order.order_number}</h1>
            <OrderStatusBadge status={order.status} className="text-sm py-1 px-3" />
            <Badge variant="outline" className="text-xs">{order.payment_method === 'purchase_order' ? 'Purchase Order' : 'Stripe card'}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Placed {new Date(order.created_at).toLocaleString('en-AU')} by {order.buyer_company?.name}
          </p>
        </div>
        <div className="flex gap-2">
          {canApprove && (
            <Button onClick={handleApprove} disabled={approve.isPending}>
              {approve.isPending
                ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                : <Check className="w-4 h-4 mr-1.5" />}
              {approve.isPending ? 'Approving…' : 'Approve'}
            </Button>
          )}
          {canReject && (
            <Button variant="outline" onClick={() => setRejectOpen(true)} disabled={approve.isPending}>
              <X className="w-4 h-4 mr-1.5" /> Reject
            </Button>
          )}
          {canCancel && !canApprove && (
            <Button variant="outline" onClick={handleCancel} disabled={approve.isPending}>
              {approve.isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Cancel
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* Items + totals */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {items.map((it) => (
                  <div key={it.id} className="py-3 grid grid-cols-12 gap-3 text-sm">
                    <div className="col-span-12 sm:col-span-5">
                      <p className="font-medium">{it.product_name}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <HazardBadge classification={it.product_classification} className="text-[10px]" />
                        <span className="text-xs text-muted-foreground">{it.packaging_size_name}</span>
                      </div>
                    </div>
                    <div className="col-span-3 sm:col-span-2 text-xs">
                      <span className="text-muted-foreground">Qty: </span><strong>{it.quantity}</strong>
                    </div>
                    <div className="col-span-3 sm:col-span-2 text-xs">
                      <span className="text-muted-foreground">Unit: </span>{formatAUD(it.unit_price_ex_gst)}
                    </div>
                    <div className="col-span-3 sm:col-span-2 text-xs">
                      <span className="text-muted-foreground">Freight: </span>{formatAUD(it.freight_ex_gst ?? 0)}
                    </div>
                    <div className="col-span-3 sm:col-span-1 text-right">
                      <p className="font-semibold">{formatAUD(it.line_subtotal_ex_gst)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Separator className="my-3" />
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal (ex-GST)</span><span>{formatAUD(order.subtotal_ex_gst)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Freight (ex-GST)</span><span>{formatAUD(order.freight_ex_gst)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">GST (10%)</span><span>{formatAUD(order.gst_amount)}</span></div>
                <div className="flex justify-between font-semibold pt-1 mt-2 border-t"><span>Total</span><span>{formatAUD(order.total_amount)}</span></div>
              </div>
            </CardContent>
          </Card>

          {/* Customer + delivery */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Building2 className="w-4 h-4" /> Customer</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <p className="font-medium">{order.buyer_company?.name}</p>
                {order.buyer_company?.marketplace_invoice_email && (
                  <p className="text-xs text-muted-foreground">Invoice email: {order.buyer_company.marketplace_invoice_email}</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><MapPin className="w-4 h-4" /> Delivery</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-0.5">
                <p>{order.delivery_address?.line1}</p>
                {order.delivery_address?.line2 && <p>{order.delivery_address.line2}</p>}
                <p>{order.delivery_address?.suburb} {order.delivery_address?.state} {order.delivery_postcode}</p>
                {order.delivery_contact_name && <p className="text-xs text-muted-foreground pt-1">Contact: {order.delivery_contact_name} {order.delivery_contact_phone && `• ${order.delivery_contact_phone}`}</p>}
                {order.delivery_notes && <p className="text-xs italic text-muted-foreground pt-1 whitespace-pre-line">"{order.delivery_notes}"</p>}
              </CardContent>
            </Card>
          </div>

          {/* Site-access answers */}
          {order.site_access_answers && Object.keys(order.site_access_answers).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Site-access answers</CardTitle>
                <CardDescription>Buyer responses to the per-product checkout questions.</CardDescription>
              </CardHeader>
              <CardContent>
                <SiteAccessAnswers
                  answers={order.site_access_answers}
                  productIds={items.map((i) => i.product_id)}
                />
              </CardContent>
            </Card>
          )}

          {/* Fulfilment editor */}
          {['approved', 'paid', 'dispatched', 'delivered'].includes(order.status) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Truck className="w-4 h-4" /> Fulfilment</CardTitle>
                <CardDescription>Update dispatch, ETA, and tracking. The buyer is notified.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Dispatch date">
                    <Input type="date" value={edit.supplier_dispatch_date ?? ''} onChange={(e) => setEdit({ ...edit, supplier_dispatch_date: e.target.value || null })} />
                  </Field>
                  <Field label="ETA">
                    <Input type="date" value={edit.supplier_eta_date ?? ''} onChange={(e) => setEdit({ ...edit, supplier_eta_date: e.target.value || null })} />
                  </Field>
                  <Field label="Tracking carrier">
                    <Input value={edit.supplier_tracking_carrier ?? ''} onChange={(e) => setEdit({ ...edit, supplier_tracking_carrier: e.target.value })} placeholder="e.g. TNT, StarTrack" />
                  </Field>
                  <Field label="Tracking URL">
                    <Input value={edit.supplier_tracking_url ?? ''} onChange={(e) => setEdit({ ...edit, supplier_tracking_url: e.target.value })} placeholder="https://…" />
                  </Field>
                  <Field label="Notes for buyer" full>
                    <Textarea rows={2} value={edit.supplier_notes ?? ''} onChange={(e) => setEdit({ ...edit, supplier_notes: e.target.value })} />
                  </Field>
                </div>
                <div className="flex justify-end gap-2 pt-3">
                  {order.status === 'approved' && edit.supplier_dispatch_date && (
                    <Button variant="outline" onClick={() => handleSaveFulfilment({ status: 'dispatched' })} disabled={fulfilment.isPending}>
                      {fulfilment.isPending
                        ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                        : <Truck className="w-4 h-4 mr-1.5" />}
                      Mark dispatched
                    </Button>
                  )}
                  {order.status === 'dispatched' && (
                    <Button variant="outline" onClick={() => handleSaveFulfilment({ status: 'delivered' })} disabled={fulfilment.isPending}>
                      {fulfilment.isPending
                        ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                        : <Check className="w-4 h-4 mr-1.5" />}
                      Mark delivered
                    </Button>
                  )}
                  <Button onClick={() => handleSaveFulfilment()} disabled={fulfilment.isPending}>
                    {fulfilment.isPending
                      ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                      : <Save className="w-4 h-4 mr-1.5" />}
                    Save
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          {/* PO document */}
          {order.po_pdf_path && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4" /> PO document</CardTitle>
              </CardHeader>
              <CardContent>
                {poSignedUrl ? (
                  <a href={poSignedUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm p-2 border rounded-md hover:bg-muted transition-colors">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="flex-1">View PO (PDF)</span>
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                  </a>
                ) : (
                  <p className="text-xs text-muted-foreground">Loading…</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Status history */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Status history</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {history.length === 0 && <li className="text-xs text-muted-foreground">No history yet.</li>}
                {history.map((h) => (
                  <li key={h.id} className="text-sm">
                    <div className="flex items-center gap-2">
                      <OrderStatusBadge status={h.to_status} className="text-[10px]" />
                      <span className="text-xs text-muted-foreground">
                        {new Date(h.created_at).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                    </div>
                    {h.reason && <p className="text-xs text-muted-foreground mt-1 ml-1 whitespace-pre-line">{h.reason}</p>}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {/* Xero status */}
          {(order.xero_invoice_id || order.xero_po_id || xero_log?.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Receipt className="w-4 h-4" /> Xero</CardTitle>
                <CardDescription>Click to open in your connected Xero org.</CardDescription>
              </CardHeader>
              <CardContent className="text-sm space-y-3">
                {order.xero_invoice_id && (
                  <div className="rounded-md border border-border bg-muted/30 p-2.5 flex items-start justify-between gap-2 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Invoice</p>
                      <p className="font-medium">
                        {order.xero_invoice_number ?? <span className="font-mono text-xs">{order.xero_invoice_id}</span>}{' '}
                        <Badge variant="outline" className="ml-1 text-[10px]">{order.xero_invoice_status ?? 'AUTHORISED'}</Badge>
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(`https://go.xero.com/app/invoicing/edit/${order.xero_invoice_id}`, '_blank', 'noopener')}
                    >
                      Open in Xero <ExternalLink className="w-3 h-3 ml-1.5" />
                    </Button>
                  </div>
                )}
                {order.xero_po_id && (
                  <div className="rounded-md border border-border bg-muted/30 p-2.5 flex items-start justify-between gap-2 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Purchase order</p>
                      <p className="font-medium">
                        {order.xero_po_number ?? <span className="font-mono text-xs">{order.xero_po_id}</span>}{' '}
                        <Badge variant="outline" className="ml-1 text-[10px]">{order.xero_po_status ?? 'AUTHORISED'}</Badge>
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(`https://go.xero.com/app/purchase-orders/edit/${order.xero_po_id}`, '_blank', 'noopener')}
                    >
                      Open in Xero <ExternalLink className="w-3 h-3 ml-1.5" />
                    </Button>
                  </div>
                )}
                {xero_log?.length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground">{xero_log.length} sync event(s)</summary>
                    <pre className="mt-2 bg-muted/40 p-2 rounded overflow-x-auto">{JSON.stringify(xero_log.slice(0, 5).map((l) => ({ op: l.operation, status: l.status, at: l.created_at, err: l.error_message })), null, 2)}</pre>
                  </details>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Reject modal */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject order {order.order_number}?</DialogTitle>
            <DialogDescription>
              The buyer will see this reason on their order page and receive a rejection email.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={4}
            placeholder="Reason for rejection (e.g. credit hold, PO mismatch)…"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={approve.isPending}>Back</Button>
            <Button variant="destructive" onClick={handleReject} disabled={approve.isPending || !rejectReason.trim()}>
              {approve.isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Reject order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {ConfirmDialog}
    </div>
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
