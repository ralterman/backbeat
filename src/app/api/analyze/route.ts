export const maxDuration = 60; // allow up to 60 s for S3 fetch + FFmpeg + Claude

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeVideoFrames } from "@/lib/analyze";
import { matchTracks } from "@/lib/matching";
import { incrementUsage, getUserPlan } from "@/lib/usage";
import { s3Client } from "@/lib/s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { Readable } from "stream";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

// Leave a 5 s buffer before maxDuration so we can write the FAILED status
// and return a clean 504 rather than being killed mid-flight by Vercel.
const ANALYSIS_TIMEOUT_MS = 55_000;

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
  const { videoId } = await req.json() as { videoId: string };

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

  if (video.status === "ANALYZED") {
    const analysis = await prisma.analysis.findUnique({ where: { videoId } });
    const matches = await prisma.trackMatch.findMany({
      where: { analysisId: analysis?.id },
      orderBy: { rank: "asc" },
    });
    return NextResponse.json({ status: "completed", analysis, matches });
  }

  await prisma.video.update({
    where: { id: videoId },
    data: { status: "ANALYZING" },
  });

  const isTimeout = (err: unknown): boolean =>
    err instanceof Error && err.message.includes("timed out");

  try {
    const analysisResult = await withTimeout(
      (async () => {
        const s3Obj = await s3Client.send(
          new GetObjectCommand({ Bucket: video.s3Bucket, Key: video.s3Key })
        );
        const videoBuffer = await streamToBuffer(s3Obj.Body as Readable);

        const frames = await extractFrames(videoBuffer, videoId);
        if (frames.length === 0) {
          throw new Error("No frames could be extracted from the video");
        }

        return analyzeVideoFrames(frames);
      })(),
      ANALYSIS_TIMEOUT_MS,
      "Analysis timed out — please try a shorter video"
    );

    const plan = await getUserPlan(userId);
    const topN = plan === "FREE" ? 3 : 5;
    const topTracks = await matchTracks(analysisResult, topN);

    const analysis = await prisma.analysis.create({
      data: {
        videoId,
        moodTags: analysisResult.mood_tags,
        bpmRange: analysisResult.bpm_range,
        energyScore: analysisResult.energy_score,
        sceneTags: analysisResult.scene_tags,
        recommendedGenres: analysisResult.recommended_genres,
      },
    });

    await prisma.trackMatch.createMany({
      data: topTracks.map((track, i) => ({
        analysisId: analysis.id,
        trackId: track.id,
        matchScore: track.match_score,
        rank: i + 1,
      })),
    });

    await prisma.video.update({
      where: { id: videoId },
      data: { status: "ANALYZED" },
    });
    await incrementUsage(userId, "analysis");

    return NextResponse.json({ status: "completed", analysis, matches: topTracks });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed. Please try again.";
    await prisma.video.update({
      where: { id: videoId },
      data: { status: "FAILED" },
    });
    console.error("Analysis error:", err);
    return NextResponse.json(
      { error: message },
      { status: isTimeout(err) ? 504 : 500 }
    );
  }
}
