-- Email-change verification requests: the new address is only written to
-- "User"."email" once the token sent to that address is used.
CREATE TABLE IF NOT EXISTS "EmailChangeRequest" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "newEmail"  TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailChangeRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmailChangeRequest_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "EmailChangeRequest_tokenHash_key" ON "EmailChangeRequest"("tokenHash");
CREATE INDEX        IF NOT EXISTS "EmailChangeRequest_userId_idx"    ON "EmailChangeRequest"("userId");

-- Processed Stripe webhook event ids (idempotency; Stripe delivers at-least-once).
CREATE TABLE IF NOT EXISTS "StripeEvent" (
  "id"          TEXT NOT NULL,
  "type"        TEXT NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StripeEvent_pkey" PRIMARY KEY ("id")
);

-- "Cancels on <date>" support.
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;

-- Match the rest of the schema: RLS on, no policies (Prisma connects as a
-- BYPASSRLS role; this just locks PostgREST/anon out of the new tables).
ALTER TABLE "EmailChangeRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StripeEvent"        ENABLE ROW LEVEL SECURITY;
