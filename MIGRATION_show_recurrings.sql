-- Recurrings tab visibility flag. Paste into the Supabase SQL editor and run.
-- user_settings already has RLS (auth.uid() = user_id); a new column inherits
-- it, so no policy change is needed. Until this runs, the app degrades
-- gracefully: the setup remote-read fails the column check and falls back to
-- the local cached setup (no crash), and the flag works locally.

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS show_recurrings boolean NOT NULL DEFAULT false;
