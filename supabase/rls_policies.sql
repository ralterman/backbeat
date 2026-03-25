-- ============================================================
-- Backbeat — Row Level Security Policies
-- Applied to all tables to resolve Supabase Security Advisor errors
--
-- Architecture note: This app uses NextAuth + Prisma (server-side).
-- All app queries go through DATABASE_URL (bypasses RLS). RLS
-- here serves as a defense layer against direct Supabase client access.
-- auth.uid()::text cast handles UUID→text comparison; since NextAuth
-- uses cuid IDs these policies act as "deny all direct client access".
-- ============================================================


-- ============================================================
-- 1. _prisma_migrations
--    Internal Prisma table — block all client access, no policies
-- ============================================================
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
-- No policies → all client access denied by default


-- ============================================================
-- 2. NextAuth tables (Session, Account, VerificationToken)
--    Server-side only via DATABASE_URL — no public policies
-- ============================================================
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
-- No policies → all client access denied by default

ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
-- No policies → all client access denied by default

ALTER TABLE "VerificationToken" ENABLE ROW LEVEL SECURITY;
-- No policies → all client access denied by default


-- ============================================================
-- 3. User table
--    Users can only read and update their own row
-- ============================================================
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON "User";
CREATE POLICY "Users can view own profile"
  ON "User"
  FOR SELECT
  USING (auth.uid()::text = id);

DROP POLICY IF EXISTS "Users can update own profile" ON "User";
CREATE POLICY "Users can update own profile"
  ON "User"
  FOR UPDATE
  USING (auth.uid()::text = id)
  WITH CHECK (auth.uid()::text = id);


-- ============================================================
-- 4. Video table
--    Users can CRUD their own videos (userId direct FK)
-- ============================================================
ALTER TABLE "Video" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own videos" ON "Video";
CREATE POLICY "Users can view own videos"
  ON "Video"
  FOR SELECT
  USING (auth.uid()::text = "userId");

DROP POLICY IF EXISTS "Users can insert own videos" ON "Video";
CREATE POLICY "Users can insert own videos"
  ON "Video"
  FOR INSERT
  WITH CHECK (auth.uid()::text = "userId");

DROP POLICY IF EXISTS "Users can update own videos" ON "Video";
CREATE POLICY "Users can update own videos"
  ON "Video"
  FOR UPDATE
  USING (auth.uid()::text = "userId")
  WITH CHECK (auth.uid()::text = "userId");

DROP POLICY IF EXISTS "Users can delete own videos" ON "Video";
CREATE POLICY "Users can delete own videos"
  ON "Video"
  FOR DELETE
  USING (auth.uid()::text = "userId");


-- ============================================================
-- 5. Analysis table
--    No direct userId — ownership checked via Video join
-- ============================================================
ALTER TABLE "Analysis" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own analyses" ON "Analysis";
CREATE POLICY "Users can view own analyses"
  ON "Analysis"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "Video"
      WHERE "Video"."id" = "Analysis"."videoId"
        AND "Video"."userId" = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Users can insert own analyses" ON "Analysis";
CREATE POLICY "Users can insert own analyses"
  ON "Analysis"
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Video"
      WHERE "Video"."id" = "Analysis"."videoId"
        AND "Video"."userId" = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Users can update own analyses" ON "Analysis";
CREATE POLICY "Users can update own analyses"
  ON "Analysis"
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "Video"
      WHERE "Video"."id" = "Analysis"."videoId"
        AND "Video"."userId" = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Users can delete own analyses" ON "Analysis";
CREATE POLICY "Users can delete own analyses"
  ON "Analysis"
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM "Video"
      WHERE "Video"."id" = "Analysis"."videoId"
        AND "Video"."userId" = auth.uid()::text
    )
  );


-- ============================================================
-- 6. TrackMatch table
--    No direct userId — ownership via Analysis → Video join
-- ============================================================
ALTER TABLE "TrackMatch" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own track matches" ON "TrackMatch";
CREATE POLICY "Users can view own track matches"
  ON "TrackMatch"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "Analysis"
      JOIN "Video" ON "Video"."id" = "Analysis"."videoId"
      WHERE "Analysis"."id" = "TrackMatch"."analysisId"
        AND "Video"."userId" = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Users can insert own track matches" ON "TrackMatch";
CREATE POLICY "Users can insert own track matches"
  ON "TrackMatch"
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Analysis"
      JOIN "Video" ON "Video"."id" = "Analysis"."videoId"
      WHERE "Analysis"."id" = "TrackMatch"."analysisId"
        AND "Video"."userId" = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Users can update own track matches" ON "TrackMatch";
CREATE POLICY "Users can update own track matches"
  ON "TrackMatch"
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "Analysis"
      JOIN "Video" ON "Video"."id" = "Analysis"."videoId"
      WHERE "Analysis"."id" = "TrackMatch"."analysisId"
        AND "Video"."userId" = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Users can delete own track matches" ON "TrackMatch";
CREATE POLICY "Users can delete own track matches"
  ON "TrackMatch"
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM "Analysis"
      JOIN "Video" ON "Video"."id" = "Analysis"."videoId"
      WHERE "Analysis"."id" = "TrackMatch"."analysisId"
        AND "Video"."userId" = auth.uid()::text
    )
  );


-- ============================================================
-- 7. Export table
--    Direct userId FK
-- ============================================================
ALTER TABLE "Export" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own exports" ON "Export";
CREATE POLICY "Users can view own exports"
  ON "Export"
  FOR SELECT
  USING (auth.uid()::text = "userId");

DROP POLICY IF EXISTS "Users can insert own exports" ON "Export";
CREATE POLICY "Users can insert own exports"
  ON "Export"
  FOR INSERT
  WITH CHECK (auth.uid()::text = "userId");

DROP POLICY IF EXISTS "Users can update own exports" ON "Export";
CREATE POLICY "Users can update own exports"
  ON "Export"
  FOR UPDATE
  USING (auth.uid()::text = "userId")
  WITH CHECK (auth.uid()::text = "userId");

DROP POLICY IF EXISTS "Users can delete own exports" ON "Export";
CREATE POLICY "Users can delete own exports"
  ON "Export"
  FOR DELETE
  USING (auth.uid()::text = "userId");


-- ============================================================
-- 8. Subscription table
--    Direct userId FK
-- ============================================================
ALTER TABLE "Subscription" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own subscription" ON "Subscription";
CREATE POLICY "Users can view own subscription"
  ON "Subscription"
  FOR SELECT
  USING (auth.uid()::text = "userId");

DROP POLICY IF EXISTS "Users can insert own subscription" ON "Subscription";
CREATE POLICY "Users can insert own subscription"
  ON "Subscription"
  FOR INSERT
  WITH CHECK (auth.uid()::text = "userId");

DROP POLICY IF EXISTS "Users can update own subscription" ON "Subscription";
CREATE POLICY "Users can update own subscription"
  ON "Subscription"
  FOR UPDATE
  USING (auth.uid()::text = "userId")
  WITH CHECK (auth.uid()::text = "userId");

DROP POLICY IF EXISTS "Users can delete own subscription" ON "Subscription";
CREATE POLICY "Users can delete own subscription"
  ON "Subscription"
  FOR DELETE
  USING (auth.uid()::text = "userId");


-- ============================================================
-- 9. UsageRecord table
--    Direct userId FK
-- ============================================================
ALTER TABLE "UsageRecord" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own usage records" ON "UsageRecord";
CREATE POLICY "Users can view own usage records"
  ON "UsageRecord"
  FOR SELECT
  USING (auth.uid()::text = "userId");

DROP POLICY IF EXISTS "Users can insert own usage records" ON "UsageRecord";
CREATE POLICY "Users can insert own usage records"
  ON "UsageRecord"
  FOR INSERT
  WITH CHECK (auth.uid()::text = "userId");

DROP POLICY IF EXISTS "Users can update own usage records" ON "UsageRecord";
CREATE POLICY "Users can update own usage records"
  ON "UsageRecord"
  FOR UPDATE
  USING (auth.uid()::text = "userId")
  WITH CHECK (auth.uid()::text = "userId");

DROP POLICY IF EXISTS "Users can delete own usage records" ON "UsageRecord";
CREATE POLICY "Users can delete own usage records"
  ON "UsageRecord"
  FOR DELETE
  USING (auth.uid()::text = "userId");
