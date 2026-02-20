import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '../keys';

/**
 * Current user's operations log permissions (for "toggle who can create")
 * If no row exists, default can_create true for admin/super_admin.
 */
export function operationsLogMyPermissionsOptions(userId) {
  return queryOptions({
    queryKey: queryKeys.global.operationsLogMyPermissions(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operations_log_permissions')
        .select('can_create, can_edit, can_resolve')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 2 * 60 * 1000,
    enabled: !!userId,
  });
}

/**
 * Operations log categories (active only, for dropdowns)
 */
export function operationsLogCategoriesOptions() {
  return queryOptions({
    queryKey: queryKeys.global.operationsLogCategories(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operations_log_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * All operations log categories (active + inactive, for Super Admin management)
 */
export function allOperationsLogCategoriesOptions() {
  return queryOptions({
    queryKey: [...queryKeys.global.operationsLogCategories(), 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operations_log_categories')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Products (active for dropdown)
 */
export function productsOptions() {
  return queryOptions({
    queryKey: queryKeys.global.products(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('status', 'active')
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * All products (for Super Admin management - active + inactive)
 */
export function allProductsOptions() {
  return queryOptions({
    queryKey: [...queryKeys.global.products(), 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Paginated products (for Admin Products page)
 * @param {{ page?: number, pageSize?: number }}
 * @returns { products, total }
 */
export function allProductsPaginatedOptions({ page = 1, pageSize = 20 } = {}) {
  return queryOptions({
    queryKey: [...queryKeys.global.products(), 'all', 'paginated', page, pageSize],
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const { data, error, count } = await supabase
        .from('products')
        .select('*', { count: 'exact' })
        .order('name')
        .range(from, to);
      if (error) throw error;
      return { products: data ?? [], total: count ?? 0 };
    },
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Operations log entries list with filters
 * @param {string} companyId - user's company (for cache key; super_admin can see all via RLS)
 * @param {{ customerRef?: string, siteRef?: string, status?: string, categoryId?: string, search?: string, vehicleIds?: string[], page?: number, pageSize?: number }} filters
 */
export function operationsLogEntriesOptions(companyId, filters = {}) {
  const { customerRef, siteRef, status, categoryId, search, vehicleIds = [], page = 1, pageSize = 50 } = filters;
  return queryOptions({
    queryKey: queryKeys.tenant.operationsLogEntries(companyId, filters),
    queryFn: async () => {
      let entryIdsForVehicleFilter = null;
      if (Array.isArray(vehicleIds) && vehicleIds.length > 0) {
        const { data: links, error: linksError } = await supabase
          .from('operations_log_vehicle_links')
          .select('entry_id')
          .in('vehicle_id', vehicleIds);
        if (linksError) throw linksError;
        entryIdsForVehicleFilter = [...new Set((links ?? []).map((r) => r.entry_id).filter(Boolean))];
        if (entryIdsForVehicleFilter.length === 0) {
          return { entries: [], total: 0 };
        }
      }

      let q = supabase
        .from('operations_log_entries')
        .select(
          `
          *,
          category:operations_log_categories(id,name),
          operations_log_vehicle_links(vehicle_id),
          operations_log_attachments(id,file_name,file_size,mime_type)
        `,
          { count: 'exact' }
        )
        .order('created_at', { ascending: false });

      if (entryIdsForVehicleFilter && entryIdsForVehicleFilter.length > 0) {
        q = q.in('id', entryIdsForVehicleFilter);
      }
      if (customerRef && customerRef !== 'all') q = q.eq('customer_ref', customerRef);
      if (siteRef && siteRef !== 'all') q = q.eq('site_ref', siteRef);
      if (status && status !== 'all') q = q.eq('status', status);
      if (categoryId && categoryId !== 'all') q = q.eq('category_id', categoryId);
      if (search && search.trim()) {
        q = q.or(`title.ilike.%${search.trim()}%,description.ilike.%${search.trim()}%,brief.ilike.%${search.trim()}%`);
      }

      const from = (page - 1) * pageSize;
      q = q.range(from, from + pageSize - 1);

      const { data, error, count } = await q;
      if (error) throw error;
      return { entries: data ?? [], total: count ?? 0 };
    },
    staleTime: 1 * 60 * 1000,
    enabled: true,
  });
}

/**
 * Single operations log entry with relations
 */
export function operationsLogEntryOptions(companyId, entryId) {
  return queryOptions({
    queryKey: queryKeys.tenant.operationsLogEntry(companyId, entryId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operations_log_entries')
        .select(
          `
          *,
          category:operations_log_categories(id,name),
          operations_log_vehicle_links(vehicle_id),
          operations_log_attachments(id,storage_path,file_name,file_size,mime_type,uploaded_at)
        `
        )
        .eq('id', entryId)
        .single();
      if (error) throw error;
      return data;
    },
    staleTime: 1 * 60 * 1000,
    enabled: !!companyId && !!entryId,
  });
}
