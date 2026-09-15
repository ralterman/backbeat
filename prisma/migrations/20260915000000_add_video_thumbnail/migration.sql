-- First-frame poster for the results-page video preview.
ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "thumbnailKey" TEXT;
ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "thumbnailUrl" TEXT;
