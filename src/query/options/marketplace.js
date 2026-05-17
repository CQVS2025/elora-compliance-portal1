/**
 * Marketplace query options.
 *
 * Separated into:
 *   - Global lookups       (packaging sizes, settings — readable by all auth users)
 *   - Buyer-facing reads   (catalog, product detail, cart, company settings)
 *   - Admin-facing reads   (admin product list, admin product detail with full pricing,
 *                           per-customer pricing grid, warehouses, companies)
 *
 * RLS does the heavy lifting — these options just shape queries and pass tenant
 * keys for cache invalidation.
 */

import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '../keys';

// ============================================================================
// Global lookups
// ============================================================================

export function packagingSizesOptions() {
  return queryOptions({
    queryKey: queryKeys.global.marketplacePackagingSizes(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketplace_packaging_sizes')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000, // 5 min — lookups are stable
  });
}

export function marketplaceSettingsOptions() {
  return queryOptions({
    queryKey: queryKeys.global.marketplaceSettings(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketplace_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================================================
// Buyer-facing
// ============================================================================

/**
 * Buyer catalog. Returns active products with their resolved (per-customer or
 * default) prices and packaging sizes, plus cover image.
 *
 * Data flow:
 *   1. Pull active products (RLS filters automatically).
 *   2. Pull v_marketplace_buyer_prices for those products (RLS filters to
 *      caller's company-specific prices).
 *   3. Pull packaging sizes (lookup).
 *   4. Pull cover images for those products.
 *   5. Stitch in the client.
 *
 * `companyId` is used only for the cache key (the buyer's company); the
 * actual scoping is done by RLS on the server.
 */
export function buyerCatalogOptions(companyId, filters = {}) {
  return queryOptions({
    queryKey: queryKeys.tenant.marketplaceCatalog(companyId, filters),
    queryFn: async () => {
      const [{ data: products, error: pErr }, { data: prices, error: prErr }, { data: sizes, error: sErr }] = await Promise.all([
        supabase
          .from('marketplace_products')
          .select('id, slug, name, short_description, manufacturer, classification, badge, display_order')
          .eq('is_active', true)
          .order('display_order', { ascending: true }),
        supabase
          .from('v_marketplace_buyer_prices')
          .select('*'),
        supabase
          .from('marketplace_packaging_sizes')
          .select('id, name, short_code, volume_litres, container_type, sort_order')
          .eq('is_active', true)
          .order('sort_order', { ascending: true }),
      ]);
      if (pErr) throw pErr;
      if (prErr) throw prErr;
      if (sErr) throw sErr;

      const productIds = (products ?? []).map((p) => p.id);
      let images = [];
      if (productIds.length > 0) {
        const { data: imgData, error: iErr } = await supabase
          .from('marketplace_product_images')
          .select('product_id, storage_path, alt_text, is_cover')
          .in('product_id', productIds)
          .eq('is_cover', true);
        if (iErr) throw iErr;
        images = imgData ?? [];
      }

      const sizeById = new Map((sizes ?? []).map((s) => [s.id, s]));
      const coverByProductId = new Map(images.map((i) => [i.product_id, i]));
      const pricesByProductId = new Map();
      (prices ?? []).forEach((row) => {
        const list = pricesByProductId.get(row.product_id) ?? [];
        list.push({
          ...row,
          packaging_size: sizeById.get(row.packaging_size_id) ?? null,
        });
        pricesByProductId.set(row.product_id, list);
      });

      return (products ?? []).map((p) => ({
        ...p,
        cover_image: coverByProductId.get(p.id) ?? null,
        prices: (pricesByProductId.get(p.id) ?? [])
          .filter((row) => row.is_available)
          .sort((a, b) => (a.packaging_size?.sort_order ?? 0) - (b.packaging_size?.sort_order ?? 0)),
      })).filter((p) => p.prices.length > 0); // hide products with no available pricing
    },
    enabled: !!companyId,
    staleTime: 30 * 1000,
  });
}

/**
 * Buyer product detail by slug. Includes all packaging prices (via the view)
 * plus full image gallery and any SDS documents.
 */
export function buyerProductDetailOptions(companyId, slug) {
  return queryOptions({
    queryKey: queryKeys.tenant.marketplaceProductDetail(companyId, slug),
    queryFn: async () => {
      const { data: product, error: pErr } = await supabase
        .from('marketplace_products')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle();
      if (pErr) throw pErr;
      if (!product) return null;

      const [
        { data: prices, error: prErr },
        { data: sizes, error: sErr },
        { data: images, error: iErr },
        { data: docs, error: dErr },
      ] = await Promise.all([
        supabase
          .from('v_marketplace_buyer_prices')
          .select('*')
          .eq('product_id', product.id),
        supabase
          .from('marketplace_packaging_sizes')
          .select('*')
          .eq('is_active', true),
        supabase
          .from('marketplace_product_images')
          .select('*')
          .eq('product_id', product.id)
          .order('is_cover', { ascending: false })
          .order('sort_order', { ascending: true }),
        supabase
          .from('marketplace_product_documents')
          .select('id, doc_type, file_name, storage_path, file_size_bytes, mime_type, created_at')
          .eq('product_id', product.id)
          .order('created_at', { ascending: false }),
      ]);
      if (prErr) throw prErr;
      if (sErr) throw sErr;
      if (iErr) throw iErr;
      if (dErr) throw dErr;

      const sizeById = new Map((sizes ?? []).map((s) => [s.id, s]));
      const enriched = (prices ?? [])
        .filter((row) => row.is_available)
        .map((row) => ({ ...row, packaging_size: sizeById.get(row.packaging_size_id) ?? null }))
        .sort((a, b) => (a.packaging_size?.sort_order ?? 0) - (b.packaging_size?.sort_order ?? 0));

      return {
        product,
        prices: enriched,
        images: images ?? [],
        documents: docs ?? [],
      };
    },
    enabled: !!companyId && !!slug,
    staleTime: 30 * 1000,
  });
}

/**
 * Persistent cart for the logged-in user.
 *
 * The product join is intentionally a LEFT join (no `!inner`) so that if an
 * admin deactivates or hides a product the buyer's cart row still appears
 * (with `product: null`) — the UI can then surface a "no longer available"
 * line and let the buyer remove it. With `!inner`, RLS-blocked or removed
 * products would silently drop the cart row, leaving the buyer wondering
 * why their item disappeared.
 *
 * Packaging size is a stable lookup (RLS lets all auth users read it), so
 * `!inner` there is safe and slightly faster.
 */
export function cartOptions(companyId, userId) {
  return queryOptions({
    queryKey: queryKeys.tenant.marketplaceCart(companyId, userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketplace_cart_items')
        .select(`
          id,
          product_id,
          packaging_size_id,
          quantity,
          created_at,
          updated_at,
          product:marketplace_products ( id, slug, name, manufacturer, classification, is_active ),
          packaging_size:marketplace_packaging_sizes!inner ( id, name, short_code, volume_litres, container_type )
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId && !!companyId,
    staleTime: 10 * 1000,
  });
}

/**
 * Per-user marketplace delivery address book. Reads
 * user_profiles.marketplace_saved_addresses for the current user.
 */
export function savedAddressesOptions(companyId, userId) {
  return queryOptions({
    queryKey: queryKeys.tenant.marketplaceSavedAddresses(companyId, userId),
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('user_profiles')
        .select('marketplace_saved_addresses')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      const arr = data?.marketplace_saved_addresses;
      return Array.isArray(arr) ? arr : [];
    },
    enabled: !!userId && !!companyId,
    staleTime: 30 * 1000,
  });
}

// ============================================================================
// Admin-facing
// ============================================================================

export function adminProductListOptions(companyId, filters = {}) {
  return queryOptions({
    queryKey: queryKeys.tenant.marketplaceAdminProducts(companyId, filters),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketplace_products')
        .select(`
          id, slug, name, manufacturer, classification, badge,
          display_order, is_active, created_at, updated_at,
          prices:marketplace_product_packaging_prices ( id, packaging_size_id, price_type, price_per_litre, fixed_price, is_available ),
          images:marketplace_product_images ( id, storage_path, is_cover, sort_order )
        `)
        .order('display_order', { ascending: true })
        // PostgREST: order embedded resources so the cover image is first
        // and the rest fall back to sort_order for stable card display.
        .order('is_cover', { foreignTable: 'images', ascending: false })
        .order('sort_order', { foreignTable: 'images', ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!companyId,
    staleTime: 30 * 1000,
  });
}

export function adminProductDetailOptions(companyId, productId) {
  return queryOptions({
    queryKey: queryKeys.tenant.marketplaceAdminProduct(companyId, productId),
    queryFn: async () => {
      if (!productId || productId === 'new') return null;
      const { data: product, error: pErr } = await supabase
        .from('marketplace_products')
        .select('*')
        .eq('id', productId)
        .maybeSingle();
      if (pErr) throw pErr;
      if (!product) return null;

      const [
        { data: prices, error: prErr },
        { data: images, error: iErr },
        { data: docs, error: dErr },
        { data: questions, error: qErr },
      ] = await Promise.all([
        supabase
          .from('marketplace_product_packaging_prices')
          .select('*')
          .eq('product_id', productId),
        supabase
          .from('marketplace_product_images')
          .select('*')
          .eq('product_id', productId)
          .order('is_cover', { ascending: false })
          .order('sort_order', { ascending: true }),
        supabase
          .from('marketplace_product_documents')
          .select('*')
          .eq('product_id', productId)
          .order('created_at', { ascending: false }),
        supabase
          .from('marketplace_product_checkout_questions')
          .select('*')
          .eq('product_id', productId)
          .order('display_order', { ascending: true }),
      ]);
      if (prErr) throw prErr;
      if (iErr) throw iErr;
      if (dErr) throw dErr;
      if (qErr) throw qErr;

      return {
        product,
        prices: prices ?? [],
        images: images ?? [],
        documents: docs ?? [],
        questions: questions ?? [],
      };
    },
    enabled: !!companyId && !!productId,
    staleTime: 30 * 1000,
  });
}

/**
 * Admin: per-company pricing overrides for a target buyer company.
 * Shows the matrix of (product × packaging_size) → override (if any).
 */
export function adminCompanyPricingOptions(companyId, targetCompanyId) {
  return queryOptions({
    queryKey: queryKeys.tenant.marketplaceAdminCompanyPricing(companyId, targetCompanyId),
    queryFn: async () => {
      if (!targetCompanyId) return { defaults: [], overrides: [] };
      const [{ data: defaults, error: dErr }, { data: overrides, error: oErr }] = await Promise.all([
        supabase
          .from('marketplace_product_packaging_prices')
          .select(`
            id, product_id, packaging_size_id, price_type, price_per_litre, fixed_price,
            minimum_order_quantity, is_available,
            product:marketplace_products!inner ( id, name, slug, is_active ),
            packaging_size:marketplace_packaging_sizes!inner ( id, name, sort_order, volume_litres, container_type )
          `),
        supabase
          .from('marketplace_company_pricing')
          .select('*')
          .eq('company_id', targetCompanyId)
          .is('valid_to', null),
      ]);
      if (dErr) throw dErr;
      if (oErr) throw oErr;
      return {
        defaults: defaults ?? [],
        overrides: overrides ?? [],
      };
    },
    enabled: !!companyId && !!targetCompanyId,
    staleTime: 30 * 1000,
  });
}

export function warehousesOptions(companyId) {
  return queryOptions({
    queryKey: queryKeys.tenant.marketplaceWarehouses(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketplace_warehouses')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!companyId,
    staleTime: 60 * 1000,
  });
}

/**
 * Admin: companies + their marketplace toggles. Returns full companies list
 * including marketplace_enabled, marketplace_invoice_email, etc.
 */
export function marketplaceCompaniesOptions(companyId) {
  return queryOptions({
    queryKey: queryKeys.tenant.marketplaceCompanies(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, slug, email_domain, is_active, marketplace_enabled, marketplace_invoice_email, marketplace_default_address, xero_contact_id, xero_invoicing_enabled, xero_contact_details')
        .order('name', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!companyId,
    staleTime: 60 * 1000,
  });
}

// ============================================================================
// Orders — buyer-side
// ============================================================================

export function buyerOrdersOptions(companyId) {
  return queryOptions({
    queryKey: queryKeys.tenant.marketplaceBuyerOrders(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketplace_orders')
        .select(`
          id, order_number, status, payment_method,
          subtotal_ex_gst, freight_ex_gst, gst_amount, total_amount, currency,
          supplier_dispatch_date, supplier_eta_date, supplier_tracking_url, supplier_tracking_carrier,
          created_at, updated_at,
          buyer_user_id
        `)
        .eq('buyer_company_id', companyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!companyId,
    staleTime: 30 * 1000,
  });
}

export function buyerOrderDetailOptions(companyId, orderId) {
  return queryOptions({
    queryKey: queryKeys.tenant.marketplaceBuyerOrder(companyId, orderId),
    queryFn: async () => {
      if (!orderId) return null;
      const [orderRes, itemsRes, historyRes] = await Promise.all([
        supabase
          .from('marketplace_orders')
          .select('*')
          .eq('id', orderId)
          .maybeSingle(),
        supabase
          .from('marketplace_order_items')
          .select('*')
          .eq('order_id', orderId)
          .order('created_at', { ascending: true }),
        supabase
          .from('marketplace_order_status_history')
          .select('*')
          .eq('order_id', orderId)
          .order('created_at', { ascending: true }),
      ]);
      if (orderRes.error) throw orderRes.error;
      if (itemsRes.error) throw itemsRes.error;
      if (historyRes.error) throw historyRes.error;
      return {
        order: orderRes.data,
        items: itemsRes.data ?? [],
        history: historyRes.data ?? [],
      };
    },
    enabled: !!companyId && !!orderId,
    staleTime: 15 * 1000,
  });
}

// ============================================================================
// Orders — admin-side
// ============================================================================

export function adminOrdersOptions(companyId, filters = {}) {
  return queryOptions({
    queryKey: queryKeys.tenant.marketplaceAdminOrders(companyId, filters),
    queryFn: async () => {
      let q = supabase
        .from('marketplace_orders')
        .select(`
          id, order_number, status, payment_method,
          subtotal_ex_gst, freight_ex_gst, gst_amount, total_amount, currency,
          buyer_company_id, buyer_user_id,
          created_at, updated_at,
          approved_at, rejected_at, rejection_reason,
          supplier_dispatch_date, supplier_eta_date, supplier_tracking_url,
          delivery_postcode, delivery_address,
          stripe_payment_intent_id, xero_invoice_number,
          buyer_company:companies!buyer_company_id ( id, name )
        `)
        .order('created_at', { ascending: false });
      if (filters.status) q = q.eq('status', filters.status);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!companyId,
    staleTime: 20 * 1000,
  });
}

export function adminOrderDetailOptions(companyId, orderId) {
  return queryOptions({
    queryKey: queryKeys.tenant.marketplaceAdminOrder(companyId, orderId),
    queryFn: async () => {
      if (!orderId) return null;
      const [orderRes, itemsRes, historyRes, syncRes] = await Promise.all([
        supabase
          .from('marketplace_orders')
          .select(`
            *,
            buyer_company:companies!buyer_company_id ( id, name, marketplace_invoice_email ),
            warehouse:marketplace_warehouses ( id, name, contact_email )
          `)
          .eq('id', orderId)
          .maybeSingle(),
        supabase
          .from('marketplace_order_items')
          .select('*')
          .eq('order_id', orderId)
          .order('created_at', { ascending: true }),
        supabase
          .from('marketplace_order_status_history')
          .select('*')
          .eq('order_id', orderId)
          .order('created_at', { ascending: true }),
        supabase
          .from('marketplace_xero_sync_log')
          .select('*')
          .eq('order_id', orderId)
          .order('created_at', { ascending: false }),
      ]);
      if (orderRes.error) throw orderRes.error;
      if (itemsRes.error) throw itemsRes.error;
      if (historyRes.error) throw historyRes.error;
      // sync log may fail for non-admin; tolerate
      return {
        order: orderRes.data,
        items: itemsRes.data ?? [],
        history: historyRes.data ?? [],
        xero_log: syncRes.data ?? [],
      };
    },
    enabled: !!companyId && !!orderId,
    staleTime: 15 * 1000,
  });
}

// ============================================================================
// Orders — warehouse-side
// ============================================================================

export function warehouseOrdersOptions(companyId, warehouseId) {
  return queryOptions({
    queryKey: queryKeys.tenant.marketplaceWarehouseOrders(companyId, warehouseId),
    queryFn: async () => {
      if (!warehouseId) return [];
      const { data, error } = await supabase
        .from('marketplace_orders')
        .select(`
          id, order_number, status, payment_method,
          supplier_dispatch_date, supplier_eta_date, supplier_tracking_url, supplier_tracking_carrier, supplier_notes,
          delivery_address, delivery_postcode, delivery_contact_name, delivery_contact_phone, delivery_notes,
          created_at, approved_at,
          site_access_answers
        `)
        .eq('warehouse_id', warehouseId)
        .in('status', ['approved', 'paid', 'dispatched', 'delivered'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!companyId && !!warehouseId,
    staleTime: 30 * 1000,
  });
}

// ============================================================================
// Freight
// ============================================================================

/**
 * All product → rate sheet mappings for the org. One row per
 * (product, packaging_size_id) — NULL packaging_size_id is the
 * product-level default; non-null is a per-size override.
 */
export function productRateSheetMappingsOptions(companyId) {
  return queryOptions({
    queryKey: queryKeys.tenant.marketplaceProductRateSheets(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketplace_product_rate_sheets')
        .select('id, product_id, packaging_size_id, rate_sheet_id, created_at');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!companyId,
    staleTime: 60 * 1000,
  });
}

export function rateSheetsOptions(companyId) {
  return queryOptions({
    queryKey: queryKeys.tenant.marketplaceRateSheets(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketplace_rate_sheets')
        .select(`
          *,
          warehouse:marketplace_warehouses ( id, name, postcode ),
          brackets:marketplace_rate_sheet_brackets ( id, distance_from_km, distance_to_km, rate, zone_name )
        `)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!companyId,
    staleTime: 60 * 1000,
  });
}

// ============================================================================
// Integrations
// ============================================================================

export function integrationLogOptions(companyId, filters = {}) {
  return queryOptions({
    queryKey: queryKeys.tenant.marketplaceIntegrationLog(companyId, filters),
    queryFn: async () => {
      let q = supabase
        .from('marketplace_integration_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (filters.integration) q = q.eq('integration', filters.integration);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!companyId,
    staleTime: 15 * 1000,
  });
}

export function xeroCredentialsOptions(companyId) {
  return queryOptions({
    queryKey: queryKeys.tenant.marketplaceXeroCredentials(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketplace_xero_credentials')
        .select('id, tenant_id, tenant_name, expires_at, connected_at, last_refreshed_at, revenue_account_code, freight_account_code, gst_tax_type, branding_theme_id, po_sender_email')
        .eq('id', 1)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    enabled: !!companyId,
    staleTime: 60 * 1000,
  });
}
