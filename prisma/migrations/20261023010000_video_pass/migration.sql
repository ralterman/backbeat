-- One-time $5 Video Pass: per-video entitlement (full-length tracks, two
-- options, watermark-free export) that leaves the user's plan unchanged.
CREATE TABLE IF NOT EXISTS "VideoPass" (
  "id"                      TEXT NOT NULL,
  "videoId"                 TEXT NOT NULL,
  "userId"                  TEXT NOT NULL,
  "stripeCheckoutSessionId" TEXT NOT NULL,
  "stripePaymentIntentId"   TEXT,
  "amountCents"             INTEGER NOT NULL,
  "currency"                TEXT NOT NULL,
  "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VideoPass_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "VideoPass_videoId_key" ON "VideoPass"("videoId");
CREATE UNIQUE INDEX IF NOT EXISTS "VideoPass_stripeCheckoutSessionId_key" ON "VideoPass"("stripeCheckoutSessionId");
CREATE INDEX IF NOT EXISTS "VideoPass_userId_idx" ON "VideoPass"("userId");
DO $$ BEGIN
  ALTER TABLE "VideoPass" ADD CONSTRAINT "VideoPass_videoId_fkey"
    FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "VideoPass" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "VideoPass" FROM anon, authenticated;
