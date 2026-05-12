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
import { supabase } from '@/lib/supabase';
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
