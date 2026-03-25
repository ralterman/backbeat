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

  const videoPath = path.join(tmpDir, "input.mp4");
  const audioPath = path.join(tmpDir, "audio.mp3");
  const outputPath = path.join(tmpDir, "output.mp4");

  fs.writeFileSync(videoPath, videoBuffer);
  fs.writeFileSync(audioPath, audioBuffer);
  console.log(`[export][${exportId}] wrote video (${videoBuffer.length}b) + audio (${audioBuffer.length}b)`);

  // Probe video duration with a 5s timeout
  const videoDuration = await new Promise<number>((resolve) => {
    const t = setTimeout(() => { console.log(`[export][${exportId}] ffprobe timed out, using 30s`); resolve(30); }, 5000);
    ffmpeg.ffprobe(videoPath, (err, meta) => {
      clearTimeout(t);
      resolve(err || !meta?.format?.duration ? 30 : Math.max(1, meta.format.duration));
    });
  });
  const fadeOutStart = Math.max(0, videoDuration - 2);
  console.log(`[export][${exportId}] duration=${videoDuration.toFixed(1)}s fadeOutStart=${fadeOutStart.toFixed(1)}s hasWatermark=${hasWatermark}`);

  return new Promise((resolve, reject) => {
    // Build filter_complex — explicitly route [1:a] (audio input) through
    // fade/volume, and [0:v] (video input) through drawtext for watermark.
    const audioChain = `[1:a]afade=t=in:st=0:d=2,afade=t=out:st=${fadeOutStart.toFixed(2)}:d=2,volume=0.85[aout]`;

    let filterComplex: string;
    // Pass each flag+value as separate strings so they become separate spawn args.
    // Passing "-map [vout]" as one string would make ffmpeg see "map [vout]" as
    // the option name (unrecognized). Two strings = two argv entries = correct.
    let outputOpts: string[];

    if (hasWatermark) {
      const watermark = `drawtext=text='Made with Backbeat':fontsize=18:fontcolor=white@0.75:shadowcolor=black@0.8:shadowx=1:shadowy=1:x=w-165:y=h-28`;
      filterComplex = `${audioChain};[0:v]${watermark}[vout]`;
      outputOpts = [
        "-map", "[vout]", "-map", "[aout]",
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "26",
        "-c:a", "aac", "-shortest",
      ];
    } else {
      filterComplex = audioChain;
      outputOpts = [
        "-map", "0:v:0", "-map", "[aout]",
        "-c:v", "copy",
        "-c:a", "aac", "-shortest",
      ];
    }

    console.log(`[export][${exportId}] filter_complex: ${filterComplex}`);

    // Use .complexFilter() — it passes -filter_complex and its value as two
    // separate spawn arguments, unlike outputOptions which joins them into one.
    ffmpeg(videoPath)
      .addInput(audioPath)
      .complexFilter(filterComplex)
      .outputOptions(outputOpts)
      .output(outputPath)
      .on("start", (cmd) => console.log(`[export][${exportId}] cmd: ${cmd}`))
      .on("stderr", (line) => console.log(`[export][${exportId}] ffmpeg: ${line}`))
      .on("end", () => {
        try {
          const buf = fs.readFileSync(outputPath);
          console.log(`[export][${exportId}] output: ${buf.length} bytes`);
          try { fs.rmSync(tmpDir, { recursive: true }); } catch {}
          resolve(buf);
        } catch (err) {
          reject(err);
        }
      })
      .on("error", (err, _stdout, stderr) => {
        console.error(`[export][${exportId}] ffmpeg error: ${err.message}`);
        console.error(`[export][${exportId}] stderr: ${stderr}`);
        try { fs.rmSync(tmpDir, { recursive: true }); } catch {}
        // Surface the real ffmpeg error so the frontend can display it
        reject(new Error(`FFmpeg: ${(stderr || err.message).split("\n").slice(-3).join(" | ")}`));
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
    data: { id: exportId, videoId, trackId, userId, status: "PROCESSING", hasWatermark },
  });

  try {
    console.log(`[export][${exportId}] fetching video S3: ${video.s3Bucket}/${video.s3Key}`);
    const s3Obj = await s3Client.send(new GetObjectCommand({ Bucket: video.s3Bucket, Key: video.s3Key }));
    const videoBuffer = await streamToBuffer(s3Obj.Body as Readable);
    console.log(`[export][${exportId}] video fetched: ${videoBuffer.length}b`);

    console.log(`[export][${exportId}] fetching audio: ${track.preview_url}`);
    const audioRes = await fetch(track.preview_url);
    if (!audioRes.ok) throw new Error(`Audio fetch failed: ${audioRes.status} ${audioRes.statusText}`);
    const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
    console.log(`[export][${exportId}] audio fetched: ${audioBuffer.length}b`);

    console.log(`[export][${exportId}] starting FFmpeg (plan=${plan})`);
    const outputBuffer = await mergeVideoAudio(videoBuffer, audioBuffer, exportId, hasWatermark);

    const outputKey = `exports/${userId}/${exportId}.mp4`;
    await s3Client.send(new PutObjectCommand({
      Bucket: OUTPUT_BUCKET, Key: outputKey, Body: outputBuffer, ContentType: "video/mp4",
    }));
    console.log(`[export][${exportId}] uploaded: ${OUTPUT_BUCKET}/${outputKey}`);

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const downloadUrl = await generateDownloadPresignedUrl(OUTPUT_BUCKET, outputKey, 86400);

    await prisma.export.update({
      where: { id: exportId },
      data: { status: "COMPLETED", s3OutputKey: outputKey, downloadUrl, expiresAt },
    });
    console.log(`[export][${exportId}] complete`);

    return NextResponse.json({ exportId, downloadUrl, expiresAt });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[export][${exportId}] FAILED: ${message}`);
    await prisma.export.update({ where: { id: exportId }, data: { status: "FAILED" } });
    // Return the real error message so it surfaces in the frontend alert
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
