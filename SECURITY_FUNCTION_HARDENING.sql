-- ============================================================================
-- One-time security hardening — paste into Supabase SQL editor and run.
-- Generated from the Supabase Security Advisor warnings on 2026-05-16.
--
-- Closes 3 of the 4 advisor warnings, all for public.handle_new_user (the
-- AFTER INSERT trigger on auth.users that seeds a row on signup):
--
--   #1 function_search_path_mutable                   -> pin search_path
--   #2 anon_security_definer_function_executable       -> revoke EXECUTE
--   #3 authenticated_security_definer_function_executable -> revoke EXECUTE
--
-- Why this is safe: a trigger function runs as the table owner via the
-- trigger itself, NOT via the caller's EXECUTE grant. Revoking EXECUTE only
-- removes the unintended REST exposure (/rest/v1/rpc/handle_new_user); signup
-- keeps working. Pinning search_path = public keeps unqualified table refs in
-- the function body resolving exactly as before.
--
-- The 4th warning (auth_leaked_password_protection) is NOT fixable in SQL:
--   Dashboard -> Authentication -> Policies -> enable
--   "Leaked password protection". Do that manually.
-- ============================================================================

-- #1 — pin the search_path so it can't be hijacked by a caller-set path.
-- 'public' keeps the function's existing (unqualified) table references
-- working. See the OPTIONAL stricter variant note at the bottom.
ALTER FUNCTION public.handle_new_user() SET search_path = public;

-- #2 + #3 — remove the unintended RPC exposure. The trigger still fires;
-- only direct REST/RPC invocation is blocked.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

-- ----------------------------------------------------------------------------
-- Verify (re-run after applying — all three should report the hardened state):
-- ----------------------------------------------------------------------------
-- SELECT proname, prosecdef, proconfig
--   FROM pg_proc
--  WHERE oid = 'public.handle_new_user()'::regprocedure;
--   -> proconfig should contain  search_path=public
--
-- SELECT has_function_privilege('anon',          'public.handle_new_user()', 'EXECUTE') AS anon,
--        has_function_privilege('authenticated', 'public.handle_new_user()', 'EXECUTE') AS authd;
--   -> both should be  false

-- ----------------------------------------------------------------------------
-- OPTIONAL — strictest posture (gold standard for SECURITY DEFINER):
--   ALTER FUNCTION public.handle_new_user() SET search_path = '';
-- This requires EVERY object reference inside the function body to be
-- schema-qualified (public.setup, auth.users, etc.). Only switch to this
-- after confirming the body is fully qualified, or signup will throw
-- "relation does not exist". Inspect the body with:
--   SELECT pg_get_functiondef('public.handle_new_user()'::regprocedure);
-- ----------------------------------------------------------------------------
