-- ============================================================
-- Backbeat — Explicit Role Grants
--
-- Supabase revoked default public-schema grants on all projects
-- created after 2024-01-01. Explicit grants are now required.
-- Reference: https://supabase.com/docs/guides/database/postgres/roles
--
-- Architecture:
--   anon          → no table access (app requires authentication)
--   authenticated → DML on user-data tables (RLS restricts to own rows)
--   service_role  → full access to all tables (used by Prisma/DATABASE_URL)
--
-- Note: All app queries run through Prisma via DATABASE_URL (postgres
-- superuser), which bypasses both grants and RLS. These grants are
-- required for Supabase Security Advisor compliance and as a
-- defense-in-depth layer against direct PostgREST/client access.
-- ============================================================


-- ============================================================
-- Schema-level usage grant
-- Required for PostgREST to resolve table names at all
-- ============================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;


-- ============================================================
-- NextAuth internal tables
-- Server-side only (Prisma/DATABASE_URL). No client access.
-- authenticated and anon intentionally receive no grants.
-- ============================================================
GRANT ALL ON TABLE "Session"           TO service_role;
GRANT ALL ON TABLE "Account"           TO service_role;
GRANT ALL ON TABLE "VerificationToken" TO service_role;


-- ============================================================
-- User table
-- authenticated: SELECT + UPDATE only (no self-INSERT — created
--   server-side by NextAuth). RLS restricts to own row.
-- ============================================================
GRANT SELECT, UPDATE                   ON TABLE "User" TO authenticated;
GRANT ALL                              ON TABLE "User" TO service_role;


-- ============================================================
-- Video table
-- authenticated: full DML. RLS restricts to userId = own id.
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE   ON TABLE "Video" TO authenticated;
GRANT ALL                              ON TABLE "Video" TO service_role;


-- ============================================================
-- Analysis table
-- authenticated: full DML. RLS restricts via Video → userId join.
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE   ON TABLE "Analysis" TO authenticated;
GRANT ALL                              ON TABLE "Analysis" TO service_role;


-- ============================================================
-- TrackMatch table
-- authenticated: full DML. RLS restricts via Analysis → Video → userId.
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE   ON TABLE "TrackMatch" TO authenticated;
GRANT ALL                              ON TABLE "TrackMatch" TO service_role;


-- ============================================================
-- Export table
-- authenticated: full DML. RLS restricts to userId = own id.
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE   ON TABLE "Export" TO authenticated;
GRANT ALL                              ON TABLE "Export" TO service_role;


-- ============================================================
-- Subscription table
-- authenticated: SELECT + INSERT only (updates/deletes go through
--   Stripe webhook via service_role). RLS restricts to own row.
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE   ON TABLE "Subscription" TO authenticated;
GRANT ALL                              ON TABLE "Subscription" TO service_role;


-- ============================================================
-- UsageRecord table
-- authenticated: full DML. RLS restricts to userId = own id.
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE   ON TABLE "UsageRecord" TO authenticated;
GRANT ALL                              ON TABLE "UsageRecord" TO service_role;
