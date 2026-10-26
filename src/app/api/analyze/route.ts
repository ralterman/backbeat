export const maxDuration = 300; // Claude + ElevenLabs generation can take 60–120 s

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeVideoFrames, VideoAnalysis } from "@/lib/analyze";
import { generateMusicOptionsFromVideo, generateMusicFromVideo, ElevenLabsQuotaError, type GeneratedMusic } from "@/lib/elevenlabs";
import { notifyAdminThrottled, elevenLabsQuotaAlert, ONE_HOUR_MS } from "@/lib/alerts";
import { reserveAnalysisSlot, releaseAnalysisSlot, getUserPlan, OPTION_CAPS, HARD_MAX_OPTIONS, initialOptionCount, FREE_PREVIEW_SECONDS } from "@/lib/usage";
import { PLAN_LABELS } from "@/lib/plans";
import { isAdminEmail } from "@/lib/admin";
import { getVideoPass, PASS_OPTION_CAP, PASS_LABEL } from "@/lib/videoPass";
import { s3Client, OUTPUT_BUCKET, generateDownloadPresignedUrl } from "@/lib/s3";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import { probeMedia } from "@/lib/probe";
import { isUploadTooLarge, UPLOAD_TOO_LARGE_MESSAGE } from "@/lib/uploadLimits";
import { Readable } from "stream";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);
// See the matching note in export/route.ts: ffmpeg-static has no ffprobe and
// neither does the Vercel runtime, so probeHasAudio() below needs this.
ffmpeg.setFfprobePath(ffprobeInstaller.path);

// Leave a 20 s buffer before maxDuration so we can write FAILED and return
// a clean 504 rather than being killed mid-flight by Vercel.
const ANALYSIS_TIMEOUT_MS = 280_000;

const OPTION_LABELS = ["A", "B", "C", "D", "E", "F"]; // length === HARD_MAX_OPTIONS

export interface GeneratedOption {
  id: string;
  round: number;
  label: string;
  audioKey: string;
  audioUrl: string;
  description: string;
  tags: string[];
  createdAt: string;
}

/** Whether an Analysis row holds at least one generated track (new options
 *  array or the legacy single-track fields). */
function analysisHasOptions(a: { generatedOptions: unknown; generatedAudioKey: string | null }): boolean {
  const opts = (a.generatedOptions as unknown as GeneratedOption[] | null) ?? [];
  return opts.length > 0 || !!a.generatedAudioKey;
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms)
    ),
  ]);
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

// hasAudioStream from the probe is tri-state: true / false / null (unknown —
// probe failed or timed out). Unknown is NOT "no audio"; the caller falls
// back to the schema default (true) so a genuinely silent video keeps the
// "keep my audio" option available and mixing just adds silence, while the
// export route's own probe gets a second chance.

/**
 * First `seconds` of the video as an MP4, stream-copied (no re-encode, so a
 * cut can land up to a keyframe early; fine for music generation, and the
 * export trims precisely). Used for the free tier: ElevenLabs' track length
 * follows the video, so a shorter video is the only way to cap the music.
 * Falls back to the untrimmed buffer if ffmpeg fails, logging loudly: the
 * user still gets a result, we just paid for a longer track.
 */
async function trimVideoToSeconds(videoBuffer: Buffer, seconds: number, videoId: string): Promise<Buffer> {
  const tmpDir = path.join(os.tmpdir(), `backbeat-trim-${videoId}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  const inputPath = path.join(tmpDir, "input.mp4");
  const outputPath = path.join(tmpDir, "trimmed.mp4");
  fs.writeFileSync(inputPath, videoBuffer);
  try {
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions(["-t", String(seconds), "-c", "copy", "-movflags", "+faststart"])
        .format("mp4")
        .output(outputPath)
        .on("end", () => resolve())
        .on("error", (err) => reject(err))
        .run();
    });
    const out = fs.readFileSync(outputPath);
    console.log(`[analyze][${videoId}] trimmed to first ${seconds}s for generation: ${videoBuffer.length}b → ${out.length}b`);
    return out;
  } catch (err) {
    console.error(`[analyze][${videoId}] trim to ${seconds}s FAILED, sending full video:`, err);
    return videoBuffer;
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true }); } catch {}
  }
}

async function extractFrames(
  videoBuffer: Buffer,
  videoId: string
): Promise<{ frames: string[]; hasAudioStream: boolean | null; durationSec: number | null }> {
  const tmpDir = path.join(os.tmpdir(), `backbeat-${videoId}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  const inputPath = path.join(tmpDir, "input.mp4");
  fs.writeFileSync(inputPath, videoBuffer);

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        "-vf", "fps=1/3,scale=512:-1",
        "-frames:v", "10",
        "-f", "image2",
      ])
      .output(path.join(tmpDir, "frame-%03d.jpg"))
      .on("end", async () => {
        try {
          const files = fs.readdirSync(tmpDir)
            .filter((f) => f.startsWith("frame-") && f.endsWith(".jpg"))
            .sort();
          const frames = files.map((f) =>
            fs.readFileSync(path.join(tmpDir, f)).toString("base64")
          );
          // Probe while the file is still on disk, before cleanup.
          const probe = await probeMedia(inputPath);
          if (probe.error) console.log(`[analyze][${videoId}] probe unknown: ${probe.error}`);
          try { fs.rmSync(tmpDir, { recursive: true }); } catch {}
          resolve({ frames, hasAudioStream: probe.hasAudioStream, durationSec: probe.durationSec });
        } catch (err) {
          reject(err);
        }
      })
      .on("error", (err) => {
        try { fs.rmSync(tmpDir, { recursive: true }); } catch {}
        reject(err);
      })
      .run();
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const admin = isAdminEmail(session.user.email);
  const body = await req.json() as { videoId: string; regenerate?: boolean };
  const { videoId, regenerate = false } = body;

  if (!videoId) {
    return NextResponse.json({ error: "videoId is required" }, { status: 400 });
  }

  const video = await prisma.video.findFirst({
    where: { id: videoId, userId },
  });

  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  if (video.status === "ANALYZING" || video.status === "GENERATING") {
    return NextResponse.json({ error: "Analysis already in progress" }, { status: 409 });
  }

  // Defense in depth for the upload cap (the presign route enforces it
  // first): files above the limit can't be processed safely in this
  // function's memory, and any that slipped in before the cap existed must
  // not be retried into the same crash.
  if (isUploadTooLarge(video.fileSize)) {
    return NextResponse.json({ error: UPLOAD_TOO_LARGE_MESSAGE }, { status: 400 });
  }

  // ── Non-regenerate: return existing result early ────────────────────────
  // Only when the analysis actually has a track. An Analysis row with no
  // options (an interrupted first run) must fall through to a first
  // analysis so the empty-state "Generate Music" button can work.
  if (video.status === "ANALYZED" && !regenerate) {
    const analysis = await prisma.analysis.findUnique({ where: { videoId } });
    if (analysis && analysisHasOptions(analysis)) {
      let audioUrl = analysis.generatedAudioUrl;
      if (analysis.generatedAudioKey) {
        try { audioUrl = await generateDownloadPresignedUrl(OUTPUT_BUCKET, analysis.generatedAudioKey, 86400); } catch {}
      }
      let audioUrl2 = analysis.generatedAudioUrl2;
      if (analysis.generatedAudioKey2) {
        try { audioUrl2 = await generateDownloadPresignedUrl(OUTPUT_BUCKET, analysis.generatedAudioKey2, 86400); } catch {}
      }
      return NextResponse.json({
        status: "completed",
        analysis: { ...analysis, generatedAudioUrl: audioUrl, generatedAudioUrl2: audioUrl2 },
      });
    }
  }

  // ── Regenerate: option-cap and plan gate ────────────────────────────────
  // These apply whether or not an Analysis row exists — otherwise a video
  // with no row (e.g. the empty-state "Generate Music" button) bypasses both.
  let cachedVideoAnalysis: VideoAnalysis | null = null;
  const existingAnalysis = await prisma.analysis.findUnique({ where: { videoId } });

  // An existing row — whether we're regenerating or re-running an empty
  // first analysis — already holds Claude's read of the video. Reuse it
  // instead of paying for frames + Claude again.
  if (existingAnalysis) {
    cachedVideoAnalysis = {
      mood_tags:          existingAnalysis.moodTags,
      bpm_range:          existingAnalysis.bpmRange as { min: number; max: number },
      energy_score:       existingAnalysis.energyScore,
      scene_tags:         existingAnalysis.sceneTags,
      recommended_genres: existingAnalysis.recommendedGenres,
    };
  }

  // Admins are treated as the top plan everywhere below.
  const plan = admin ? "TEAM" : await getUserPlan(userId);
  // A FREE user who bought the one-time Video Pass for THIS video gets
  // paid-tier generation for it (full length, pairs, one regeneration) while
  // staying FREE everywhere else.
  const pass = !admin && plan === "FREE" ? await getVideoPass(videoId) : null;
  const freeLimited = !admin && plan === "FREE" && !pass;

  // Free tier: generate music for the first 60 s only. The analysis
  // (frames → Claude) still runs on the whole video; only the ElevenLabs
  // input is trimmed. Null = full length.
  const capSec: number | null = freeLimited ? FREE_PREVIEW_SECONDS : null;

  if (regenerate) {
    const opts = existingAnalysis
      ? ((existingAnalysis.generatedOptions as unknown as GeneratedOption[]) ?? [])
      : [];

    // Per-plan option cap: FREE 2 (no regen), CREATOR 4, TEAM/Pro 6. Admins
    // get the hard ceiling. Regeneration does not consume an analysis credit;
    // this cap is its only limiter.
    const cap = admin ? HARD_MAX_OPTIONS : pass ? PASS_OPTION_CAP : OPTION_CAPS[plan];

    if (freeLimited) {
      return NextResponse.json({ error: "Upgrade to generate more options." }, { status: 403 });
    }

    if (opts.length >= cap) {
      const label = pass ? PASS_LABEL : PLAN_LABELS[plan] ?? plan;
      const hint = cap < HARD_MAX_OPTIONS
        ? ` Upgrade to ${PLAN_LABELS.TEAM} for up to ${HARD_MAX_OPTIONS} per video.`
        : "";
      return NextResponse.json(
        { error: `Maximum options reached — the ${label} plan allows up to ${cap} per video.${hint}`, cap },
        { status: 400 }
      );
    }

  }

  // ── Quota: reserve the slot now, release it if we fail ──────────────────
  // The presign-time check alone is bypassable (mint several presigned URLs
  // while remaining > 0, then analyze each). Reserving here, before any
  // work starts and under a per-user lock, also closes the race where two
  // analyses started back-to-back both passed a check-only gate. Applies to
  // first-run analyses, plus one case of regeneration: a subscriber turning
  // a 60 s free-tier analysis into full-length tracks ("uncapping") pays one
  // analysis for it, like any paid analysis. Ordinary regeneration is part
  // of the analysis already paid for and is bounded by the option cap above;
  // a Video Pass uncapping is paid for by the pass.
  const uncapping = regenerate && existingAnalysis?.cappedSec != null && capSec === null;
  let reserved = false;
  if (!admin && (!regenerate || (uncapping && !pass))) {
    reserved = await reserveAnalysisSlot(userId);
    if (!reserved) {
      return NextResponse.json(
        { error: "Analysis limit reached — upgrade your plan to continue." },
        { status: 403 }
      );
    }
  }

  // How many tracks this run generates. First analysis: 1 on the free tier,
  // 2 on paid (and for admins). Regeneration is paid-only (gated above) and
  // always adds a pair.
  const trackCount: 1 | 2 = regenerate ? 2 : initialOptionCount(plan, admin || !!pass);

  await prisma.video.update({
    where: { id: videoId },
    data: { status: "ANALYZING" },
  });

  const isTimeout = (err: unknown): boolean =>
    err instanceof Error && err.message.includes("timed out");

  try {
    const result = await withTimeout(
      (async () => {
        // 1. Fetch video from S3
        const s3Obj = await s3Client.send(
          new GetObjectCommand({ Bucket: video.s3Bucket, Key: video.s3Key })
        );
        const videoBuffer = await streamToBuffer(s3Obj.Body as Readable);
        console.log(`[analyze][${videoId}] video fetched: ${videoBuffer.length}b`);

        // 2. VideoAnalysis — from cache (regenerate) or Claude (first run)
        // hasAudioStream stays null on the cached/regenerate path — that path
        // never re-extracts frames, and the existing Analysis row already has
        // hasOriginalAudio set from when it was first created.
        let videoAnalysis: VideoAnalysis;
        let hasAudioStream: boolean | null = null;
        let durationSec: number | null = video.durationSec ?? null;
        if (cachedVideoAnalysis) {
          console.log(`[analyze][${videoId}] regenerate: reusing cached VideoAnalysis`);
          videoAnalysis = cachedVideoAnalysis;
        } else {
          const extracted = await extractFrames(videoBuffer, videoId);
          const { frames } = extracted;
          hasAudioStream = extracted.hasAudioStream;
          if (extracted.durationSec !== null) durationSec = extracted.durationSec;
          if (frames.length === 0) throw new Error("No frames could be extracted from the video");
          console.log(`[analyze][${videoId}] extracted ${frames.length} frames, hasAudioStream=${hasAudioStream}, duration=${durationSec?.toFixed(1) ?? "?"}s`);
          if (durationSec !== null && video.durationSec == null) {
            await prisma.video.update({ where: { id: videoId }, data: { durationSec } })
              .catch((err) => console.error(`[analyze][${videoId}] failed to store duration (non-fatal):`, err));
          }

          // Thumbnail for the results-page poster: reuse the first extracted
          // frame (512px-wide JPEG sampled at ~t=0) instead of a second ffmpeg
          // pass. Only needed once — a regenerate takes the cachedVideoAnalysis
          // branch above and skips extraction entirely, so it never gets here.
          // Non-fatal: a missing poster degrades to preload="metadata" on the
          // client, it's not worth failing the whole analysis over.
          if (!video.thumbnailKey) {
            try {
              const thumbnailKey = `thumbnails/${videoId}/thumbnail.jpg`;
              await s3Client.send(new PutObjectCommand({
                Bucket: OUTPUT_BUCKET,
                Key: thumbnailKey,
                Body: Buffer.from(frames[0], "base64"),
                ContentType: "image/jpeg",
              }));
              const thumbnailUrl = await generateDownloadPresignedUrl(OUTPUT_BUCKET, thumbnailKey, 86400);
              await prisma.video.update({ where: { id: videoId }, data: { thumbnailKey, thumbnailUrl } });
              console.log(`[analyze][${videoId}] thumbnail uploaded: ${thumbnailKey}`);
            } catch (err) {
              console.error(`[analyze][${videoId}] thumbnail generation failed (non-fatal):`, err);
            }
          }

          videoAnalysis = await analyzeVideoFrames(frames);
          console.log(`[analyze][${videoId}] Claude analysis complete: energy=${videoAnalysis.energy_score}`);
        }

        // 3. Mark GENERATING for polling UI
        await prisma.video.update({ where: { id: videoId }, data: { status: "GENERATING" } });
        console.log(`[analyze][${videoId}] status → GENERATING`);

        // 4. ElevenLabs: two tracks in parallel (paid / regenerate), or one (free).
        // Free tier sends only the first FREE_PREVIEW_SECONDS of the video; the
        // track length follows the video, so this is what caps the music (and
        // the credits). cappedSec is recorded only when we know the video was
        // actually longer than the cap.
        let genBuffer = videoBuffer;
        let genMime = video.mimeType;
        let cappedSec: number | null = null;
        if (capSec !== null && (durationSec === null || durationSec > capSec)) {
          genBuffer = await trimVideoToSeconds(videoBuffer, capSec, videoId);
          genMime = "video/mp4";
          if (durationSec !== null && genBuffer !== videoBuffer) cappedSec = capSec;
        }
        console.log(`[analyze][${videoId}] calling ElevenLabs for ${trackCount} track(s)${cappedSec ? ` (first ${cappedSec}s)` : uncapping ? " (full length, replacing a capped preview)" : ""}...`);
        let option1: GeneratedMusic;
        let option2: GeneratedMusic | null = null;
        if (trackCount === 2) {
          ({ option1, option2 } = await generateMusicOptionsFromVideo(genBuffer, genMime, videoAnalysis));
        } else {
          option1 = await generateMusicFromVideo(genBuffer, genMime, videoAnalysis);
        }
        console.log(`[analyze][${videoId}] ElevenLabs opt1: ${option1.audioBuffer.byteLength}b${option2 ? `, opt2: ${option2.audioBuffer.byteLength}b` : ""}`);

        // 5. Upload to S3
        const timestamp = Date.now();
        const audioKey1 = `generated-music/${videoId}/${timestamp}-opt1.mp3`;
        const audioKey2 = option2 ? `generated-music/${videoId}/${timestamp}-opt2.mp3` : null;

        await Promise.all([
          s3Client.send(new PutObjectCommand({ Bucket: OUTPUT_BUCKET, Key: audioKey1, Body: Buffer.from(option1.audioBuffer), ContentType: "audio/mpeg" })),
          ...(option2 && audioKey2
            ? [s3Client.send(new PutObjectCommand({ Bucket: OUTPUT_BUCKET, Key: audioKey2, Body: Buffer.from(option2.audioBuffer), ContentType: "audio/mpeg" }))]
            : []),
        ]);
        console.log(`[analyze][${videoId}] audio uploaded: ${audioKey1}${audioKey2 ? `, ${audioKey2}` : ""}`);

        // 6. Presigned playback URLs (24 h)
        const audioUrl1 = await generateDownloadPresignedUrl(OUTPUT_BUCKET, audioKey1, 86400);
        const audioUrl2 = audioKey2 ? await generateDownloadPresignedUrl(OUTPUT_BUCKET, audioKey2, 86400) : null;

        return { videoAnalysis, hasAudioStream, cappedSec, option1, option2, audioKey1, audioUrl1, audioKey2, audioUrl2 };
      })(),
      ANALYSIS_TIMEOUT_MS,
      "Music generation timed out — try uploading a shorter clip."
    );

    const now = new Date().toISOString();

    if (regenerate && existingAnalysis) {
      // ── Accumulate: append the new options to the existing Analysis ──────
      // Regeneration always produces a pair (trackCount === 2 above).
      const existing = (existingAnalysis.generatedOptions as unknown as GeneratedOption[]) ?? [];
      const nextIndex = existing.length; // 2, 4 (or 1, 3 for an account that upgraded from a 1-track free analysis)
      const round = Math.floor(nextIndex / 2) + 1;

      const newOpts: GeneratedOption[] = [
        {
          id: `opt_${nextIndex + 1}`,
          round,
          label: OPTION_LABELS[nextIndex],
          audioKey: result.audioKey1,
          audioUrl: result.audioUrl1,
          description: result.option1.description,
          tags: result.option1.tags,
          createdAt: now,
        },
        ...(result.option2 && result.audioKey2 && result.audioUrl2
          ? [{
              id: `opt_${nextIndex + 2}`,
              round,
              label: OPTION_LABELS[nextIndex + 1],
              audioKey: result.audioKey2,
              audioUrl: result.audioUrl2,
              description: result.option2.description,
              tags: result.option2.tags,
              createdAt: now,
            }]
          : []),
      ];

      // A regeneration is paid, passed or admin, so it is full-length: clear
      // a cap left by an earlier free-tier run of the same video.
      const updated = await prisma.analysis.update({
        where: { id: existingAnalysis.id },
        data: {
          generatedOptions: JSON.parse(JSON.stringify([...existing, ...newOpts])),
          ...(result.cappedSec === null && existingAnalysis.cappedSec !== null ? { cappedSec: null } : {}),
        },
      });

      await prisma.video.update({ where: { id: videoId }, data: { status: "ANALYZED" } });
      // No incrementUsage here: regeneration is included in the original
      // analysis credit (pricing: "2 base + N more via regeneration").

      return NextResponse.json({ status: "completed", analysis: updated });

    } else {
      // ── First analysis: create Analysis with round-1 option(s) ───────────
      // One track on the free tier, two on paid — see trackCount.
      const initOpts: GeneratedOption[] = [
        {
          id: "opt_1",
          round: 1,
          label: "A",
          audioKey: result.audioKey1,
          audioUrl: result.audioUrl1,
          description: result.option1.description,
          tags: result.option1.tags,
          createdAt: now,
        },
        ...(result.option2 && result.audioKey2 && result.audioUrl2
          ? [{
              id: "opt_2",
              round: 1,
              label: "B",
              audioKey: result.audioKey2,
              audioUrl: result.audioUrl2,
              description: result.option2.description,
              tags: result.option2.tags,
              createdAt: now,
            }]
          : []),
      ];

      // Upsert, not create: a first run that was interrupted may have left
      // an Analysis row with no options, and videoId is unique.
      const analysisData = {
          moodTags:           result.videoAnalysis.mood_tags,
          bpmRange:           result.videoAnalysis.bpm_range,
          energyScore:        result.videoAnalysis.energy_score,
          sceneTags:          result.videoAnalysis.scene_tags,
          recommendedGenres:  result.videoAnalysis.recommended_genres,
          // Legacy fields — kept for backward compat
          musicDescription:   result.option1.description,
          musicTags:          result.option1.tags,
          generatedAudioKey:  result.audioKey1,
          generatedAudioUrl:  result.audioUrl1,
          musicDescription2:  result.option2?.description ?? null,
          musicTags2:         result.option2?.tags ?? [],
          generatedAudioKey2: result.audioKey2,
          generatedAudioUrl2: result.audioUrl2,
          // New: accumulated options array
          generatedOptions: JSON.parse(JSON.stringify(initOpts)),
          // null = probe unknown (failed/timed out) → schema default (true).
          // Only a positive "no audio stream" result stores false.
          hasOriginalAudio: result.hasAudioStream ?? true,
          cappedSec: result.cappedSec,
      };
      // On the cached path the audio probe doesn't run (hasAudioStream is
      // null); don't let the default clobber a value the first run stored.
      const { hasOriginalAudio: probedHasAudio, ...rest } = analysisData;
      const analysis = await prisma.analysis.upsert({
        where: { videoId },
        create: { videoId, ...analysisData },
        update: result.hasAudioStream === null ? rest : { ...rest, hasOriginalAudio: probedHasAudio },
      });

      await prisma.video.update({ where: { id: videoId }, data: { status: "ANALYZED" } });
      // The slot was reserved up front (reserveAnalysisSlot); nothing to count here.

      return NextResponse.json({ status: "completed", analysis });
    }

  } catch (err) {
    // Whatever went wrong, the user didn't get an analysis: hand the slot back.
    if (reserved) {
      await releaseAnalysisSlot(userId).catch((e) =>
        console.error(`[analyze][${videoId}] failed to release usage slot:`, e)
      );
    }

    // Out of ElevenLabs credits: not the user's fault and not a failure of
    // their video. Park it as PAUSED (the owner can retry after a top-up),
    // tell the user plainly, and page the admin — at most once an hour.
    if (err instanceof ElevenLabsQuotaError) {
      await prisma.video.update({ where: { id: videoId }, data: { status: "PAUSED" } });
      console.error(`[analyze][${videoId}] ElevenLabs quota exhausted (${err.status}): ${err.detail}`);
      await notifyAdminThrottled("elevenlabs-quota", ONE_HOUR_MS, elevenLabsQuotaAlert({ videoId, userId, detail: err.detail }));
      return NextResponse.json({ error: err.message, status: "PAUSED" }, { status: 503 });
    }

    const message = err instanceof Error ? err.message : "Analysis failed. Please try again.";
    await prisma.video.update({ where: { id: videoId }, data: { status: "FAILED" } });
    console.error(`[analyze][${videoId}] error:`, err);
    return NextResponse.json(
      { error: message },
      { status: isTimeout(err) ? 504 : 500 }
    );
  }
}
