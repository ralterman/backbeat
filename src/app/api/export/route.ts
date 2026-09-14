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
import type { GeneratedOption } from "@/app/api/analyze/route";

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

interface ContentRect { w: number; h: number; x: number; y: number }

/**
 * Find the visible-content rectangle of the video, ignoring letterbox /
 * pillarbox bars that are baked into the source encode (phones and editors
 * often pad a 4:5 or 16:9 clip into a 9:16 frame with black). Our pipeline
 * adds no padding of its own, so without this the watermark is positioned
 * relative to the encoded frame and can land on a black bar — which is
 * trivially cropped off.
 *
 * Samples the first ~6 s with cropdetect and takes the last (most settled)
 * suggestion. Returns null on timeout or if nothing is detected, in which
 * case the caller anchors to the full frame.
 */
function detectContentRect(videoPath: string, exportId: string): Promise<ContentRect | null> {
  return new Promise((resolve) => {
    let last: ContentRect | null = null;
    let settled = false;
    const done = (v: ContentRect | null) => { if (!settled) { settled = true; resolve(v); } };
    const timer = setTimeout(() => {
      console.log(`[export][${exportId}] cropdetect timed out; using full frame`);
      try { proc.kill("SIGKILL"); } catch {}
      done(last);
    }, 8000);

    const proc = ffmpeg(videoPath)
      .inputOptions(["-t", "6"])
      // limit=24: treat near-black (≤24/255) as bar; round=2: even dims; reset=0: accumulate
      .videoFilters("cropdetect=24:2:0")
      .outputOptions(["-an", "-f", "null"])
      .output("-")
      .on("stderr", (line: string) => {
        const m = line.match(/crop=(\d+):(\d+):(\d+):(\d+)/);
        if (m) last = { w: +m[1], h: +m[2], x: +m[3], y: +m[4] };
      })
      .on("end", () => { clearTimeout(timer); done(last); })
      .on("error", (err) => {
        clearTimeout(timer);
        if (!settled) console.log(`[export][${exportId}] cropdetect failed (${err.message}); using full frame`);
        done(last);
      });
    proc.run();
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

  // Lives in public/ (and is force-included in the function bundle via
  // outputFileTracingIncludes in next.config.ts) so it exists at runtime on Vercel.
  const wmPath = hasWatermark
    ? path.join(process.cwd(), "public/watermark.png")
    : null;
  if (wmPath && !fs.existsSync(wmPath)) {
    throw new Error(`Watermark asset missing at ${wmPath}`);
  }

  // Anchor the watermark to the visible content, not the encoded frame.
  // `w`/`h` in the overlay expression are the watermark's own dimensions.
  // Full frame: x = W-w-20, y = H-h-20. Detected rect: the same, but measured
  // from the rect's bottom-right corner (x+w_rect, y+h_rect).
  const WM_PAD = 24; // inset from the content edges; bumped with the 1.18× mark
  let overlayXY = `W-w-${WM_PAD}:H-h-${WM_PAD}`;
  if (wmPath) {
    const rect = await detectContentRect(videoPath, exportId);
    if (rect) {
      overlayXY = `${rect.x + rect.w}-w-${WM_PAD}:${rect.y + rect.h}-h-${WM_PAD}`;
      console.log(`[export][${exportId}] content rect ${rect.w}x${rect.h}+${rect.x}+${rect.y} → overlay ${overlayXY}`);
    } else {
      console.log(`[export][${exportId}] no content rect; overlay on full frame ${overlayXY}`);
    }
  }

  return new Promise((resolve, reject) => {
    const audioChain = `[1:a]afade=t=in:st=0:d=2,afade=t=out:st=${fadeOutStart.toFixed(2)}:d=2,volume=0.85[aout]`;

    let filterComplex: string;
    let outputOpts: string[];

    if (hasWatermark && wmPath) {
      // [wm]: upscale the PNG 1.18× (native 268×40 → ~316×47), force RGBA,
      //       then scale the alpha channel to 82% so the mark is clearly
      //       visible but still lets the video read through.
      // overlay: bottom-right of the visible content with WM_PAD inset
      //       (see overlayXY — `w`/`h` are the *scaled* mark's dimensions);
      //       format=auto picks a compatible blend format.
      // format=yuv420p: libx264 output must be 4:2:0 for broad playback.
      filterComplex =
        `${audioChain};` +
        `[2:v]scale=iw*1.18:ih*1.18,format=rgba,colorchannelmixer=aa=0.82[wm];` +
        `[0:v][wm]overlay=${overlayXY}:format=auto,format=yuv420p[vout]`;
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
  const { videoId, optionId, audioOption } = await req.json() as {
    videoId: string;
    optionId?: string;
    audioOption?: 1 | 2; // legacy fallback
  };

  if (!videoId) {
    return NextResponse.json({ error: "videoId is required" }, { status: 400 });
  }

  const video = await prisma.video.findFirst({ where: { id: videoId, userId } });
  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  const analysis = await prisma.analysis.findUnique({ where: { videoId } });
  if (!analysis) {
    return NextResponse.json({ error: "No generated audio found — please run analysis first." }, { status: 404 });
  }

  // Resolve which audioKey to use: new optionId takes precedence over legacy audioOption
  let audioKey: string | null | undefined;
  if (optionId) {
    const opts = (analysis.generatedOptions as unknown as GeneratedOption[]) ?? [];
    const match = opts.find((o) => o.id === optionId);
    audioKey = match?.audioKey;
  } else {
    // Legacy: audioOption 1 or 2
    audioKey = audioOption === 2 ? analysis.generatedAudioKey2 : analysis.generatedAudioKey;
  }

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
