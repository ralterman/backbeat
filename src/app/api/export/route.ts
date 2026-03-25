export const maxDuration = 60; // allow up to 60s for FFmpeg processing

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
  console.log(`[export][${exportId}] tmpDir created: ${tmpDir}`);

  const videoPath = path.join(tmpDir, "input.mp4");
  const audioPath = path.join(tmpDir, "audio.mp3");
  const outputPath = path.join(tmpDir, "output.mp4");

  fs.writeFileSync(videoPath, videoBuffer);
  fs.writeFileSync(audioPath, audioBuffer);
  console.log(`[export][${exportId}] wrote video (${videoBuffer.length} bytes) + audio (${audioBuffer.length} bytes)`);

  // Probe video duration to set fade-out timing correctly
  const videoDuration: number = await new Promise((res) => {
    ffmpeg.ffprobe(videoPath, (err, meta) => {
      if (err || !meta?.format?.duration) { res(30); return; }
      res(Math.max(1, meta.format.duration));
    });
  });
  const fadeOutStart = Math.max(0, videoDuration - 2);
  console.log(`[export][${exportId}] videoDuration=${videoDuration.toFixed(2)}s, fadeOutStart=${fadeOutStart.toFixed(2)}s, hasWatermark=${hasWatermark}`);

  return new Promise((resolve, reject) => {
    let cmd = ffmpeg(videoPath)
      .addInput(audioPath)
      .audioFilters([
        "afade=t=in:st=0:d=2",
        `afade=t=out:st=${fadeOutStart.toFixed(2)}:d=2`,
        "volume=0.85", // simple single-pass volume; loudnorm is 2-pass and takes 15-30s
      ]);

    if (hasWatermark) {
      // drawtext without font= uses ffmpeg's built-in bitmap font — no fontconfig needed
      cmd = cmd
        .videoFilters([
          "drawtext=text='Made with Backbeat':fontsize=18:fontcolor=white@0.75:shadowcolor=black@0.8:shadowx=1:shadowy=1:x=w-165:y=h-28",
        ])
        .outputOptions([
          "-map 0:v:0",
          "-map 1:a:0",
          "-c:v libx264",
          "-preset ultrafast", // 4-5x faster than 'fast'; quality still fine for watermark tier
          "-crf 26",
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
      .on("start", (cmdLine) => console.log(`[export][${exportId}] ffmpeg start: ${cmdLine}`))
      .on("stderr", (line) => console.log(`[export][${exportId}] ffmpeg: ${line}`))
      .on("end", () => {
        try {
          const buf = fs.readFileSync(outputPath);
          console.log(`[export][${exportId}] output generated: ${buf.length} bytes`);
          try { fs.rmSync(tmpDir, { recursive: true }); } catch {}
          resolve(buf);
        } catch (err) {
          console.error(`[export][${exportId}] failed to read output:`, err);
          reject(err);
        }
      })
      .on("error", (err, _stdout, stderr) => {
        console.error(`[export][${exportId}] ffmpeg error:`, err.message);
        console.error(`[export][${exportId}] ffmpeg stderr:`, stderr);
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
    console.log(`[export][${exportId}] fetching video from S3: ${video.s3Bucket}/${video.s3Key}`);
    const s3Obj = await s3Client.send(
      new GetObjectCommand({ Bucket: video.s3Bucket, Key: video.s3Key })
    );
    const videoBuffer = await streamToBuffer(s3Obj.Body as Readable);
    console.log(`[export][${exportId}] video fetched: ${videoBuffer.length} bytes`);

    console.log(`[export][${exportId}] fetching audio: ${track.preview_url}`);
    const audioRes = await fetch(track.preview_url);
    if (!audioRes.ok) throw new Error(`Failed to fetch audio: ${audioRes.status} ${audioRes.statusText}`);
    const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
    console.log(`[export][${exportId}] audio fetched: ${audioBuffer.length} bytes`);

    console.log(`[export][${exportId}] starting FFmpeg merge (plan=${plan}, hasWatermark=${hasWatermark})`);
    const outputBuffer = await mergeVideoAudio(videoBuffer, audioBuffer, exportId, hasWatermark);
    console.log(`[export][${exportId}] FFmpeg done, uploading to S3`);

    const outputKey = `exports/${userId}/${exportId}.mp4`;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: OUTPUT_BUCKET,
        Key: outputKey,
        Body: outputBuffer,
        ContentType: "video/mp4",
      })
    );
    console.log(`[export][${exportId}] uploaded to S3: ${OUTPUT_BUCKET}/${outputKey}`);

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const downloadUrl = await generateDownloadPresignedUrl(OUTPUT_BUCKET, outputKey, 86400);

    await prisma.export.update({
      where: { id: exportId },
      data: { status: "COMPLETED", s3OutputKey: outputKey, downloadUrl, expiresAt },
    });
    console.log(`[export][${exportId}] complete`);

    return NextResponse.json({ exportId, downloadUrl, expiresAt });
  } catch (err) {
    console.error(`[export][${exportId}] FAILED:`, err);
    await prisma.export.update({ where: { id: exportId }, data: { status: "FAILED" } });
    return NextResponse.json({ error: "Export failed. Please try again." }, { status: 500 });
  }
}
