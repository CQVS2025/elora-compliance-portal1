-- Allow users to see and edit their own operations log entries (created_by = auth.uid()).
-- Fixes delivery drivers (and any user without company_id) not seeing entries they created.
-- Migration: 20260305000001_operations_log_created_by_visibility

-- operations_log_entries: SELECT and UPDATE for own entries
CREATE POLICY "Users can read their own operations log entries"
    ON operations_log_entries FOR SELECT
    TO authenticated
    USING (created_by = auth.uid());

CREATE POLICY "Users can update their own operations log entries"
    ON operations_log_entries FOR UPDATE
    TO authenticated
    USING (created_by = auth.uid())
    WITH CHECK (created_by = auth.uid());

-- operations_log_vehicle_links: read/insert/delete for entries the user created
CREATE POLICY "Users can read vehicle links for their own entries"
    ON operations_log_vehicle_links FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM operations_log_entries e
            WHERE e.id = entry_id AND e.created_by = auth.uid()
        )
    );

CREATE POLICY "Users can insert vehicle links for their own entries"
    ON operations_log_vehicle_links FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM operations_log_entries e
            WHERE e.id = entry_id AND e.created_by = auth.uid()
        )
    );

CREATE POLICY "Users can delete vehicle links for their own entries"
    ON operations_log_vehicle_links FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM operations_log_entries e
            WHERE e.id = entry_id AND e.created_by = auth.uid()
        )
    );

-- operations_log_attachments: read/insert/delete for entries the user created
CREATE POLICY "Users can read attachments for their own entries"
    ON operations_log_attachments FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM operations_log_entries e
            WHERE e.id = entry_id AND e.created_by = auth.uid()
        )
    );

CREATE POLICY "Users can insert attachments for their own entries"
    ON operations_log_attachments FOR INSERT
    TO authenticated
    WITH CHECK (
        uploaded_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM operations_log_entries e
            WHERE e.id = entry_id AND e.created_by = auth.uid()
        )
    );

CREATE POLICY "Users can delete attachments for their own entries"
    ON operations_log_attachments FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM operations_log_entries e
            WHERE e.id = entry_id AND e.created_by = auth.uid()
        )
    );
