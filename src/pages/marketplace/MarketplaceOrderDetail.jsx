import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Package, MapPin, Truck, Receipt, FileText, ExternalLink, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { buyerOrderDetailOptions } from '@/query/options/marketplace';
import { formatAUD } from '@/lib/marketplaceFormat';
import { OrderStatusBadge } from '@/components/marketplace/OrderStatusBadge';
import { HazardBadge } from '@/components/marketplace/HazardBadge';

/**
 * Buyer-side order detail. Shows the full order: line items, delivery, totals,
 * status, dispatch info, tracking link, and a downloadable PO PDF (signed URL).
 */
export default function MarketplaceOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const companyId = userProfile?.company_id;
  const { data, isLoading } = useQuery(buyerOrderDetailOptions(companyId, id));

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

  if (isLoading) {
    return (
      <div className="p-12 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data?.order) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => navigate('/marketplace/orders')}>
          <ArrowLeft className="w-4 h-4 mr-1.5" /> My orders
        </Button>
        <Card className="mt-4">
          <CardContent className="py-12 text-center">
            <p className="text-base font-medium mb-1">Order not found</p>
            <p className="text-sm text-muted-foreground">It may have been removed or you don't have access.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { order, items, history } = data;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate('/marketplace/orders')} className="mb-4">
        <ArrowLeft className="w-4 h-4 mr-1.5" /> My orders
      </Button>

      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">{order.order_number}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Placed {new Date(order.created_at).toLocaleString('en-AU')} • {order.payment_method === 'purchase_order' ? 'Purchase Order' : 'Stripe card'}
          </p>
        </div>
        <OrderStatusBadge status={order.status} className="text-sm py-1 px-3" />
      </div>

      {order.status === 'rejected' && order.rejection_reason && (
        <div className="mb-5 p-4 rounded-md border border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
          <p className="text-sm font-semibold mb-1">Reason for rejection</p>
          <p className="text-sm whitespace-pre-line">{order.rejection_reason}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* Line items */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Package className="w-4 h-4" /> Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {items.map((it) => (
                  <div key={it.id} className="py-3 grid grid-cols-12 gap-3 items-start text-sm">
                    <div className="col-span-12 sm:col-span-6">
                      <p className="font-medium">{it.product_name}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <HazardBadge classification={it.product_classification} className="text-[10px]" />
                        <span className="text-xs text-muted-foreground">
                          {it.packaging_size_name}{it.packaging_volume_litres ? ` (${it.packaging_volume_litres}L)` : ''}
                        </span>
                      </div>
                    </div>
                    <div className="col-span-4 sm:col-span-2 text-muted-foreground text-xs">
                      Qty: <span className="font-medium text-foreground">{it.quantity}</span>
                    </div>
                    <div className="col-span-4 sm:col-span-2 text-muted-foreground text-xs">
                      Unit: <span className="font-medium text-foreground">{formatAUD(it.unit_price_ex_gst)}</span>
                    </div>
                    <div className="col-span-4 sm:col-span-2 text-right">
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
                <div className="flex justify-between font-semibold text-base pt-1 border-t mt-2"><span>Total</span><span>{formatAUD(order.total_amount)}</span></div>
              </div>
            </CardContent>
          </Card>

          {/* Delivery */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><MapPin className="w-4 h-4" /> Delivery</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <p>{order.delivery_address?.line1}</p>
              {order.delivery_address?.line2 && <p>{order.delivery_address.line2}</p>}
              <p>{order.delivery_address?.suburb} {order.delivery_address?.state} {order.delivery_postcode}</p>
              {order.delivery_contact_name && <p className="pt-2 text-muted-foreground">Contact: <span className="text-foreground">{order.delivery_contact_name}</span></p>}
              {order.delivery_contact_phone && <p className="text-muted-foreground">Phone: <span className="text-foreground">{order.delivery_contact_phone}</span></p>}
              {order.delivery_notes && <p className="text-muted-foreground pt-2 whitespace-pre-line">{order.delivery_notes}</p>}
            </CardContent>
          </Card>

          {/* Fulfilment */}
          {(order.supplier_dispatch_date || order.supplier_eta_date || order.supplier_tracking_url) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Truck className="w-4 h-4" /> Dispatch &amp; tracking</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1.5">
                {order.supplier_dispatch_date && (
                  <p><span className="text-muted-foreground">Dispatched:</span> {new Date(order.supplier_dispatch_date).toLocaleDateString('en-AU', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                )}
                {order.supplier_eta_date && (
                  <p><span className="text-muted-foreground">ETA:</span> {new Date(order.supplier_eta_date).toLocaleDateString('en-AU', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                )}
                {order.supplier_tracking_url && (
                  <p>
                    <span className="text-muted-foreground">Tracking:</span>{' '}
                    <a href={order.supplier_tracking_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                      {order.supplier_tracking_carrier ?? 'View'} <ExternalLink className="w-3 h-3" />
                    </a>
                  </p>
                )}
                {order.supplier_notes && (
                  <div className="pt-2 mt-2 border-t">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Notes from warehouse</p>
                    <p className="whitespace-pre-line">{order.supplier_notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          {/* Status history */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">History</CardTitle>
              <CardDescription>Every status change is logged here.</CardDescription>
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

          {/* PO / Receipt */}
          {order.po_pdf_path && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4" /> Documents</CardTitle>
              </CardHeader>
              <CardContent>
                {poSignedUrl ? (
                  <a href={poSignedUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm p-2 border rounded-md hover:bg-muted transition-colors">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="flex-1">Your PO (PDF)</span>
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                  </a>
                ) : (
                  <p className="text-xs text-muted-foreground">Loading document link…</p>
                )}
              </CardContent>
            </Card>
          )}

          {order.xero_invoice_number && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Receipt className="w-4 h-4" /> Xero invoice</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <p><span className="text-muted-foreground">Invoice number:</span> <strong>{order.xero_invoice_number}</strong></p>
                {order.xero_invoice_status && <p className="mt-1"><span className="text-muted-foreground">Status:</span> <Badge variant="outline">{order.xero_invoice_status}</Badge></p>}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
