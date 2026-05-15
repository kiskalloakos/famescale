-- Goals: manual savings/payoff targets. Paste into the Supabase SQL editor
-- and run. Two parts: the goals table (same FOR ALL auth.uid()=user_id RLS +
-- CHECK constraints as every other table) and the show_goals visibility flag
-- on user_settings (a new column inherits user_settings' existing RLS).
-- Run SECURITY_VERIFY.sql afterwards to confirm the 10th table is protected.

CREATE TABLE IF NOT EXISTS goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  target_amount numeric NOT NULL DEFAULT 0 CHECK (target_amount BETWEEN 0 AND 1e12),
  current_amount numeric NOT NULL DEFAULT 0 CHECK (current_amount BETWEEN -1e12 AND 1e12),
  deadline text CHECK (deadline IS NULL OR char_length(deadline) <= 10),
  emoji text CHECK (emoji IS NULL OR char_length(emoji) <= 16),
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS goals_user_position_idx
  ON goals (user_id, position);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY goals_owner ON goals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS show_goals boolean NOT NULL DEFAULT false;
