-- Recurring expenses gain a frequency. A cost is no longer assumed monthly:
-- interval_months is 1 (monthly), 3 (quarterly), 12 (yearly), or any N for a
-- custom "every N months" bill. due_month (1–12) is the anchor month a
-- non-monthly bill lands on — a quarterly cost anchored to March recurs
-- Mar/Jun/Sep/Dec; it is null/ignored for monthly costs.
--
-- The auto-reset (lib/finance.ts resetStaleCosts) now un-pays a cost only
-- after its full interval has elapsed since paid_month, instead of every
-- month. interval_months DEFAULT 1 makes that identical to the old behavior
-- for every existing row, so legacy monthly costs are untouched.
--
-- Additive columns on the existing `costs` table — they inherit its existing
-- RLS (FOR ALL USING/WITH CHECK auth.uid() = user_id), so no policy change
-- and no SECURITY_VERIFY.sql re-run is required.

ALTER TABLE costs
  ADD COLUMN IF NOT EXISTS interval_months int NOT NULL DEFAULT 1;

ALTER TABLE costs
  ADD COLUMN IF NOT EXISTS due_month int;
