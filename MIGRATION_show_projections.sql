-- Adds a per-user toggle for compound-growth projections on Investments and
-- Savings. When false, the page hides "Avg monthly", 1y/5y/10y cards, and the
-- yearly breakdown — useful when the bucket is just plain cash, not invested.
-- Defaults to false so new users start in the simpler view.

ALTER TABLE investment_setup
  ADD COLUMN IF NOT EXISTS show_projections boolean NOT NULL DEFAULT false;

ALTER TABLE savings_setup
  ADD COLUMN IF NOT EXISTS show_projections boolean NOT NULL DEFAULT false;
