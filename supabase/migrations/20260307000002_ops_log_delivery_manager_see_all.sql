-- Operations Log: same visibility as super_admin for delivery_manager and driver (sites/vehicles
-- are handled by allTenants in the app; here we allow reading all entries and related data).

-- operations_log_entries: allow delivery_manager and driver to SELECT all (like super_admin)
CREATE POLICY "Delivery manager and driver can read all operations log entries"
    ON operations_log_entries FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role IN ('delivery_manager', 'driver')
        )
    );

-- operations_log_vehicle_links: allow delivery_manager and driver to read all
CREATE POLICY "Delivery manager and driver can read all vehicle links"
    ON operations_log_vehicle_links FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role IN ('delivery_manager', 'driver')
        )
    );

-- operations_log_attachments: allow delivery_manager and driver to read all
CREATE POLICY "Delivery manager and driver can read all attachments"
    ON operations_log_attachments FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role IN ('delivery_manager', 'driver')
        )
    );
