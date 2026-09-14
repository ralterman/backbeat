export const maxDuration = 300; // Claude + ElevenLabs generation can take 60–120 s

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeVideoFrames, VideoAnalysis } from "@/lib/analyze";
import { generateMusicOptionsFromVideo } from "@/lib/elevenlabs";
import { incrementUsage } from "@/lib/usage";
import { getUserPlan } from "@/lib/usage";
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

const OPTION_LABELS = ["A", "B", "C", "D", "E", "F"];
const MAX_OPTIONS = 6;

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

async function extractFrames(videoBuffer: Buffer, videoId: string): Promise<string[]> {
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
      .on("end", () => {
        try {
          const files = fs.readdirSync(tmpDir)
            .filter((f) => f.startsWith("frame-") && f.endsWith(".jpg"))
            .sort();
          const frames = files.map((f) =>
            fs.readFileSync(path.join(tmpDir, f)).toString("base64")
          );
          try { fs.rmSync(tmpDir, { recursive: true }); } catch {}
          resolve(frames);
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

  // ── Regenerate: plan-gate and option-cap checks ─────────────────────────
  let cachedVideoAnalysis: VideoAnalysis | null = null;
  let existingAnalysis: Awaited<ReturnType<typeof prisma.analysis.findUnique>> | null = null;

  if (regenerate) {
    existingAnalysis = await prisma.analysis.findUnique({ where: { videoId } });

    if (existingAnalysis) {
      const opts = (existingAnalysis.generatedOptions as unknown as GeneratedOption[]) ?? [];

      if (opts.length >= MAX_OPTIONS) {
        return NextResponse.json(
          { error: "Maximum options reached." },
          { status: 400 }
        );
      }

      if (!admin) {
        const plan = await getUserPlan(userId);
        if (plan === "FREE") {
          return NextResponse.json(
            { error: "Upgrade to generate more options." },
            { status: 403 }
          );
        }
      }

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
        let videoAnalysis: VideoAnalysis;
        if (cachedVideoAnalysis) {
          console.log(`[analyze][${videoId}] regenerate: reusing cached VideoAnalysis`);
          videoAnalysis = cachedVideoAnalysis;
        } else {
          const frames = await extractFrames(videoBuffer, videoId);
          if (frames.length === 0) throw new Error("No frames could be extracted from the video");
          console.log(`[analyze][${videoId}] extracted ${frames.length} frames`);
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

        return { videoAnalysis, option1, option2, audioKey1, audioUrl1, audioKey2, audioUrl2 };
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
      if (!admin) await incrementUsage(userId, "analysis");

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
