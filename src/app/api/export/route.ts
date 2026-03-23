import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { s3Client, OUTPUT_BUCKET, generateDownloadPresignedUrl } from "@/lib/s3";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getUserPlan } from "@/lib/usage";
import { tracks } from "@/data/tracks";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { Readable } from "stream";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { randomUUID } from "crypto";

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

async function mergeVideoAudio(
  videoBuffer: Buffer,
  audioBuffer: Buffer,
  exportId: string,
  hasWatermark: boolean
): Promise<Buffer> {
  const tmpDir = path.join(os.tmpdir(), `backbeat-export-${exportId}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const videoPath = path.join(tmpDir, "input.mp4");
  const audioPath = path.join(tmpDir, "audio.mp3");
  const outputPath = path.join(tmpDir, "output.mp4");

  fs.writeFileSync(videoPath, videoBuffer);
  fs.writeFileSync(audioPath, audioBuffer);

  return new Promise((resolve, reject) => {
    let cmd = ffmpeg(videoPath)
      .addInput(audioPath)
      .audioFilters([
        "afade=t=in:st=0:d=2",
        "afade=t=out:st=28:d=2",
        "loudnorm=I=-14:TP=-1:LRA=11",
      ]);

    if (hasWatermark) {
      cmd = cmd
        .videoFilters([
          "drawtext=text='BACKBEAT WATERMARK':fontcolor=white@0.3:fontsize=24:x=(w-text_w)/2:y=(h-text_h)/2",
        ])
        .outputOptions([
          "-map 0:v:0",
          "-map 1:a:0",
          "-c:v libx264",
          "-preset fast",
          "-crf 23",
          "-c:a aac",
          "-shortest",
        ]);
    } else {
      cmd = cmd.outputOptions([
        "-map 0:v:0",
        "-map 1:a:0",
        "-c:v copy",
        "-c:a aac",
        "-shortest",
      ]);
    }

    cmd
      .output(outputPath)
      .on("end", () => {
        try {
          const buf = fs.readFileSync(outputPath);
          try { fs.rmSync(tmpDir, { recursive: true }); } catch {}
          resolve(buf);
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
  await prisma.export.create({
    data: {
      id: exportId,
      videoId,
      trackId,
      userId,
      status: "PROCESSING",
      hasWatermark,
    },
  });

  try {
    const s3Obj = await s3Client.send(
      new GetObjectCommand({ Bucket: video.s3Bucket, Key: video.s3Key })
    );
    const videoBuffer = await streamToBuffer(s3Obj.Body as Readable);

    const audioRes = await fetch(track.preview_url);
    if (!audioRes.ok) throw new Error(`Failed to fetch audio: ${audioRes.status}`);
    const audioBuffer = Buffer.from(await audioRes.arrayBuffer());

    const outputBuffer = await mergeVideoAudio(videoBuffer, audioBuffer, exportId, hasWatermark);

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
    const downloadUrl = await generateDownloadPresignedUrl(OUTPUT_BUCKET, outputKey, 86400);

    await prisma.export.update({
      where: { id: exportId },
      data: { status: "COMPLETED", s3OutputKey: outputKey, downloadUrl, expiresAt },
    });

    return NextResponse.json({ exportId, downloadUrl, expiresAt });
  } catch (err) {
    console.error("Export error:", err);
    await prisma.export.update({ where: { id: exportId }, data: { status: "FAILED" } });
    return NextResponse.json({ error: "Export failed. Please try again." }, { status: 500 });
  }
}
