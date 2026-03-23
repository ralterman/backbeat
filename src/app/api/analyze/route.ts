import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeVideoFrames } from "@/lib/analyze";
import { matchTracks } from "@/lib/matching";
import { incrementUsage, getUserPlan } from "@/lib/usage";
import { s3Client, INPUT_BUCKET } from "@/lib/s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getFFmpeg } from "@/lib/ffmpeg-wasm";
import { Readable } from "stream";

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

async function extractFrames(videoBuffer: Buffer, videoId: string): Promise<string[]> {
  const ffmpeg = await getFFmpeg();
  const inputName = `input-${videoId}.mp4`;

  await ffmpeg.writeFile(inputName, new Uint8Array(videoBuffer));

  try {
    await ffmpeg.exec([
      "-i", inputName,
      "-vf", "fps=1/3,scale=512:-1",
      "-frames:v", "10",
      "-f", "image2",
      `frame-${videoId}-%03d.jpg`,
    ]);
  } finally {
    try { await ffmpeg.deleteFile(inputName); } catch {}
  }

  const frames: string[] = [];
  for (let i = 1; i <= 10; i++) {
    const name = `frame-${videoId}-${String(i).padStart(3, "0")}.jpg`;
    try {
      const data = await ffmpeg.readFile(name) as Uint8Array;
      frames.push(Buffer.from(data).toString("base64"));
      await ffmpeg.deleteFile(name);
    } catch {
      break;
    }
  }

  return frames;
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

  // Mark as analyzing
  await prisma.video.update({
    where: { id: videoId },
    data: { status: "ANALYZING" },
  });

  try {
    // Download video from S3
    const s3Obj = await s3Client.send(
      new GetObjectCommand({ Bucket: video.s3Bucket, Key: video.s3Key })
    );
    const videoBuffer = await streamToBuffer(s3Obj.Body as Readable);

    // Extract frames
    const frames = await extractFrames(videoBuffer, videoId);

    if (frames.length === 0) {
      throw new Error("No frames could be extracted from the video");
    }

    // Call Claude
    const analysisResult = await analyzeVideoFrames(frames);

    // Match tracks — free users get top 3, paid users get top 5
    const plan = await getUserPlan(userId);
    const topN = plan === "FREE" ? 3 : 5;
    const topTracks = await matchTracks(analysisResult, topN);

    // Save analysis
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

    // Save track matches
    await prisma.trackMatch.createMany({
      data: topTracks.map((track, i) => ({
        analysisId: analysis.id,
        trackId: track.id,
        matchScore: track.match_score,
        rank: i + 1,
      })),
    });

    // Mark video as analyzed & increment usage
    await prisma.video.update({
      where: { id: videoId },
      data: { status: "ANALYZED" },
    });
    await incrementUsage(userId, "analysis");

    return NextResponse.json({
      status: "completed",
      analysis,
      matches: topTracks,
    });
  } catch (err) {
    await prisma.video.update({
      where: { id: videoId },
      data: { status: "FAILED" },
    });
    console.error("Analysis error:", err);
    return NextResponse.json(
      { error: "Analysis failed. Please try again." },
      { status: 500 }
    );
  }
}
