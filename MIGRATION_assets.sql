-- Net-worth assets (house, car, valuables…). Paste into the Supabase SQL
-- editor and run. Same RLS regime as every other table: a single FOR ALL
-- policy keyed on auth.uid() = user_id. Run SECURITY_VERIFY.sql afterwards
-- to confirm the 9th table is protected.

CREATE TABLE IF NOT EXISTS assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  amount numeric NOT NULL DEFAULT 0 CHECK (amount BETWEEN -1e12 AND 1e12),
  emoji text CHECK (emoji IS NULL OR char_length(emoji) <= 16),
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS assets_user_position_idx
  ON assets (user_id, position);

ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY assets_owner ON assets FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
