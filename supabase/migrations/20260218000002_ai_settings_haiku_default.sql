-- Switch default AI model from Claude Sonnet 4 to Claude Haiku 4.5 (lower cost).
-- Pipeline (analyze-fleet) and manual AI analysis both use ai_settings.default_ai_model.

UPDATE ai_settings
SET value = 'claude-haiku-4-5-20251001',
    updated_at = NOW()
WHERE key = 'default_ai_model';

-- If no row exists (e.g. fresh install), insert default
INSERT INTO ai_settings (key, value)
VALUES ('default_ai_model', 'claude-haiku-4-5-20251001')
ON CONFLICT (key) DO NOTHING;
