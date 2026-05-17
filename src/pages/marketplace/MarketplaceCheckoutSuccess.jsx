import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ShoppingCart, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/query/keys';

/**
 * Stripe success landing page.
 *
 * Two URL shapes:
 *   - ?order=<uuid>           (legacy / PO-late-pay path — order_id known up-front)
 *   - ?session=<checkout_session_id>  (new deferred-creation path — order is
 *                                       materialised by the Stripe webhook
 *                                       after payment succeeds; we poll the
 *                                       checkout_sessions row until order_id
 *                                       fills in)
 */
export default function MarketplaceCheckoutSuccess() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialOrderId = params.get('order');
  const sessionId = params.get('session');
  const { userProfile } = useAuth();
  const companyId = userProfile?.company_id;
  const queryClient = useQueryClient();

  const [orderId, setOrderId] = useState(initialOrderId ?? null);
  const [waiting, setWaiting] = useState(!initialOrderId && !!sessionId);
  const [timedOut, setTimedOut] = useState(false);

  // Poll the checkout_sessions row until the webhook fills in order_id.
  useEffect(() => {
    if (orderId || !sessionId) return;
    let cancelled = false;
    const start = Date.now();
    const TIMEOUT_MS = 30_000; // 30s
    const POLL_MS = 2000;

    async function tick() {
      if (cancelled) return;
      const { data } = await supabase
        .from('marketplace_checkout_sessions')
        .select('order_id, status')
        .eq('id', sessionId)
        .maybeSingle();
      if (cancelled) return;
      if (data?.order_id) {
        setOrderId(data.order_id);
        setWaiting(false);
        return;
      }
      if (Date.now() - start > TIMEOUT_MS) {
        setTimedOut(true);
        setWaiting(false);
        return;
      }
      setTimeout(tick, POLL_MS);
    }
    tick();
    return () => { cancelled = true; };
  }, [sessionId, orderId]);

  // Invalidate the buyer orders cache once we know the order_id.
  useEffect(() => {
    if (companyId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant.marketplaceBuyerOrders(companyId) });
      if (orderId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.tenant.marketplaceBuyerOrder(companyId, orderId) });
      }
    }
  }, [companyId, orderId, queryClient]);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Card>
        <CardContent className="py-12 text-center">
          {waiting ? (
            <>
              <Loader2 className="w-10 h-10 text-primary mx-auto mb-4 animate-spin" />
              <h1 className="text-2xl font-semibold mb-1">Confirming your payment…</h1>
              <p className="text-sm text-muted-foreground mb-6">
                Stripe has accepted your payment. Hang tight while we generate your order. This usually takes a few seconds.
              </p>
            </>
          ) : timedOut ? (
            <>
              <CheckCircle2 className="w-12 h-12 text-amber-500 mx-auto mb-4" />
              <h1 className="text-2xl font-semibold mb-1">Payment received</h1>
              <p className="text-sm text-muted-foreground mb-6">
                Your payment went through, but we're still finalising the order record. Check <strong>My Orders</strong> in a minute and the order will be there. You'll also receive a confirmation email.
              </p>
              <div className="flex justify-center gap-2">
                <Button onClick={() => navigate('/marketplace/orders')}>View my orders</Button>
                <Button variant="outline" onClick={() => navigate('/marketplace')}>
                  <ShoppingCart className="w-4 h-4 mr-1.5" /> Keep shopping
                </Button>
              </div>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-12 h-12 text-emerald-600 dark:text-emerald-400 mx-auto mb-4" />
              <h1 className="text-2xl font-semibold mb-1">Payment received</h1>
              <p className="text-sm text-muted-foreground mb-6">
                Your order has been auto-approved. A confirmation email is on the way and Elora will start fulfilment shortly.
              </p>
              <div className="flex justify-center gap-2">
                {orderId && (
                  <Button onClick={() => navigate(`/marketplace/orders/${orderId}`)}>
                    View order
                  </Button>
                )}
                <Button variant="outline" onClick={() => navigate('/marketplace')}>
                  <ShoppingCart className="w-4 h-4 mr-1.5" /> Keep shopping
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
