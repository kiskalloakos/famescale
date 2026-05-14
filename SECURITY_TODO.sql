-- ============================================================================
-- One-time security hardening — paste into Supabase SQL editor and run.
-- Generated from the security audit on 2026-05-14.
--
-- Finding #7: add CHECK constraints so a malicious client cannot use the
-- public anon key to bloat the database with huge / negative / impossible
-- rows. RLS already blocks cross-user writes; this stops a logged-in user
-- from abusing their own row budget.
-- ============================================================================

-- accounts
ALTER TABLE accounts
  ADD CONSTRAINT accounts_name_len_ck
    CHECK (char_length(name) BETWEEN 1 AND 80),
  ADD CONSTRAINT accounts_amount_range_ck
    CHECK (amount BETWEEN -1e12 AND 1e12);

-- costs
ALTER TABLE costs
  ADD CONSTRAINT costs_name_len_ck
    CHECK (char_length(name) BETWEEN 1 AND 80),
  ADD CONSTRAINT costs_amount_range_ck
    CHECK (amount BETWEEN -1e12 AND 1e12),
  ADD CONSTRAINT costs_due_day_ck
    CHECK (due_day BETWEEN 1 AND 31),
  ADD CONSTRAINT costs_paid_month_len_ck
    CHECK (paid_month IS NULL OR char_length(paid_month) <= 7);

-- debts
ALTER TABLE debts
  ADD CONSTRAINT debts_name_len_ck
    CHECK (char_length(name) BETWEEN 1 AND 80),
  ADD CONSTRAINT debts_amount_range_ck
    CHECK (amount BETWEEN -1e12 AND 1e12),
  ADD CONSTRAINT debts_notes_len_ck
    CHECK (notes IS NULL OR char_length(notes) <= 2000);

-- revenue_entries
ALTER TABLE revenue_entries
  ADD CONSTRAINT revenue_label_len_ck
    CHECK (char_length(label) BETWEEN 1 AND 32),
  ADD CONSTRAINT revenue_amount_range_ck
    CHECK (amount BETWEEN -1e12 AND 1e12);

-- investment_setup
ALTER TABLE investment_setup
  ADD CONSTRAINT investment_total_range_ck
    CHECK (total_invested BETWEEN 0 AND 1e12),
  ADD CONSTRAINT investment_start_month_ck
    CHECK (start_month BETWEEN 1 AND 12),
  ADD CONSTRAINT investment_start_year_ck
    CHECK (start_year BETWEEN 1900 AND 2200),
  ADD CONSTRAINT investment_return_ck
    CHECK (annual_return BETWEEN -100 AND 1000);

-- savings_setup
ALTER TABLE savings_setup
  ADD CONSTRAINT savings_total_range_ck
    CHECK (total_invested BETWEEN 0 AND 1e12),
  ADD CONSTRAINT savings_start_month_ck
    CHECK (start_month BETWEEN 1 AND 12),
  ADD CONSTRAINT savings_start_year_ck
    CHECK (start_year BETWEEN 1900 AND 2200),
  ADD CONSTRAINT savings_return_ck
    CHECK (annual_return BETWEEN -100 AND 1000);

-- user_settings — currency codes are 3-char ISO 4217; allow a generous 8.
ALTER TABLE user_settings
  ADD CONSTRAINT user_settings_currency_len_ck
    CHECK (currency IS NULL OR char_length(currency) <= 8),
  ADD CONSTRAINT user_settings_dashboard_currency_len_ck
    CHECK (dashboard_currency IS NULL OR char_length(dashboard_currency) <= 8),
  ADD CONSTRAINT user_settings_investments_currency_len_ck
    CHECK (investments_currency IS NULL OR char_length(investments_currency) <= 8),
  ADD CONSTRAINT user_settings_savings_currency_len_ck
    CHECK (savings_currency IS NULL OR char_length(savings_currency) <= 8),
  ADD CONSTRAINT user_settings_revenue_currency_len_ck
    CHECK (revenue_currency IS NULL OR char_length(revenue_currency) <= 8),
  ADD CONSTRAINT user_settings_debts_currency_len_ck
    CHECK (debts_currency IS NULL OR char_length(debts_currency) <= 8);
