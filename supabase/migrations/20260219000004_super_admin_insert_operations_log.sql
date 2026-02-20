-- Allow Super Admin to INSERT operations_log_entries with any company_id
-- (e.g. when creating entries for a selected customer; company_id resolved from customer_ref)
-- Migration: 20260219000004_super_admin_insert_operations_log

CREATE POLICY "Super admin can insert entries for any company"
    ON operations_log_entries FOR INSERT
    TO authenticated
    WITH CHECK (public.is_super_admin());
