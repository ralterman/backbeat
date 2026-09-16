-- Whether the uploaded video has its own audio track (see Analysis model comment).
ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "hasOriginalAudio" BOOLEAN NOT NULL DEFAULT true;
