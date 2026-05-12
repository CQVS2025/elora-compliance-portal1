import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, ShoppingCart, FileText, Loader2, Plus, Minus, Eye } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { buyerProductDetailOptions } from '@/query/options/marketplace';
import { useAddToCart } from '@/query/mutations/marketplace';
import { toastError, toastSuccess } from '@/lib/toast';
import { useMarketplaceAccess } from '@/hooks/useMarketplaceAccess';
import { MarketplaceImage } from '@/components/marketplace/MarketplaceImage';
import { HazardBadge } from '@/components/marketplace/HazardBadge';
import { PriceTag } from '@/components/marketplace/PriceTag';
import { PackagingSelector } from '@/components/marketplace/PackagingSelector';
import { calculateLineSubtotal, formatAUD } from '@/lib/marketplaceFormat';

export default function MarketplaceProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { userProfile, user } = useAuth();
  const companyId = userProfile?.company_id;

  const { data, isLoading } = useQuery(buyerProductDetailOptions(companyId, slug));
  const addToCart = useAddToCart(companyId, user?.id);
  const { canShop } = useMarketplaceAccess();

  const [selectedSizeId, setSelectedSizeId] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  const selectedPrice = useMemo(
    () => (data?.prices ?? []).find((r) => r.packaging_size_id === selectedSizeId),
    [data?.prices, selectedSizeId]
  );

  // Set defaults once detail loads.
  useEffect(() => {
    if (data?.prices?.length && !selectedSizeId) {
      const first = data.prices[0];
      setSelectedSizeId(first.packaging_size_id);
      setQuantity(first.minimum_order_quantity ?? 1);
    }
  }, [data, selectedSizeId]);

  const lineSubtotal = useMemo(() => {
    if (!selectedPrice) return null;
    return calculateLineSubtotal({
      priceType: selectedPrice.price_type,
      pricePerLitre: selectedPrice.price_per_litre,
      fixedPrice: selectedPrice.fixed_price,
      volumeLitres: selectedPrice.packaging_size?.volume_litres,
      quantity,
    });
  }, [selectedPrice, quantity]);

  const handleAdd = async () => {
    if (!selectedPrice) return;
    if (quantity < (selectedPrice.minimum_order_quantity ?? 1)) {
      toastError(new Error(`Minimum order quantity is ${selectedPrice.minimum_order_quantity}`), 'add to cart');
      return;
    }
    try {
      await addToCart.mutateAsync({
        productId: data.product.id,
        packagingSizeId: selectedSizeId,
        quantity,
      });
      toastSuccess('add', 'item to cart');
    } catch (e) {
      toastError(e, 'adding to cart');
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data?.product) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => navigate('/marketplace')}>
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to marketplace
        </Button>
        <Card className="mt-4">
          <CardContent className="py-12 text-center">
            <p className="text-base font-medium mb-1">Product not found</p>
            <p className="text-sm text-muted-foreground">It may have been removed or made inactive.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { product, prices, images, documents } = data;
  const activeImage = images[activeImageIdx] ?? images[0];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate('/marketplace')} className="mb-4">
        <ArrowLeft className="w-4 h-4 mr-1.5" /> Marketplace
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gallery */}
        <div className="space-y-3">
          <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden">
            <MarketplaceImage
              storagePath={activeImage?.storage_path}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>
          {images.length > 1 && (
            <div className="grid grid-cols-5 gap-2">
              {images.map((img, i) => (
                <button
                  type="button"
                  key={img.id}
                  className={`aspect-square bg-muted rounded overflow-hidden border-2 transition-colors ${i === activeImageIdx ? 'border-primary' : 'border-transparent'}`}
                  onClick={() => setActiveImageIdx(i)}
                >
                  <MarketplaceImage storagePath={img.storage_path} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          {product.badge && <p className="text-xs uppercase tracking-wider text-primary font-semibold mb-1">{product.badge}</p>}
          <h1 className="text-2xl font-semibold">{product.name}</h1>
          {product.manufacturer && (
            <p className="text-sm text-muted-foreground mt-1">{product.manufacturer}</p>
          )}
          <div className="flex items-center gap-2 mt-3">
            <HazardBadge classification={product.classification} />
            {product.un_number && <Badge variant="outline" className="text-xs">UN {product.un_number}</Badge>}
            {product.cas_number && <Badge variant="outline" className="text-xs">CAS {product.cas_number}</Badge>}
          </div>

          {product.short_description && (
            <p className="mt-4 text-sm">{product.short_description}</p>
          )}
          {product.long_description && (
            <p className="mt-2 text-sm text-muted-foreground whitespace-pre-line">{product.long_description}</p>
          )}
          {product.delivery_info && (
            <p className="mt-2 text-xs text-muted-foreground italic whitespace-pre-line">
              <span className="not-italic font-semibold mr-1">Delivery:</span>{product.delivery_info}
            </p>
          )}

          {!canShop && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              <Eye className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                You're previewing as an administrator. Adding to cart is reserved for buyer accounts in marketplace-enabled companies.
              </span>
            </div>
          )}

          <Separator className="my-5" />

          {/* Packaging selector */}
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Packaging</p>
          <PackagingSelector
            prices={prices}
            selectedSizeId={selectedSizeId}
            onChange={(id) => {
              setSelectedSizeId(id);
              const newRow = prices.find((r) => r.packaging_size_id === id);
              if (newRow) setQuantity(newRow.minimum_order_quantity ?? 1);
            }}
          />

          {selectedPrice ? (
            <div className="mt-4 p-4 rounded-lg border bg-muted/30">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <PriceTag priceRow={selectedPrice} />
                  <p className="text-xs text-muted-foreground mt-1">
                    Min order qty: {selectedPrice.minimum_order_quantity}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Quantity</p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setQuantity((q) => Math.max((selectedPrice.minimum_order_quantity ?? 1), q - 1))}
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </Button>
                    <Input
                      type="number"
                      min={selectedPrice.minimum_order_quantity ?? 1}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                      className="w-16 h-8 text-center"
                    />
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setQuantity((q) => q + 1)}>
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
              {lineSubtotal && (
                <div className="mt-3 pt-3 border-t flex items-baseline justify-between">
                  <p className="text-xs text-muted-foreground">Line subtotal (ex-GST)</p>
                  <p className="text-lg font-semibold">{formatAUD(lineSubtotal.lineSubtotalExGst)}</p>
                </div>
              )}
              <Button
                className="w-full mt-3"
                onClick={handleAdd}
                disabled={addToCart.isPending || !selectedPrice || !canShop}
                title={!canShop ? 'Adding to cart requires a buyer account in a marketplace-enabled company.' : undefined}
              >
                <ShoppingCart className="w-4 h-4 mr-1.5" />
                {canShop ? 'Add to cart' : 'Add to cart (preview only)'}
              </Button>
              <p className="text-[11px] text-muted-foreground mt-2 text-center">
                Checkout, freight quoting and Xero invoicing arrive in the next release.
              </p>
            </div>
          ) : null}

          {/* SDS / docs */}
          {documents.length > 0 && (
            <Card className="mt-5">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Safety &amp; documents</CardTitle>
                <CardDescription>SDS and other product documents.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {documents.map((d) => (
                    <SDSDocLink key={d.id} doc={d} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Hazard info detail */}
          {(product.safety_info || product.hazard_class || product.packing_group) && (
            <Card className="mt-5">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Hazard &amp; handling</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                {product.hazard_class && <p><span className="text-muted-foreground">Hazard class:</span> {product.hazard_class}</p>}
                {product.packing_group && <p><span className="text-muted-foreground">Packing group:</span> {product.packing_group}</p>}
                {product.safety_info && <p className="text-muted-foreground whitespace-pre-line pt-2">{product.safety_info}</p>}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function SDSDocLink({ doc }) {
  const [signedUrl, setSignedUrl] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data, error } = await supabase.storage
          .from('marketplace-product-sds')
          .createSignedUrl(doc.storage_path, 60 * 10);
        if (error) throw error;
        if (alive) setSignedUrl(data?.signedUrl);
      } catch (_) { /* ignore — link will fall back */ }
    })();
    return () => { alive = false; };
  }, [doc.storage_path]);

  return (
    <a
      href={signedUrl ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 text-sm p-2 border rounded-md hover:bg-muted transition-colors"
    >
      <FileText className="w-4 h-4 text-muted-foreground" />
      <span className="flex-1">{doc.file_name}</span>
      <Badge variant="outline" className="text-[10px] uppercase">{doc.doc_type}</Badge>
    </a>
  );
}
