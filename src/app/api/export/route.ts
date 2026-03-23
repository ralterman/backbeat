import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { s3Client, OUTPUT_BUCKET, generateDownloadPresignedUrl } from "@/lib/s3";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getUserPlan } from "@/lib/usage";
import { tracks } from "@/data/tracks";
import { getFFmpeg } from "@/lib/ffmpeg-wasm";
import { Readable } from "stream";
import { randomUUID } from "crypto";

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
  const ffmpeg = await getFFmpeg();
  const inputVideo = `input-${exportId}.mp4`;
  const inputAudio = `audio-${exportId}.mp3`;
  const outputFile = `output-${exportId}.mp4`;

  await ffmpeg.writeFile(inputVideo, new Uint8Array(videoBuffer));
  await ffmpeg.writeFile(inputAudio, new Uint8Array(audioBuffer));

  const args: string[] = [
    "-i", inputVideo,
    "-i", inputAudio,
    "-af", "afade=t=in:st=0:d=2,afade=t=out:st=28:d=2,loudnorm=I=-14:TP=-1:LRA=11",
    "-map", "0:v:0",
    "-map", "1:a:0",
  ];

  if (hasWatermark) {
    // Re-encode video to burn in the watermark text
    args.push(
      "-vf", "drawtext=text='BACKBEAT WATERMARK':fontcolor=white@0.3:fontsize=24:x=(w-text_w)/2:y=(h-text_h)/2",
      "-c:v", "libx264", "-preset", "fast", "-crf", "23",
    );
  } else {
    args.push("-c:v", "copy");
  }

  args.push("-c:a", "aac", "-shortest", outputFile);

  try {
    await ffmpeg.exec(args);
  } finally {
    try { await ffmpeg.deleteFile(inputVideo); } catch {}
    try { await ffmpeg.deleteFile(inputAudio); } catch {}
  }

  const data = await ffmpeg.readFile(outputFile) as Uint8Array;
  await ffmpeg.deleteFile(outputFile);
  return Buffer.from(data);
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
    // Download video from S3
    const s3Obj = await s3Client.send(
      new GetObjectCommand({ Bucket: video.s3Bucket, Key: video.s3Key })
    );
    const videoBuffer = await streamToBuffer(s3Obj.Body as Readable);

    // Download audio from track preview URL
    const audioRes = await fetch(track.preview_url);
    if (!audioRes.ok) throw new Error(`Failed to fetch audio: ${audioRes.status}`);
    const audioBuffer = Buffer.from(await audioRes.arrayBuffer());

    // Merge using WASM FFmpeg
    const outputBuffer = await mergeVideoAudio(videoBuffer, audioBuffer, exportId, hasWatermark);

    // Upload merged file to output S3
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
