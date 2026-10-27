-- Attribution captured when a magic link is requested, consumed when the
-- User row is created. See src/lib/attributionStore.ts.
CREATE TABLE IF NOT EXISTS "MagicLinkAttribution" (
  "email"       TEXT NOT NULL,
  "referrer"    TEXT,
  "landingPath" TEXT,
  "utmSource"   TEXT,
  "utmMedium"   TEXT,
  "utmCampaign" TEXT,
  "utmTerm"     TEXT,
  "utmContent"  TEXT,
  "capturedAt"  TIMESTAMP(3) NOT NULL,
  "expires"     TIMESTAMP(3) NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MagicLinkAttribution_pkey" PRIMARY KEY ("email")
);

CREATE INDEX IF NOT EXISTS "MagicLinkAttribution_expires_idx" ON "MagicLinkAttribution"("expires");

-- Same posture as every other table: deny-all RLS and no Data API grants
-- (the default privileges from 20261020000000 already withhold the grants;
-- stated explicitly so this file is self-contained).
ALTER TABLE "MagicLinkAttribution" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "MagicLinkAttribution" FROM anon, authenticated;
