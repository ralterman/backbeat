export const maxDuration = 300; // Claude + ElevenLabs generation can take 60–120 s

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeVideoFrames, VideoAnalysis } from "@/lib/analyze";
import { generateMusicOptionsFromVideo } from "@/lib/elevenlabs";
import { incrementUsage } from "@/lib/usage";
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

  if (video.status === "ANALYZING") {
    return NextResponse.json({ error: "Analysis already in progress" }, { status: 409 });
  }

  // If already analyzed and not regenerating, return the existing result.
  if (video.status === "ANALYZED" && !regenerate) {
    const analysis = await prisma.analysis.findUnique({ where: { videoId } });
    if (analysis) {
      // Refresh presigned URLs if we have the S3 keys (they expire every 24 h).
      let audioUrl = analysis.generatedAudioUrl;
      if (analysis.generatedAudioKey) {
        try {
          audioUrl = await generateDownloadPresignedUrl(OUTPUT_BUCKET, analysis.generatedAudioKey, 86400);
        } catch { /* leave the stored URL as-is */ }
      }
      let audioUrl2 = analysis.generatedAudioUrl2;
      if (analysis.generatedAudioKey2) {
        try {
          audioUrl2 = await generateDownloadPresignedUrl(OUTPUT_BUCKET, analysis.generatedAudioKey2, 86400);
        } catch { /* leave the stored URL as-is */ }
      }
      return NextResponse.json({
        status: "completed",
        analysis: { ...analysis, generatedAudioUrl: audioUrl, generatedAudioUrl2: audioUrl2 },
      });
    }
  }

  // ── Part 3: On regenerate, reconstruct VideoAnalysis from the stored Analysis
  // (skip the Claude API call — saves credits and ~10–20 s of latency).
  let cachedVideoAnalysis: VideoAnalysis | null = null;
  if (regenerate && video.status === "ANALYZED") {
    const existing = await prisma.analysis.findUnique({ where: { videoId } });
    if (existing) {
      cachedVideoAnalysis = {
        mood_tags:           existing.moodTags,
        bpm_range:           existing.bpmRange as { min: number; max: number },
        energy_score:        existing.energyScore,
        scene_tags:          existing.sceneTags,
        recommended_genres:  existing.recommendedGenres,
      };
      await prisma.analysis.delete({ where: { id: existing.id } });
    }
    await prisma.video.update({ where: { id: videoId }, data: { status: "UPLOADED" } });
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

        // 2. Get VideoAnalysis — either from cache (regenerate) or from Claude
        let videoAnalysis: VideoAnalysis;
        if (cachedVideoAnalysis) {
          console.log(`[analyze][${videoId}] regenerate: reusing cached VideoAnalysis (skipping Claude)`);
          videoAnalysis = cachedVideoAnalysis;
        } else {
          // Extract frames for Claude
          const frames = await extractFrames(videoBuffer, videoId);
          if (frames.length === 0) {
            throw new Error("No frames could be extracted from the video");
          }
          console.log(`[analyze][${videoId}] extracted ${frames.length} frames`);

          // Claude analyzes the frames → structured JSON
          videoAnalysis = await analyzeVideoFrames(frames);
          console.log(`[analyze][${videoId}] Claude analysis complete: energy=${videoAnalysis.energy_score}`);
        }

        // 3. ElevenLabs generates two custom tracks in parallel
        console.log(`[analyze][${videoId}] calling ElevenLabs (two options in parallel)...`);
        const { option1, option2 } = await generateMusicOptionsFromVideo(
          videoBuffer,
          video.mimeType,
          videoAnalysis
        );
        console.log(`[analyze][${videoId}] ElevenLabs opt1: ${option1.audioBuffer.byteLength}b, opt2: ${option2.audioBuffer.byteLength}b`);

        // 4. Upload both audio tracks to S3
        const timestamp = Date.now();
        const audioKey1 = `generated-music/${videoId}/${timestamp}-opt1.mp3`;
        const audioKey2 = `generated-music/${videoId}/${timestamp}-opt2.mp3`;

        await Promise.all([
          s3Client.send(new PutObjectCommand({
            Bucket: OUTPUT_BUCKET,
            Key: audioKey1,
            Body: Buffer.from(option1.audioBuffer),
            ContentType: "audio/mpeg",
          })),
          s3Client.send(new PutObjectCommand({
            Bucket: OUTPUT_BUCKET,
            Key: audioKey2,
            Body: Buffer.from(option2.audioBuffer),
            ContentType: "audio/mpeg",
          })),
        ]);
        console.log(`[analyze][${videoId}] audio uploaded: ${audioKey1}, ${audioKey2}`);

        // 5. Generate 24-hour presigned playback URLs for both
        const [audioUrl1, audioUrl2] = await Promise.all([
          generateDownloadPresignedUrl(OUTPUT_BUCKET, audioKey1, 86400),
          generateDownloadPresignedUrl(OUTPUT_BUCKET, audioKey2, 86400),
        ]);

        return { videoAnalysis, option1, option2, audioKey1, audioUrl1, audioKey2, audioUrl2 };
      })(),
      ANALYSIS_TIMEOUT_MS,
      "Music generation timed out — try uploading a shorter clip."
    );

    // 6. Persist analysis to DB (both options)
    const analysis = await prisma.analysis.create({
      data: {
        videoId,
        moodTags:          result.videoAnalysis.mood_tags,
        bpmRange:          result.videoAnalysis.bpm_range,
        energyScore:       result.videoAnalysis.energy_score,
        sceneTags:         result.videoAnalysis.scene_tags,
        recommendedGenres: result.videoAnalysis.recommended_genres,
        // Option 1
        musicDescription:  result.option1.description,
        musicTags:         result.option1.tags,
        generatedAudioKey: result.audioKey1,
        generatedAudioUrl: result.audioUrl1,
        // Option 2
        musicDescription2:  result.option2.description,
        musicTags2:         result.option2.tags,
        generatedAudioKey2: result.audioKey2,
        generatedAudioUrl2: result.audioUrl2,
      },
    });

    await prisma.video.update({
      where: { id: videoId },
      data: { status: "ANALYZED" },
    });
    await incrementUsage(userId, "analysis");

    return NextResponse.json({ status: "completed", analysis });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed. Please try again.";
    await prisma.video.update({
      where: { id: videoId },
      data: { status: "FAILED" },
    });
    console.error(`[analyze][${videoId}] error:`, err);
    return NextResponse.json(
      { error: message },
      { status: isTimeout(err) ? 504 : 500 }
    );
  }
}
