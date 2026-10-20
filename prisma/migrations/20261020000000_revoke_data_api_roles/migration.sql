-- Close the public schema to the Supabase Data API roles.
--
-- Supabase grants anon and authenticated full privileges on everything in
-- public by default, and sets default privileges so new objects get the
-- same. This app never uses the Data API (no supabase-js, no /rest/v1);
-- Prisma connects directly as the postgres role. Revoking the grants means
-- those roles are refused at the privilege layer, before RLS is consulted.
-- service_role is deliberately left alone.
--
-- Applied to production 2026-10-20. Recorded so a fresh database inherits
-- the same posture.
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- Without these, the next CREATE TABLE by the postgres role (i.e. every
-- future Prisma migration) would be auto-granted to the Data API roles again.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
