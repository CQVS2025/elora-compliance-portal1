-- ============================================================================
-- Marketplace · Defer order creation until Stripe payment succeeds
--
-- Mirrors the CQVS-Chem-Connect pattern. Previously the create_order Edge
-- Function always inserted into marketplace_orders, even when the buyer
-- chose Stripe. If the buyer abandoned the Stripe page (or the card was
-- declined) we were left with orphan orders cluttering the admin queue.
--
-- New flow:
--   - PO path:     marketplace_create_order inserts into marketplace_orders
--                  immediately (status=pending_approval). Unchanged.
--   - Stripe path: marketplace_create_order does NOT insert into
--                  marketplace_orders. It stores the validated/calculated
--                  payload in marketplace_checkout_sessions and returns a
--                  checkout_session_id. The actual order row materialises
--                  only when the Stripe webhook fires
--                  checkout.session.completed.
--
-- Schema changes
-- --------------
-- marketplace_checkout_sessions:
--   - order_id        → made NULLABLE (was NOT NULL FK to orders)
--   - user_id         → NEW, FK to user_profiles (so the webhook can
--                       attribute the order without a JWT in scope)
--   - company_id      → NEW, FK to companies (tenant scope)
--   - intent_payload  → NEW jsonb, the full calculated payload that the
--                       webhook replays to insert the order
-- ============================================================================

-- 1. Relax the FK / NOT NULL on order_id so we can pre-create the session.
ALTER TABLE marketplace_checkout_sessions
  ALTER COLUMN order_id DROP NOT NULL;

-- 2. New columns for deferred materialisation.
ALTER TABLE marketplace_checkout_sessions
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS intent_payload JSONB;

CREATE INDEX IF NOT EXISTS idx_marketplace_checkout_sessions_user
  ON marketplace_checkout_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_checkout_sessions_company
  ON marketplace_checkout_sessions(company_id);

COMMENT ON COLUMN marketplace_checkout_sessions.order_id IS
  'NULL until the Stripe checkout completes and the order is materialised by marketplace_stripe_webhook. Non-NULL on PO orders and after Stripe success.';
COMMENT ON COLUMN marketplace_checkout_sessions.intent_payload IS
  'The validated, server-side-calculated order body that the Stripe webhook replays into marketplace_orders on payment success.';

-- 3. RLS — allow buyers to SELECT their own pending Stripe session so the
-- success page can resolve `?session=<id>` back to the order they just paid
-- for. The existing policy gates on order_id; we add a fallback for
-- pre-payment sessions where order_id is still NULL.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'marketplace_checkout_sessions'
      AND policyname = 'Buyer reads own pre-payment checkout session'
  ) THEN
    EXECUTE 'DROP POLICY "Buyer reads own pre-payment checkout session" ON marketplace_checkout_sessions';
  END IF;
END $$;

CREATE POLICY "Buyer reads own pre-payment checkout session"
  ON marketplace_checkout_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid());
