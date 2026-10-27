-- Analysis.slotChargedAt: when an analysis slot (or a Video Pass) paid for
-- this analysis. Null = made on the free tier and not yet charged.
ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "slotChargedAt" TIMESTAMP(3);

-- Backfill. Analyses made while the owner was already on a paid plan
-- (approximated by the subscription's last update, which for every current
-- subscriber is the upgrade time) were paid for at creation; a Video Pass
-- pays for its video's analysis; admins are never charged.
UPDATE "Analysis" a SET "slotChargedAt" = a."createdAt"
FROM "Video" v, "Subscription" s
WHERE a."videoId" = v.id AND s."userId" = v."userId"
  AND s.plan <> 'FREE' AND s.status <> 'CANCELED'
  AND a."createdAt" >= s."updatedAt" AND a."slotChargedAt" IS NULL;

UPDATE "Analysis" a SET "slotChargedAt" = p."createdAt"
FROM "VideoPass" p
WHERE p."videoId" = a."videoId" AND a."slotChargedAt" IS NULL;
