-- Adds a per-user toggle for whether growth projections assume an ongoing
-- monthly contribution. Today the app infers a monthly amount from how long
-- ago you started (total ÷ months since start) and projects it forward.
-- When this is false, projections compound the current amount only (pmt=0) —
-- the lump-sum case where you don't add to it monthly; the start month/year
-- inputs and the "Avg monthly" stat are then hidden on screen.
--
-- DEFAULT true so existing users' projections are unchanged. Additive columns
-- on existing tables — they inherit each table's existing RLS, so no policy
-- change and no SECURITY_VERIFY.sql re-run is required.

ALTER TABLE investment_setup
  ADD COLUMN IF NOT EXISTS contribute_monthly boolean NOT NULL DEFAULT true;

ALTER TABLE savings_setup
  ADD COLUMN IF NOT EXISTS contribute_monthly boolean NOT NULL DEFAULT true;
