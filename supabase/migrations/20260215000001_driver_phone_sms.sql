-- Driver phone from vehicles API + SMS reminders (Phase 2 Twilio)
-- Migration: 20260215000001_driver_phone_sms

-- Add driver_phone to ai_predictions (populated from vehicles API phone/mobile)
ALTER TABLE ai_predictions ADD COLUMN IF NOT EXISTS driver_phone TEXT;
CREATE INDEX IF NOT EXISTS idx_ai_predictions_driver_phone ON ai_predictions(driver_phone) WHERE driver_phone IS NOT NULL;

COMMENT ON COLUMN ai_predictions.driver_phone IS 'Driver phone from vehicles API (phone or mobile), used for SMS reminders';

-- SMS reminders table for Twilio send tracking
CREATE TABLE IF NOT EXISTS sms_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    prediction_id UUID REFERENCES ai_predictions(id) ON DELETE SET NULL,
    vehicle_ref TEXT NOT NULL,
    vehicle_name TEXT,
    driver_name TEXT,
    driver_phone TEXT NOT NULL,
    message TEXT NOT NULL,
    risk_level TEXT,
    scheduled_for TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    twilio_message_sid TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'cancelled')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sms_reminders_company ON sms_reminders(company_id);
CREATE INDEX idx_sms_reminders_vehicle ON sms_reminders(vehicle_ref);
CREATE INDEX idx_sms_reminders_status ON sms_reminders(status);
CREATE INDEX idx_sms_reminders_created ON sms_reminders(created_at DESC);

ALTER TABLE sms_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sms_reminders for their company"
    ON sms_reminders FOR SELECT
    USING (
        company_id IS NULL OR
        company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid())
    );

CREATE POLICY "Admins can insert sms_reminders"
    ON sms_reminders FOR INSERT
    WITH CHECK (
        company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid())
        AND EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
    );

CREATE POLICY "Admins can update sms_reminders"
    ON sms_reminders FOR UPDATE
    USING (
        company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid())
        AND EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
    );

CREATE POLICY "Super admins full access sms_reminders"
    ON sms_reminders FOR ALL
    USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin')
    );
