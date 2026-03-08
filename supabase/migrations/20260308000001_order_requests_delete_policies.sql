-- Allow super_admin and manager to delete order requests (and items via cascade).
-- Previously only SELECT, INSERT, UPDATE had policies; DELETE was missing so deletes were blocked by RLS.

CREATE POLICY "Manager/super_admin delete order_requests"
    ON order_requests FOR DELETE
    TO authenticated
    USING (public.is_super_admin() OR public.is_manager_or_above(auth.uid()));

CREATE POLICY "Manager/super_admin delete order_request_items"
    ON order_request_items FOR DELETE
    TO authenticated
    USING (public.is_super_admin() OR public.is_manager_or_above(auth.uid()));
