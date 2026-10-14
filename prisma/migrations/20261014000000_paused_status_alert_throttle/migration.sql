-- Video can be PAUSED: music generation stopped because the ElevenLabs
-- account is out of credits. Distinct from FAILED so the UI can explain it
-- and the owner can retry later.
ALTER TYPE "VideoStatus" ADD VALUE IF NOT EXISTS 'PAUSED';

-- One operational alert email per key per window, across all function instances.
CREATE TABLE IF NOT EXISTS "AlertThrottle" (
  "key"        TEXT PRIMARY KEY,
  "lastSentAt" TIMESTAMP(3) NOT NULL
);
