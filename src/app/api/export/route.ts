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
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import { Readable } from "stream";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { randomUUID } from "crypto";
import type { GeneratedOption } from "@/app/api/analyze/route";
import {
  MUSIC_GAIN_DB,
  DEFAULT_AUDIO_MODE,
  DEFAULT_MUSIC_LEVEL,
  isAudioMode,
  isMusicLevel,
  type AudioMode,
  type MusicLevel,
} from "@/lib/audioMix";

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);
// ffmpeg-static ships no ffprobe, and the Vercel runtime has none on PATH.
// Without this, every ffmpeg.ffprobe() call below fails ("Cannot find
// ffprobe") and falls back to the 30 s duration guess. The binary is a
// platform-specific optional dependency resolved via a dynamic require, so
// it is force-included in the function bundle via outputFileTracingIncludes
// in next.config.ts.
ffmpeg.setFfprobePath(ffprobeInstaller.path);

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

interface MergeResult {
  buffer: Buffer;
  /** audioMode actually used — differs from the requested mode only when a
   *  self-correction happened (see below). */
  effectiveAudioMode: AudioMode;
}

async function mergeVideoAudio(
  videoBuffer: Buffer,
  audioBuffer: Buffer,
  exportId: string,
  hasWatermark: boolean,
  audioMode: AudioMode,
  musicLevel: MusicLevel
): Promise<MergeResult> {
  const tmpDir = path.join(os.tmpdir(), `backbeat-export-${exportId}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const videoPath = path.join(tmpDir, "input.mp4");
  const audioPath = path.join(tmpDir, "audio.mp3");
  const outputPath = path.join(tmpDir, "output.mp4");

  fs.writeFileSync(videoPath, videoBuffer);
  fs.writeFileSync(audioPath, audioBuffer);
  console.log(`[export][${exportId}] wrote video (${videoBuffer.length}b) + audio (${audioBuffer.length}b)`);

  // One ffprobe covers both duration (already needed for the fade-out point)
  // and audio-stream presence — no second probe. On error/timeout, default
  // hasAudioStream to true (same permissive default used elsewhere) so a
  // transient probe failure never wrongly flips a real video to "replace".
  const { videoDuration, hasAudioStream } = await new Promise<{ videoDuration: number; hasAudioStream: boolean }>((resolve) => {
    const t = setTimeout(() => {
      console.log(`[export][${exportId}] ffprobe timed out, using 30s / assuming audio present`);
      resolve({ videoDuration: 30, hasAudioStream: true });
    }, 5000);
    ffmpeg.ffprobe(videoPath, (err, meta) => {
      clearTimeout(t);
      resolve({
        videoDuration: err || !meta?.format?.duration ? 30 : Math.max(1, meta.format.duration),
        hasAudioStream: !err && !!meta?.streams?.some((s) => s.codec_type === "audio"),
      });
    });
  });
  const fadeOutStart = Math.max(0, videoDuration - 2);

  // Self-correction for the 16 legacy rows backfilled with hasOriginalAudio
  // defaulted to true (never actually ffprobed): if the caller asked for
  // "mix" — meaning Analysis.hasOriginalAudio said true — but the real
  // downloaded file has no audio stream at all, there is nothing to mix
  // with [0:a] would reference. Fall back to "replace" for this export; the
  // caller persists the correction so future loads stop offering the toggle.
  let effectiveAudioMode = audioMode;
  if (audioMode === "mix" && !hasAudioStream) {
    console.log(`[export][${exportId}] requested mix but source has no audio stream — falling back to replace`);
    effectiveAudioMode = "replace";
  }
  audioMode = effectiveAudioMode;

  console.log(`[export][${exportId}] duration=${videoDuration.toFixed(1)}s fadeOutStart=${fadeOutStart.toFixed(1)}s hasWatermark=${hasWatermark} audioMode=${audioMode} musicLevel=${musicLevel}`);

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
    // "replace" (default until this feature, still the only option for a
    // silent source video): drop the original audio entirely, use the
    // generated track alone at a fixed gentle attenuation. Unchanged from
    // before this feature.
    //
    // "mix": keep [0:a] — the video's own original audio, present because
    // this mode is only ever reached when hasOriginalAudio is true — and
    // layer the music on top at the level-specific dB gain instead of the
    // flat 0.85. amix's own auto-normalize is disabled (normalize=0) because
    // it would rescale both inputs by input count and flatten the exact
    // gain difference the three levels are supposed to produce.
    //
    // alimiter caps the sum below 0 dBFS — but only if level=false. alimiter
    // defaults level=true ("auto level"), which renormalizes its output back
    // up toward 0 dB after limiting, silently undoing the ceiling entirely
    // (confirmed empirically: with level unset, changing `limit` from 0.97
    // down to 0.25 made no difference to the final peak). With level=false,
    // limit=0.5 (~-6 dBFS pre-encode) leaves enough margin to survive AAC's
    // own lossy round-trip, which on hot/broadband source audio (continuous
    // loud noise, not just typical dialogue/ambience) can reconstruct sample
    // peaks 3-4 dB above whatever was fed to the encoder — a real limitation
    // of ffmpeg's native `aac` encoder (the only one available on Vercel's
    // Linux runtime; libfdk_aac is not built into ffmpeg-static). Verified:
    // continuous white noise mixed at all three levels stays 1.9-2.6 dB
    // below 0 dBFS after AAC encoding at limit=0.5; normal/moderate content
    // is untouched since the limiter doesn't engage below its ceiling.
    // atrim explicitly caps the audio at the video's real (ffprobe'd)
    // duration instead of relying on the global -shortest flag. -shortest
    // is unreliable here: verified it silently produced a near-silent
    // ~0-length-effective audio track specifically for replace+watermark
    // (three inputs — video, music, a still-image watermark with no
    // inherent duration — with the video's own [0:a] never referenced
    // anywhere in that mode's graph). mix+watermark happened to come out
    // correct because [0:a] IS referenced there (via amix), which
    // incidentally gave -shortest a well-formed duration to key off; but
    // depending on that coincidence for one mode and not the other isn't
    // something to leave in place. Explicit atrim is deterministic in
    // every mode/watermark combination and no longer depends on -shortest
    // at all, so it's dropped from outputOpts below.
    const durationCap = videoDuration.toFixed(2);
    const musicChain = `[1:a]afade=t=in:st=0:d=2,afade=t=out:st=${fadeOutStart.toFixed(2)}:d=2`;
    const audioChain =
      audioMode === "mix"
        ? `${musicChain},volume=${MUSIC_GAIN_DB[musicLevel]}dB[music];` +
          `[0:a][music]amix=inputs=2:duration=first:dropout_transition=2:normalize=0[premix];` +
          `[premix]alimiter=limit=0.5:level=false,atrim=0:${durationCap}[aout]`
        : `${musicChain},volume=0.85,atrim=0:${durationCap}[aout]`;

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
        "-c:a", "aac",
      ];
    } else {
      filterComplex = audioChain;
      outputOpts = [
        "-map", "0:v:0", "-map", "[aout]",
        "-c:v", "copy",
        "-c:a", "aac",
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
          resolve({ buffer: buf, effectiveAudioMode });
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
  const body = await req.json() as {
    videoId: string;
    optionId?: string;
    audioOption?: 1 | 2; // legacy fallback
    audioMode?: string;
    musicLevel?: string;
  };
  const { videoId, optionId, audioOption } = body;
  const requestedAudioMode = isAudioMode(body.audioMode) ? body.audioMode : DEFAULT_AUDIO_MODE;
  const musicLevel = isMusicLevel(body.musicLevel) ? body.musicLevel : DEFAULT_MUSIC_LEVEL;

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

  // A silent source video has nothing to mix with — ignore the request and
  // fall back to replace regardless of what the client asked for.
  const audioMode: AudioMode = analysis.hasOriginalAudio ? requestedAudioMode : "replace";

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
    console.log(`[export][${exportId}] starting FFmpeg (hasWatermark=${hasWatermark}, audioMode=${audioMode}, musicLevel=${musicLevel})`);
    const { buffer: outputBuffer, effectiveAudioMode } = await mergeVideoAudio(videoBuffer, audioBuffer, exportId, hasWatermark, audioMode, musicLevel);

    // Self-correction: the requested mode was "mix" (i.e. Analysis.hasOriginalAudio
    // said true) but ffprobe on the actual downloaded file found no audio stream —
    // one of the 16 legacy rows backfilled with a default we never verified. Persist
    // false so the results page stops offering the toggle for this video going forward.
    if (effectiveAudioMode !== audioMode) {
      await prisma.analysis.update({
        where: { id: analysis.id },
        data: { hasOriginalAudio: false },
      }).catch((err) => console.error(`[export][${exportId}] failed to persist hasOriginalAudio correction:`, err));
      console.log(`[export][${exportId}] corrected Analysis(${analysis.id}).hasOriginalAudio → false`);
    }

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
