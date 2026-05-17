/**
 * Marketplace mutations.
 *
 * - Cart mutations (buyer): add/update/remove. Direct supabase.from() — RLS
 *   ensures user_id = auth.uid() and the BEFORE INSERT trigger forces
 *   company_id to match the user's profile.
 *
 * - Admin mutations: product CRUD, packaging price CRUD, per-company override
 *   CRUD, warehouse CRUD, per-company toggle. RLS confines writes to admins.
 *
 * All mutations invalidate the relevant query keys on success.
 */

import { useMutation } from '@tanstack/react-query';
import { supabase, callEdgeFunction } from '@/lib/supabase';
import { queryClientInstance } from '@/lib/query-client';
import { queryKeys } from '../keys';

// ============================================================================
// Cart (buyer)
// ============================================================================

export function useAddToCart(companyId, userId) {
  return useMutation({
    mutationFn: async ({ productId, packagingSizeId, quantity }) => {
      // Upsert (one row per (user, product, size) due to UNIQUE).
      const { data, error } = await supabase
        .from('marketplace_cart_items')
        .upsert(
          {
            user_id: userId,
            product_id: productId,
            packaging_size_id: packagingSizeId,
            quantity,
          },
          { onConflict: 'user_id,product_id,packaging_size_id' }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.marketplaceCart(companyId, userId),
      });
    },
  });
}

export function useUpdateCartQuantity(companyId, userId) {
  return useMutation({
    mutationFn: async ({ cartItemId, quantity }) => {
      if (quantity <= 0) {
        const { error } = await supabase
          .from('marketplace_cart_items')
          .delete()
          .eq('id', cartItemId);
        if (error) throw error;
        return null;
      }
      const { data, error } = await supabase
        .from('marketplace_cart_items')
        .update({ quantity })
        .eq('id', cartItemId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.marketplaceCart(companyId, userId),
      });
    },
  });
}

export function useRemoveFromCart(companyId, userId) {
  return useMutation({
    mutationFn: async (cartItemId) => {
      const { error } = await supabase
        .from('marketplace_cart_items')
        .delete()
        .eq('id', cartItemId);
      if (error) throw error;
      return cartItemId;
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.marketplaceCart(companyId, userId),
      });
    },
  });
}

export function useClearCart(companyId, userId) {
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('marketplace_cart_items')
        .delete()
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.marketplaceCart(companyId, userId),
      });
    },
  });
}

// ============================================================================
// Per-user saved delivery addresses (address book on checkout)
// ============================================================================

function genId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `addr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Append a new address to the current user's marketplace_saved_addresses
 * array. The whole array is read, the new entry is pushed (deduped by
 * line1+postcode), and the array is written back. Concurrent writes from
 * two tabs are not handled — fine for an interactive checkout use case.
 */
export function useSaveDeliveryAddress(companyId, userId) {
  return useMutation({
    mutationFn: async (address) => {
      if (!userId) throw new Error('Not signed in');

      const { data: row, error: readErr } = await supabase
        .from('user_profiles')
        .select('marketplace_saved_addresses')
        .eq('id', userId)
        .maybeSingle();
      if (readErr) throw readErr;

      const existing = Array.isArray(row?.marketplace_saved_addresses)
        ? row.marketplace_saved_addresses
        : [];

      // Dedupe — collapse onto an existing entry that matches line1 + postcode
      const matchIdx = existing.findIndex(
        (a) =>
          String(a?.line1 ?? '').trim().toLowerCase() === String(address.line1 ?? '').trim().toLowerCase() &&
          String(a?.postcode ?? '').trim() === String(address.postcode ?? '').trim()
      );

      const cleaned = {
        id: matchIdx >= 0 ? existing[matchIdx].id : genId(),
        label: (address.label ?? '').trim() || (address.suburb ?? '').trim() || 'Saved address',
        line1: address.line1 ?? '',
        line2: address.line2 ?? '',
        suburb: address.suburb ?? '',
        state: address.state ?? '',
        postcode: address.postcode ?? '',
        contact_name: address.contact_name ?? '',
        contact_phone: address.contact_phone ?? '',
        created_at: matchIdx >= 0 ? existing[matchIdx].created_at : new Date().toISOString(),
      };

      const next = matchIdx >= 0
        ? existing.map((a, i) => (i === matchIdx ? cleaned : a))
        : [cleaned, ...existing];

      const { error: writeErr } = await supabase
        .from('user_profiles')
        .update({ marketplace_saved_addresses: next })
        .eq('id', userId);
      if (writeErr) throw writeErr;
      return cleaned;
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.marketplaceSavedAddresses(companyId, userId),
      });
    },
  });
}

export function useDeleteSavedAddress(companyId, userId) {
  return useMutation({
    mutationFn: async (addressId) => {
      if (!userId) throw new Error('Not signed in');
      const { data: row, error: readErr } = await supabase
        .from('user_profiles')
        .select('marketplace_saved_addresses')
        .eq('id', userId)
        .maybeSingle();
      if (readErr) throw readErr;
      const existing = Array.isArray(row?.marketplace_saved_addresses)
        ? row.marketplace_saved_addresses
        : [];
      const next = existing.filter((a) => a?.id !== addressId);
      const { error: writeErr } = await supabase
        .from('user_profiles')
        .update({ marketplace_saved_addresses: next })
        .eq('id', userId);
      if (writeErr) throw writeErr;
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.marketplaceSavedAddresses(companyId, userId),
      });
    },
  });
}

// ============================================================================
// Admin: Marketplace-wide settings (seller company designation, GST defaults)
// ============================================================================

export function useUpdateMarketplaceSettings() {
  return useMutation({
    mutationFn: async (patch) => {
      const updates = { ...patch };
      // Singleton row id is always 1.
      const { data, error } = await supabase
        .from('marketplace_settings')
        .update(updates)
        .eq('id', 1)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.global.marketplaceSettings(),
      });
    },
  });
}

// ============================================================================
// Admin: Per-company toggle + invoice email
// ============================================================================

export function useUpdateCompanyMarketplace(companyId) {
  return useMutation({
    mutationFn: async ({ targetCompanyId, marketplace_enabled, marketplace_invoice_email, marketplace_default_address }) => {
      const updates = {};
      if (marketplace_enabled !== undefined) updates.marketplace_enabled = marketplace_enabled;
      if (marketplace_invoice_email !== undefined) updates.marketplace_invoice_email = marketplace_invoice_email;
      if (marketplace_default_address !== undefined) updates.marketplace_default_address = marketplace_default_address;
      const { data, error } = await supabase
        .from('companies')
        .update(updates)
        .eq('id', targetCompanyId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.marketplaceCompanies(companyId),
      });
    },
  });
}

/**
 * Register or unregister a buyer company in Xero. Super_admin only — the
 * Edge Function enforces it. Registering creates a Xero Contact (or reuses
 * the existing xero_contact_id) and sets xero_invoicing_enabled=true.
 * Unregistering only flips xero_invoicing_enabled to false; the Xero
 * contact itself is preserved so re-enabling doesn't duplicate it.
 *
 * Pass `details` to persist the rich xero_contact_details payload (ABN,
 * addresses, phone, primary person, …) before the upsert.
 */
export function useRegisterCompanyInXero(companyId) {
  return useMutation({
    mutationFn: async ({ targetCompanyId, enabled = true, details }) => {
      return await callEdgeFunction('marketplace_xero_register_contact', {
        company_id: targetCompanyId,
        enabled,
        ...(details ? { details } : {}),
      });
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.marketplaceCompanies(companyId),
      });
    },
  });
}

/**
 * Push an update to an already-linked Xero contact. Used by the
 * "Edit Xero details" dialog on the Customer Marketplace Access page.
 */
export function useUpdateCompanyXeroContact(companyId) {
  return useMutation({
    mutationFn: async ({ targetCompanyId, details }) => {
      return await callEdgeFunction('marketplace_xero_update_contact', {
        company_id: targetCompanyId,
        details,
      });
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.marketplaceCompanies(companyId),
      });
    },
  });
}

/**
 * Archive a buyer company's Xero contact (Xero soft-delete) AND clear the
 * local link so the row falls back to "Not in Xero". The buyer's
 * marketplace toggle is preserved.
 */
export function useArchiveCompanyXeroContact(companyId) {
  return useMutation({
    mutationFn: async ({ targetCompanyId }) => {
      return await callEdgeFunction('marketplace_xero_archive_contact', {
        company_id: targetCompanyId,
      });
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.marketplaceCompanies(companyId),
      });
    },
  });
}

/**
 * Register a third-party supplier-managed warehouse in Xero as a supplier
 * contact. Same UX/flow as buyer-company registration but writes to
 * marketplace_warehouses.xero_contact_id. Super-admin only.
 */
export function useRegisterWarehouseInXero(companyId) {
  return useMutation({
    mutationFn: async ({ warehouseId, details }) => {
      return await callEdgeFunction('marketplace_xero_register_warehouse_contact', {
        warehouse_id: warehouseId,
        ...(details ? { details } : {}),
      });
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.marketplaceWarehouses(companyId),
      });
    },
  });
}

export function useUpdateWarehouseXeroContact(companyId) {
  return useMutation({
    mutationFn: async ({ warehouseId, details }) => {
      return await callEdgeFunction('marketplace_xero_update_warehouse_contact', {
        warehouse_id: warehouseId,
        details,
      });
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.marketplaceWarehouses(companyId),
      });
    },
  });
}

export function useArchiveWarehouseXeroContact(companyId) {
  return useMutation({
    mutationFn: async ({ warehouseId }) => {
      return await callEdgeFunction('marketplace_xero_archive_warehouse_contact', {
        warehouse_id: warehouseId,
      });
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.marketplaceWarehouses(companyId),
      });
    },
  });
}

// ============================================================================
// Admin: Warehouses
// ============================================================================

export function useUpsertWarehouse(companyId) {
  return useMutation({
    mutationFn: async (warehouse) => {
      if (warehouse.id) {
        const { data, error } = await supabase
          .from('marketplace_warehouses')
          .update(warehouse)
          .eq('id', warehouse.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from('marketplace_warehouses')
        .insert(warehouse)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.marketplaceWarehouses(companyId),
      });
    },
  });
}

export function useDeleteWarehouse(companyId) {
  return useMutation({
    mutationFn: async (warehouseId) => {
      const { error } = await supabase
        .from('marketplace_warehouses')
        .delete()
        .eq('id', warehouseId);
      if (error) throw error;
      return warehouseId;
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.marketplaceWarehouses(companyId),
      });
    },
  });
}

// ============================================================================
// Admin: Products
// ============================================================================

export function useUpsertProduct(companyId) {
  return useMutation({
    mutationFn: async (product) => {
      if (product.id) {
        const { data, error } = await supabase
          .from('marketplace_products')
          .update(product)
          .eq('id', product.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from('marketplace_products')
        .insert(product)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.marketplaceAdminProducts(companyId),
      });
      if (data?.id) {
        queryClientInstance.invalidateQueries({
          queryKey: queryKeys.tenant.marketplaceAdminProduct(companyId, data.id),
        });
      }
    },
  });
}

export function useDeleteProduct(companyId) {
  return useMutation({
    mutationFn: async (productId) => {
      const { error } = await supabase
        .from('marketplace_products')
        .delete()
        .eq('id', productId);
      if (error) throw error;
      return productId;
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.marketplaceAdminProducts(companyId),
      });
    },
  });
}

// ============================================================================
// Admin: Packaging prices (defaults)
// ============================================================================

export function useUpsertPackagingPrice(companyId, productId) {
  return useMutation({
    mutationFn: async (priceRow) => {
      if (priceRow.id) {
        const { data, error } = await supabase
          .from('marketplace_product_packaging_prices')
          .update(priceRow)
          .eq('id', priceRow.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from('marketplace_product_packaging_prices')
        .insert({ ...priceRow, product_id: productId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.marketplaceAdminProduct(companyId, productId),
      });
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.marketplaceAdminProducts(companyId),
      });
    },
  });
}

export function useDeletePackagingPrice(companyId, productId) {
  return useMutation({
    mutationFn: async (priceId) => {
      const { error } = await supabase
        .from('marketplace_product_packaging_prices')
        .delete()
        .eq('id', priceId);
      if (error) throw error;
      return priceId;
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.marketplaceAdminProduct(companyId, productId),
      });
    },
  });
}

// ============================================================================
// Admin: Per-company pricing overrides
// ============================================================================

export function useUpsertCompanyPricing(companyId, targetCompanyId) {
  return useMutation({
    mutationFn: async (override) => {
      // override: { id?, product_id, packaging_size_id, price_type, price_per_litre|null, fixed_price|null, minimum_order_quantity|null, notes|null }
      const payload = {
        ...override,
        company_id: targetCompanyId,
      };
      if (override.id) {
        const { data, error } = await supabase
          .from('marketplace_company_pricing')
          .update(payload)
          .eq('id', override.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from('marketplace_company_pricing')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.marketplaceAdminCompanyPricing(companyId, targetCompanyId),
      });
    },
  });
}

export function useDeleteCompanyPricing(companyId, targetCompanyId) {
  return useMutation({
    mutationFn: async (overrideId) => {
      const { error } = await supabase
        .from('marketplace_company_pricing')
        .delete()
        .eq('id', overrideId);
      if (error) throw error;
      return overrideId;
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.marketplaceAdminCompanyPricing(companyId, targetCompanyId),
      });
    },
  });
}

// ============================================================================
// Admin: Product images and documents
// ============================================================================

export function useUploadProductImage(companyId, productId) {
  return useMutation({
    mutationFn: async ({ file, isCover = false, altText = '' }) => {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${productId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('marketplace-product-images')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      // If marking as cover, clear any existing cover for this product first.
      if (isCover) {
        await supabase
          .from('marketplace_product_images')
          .update({ is_cover: false })
          .eq('product_id', productId)
          .eq('is_cover', true);
      }

      const { data, error } = await supabase
        .from('marketplace_product_images')
        .insert({
          product_id: productId,
          storage_path: path,
          alt_text: altText,
          is_cover: isCover,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.marketplaceAdminProduct(companyId, productId),
      });
    },
  });
}

export function useDeleteProductImage(companyId, productId) {
  return useMutation({
    mutationFn: async (image) => {
      // Best-effort storage cleanup; DB delete is the authoritative action.
      try {
        await supabase.storage.from('marketplace-product-images').remove([image.storage_path]);
      } catch (_) { /* ignore — orphaned objects don't break the app */ }
      const { error } = await supabase
        .from('marketplace_product_images')
        .delete()
        .eq('id', image.id);
      if (error) throw error;
      return image.id;
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.marketplaceAdminProduct(companyId, productId),
      });
    },
  });
}

export function useUploadProductDocument(companyId, productId) {
  return useMutation({
    mutationFn: async ({ file, docType = 'sds' }) => {
      const ext = (file.name.split('.').pop() || 'pdf').toLowerCase();
      if (ext !== 'pdf') {
        throw new Error('Only PDF documents are accepted.');
      }
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('File too large (10 MB maximum).');
      }
      const path = `${productId}/${docType}/${crypto.randomUUID()}.pdf`;
      const { error: upErr } = await supabase.storage
        .from('marketplace-product-sds')
        .upload(path, file, { contentType: 'application/pdf', upsert: false });
      if (upErr) throw upErr;

      const { data, error } = await supabase
        .from('marketplace_product_documents')
        .insert({
          product_id: productId,
          doc_type: docType,
          file_name: file.name,
          storage_path: path,
          file_size_bytes: file.size,
          mime_type: 'application/pdf',
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.marketplaceAdminProduct(companyId, productId),
      });
    },
  });
}

export function useDeleteProductDocument(companyId, productId) {
  return useMutation({
    mutationFn: async (doc) => {
      try {
        await supabase.storage.from('marketplace-product-sds').remove([doc.storage_path]);
      } catch (_) { /* ignore */ }
      const { error } = await supabase
        .from('marketplace_product_documents')
        .delete()
        .eq('id', doc.id);
      if (error) throw error;
      return doc.id;
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.marketplaceAdminProduct(companyId, productId),
      });
    },
  });
}

// ============================================================================
// Admin: Checkout questions (kept in M1; rendered in M2)
// ============================================================================

export function useUpsertCheckoutQuestion(companyId, productId) {
  return useMutation({
    mutationFn: async (question) => {
      if (question.id) {
        const { data, error } = await supabase
          .from('marketplace_product_checkout_questions')
          .update(question)
          .eq('id', question.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from('marketplace_product_checkout_questions')
        .insert({ ...question, product_id: productId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.marketplaceAdminProduct(companyId, productId),
      });
    },
  });
}

export function useDeleteCheckoutQuestion(companyId, productId) {
  return useMutation({
    mutationFn: async (questionId) => {
      const { error } = await supabase
        .from('marketplace_product_checkout_questions')
        .delete()
        .eq('id', questionId);
      if (error) throw error;
      return questionId;
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.marketplaceAdminProduct(companyId, productId),
      });
    },
  });
}

// ============================================================================
// Freight quote (calls Edge Function)
// ============================================================================

export function useFreightQuote() {
  return useMutation({
    mutationFn: async ({ lines, delivery_postcode, delivery_address }) => {
      return await callEdgeFunction('marketplace_freight_quote', {
        lines,
        delivery_postcode,
        // Optional — when present, the backend forwards the full street to
        // Google so LVR postcodes (1xxx/8xxx/9xxx) resolve correctly.
        delivery_address: delivery_address ?? null,
      });
    },
  });
}

// ============================================================================
// Order create (calls Edge Function)
// ============================================================================

export function useCreateOrder(companyId, userId) {
  return useMutation({
    mutationFn: async (payload) => {
      return await callEdgeFunction('marketplace_create_order', payload);
    },
    onSuccess: () => {
      // Wipe cart cache, refresh buyer orders
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.marketplaceCart(companyId, userId),
      });
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.marketplaceBuyerOrders(companyId),
      });
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.marketplaceAdminOrders(companyId),
      });
    },
  });
}

// ============================================================================
// PO upload helper (client-side direct to storage)
// ============================================================================

const ALLOWED_PO_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

export function useUploadPOPdf(companyId) {
  return useMutation({
    mutationFn: async ({ file, orderTempId }) => {
      if (!ALLOWED_PO_MIME.has(file.type)) {
        throw new Error('PO must be a PDF, Word, Excel, or image (JPG/PNG/WebP) file.');
      }
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('Attachment is larger than the 10 MB maximum.');
      }
      const ext = (file.name.split('.').pop() || 'pdf').toLowerCase();
      const path = `${companyId}/${orderTempId ?? crypto.randomUUID()}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from('marketplace-po-uploads')
        .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
      if (error) throw error;
      return {
        storage_path: path,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
      };
    },
  });
}

// ============================================================================
// Order approval (admin) — calls Edge Function
// ============================================================================

export function useApproveOrder(companyId) {
  return useMutation({
    mutationFn: async ({ order_id, action, reason }) => {
      return await callEdgeFunction('marketplace_approve_order', { order_id, action, reason });
    },
    onSuccess: (_data, { order_id }) => {
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.marketplaceAdminOrders(companyId),
      });
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.marketplaceAdminOrder(companyId, order_id),
      });
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.marketplaceBuyerOrders(companyId),
      });
    },
  });
}

// ============================================================================
// Warehouse fulfilment update (admin or warehouse user)
// ============================================================================

export function useUpdateOrderFulfilment(companyId) {
  return useMutation({
    mutationFn: async ({ order_id, ...patch }) => {
      const allowed = (({
        supplier_dispatch_date,
        supplier_eta_date,
        supplier_tracking_url,
        supplier_tracking_carrier,
        supplier_notes,
        supplier_freight_cost,
        status,
      }) => ({
        supplier_dispatch_date,
        supplier_eta_date,
        supplier_tracking_url,
        supplier_tracking_carrier,
        supplier_notes,
        supplier_freight_cost,
        status,
      }))(patch);
      Object.keys(allowed).forEach((k) => allowed[k] === undefined && delete allowed[k]);
      // Route through the Edge Function so the correct buyer notification
      // (dispatch_confirmed / tracking_added / eta_updated) is emitted.
      const res = await callEdgeFunction('marketplace_update_fulfilment', {
        order_id,
        patch: allowed,
      });
      return res?.order ?? res;
    },
    onSuccess: (_data, { order_id }) => {
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.marketplaceAdminOrders(companyId),
      });
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.marketplaceAdminOrder(companyId, order_id),
      });
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.marketplaceBuyerOrders(companyId),
      });
    },
  });
}

// ============================================================================
// Stripe — kick off checkout
// ============================================================================

export function useStripeCreateCheckout() {
  return useMutation({
    mutationFn: async ({ checkout_session_id, order_id, success_url, cancel_url }) => {
      // checkout_session_id is the new deferred-creation path (preferred).
      // order_id is kept for backward-compat with PO-late-pay flows.
      const body = { success_url, cancel_url };
      if (checkout_session_id) body.checkout_session_id = checkout_session_id;
      if (order_id) body.order_id = order_id;
      return await callEdgeFunction('marketplace_stripe_create_checkout', body);
    },
  });
}

// ============================================================================
// Rate sheets (admin CRUD)
// ============================================================================

export function useUpsertRateSheet(companyId) {
  return useMutation({
    mutationFn: async (sheet) => {
      const payload = { ...sheet };
      const id = payload.id;
      delete payload.id;
      if (id) {
        const { data, error } = await supabase
          .from('marketplace_rate_sheets')
          .update(payload)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from('marketplace_rate_sheets')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.marketplaceRateSheets(companyId),
      });
    },
  });
}

export function useDeleteRateSheet(companyId) {
  return useMutation({
    mutationFn: async (sheetId) => {
      const { error } = await supabase.from('marketplace_rate_sheets').delete().eq('id', sheetId);
      if (error) throw error;
      return sheetId;
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.marketplaceRateSheets(companyId),
      });
    },
  });
}

export function useUpsertRateSheetBracket(companyId) {
  return useMutation({
    mutationFn: async (bracket) => {
      const payload = { ...bracket };
      const id = payload.id;
      delete payload.id;
      if (id) {
        const { data, error } = await supabase
          .from('marketplace_rate_sheet_brackets')
          .update(payload)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from('marketplace_rate_sheet_brackets')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.marketplaceRateSheets(companyId),
      });
    },
  });
}

/**
 * Upsert a product → rate sheet mapping.
 *   - packaging_size_id = null  → product-level default (all sizes)
 *   - packaging_size_id = uuid  → per-size override
 *
 * Schema uses two partial unique indexes (one for NULL packaging, one for
 * non-NULL) so Postgres ON CONFLICT can't target both. Do an explicit
 * delete-then-insert — matches the Chem Connect /api/admin/product-freight
 * upsert pattern.
 */
export function useUpsertProductRateSheet(companyId) {
  return useMutation({
    mutationFn: async ({ productId, packagingSizeId = null, rateSheetId }) => {
      if (!productId) throw new Error('productId is required');
      if (!rateSheetId) throw new Error('rateSheetId is required');

      let delQuery = supabase
        .from('marketplace_product_rate_sheets')
        .delete()
        .eq('product_id', productId);
      delQuery = packagingSizeId
        ? delQuery.eq('packaging_size_id', packagingSizeId)
        : delQuery.is('packaging_size_id', null);
      const { error: delErr } = await delQuery;
      if (delErr) throw delErr;

      const { data, error } = await supabase
        .from('marketplace_product_rate_sheets')
        .insert({
          product_id: productId,
          packaging_size_id: packagingSizeId,
          rate_sheet_id: rateSheetId,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.marketplaceProductRateSheets(companyId),
      });
    },
  });
}

export function useDeleteProductRateSheet(companyId) {
  return useMutation({
    mutationFn: async ({ productId, packagingSizeId = null }) => {
      if (!productId) throw new Error('productId is required');
      let q = supabase
        .from('marketplace_product_rate_sheets')
        .delete()
        .eq('product_id', productId);
      q = packagingSizeId
        ? q.eq('packaging_size_id', packagingSizeId)
        : q.is('packaging_size_id', null);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.marketplaceProductRateSheets(companyId),
      });
    },
  });
}

export function useDeleteRateSheetBracket(companyId) {
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('marketplace_rate_sheet_brackets').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.marketplaceRateSheets(companyId),
      });
    },
  });
}
