-- Recurrings tab visibility flag. Paste into the Supabase SQL editor and run.
-- user_settings already has RLS (auth.uid() = user_id); a new column inherits
-- it, so no policy change is needed. Until this runs, the app degrades
-- gracefully: the setup remote-read fails the column check and falls back to
-- the local cached setup (no crash), and the flag works locally.

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS show_recurrings boolean NOT NULL DEFAULT false;

-- 2026-05: Recurrings became a user-toggleable tab. Until now this column
-- was a dead flag (Recurrings was unconditionally core), so every existing
-- row holds the meaningless DEFAULT false. Flip the default to true and heal
-- all existing rows to true so the upgrade preserves today's behavior
-- (Recurrings visible); users opt OUT via the new Settings switch.
-- ONE-TIME heal: run this once at upgrade. Do NOT re-run after users can
-- toggle the switch — the blanket UPDATE would clobber anyone who opted out.
ALTER TABLE user_settings
  ALTER COLUMN show_recurrings SET DEFAULT true;

UPDATE user_settings
  SET show_recurrings = true
  WHERE show_recurrings IS DISTINCT FROM true;
