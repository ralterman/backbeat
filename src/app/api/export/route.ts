export const maxDuration = 300; // FFmpeg can take up to a few minutes for longer videos

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { s3Client, OUTPUT_BUCKET, generateDownloadPresignedUrl } from "@/lib/s3";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getUserPlan } from "@/lib/usage";
import { isAdminEmail } from "@/lib/admin";
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

  const videoDuration = await new Promise<number>((resolve) => {
    const t = setTimeout(() => { console.log(`[export][${exportId}] ffprobe timed out, using 30s`); resolve(30); }, 5000);
    ffmpeg.ffprobe(videoPath, (err, meta) => {
      clearTimeout(t);
      resolve(err || !meta?.format?.duration ? 30 : Math.max(1, meta.format.duration));
    });
  });
  const fadeOutStart = Math.max(0, videoDuration - 2);
  console.log(`[export][${exportId}] duration=${videoDuration.toFixed(1)}s fadeOutStart=${fadeOutStart.toFixed(1)}s hasWatermark=${hasWatermark}`);

  const wmPath = hasWatermark
    ? path.join(process.cwd(), "src/assets/watermark.png")
    : null;

  return new Promise((resolve, reject) => {
    const audioChain = `[1:a]afade=t=in:st=0:d=2,afade=t=out:st=${fadeOutStart.toFixed(2)}:d=2,volume=0.85[aout]`;

    let filterComplex: string;
    let outputOpts: string[];

    if (hasWatermark && wmPath) {
      filterComplex = `${audioChain};[0:v][2:v]overlay=W-w-10:H-h-10[vout]`;
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

    const cmd = ffmpeg(videoPath).addInput(audioPath);
    if (wmPath) cmd.addInput(wmPath);

    cmd
      .complexFilter(filterComplex)
      .outputOptions(outputOpts)
      .output(outputPath)
      .on("start", (c) => console.log(`[export][${exportId}] cmd: ${c}`))
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
  const { videoId, audioOption = 1 } = await req.json() as { videoId: string; audioOption?: 1 | 2 };

  if (!videoId) {
    return NextResponse.json({ error: "videoId is required" }, { status: 400 });
  }

  const video = await prisma.video.findFirst({ where: { id: videoId, userId } });
  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  // Look up the generated audio for this video — pick option 1 or 2
  const analysis = await prisma.analysis.findUnique({ where: { videoId } });
  const audioKey = audioOption === 2 ? analysis?.generatedAudioKey2 : analysis?.generatedAudioKey;
  if (!audioKey) {
    return NextResponse.json(
      { error: "No generated audio found — please run analysis first." },
      { status: 404 }
    );
  }

  // Admin accounts always get watermark-free exports regardless of plan.
  const hasWatermark = isAdminEmail(session.user.email)
    ? false
    : (await getUserPlan(userId)) === "FREE";

  const exportId = randomUUID();
  await prisma.export.create({
    data: { id: exportId, videoId, userId, status: "PROCESSING", hasWatermark },
  });

  try {
    // Fetch original video from input bucket
    console.log(`[export][${exportId}] fetching video S3: ${video.s3Bucket}/${video.s3Key}`);
    const s3Video = await s3Client.send(new GetObjectCommand({ Bucket: video.s3Bucket, Key: video.s3Key }));
    const videoBuffer = await streamToBuffer(s3Video.Body as Readable);
    console.log(`[export][${exportId}] video fetched: ${videoBuffer.length}b`);

    // Fetch generated audio from output bucket
    console.log(`[export][${exportId}] fetching audio S3: ${OUTPUT_BUCKET}/${audioKey}`);
    const s3Audio = await s3Client.send(new GetObjectCommand({ Bucket: OUTPUT_BUCKET, Key: audioKey }));
    const audioBuffer = await streamToBuffer(s3Audio.Body as Readable);
    console.log(`[export][${exportId}] audio fetched: ${audioBuffer.length}b`);

    // Merge via FFmpeg (fade in/out + optional watermark)
    console.log(`[export][${exportId}] starting FFmpeg (hasWatermark=${hasWatermark})`);
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

    return NextResponse.json({ exportId, outputKey, downloadUrl, expiresAt });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[export][${exportId}] FAILED: ${message}`);
    await prisma.export.update({ where: { id: exportId }, data: { status: "FAILED" } });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
