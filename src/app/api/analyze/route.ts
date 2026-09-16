export const maxDuration = 300; // Claude + ElevenLabs generation can take 60–120 s

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeVideoFrames, VideoAnalysis } from "@/lib/analyze";
import { generateMusicOptionsFromVideo } from "@/lib/elevenlabs";
import { incrementUsage, getUserPlan, canAnalyze, OPTION_CAPS, HARD_MAX_OPTIONS } from "@/lib/usage";
import { PLAN_LABELS } from "@/lib/plans";
import { isAdminEmail } from "@/lib/admin";
import { s3Client, OUTPUT_BUCKET, generateDownloadPresignedUrl } from "@/lib/s3";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { Readable } from "stream";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

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

/** Whether the file has at least one audio stream. Benign default (true) on
 *  probe failure/timeout — worst case a genuinely silent video keeps the
 *  "keep my audio" option available and mixing just adds silence. */
function probeHasAudio(inputPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(true), 5000);
    ffmpeg.ffprobe(inputPath, (err, meta) => {
      clearTimeout(t);
      if (err || !meta?.streams) return resolve(true);
      resolve(meta.streams.some((s) => s.codec_type === "audio"));
    });
  });
}

async function extractFrames(
  videoBuffer: Buffer,
  videoId: string
): Promise<{ frames: string[]; hasAudioStream: boolean }> {
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
          const hasAudioStream = await probeHasAudio(inputPath);
          try { fs.rmSync(tmpDir, { recursive: true }); } catch {}
          resolve({ frames, hasAudioStream });
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

  // ── Non-regenerate: return existing result early ────────────────────────
  if (video.status === "ANALYZED" && !regenerate) {
    const analysis = await prisma.analysis.findUnique({ where: { videoId } });
    if (analysis) {
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
  let existingAnalysis: Awaited<ReturnType<typeof prisma.analysis.findUnique>> | null = null;

  if (regenerate) {
    existingAnalysis = await prisma.analysis.findUnique({ where: { videoId } });
    const opts = existingAnalysis
      ? ((existingAnalysis.generatedOptions as unknown as GeneratedOption[]) ?? [])
      : [];

    // Per-plan option cap: FREE 2 (no regen), CREATOR 4, TEAM/Pro 6. Admins
    // get the hard ceiling. Regeneration does not consume an analysis credit;
    // this cap is its only limiter.
    const plan = admin ? "TEAM" : await getUserPlan(userId);
    const cap = admin ? HARD_MAX_OPTIONS : OPTION_CAPS[plan];

    if (!admin && plan === "FREE") {
      return NextResponse.json({ error: "Upgrade to generate more options." }, { status: 403 });
    }

    if (opts.length >= cap) {
      const label = PLAN_LABELS[plan] ?? plan;
      const hint = cap < HARD_MAX_OPTIONS
        ? ` Upgrade to ${PLAN_LABELS.TEAM} for up to ${HARD_MAX_OPTIONS} per video.`
        : "";
      return NextResponse.json(
        { error: `Maximum options reached — the ${label} plan allows up to ${cap} per video.${hint}`, cap },
        { status: 400 }
      );
    }

    if (existingAnalysis) {
      // Reuse cached Claude analysis — skips re-analyzing
      cachedVideoAnalysis = {
        mood_tags:          existingAnalysis.moodTags,
        bpm_range:          existingAnalysis.bpmRange as { min: number; max: number },
        energy_score:       existingAnalysis.energyScore,
        scene_tags:         existingAnalysis.sceneTags,
        recommended_genres: existingAnalysis.recommendedGenres,
      };
    }
  }

  // ── Quota: enforce here, not just at upload time ────────────────────────
  // The presign-time check alone is bypassable (mint several presigned URLs
  // while remaining > 0, then analyze each). Applies to first-run analyses
  // only: regeneration is part of the analysis already paid for and is
  // bounded by the per-plan option cap above, not by the monthly quota.
  if (!admin && !regenerate && !(await canAnalyze(userId))) {
    return NextResponse.json(
      { error: "Analysis limit reached — upgrade your plan to continue." },
      { status: 403 }
    );
  }

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
        if (cachedVideoAnalysis) {
          console.log(`[analyze][${videoId}] regenerate: reusing cached VideoAnalysis`);
          videoAnalysis = cachedVideoAnalysis;
        } else {
          const extracted = await extractFrames(videoBuffer, videoId);
          const { frames } = extracted;
          hasAudioStream = extracted.hasAudioStream;
          if (frames.length === 0) throw new Error("No frames could be extracted from the video");
          console.log(`[analyze][${videoId}] extracted ${frames.length} frames, hasAudioStream=${hasAudioStream}`);

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

        // 4. ElevenLabs: two tracks in parallel
        console.log(`[analyze][${videoId}] calling ElevenLabs...`);
        const { option1, option2 } = await generateMusicOptionsFromVideo(videoBuffer, video.mimeType, videoAnalysis);
        console.log(`[analyze][${videoId}] ElevenLabs opt1: ${option1.audioBuffer.byteLength}b, opt2: ${option2.audioBuffer.byteLength}b`);

        // 5. Upload both to S3
        const timestamp = Date.now();
        const audioKey1 = `generated-music/${videoId}/${timestamp}-opt1.mp3`;
        const audioKey2 = `generated-music/${videoId}/${timestamp}-opt2.mp3`;

        await Promise.all([
          s3Client.send(new PutObjectCommand({ Bucket: OUTPUT_BUCKET, Key: audioKey1, Body: Buffer.from(option1.audioBuffer), ContentType: "audio/mpeg" })),
          s3Client.send(new PutObjectCommand({ Bucket: OUTPUT_BUCKET, Key: audioKey2, Body: Buffer.from(option2.audioBuffer), ContentType: "audio/mpeg" })),
        ]);
        console.log(`[analyze][${videoId}] audio uploaded: ${audioKey1}, ${audioKey2}`);

        // 6. Presigned playback URLs (24 h)
        const [audioUrl1, audioUrl2] = await Promise.all([
          generateDownloadPresignedUrl(OUTPUT_BUCKET, audioKey1, 86400),
          generateDownloadPresignedUrl(OUTPUT_BUCKET, audioKey2, 86400),
        ]);

        return { videoAnalysis, hasAudioStream, option1, option2, audioKey1, audioUrl1, audioKey2, audioUrl2 };
      })(),
      ANALYSIS_TIMEOUT_MS,
      "Music generation timed out — try uploading a shorter clip."
    );

    const now = new Date().toISOString();

    if (regenerate && existingAnalysis) {
      // ── Accumulate: append two new options to existing Analysis ──────────
      const existing = (existingAnalysis.generatedOptions as unknown as GeneratedOption[]) ?? [];
      const nextIndex = existing.length; // 2, 4
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
        {
          id: `opt_${nextIndex + 2}`,
          round,
          label: OPTION_LABELS[nextIndex + 1],
          audioKey: result.audioKey2,
          audioUrl: result.audioUrl2,
          description: result.option2.description,
          tags: result.option2.tags,
          createdAt: now,
        },
      ];

      const updated = await prisma.analysis.update({
        where: { id: existingAnalysis.id },
        data: { generatedOptions: JSON.parse(JSON.stringify([...existing, ...newOpts])) },
      });

      await prisma.video.update({ where: { id: videoId }, data: { status: "ANALYZED" } });
      // No incrementUsage here: regeneration is included in the original
      // analysis credit (pricing: "2 base + N more via regeneration").

      return NextResponse.json({ status: "completed", analysis: updated });

    } else {
      // ── First analysis: create Analysis with round-1 options ─────────────
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
        {
          id: "opt_2",
          round: 1,
          label: "B",
          audioKey: result.audioKey2,
          audioUrl: result.audioUrl2,
          description: result.option2.description,
          tags: result.option2.tags,
          createdAt: now,
        },
      ];

      const analysis = await prisma.analysis.create({
        data: {
          videoId,
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
          musicDescription2:  result.option2.description,
          musicTags2:         result.option2.tags,
          generatedAudioKey2: result.audioKey2,
          generatedAudioUrl2: result.audioUrl2,
          // New: accumulated options array
          generatedOptions: JSON.parse(JSON.stringify(initOpts)),
          // hasAudioStream is only null if extractFrames was somehow skipped
          // on this branch, which shouldn't happen — default true is the
          // same safe fallback the schema itself uses.
          hasOriginalAudio: result.hasAudioStream ?? true,
        },
      });

      await prisma.video.update({ where: { id: videoId }, data: { status: "ANALYZED" } });
      if (!admin) await incrementUsage(userId, "analysis");

      return NextResponse.json({ status: "completed", analysis });
    }

  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed. Please try again.";
    await prisma.video.update({ where: { id: videoId }, data: { status: "FAILED" } });
    console.error(`[analyze][${videoId}] error:`, err);
    return NextResponse.json(
      { error: message },
      { status: isTimeout(err) ? 504 : 500 }
    );
  }
}
