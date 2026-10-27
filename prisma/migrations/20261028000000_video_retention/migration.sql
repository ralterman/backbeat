-- Storage retention: when the daily cron (src/lib/retention.ts) removed a
-- video's S3 objects. Rows are kept and marked instead of deleted.
ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "expiredAt" TIMESTAMP(3);
ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "expiredAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Video_expiredAt_idx" ON "Video" ("expiredAt");
