-- Free tier: soundtracks and exports cover only the first 60 seconds.
-- Video.durationSec is probed at first analysis; Analysis.cappedSec records
-- that a soundtrack was generated from a trimmed video (null = full length).
ALTER TABLE "Video"    ADD COLUMN IF NOT EXISTS "durationSec" DOUBLE PRECISION;
ALTER TABLE "Analysis" ADD COLUMN IF NOT EXISTS "cappedSec"   INTEGER;
