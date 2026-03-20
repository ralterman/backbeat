import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { s3Client, INPUT_BUCKET, OUTPUT_BUCKET, generateDownloadPresignedUrl } from "@/lib/s3";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getUserPlan } from "@/lib/usage";
import { tracks } from "@/data/tracks";
import ffmpeg from "fluent-ffmpeg";
import { Readable } from "stream";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { randomUUID } from "crypto";
import https from "https";

if (process.env.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

async function downloadUrl(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    https.get(url, (res) => {
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

async function mergeVideoAudio(
  videoPath: string,
  audioPath: string,
  outputPath: string,
  hasWatermark: boolean
): Promise<void> {
  return new Promise((resolve, reject) => {
    let cmd = ffmpeg(videoPath)
      .addInput(audioPath)
      .audioFilters([
        "afade=t=in:st=0:d=2",     // fade in 2 sec
        "afade=t=out:st=28:d=2",   // fade out
        "loudnorm=I=-14:TP=-1:LRA=11", // normalize to -14 LUFS
      ]);

    if (hasWatermark) {
      cmd = cmd.videoFilters([
        "drawtext=text='BACKBEAT WATERMARK':fontcolor=white@0.3:fontsize=24:x=(w-text_w)/2:y=(h-text_h)/2",
      ]);
    }

    cmd
      .outputOptions([
        "-map 0:v:0",   // take video from first input
        "-map 1:a:0",   // take audio from second input
        "-c:v copy",
        "-c:a aac",
        "-shortest",
      ])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", reject)
      .run();
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { videoId, trackId } = await req.json() as { videoId: string; trackId: string };

  if (!videoId || !trackId) {
    return NextResponse.json({ error: "videoId and trackId are required" }, { status: 400 });
  }

  const video = await prisma.video.findFirst({ where: { id: videoId, userId } });
  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  const track = tracks.find((t) => t.id === trackId);
  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const plan = await getUserPlan(userId);
  const hasWatermark = plan === "FREE";

  const exportId = randomUUID();
  const exportRecord = await prisma.export.create({
    data: {
      id: exportId,
      videoId,
      trackId,
      userId,
      status: "PROCESSING",
      hasWatermark,
    },
  });

  // Process in background (non-blocking response for long operations)
  // For MVP we process inline (move to BullMQ for production)
  const tmpDir = path.join(os.tmpdir(), `backbeat-export-${exportId}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    // Download video from S3
    const s3Obj = await s3Client.send(
      new GetObjectCommand({ Bucket: video.s3Bucket, Key: video.s3Key })
    );
    const videoBuffer = await streamToBuffer(s3Obj.Body as Readable);
    const videoPath = path.join(tmpDir, "input.mp4");
    fs.writeFileSync(videoPath, videoBuffer);

    // Download audio from preview URL
    const audioBuffer = await downloadUrl(track.preview_url);
    const audioPath = path.join(tmpDir, "audio.mp3");
    fs.writeFileSync(audioPath, audioBuffer);

    const outputPath = path.join(tmpDir, "output.mp4");
    await mergeVideoAudio(videoPath, audioPath, outputPath, hasWatermark);

    // Upload to output S3
    const outputBuffer = fs.readFileSync(outputPath);
    const outputKey = `exports/${userId}/${exportId}.mp4`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: OUTPUT_BUCKET,
        Key: outputKey,
        Body: outputBuffer,
        ContentType: "video/mp4",
      })
    );

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const downloadUrl_ = await generateDownloadPresignedUrl(OUTPUT_BUCKET, outputKey, 86400);

    await prisma.export.update({
      where: { id: exportId },
      data: {
        status: "COMPLETED",
        s3OutputKey: outputKey,
        downloadUrl: downloadUrl_,
        expiresAt,
      },
    });

    // Cleanup temp files
    try { fs.rmSync(tmpDir, { recursive: true }); } catch {}

    return NextResponse.json({ exportId, downloadUrl: downloadUrl_, expiresAt });
  } catch (err) {
    console.error("Export error:", err);
    await prisma.export.update({ where: { id: exportId }, data: { status: "FAILED" } });
    try { fs.rmSync(tmpDir, { recursive: true }); } catch {}
    return NextResponse.json({ error: "Export failed. Please try again." }, { status: 500 });
  }
}
