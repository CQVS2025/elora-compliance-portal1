import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Trash2, Plus, Minus, AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import {
  cartOptions,
  buyerCatalogOptions,
  marketplaceSettingsOptions,
} from '@/query/options/marketplace';
import {
  useUpdateCartQuantity,
  useRemoveFromCart,
  useClearCart,
} from '@/query/mutations/marketplace';
import { toastError, toastSuccess } from '@/lib/toast';
import { calculateLineSubtotal, formatAUD } from '@/lib/marketplaceFormat';
import { useConfirm } from '@/hooks/useConfirm';
import { MarketplaceEmpty } from '@/components/marketplace/MarketplaceEmpty';
import { HazardBadge } from '@/components/marketplace/HazardBadge';

/**
 * Persistent cart. Prices are NOT snapshotted on the cart row — they re-resolve
 * via v_marketplace_buyer_prices through the catalog query, so admin price
 * changes propagate immediately to live carts.
 */
export default function MarketplaceCart() {
  const navigate = useNavigate();
  const { userProfile, user } = useAuth();
  const companyId = userProfile?.company_id;
  const userId = user?.id;

  const { data: items = [], isLoading } = useQuery(cartOptions(companyId, userId));
  const { data: catalog = [] } = useQuery(buyerCatalogOptions(companyId));
  const { data: settings } = useQuery(marketplaceSettingsOptions());
  const gstRate = Number(settings?.gst_rate ?? 0.10);
  const gstPercentLabel = `${(gstRate * 100).toFixed(gstRate * 100 % 1 === 0 ? 0 : 1)}%`;

  const updateQty = useUpdateCartQuantity(companyId, userId);
  const removeItem = useRemoveFromCart(companyId, userId);
  const clearCart = useClearCart(companyId, userId);
  const { confirm, ConfirmDialog } = useConfirm();

  // Build a lookup of resolved prices: keyed by (product_id, packaging_size_id).
  const priceLookup = useMemo(() => {
    const map = new Map();
    catalog.forEach((p) => {
      (p.prices ?? []).forEach((row) => {
        map.set(`${p.id}::${row.packaging_size_id}`, row);
      });
    });
    return map;
  }, [catalog]);

  const enriched = useMemo(() => {
    return items.map((item) => {
      const priceRow = priceLookup.get(`${item.product_id}::${item.packaging_size_id}`);
      const subtotal = priceRow
        ? calculateLineSubtotal({
            priceType: priceRow.price_type,
            pricePerLitre: priceRow.price_per_litre,
            fixedPrice: priceRow.fixed_price,
            volumeLitres: item.packaging_size?.volume_litres ?? priceRow.packaging_size?.volume_litres,
            quantity: item.quantity,
          })
        : null;
      return { ...item, priceRow, subtotal };
    });
  }, [items, priceLookup]);

  const totalExGst = enriched.reduce((sum, it) => sum + (it.subtotal?.lineSubtotalExGst ?? 0), 0);
  const gstEstimate = totalExGst * gstRate;
  const grandTotalEstimate = totalExGst + gstEstimate;

  const handleQtyChange = async (cartItemId, quantity) => {
    try {
      await updateQty.mutateAsync({ cartItemId, quantity });
    } catch (e) {
      toastError(e, 'updating quantity');
    }
  };

  const handleRemove = async (cartItemId) => {
    try {
      await removeItem.mutateAsync(cartItemId);
      toastSuccess('remove', 'item');
    } catch (e) {
      toastError(e, 'removing item');
    }
  };

  const handleClear = async () => {
    const ok = await confirm({
      title: 'Empty your entire cart?',
      description: 'This removes every item from your cart. You can re-add them later from the marketplace.',
      confirmLabel: 'Empty cart',
      destructive: true,
    });
    if (!ok) return;
    try {
      await clearCart.mutateAsync();
      toastSuccess('delete', 'cart');
    } catch (e) {
      toastError(e, 'clearing cart');
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-start gap-3">
        <div className="p-2 rounded-md bg-primary/10 text-primary">
          <ShoppingCart className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">My cart</h1>
          <p className="text-sm text-muted-foreground">
            {items.length === 0 ? 'No items yet.' : `${items.length} item${items.length === 1 ? '' : 's'}`}
          </p>
        </div>
      </div>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Loading cart…</p>
      ) : items.length === 0 ? (
        <MarketplaceEmpty
          title="Your cart is empty."
          description="Browse the marketplace to add items."
          action={(
            <Button asChild>
              <Link to="/marketplace">Browse marketplace</Link>
            </Button>
          )}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-3">
            {enriched.map((item) => {
              const productMissing = !item.product;
              const productInactive = item.product && item.product.is_active === false;
              const unavailable = productMissing || productInactive || !item.priceRow;
              return (
              <Card
                key={item.id}
                className={unavailable
                  ? 'border-amber-200 bg-amber-50/30 dark:border-amber-900 dark:bg-amber-950/20'
                  : undefined}
              >
                <CardContent className="p-4 grid grid-cols-12 gap-3 items-center">
                  <div className="col-span-12 sm:col-span-5">
                    {item.product?.slug ? (
                      <Link to={`/marketplace/products/${item.product.slug}`} className="font-medium hover:underline">
                        {item.product.name}
                      </Link>
                    ) : (
                      <span className="font-medium text-muted-foreground">No longer available</span>
                    )}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {item.product && <HazardBadge classification={item.product.classification} />}
                      <span className="text-xs text-muted-foreground">{item.packaging_size?.name}</span>
                      {unavailable && (
                        <Badge
                          variant="outline"
                          className="gap-1 border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                        >
                          <AlertTriangle className="w-3 h-3" />
                          Unavailable
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleQtyChange(item.id, Math.max(1, item.quantity - 1))}
                        disabled={updateQty.isPending || removeItem.isPending}
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </Button>
                      <Input
                        type="number"
                        min="0"
                        value={item.quantity}
                        onChange={(e) => handleQtyChange(item.id, Math.max(0, Number(e.target.value) || 0))}
                        className="w-16 h-8 text-center"
                        disabled={updateQty.isPending}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleQtyChange(item.id, item.quantity + 1)}
                        disabled={updateQty.isPending || removeItem.isPending}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                      {updateQty.isPending && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground ml-1" />
                      )}
                    </div>
                  </div>
                  <div className="col-span-4 sm:col-span-3 text-right">
                    {item.subtotal ? (
                      <>
                        <p className="font-semibold">{formatAUD(item.subtotal.lineSubtotalExGst)}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatAUD(item.subtotal.unitPriceExGst)} / pack
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">Price unavailable</p>
                    )}
                  </div>
                  <div className="col-span-2 sm:col-span-1 flex justify-end">
                    <Button variant="ghost" size="icon" onClick={() => handleRemove(item.id)} disabled={removeItem.isPending} title="Remove">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
              );
            })}
            <div className="flex justify-end pt-1">
              <Button variant="ghost" size="sm" onClick={handleClear} disabled={clearCart.isPending}>
                Empty cart
              </Button>
            </div>
          </div>
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle className="text-base">Summary</CardTitle>
                <CardDescription>Indicative. Final freight, GST and discounts apply at checkout.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal (ex-GST)</span>
                  <span>{formatAUD(totalExGst)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">GST ({gstPercentLabel}, est.)</span>
                  <span className="text-muted-foreground">{formatAUD(gstEstimate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Freight</span>
                  <span className="text-xs text-muted-foreground">at checkout</span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>Estimated total</span>
                  <span>{formatAUD(grandTotalEstimate)}</span>
                </div>
                <Button
                  className="w-full mt-3"
                  onClick={() => navigate('/marketplace/checkout')}
                  disabled={enriched.some((it) => !it.priceRow)}
                >
                  Continue to checkout
                </Button>
                <p className="text-[11px] text-muted-foreground text-center">
                  Freight, GST and payment method are confirmed on the next step.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
      {ConfirmDialog}
    </div>
  );
}
