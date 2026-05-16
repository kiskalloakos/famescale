-- User-customizable tab order. Additive column on the EXISTING, already
-- RLS-protected user_settings table (no new table → security posture
-- unchanged). Stores the order of the optional tabs only; Dashboard /
-- Recurrings are always pinned first and Settings last by the app, so
-- they are never in this array. NULL = use the app's default order
-- (the client's normalizeTabOrder() self-heals NULL / partial / stale).
-- Paste into the Supabase SQL editor and run, then re-run
-- SECURITY_VERIFY.sql (table count unchanged; this just confirms posture).

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS tab_order text[];
