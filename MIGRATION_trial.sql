-- Paywall: 3-day free trial, account-tied (survives reinstalls), then a
-- one-time $9.99 lifetime unlock (RevenueCat, not a store-managed trial —
-- a non-consumable IAP cannot have one). The clock starts on first
-- authenticated launch and is stored per user so deleting/reinstalling the
-- app does NOT reset it.
--
-- Additive column on the existing, already-RLS-protected user_settings
-- table (FOR ALL USING/WITH CHECK auth.uid() = user_id) — it inherits that
-- policy, so no policy change and no SECURITY_VERIFY.sql re-run is required.
-- NULL = trial not started yet (set once, never overwritten by the normal
-- settings upsert, which does not touch this column).

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz;
