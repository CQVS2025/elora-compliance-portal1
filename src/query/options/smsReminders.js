import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '../keys';

const SELECT_COLS = 'id, company_id, batch_id, sent_by, vehicle_ref, vehicle_name, driver_name, driver_phone, risk_level, status, sent_at, error_message, site_ref, site_name, customer_ref, customer_name, created_at';

/**
 * Fetch SMS reminder/alert records.
 * - Super admin: sees all (no filter; RLS allows all). Alerts may have been sent with any company_id.
 * - Company admin / other roles: see only alerts for their customer, i.e. where customer_ref
 *   equals their company's elora_customer_ref (so ELORA admin only sees Elora customer alerts, etc.).
 * Filters: dateFrom, dateTo, customerName, siteName, type, page, pageSize.
 * Returns { data, total } for pagination.
 */
export const smsRemindersOptions = (companyId, filters = {}, { isSuperAdmin = false, companyEloraCustomerRef = null } = {}) =>
  queryOptions({
    queryKey: queryKeys.tenant.smsReminders(companyId, { ...filters, isSuperAdmin, companyEloraCustomerRef }),
    queryFn: async () => {
      let q = supabase
        .from('sms_reminders')
        .select(SELECT_COLS, { count: 'exact' })
        .order('created_at', { ascending: false });

      if (!isSuperAdmin && companyEloraCustomerRef) {
        q = q.eq('customer_ref', companyEloraCustomerRef);
      }
      if (filters.dateFrom) {
        const from = filters.dateFrom.includes('T') ? filters.dateFrom : `${filters.dateFrom}T00:00:00.000Z`;
        q = q.gte('created_at', from);
      }
      if (filters.dateTo) {
        const to = filters.dateTo.includes('T') ? filters.dateTo : `${filters.dateTo}T23:59:59.999Z`;
        q = q.lte('created_at', to);
      }
      if (filters.customerName && filters.customerName !== 'all') {
        q = q.eq('customer_name', filters.customerName);
      }
      if (filters.siteName && filters.siteName !== 'all') {
        q = q.eq('site_name', filters.siteName);
      }
      if (filters.vehicleRef) {
        q = q.eq('vehicle_ref', filters.vehicleRef);
      }
      if (filters.type === 'single') {
        q = q.is('batch_id', null);
      }
      if (filters.type === 'batch') {
        q = q.not('batch_id', 'is', null);
      }

      const page = Math.max(1, Number(filters.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize) || 20));
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      q = q.range(from, to);

      const { data, error, count } = await q;
      if (error) throw error;
      return { data: data ?? [], total: count ?? 0 };
    },
    staleTime: 60 * 1000,
    enabled: !!companyId || isSuperAdmin,
  });
