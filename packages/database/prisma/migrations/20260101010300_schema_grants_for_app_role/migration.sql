-- Round 25 fix: schema-level + Jwks GRANTs for starter_app.
--
-- The init migration (20260101000000) creates tables and grants them
-- to starter_app at the table level, but:
--   1. The schema's default PUBLIC ACL was empty in this setup, so
--      the implicit pseudo-role grant did not apply — starter_app
--      had no USAGE on `public`, making every table-level GRANT
--      invisible and every app query failing with
--      `42501 permission denied for schema public` (or
--      `42P01 relation does not exist`).
--   2. The "Jwks" table (consolidated into the init migration)
--      also lacked table-level GRANTs — better-auth's jwt() plugin
--      reads/writes it on the pooled URL, so every
--      /api/auth/get-session failed with
--      `42501 permission denied for table Jwks`.
--
-- This migration applies the missing GRANTs. Idempotent at the role
-- level.
GRANT USAGE, CREATE ON SCHEMA public TO starter_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "Jwks" TO starter_app;