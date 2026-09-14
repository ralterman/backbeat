import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateDownloadPresignedUrl } from "@/lib/s3";
import { INPUT_BUCKET, OUTPUT_BUCKET } from "@/lib/s3";
import type { GeneratedOption } from "@/app/api/analyze/route";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: videoId } = await params;

  const video = await prisma.video.findFirst({
    where: { id: videoId, userId: session.user.id },
    include: { analysis: true },
  });

  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  // Generate a presigned URL for the original video (synced preview player).
  let videoUrl: string | null = null;
  try {
    videoUrl = await generateDownloadPresignedUrl(INPUT_BUCKET, video.s3Key, 86400);
  } catch (err) {
    console.error("[analyze/[id]] video presigned URL failed:", err);
  }

  if (!video.analysis) {
    return NextResponse.json({ status: video.status, videoId, videoUrl });
  }

  const analysis = video.analysis;

  // Refresh presigned URLs on legacy option fields
  let audioUrl = analysis.generatedAudioUrl;
  if (analysis.generatedAudioKey) {
    try {
      audioUrl = await generateDownloadPresignedUrl(OUTPUT_BUCKET, analysis.generatedAudioKey, 86400);
    } catch { /* leave stored URL */ }
  }
  let audioUrl2 = analysis.generatedAudioUrl2;
  if (analysis.generatedAudioKey2) {
    try {
      audioUrl2 = await generateDownloadPresignedUrl(OUTPUT_BUCKET, analysis.generatedAudioKey2, 86400);
    } catch { /* leave stored URL */ }
  }

  // Refresh presigned URLs inside generatedOptions
  const rawOptions = (analysis.generatedOptions as unknown as GeneratedOption[]) ?? [];
  const refreshedOptions = await Promise.all(
    rawOptions.map(async (opt) => {
      if (!opt.audioKey) return opt;
      try {
        const freshUrl = await generateDownloadPresignedUrl(OUTPUT_BUCKET, opt.audioKey, 86400);
        return { ...opt, audioUrl: freshUrl };
      } catch {
        return opt;
      }
    })
  );

  // Persist refreshed URLs so they're warm for subsequent polls
  if (refreshedOptions.length > 0) {
    try {
      await prisma.analysis.update({
        where: { id: analysis.id },
        data: { generatedOptions: JSON.parse(JSON.stringify(refreshedOptions)) },
      });
    } catch { /* non-fatal */ }
  }

  return NextResponse.json({
    status: "completed",
    videoId,
    videoUrl,
    analysis: {
      id:                analysis.id,
      moodTags:          analysis.moodTags,
      bpmRange:          analysis.bpmRange,
      energyScore:       analysis.energyScore,
      sceneTags:         analysis.sceneTags,
      recommendedGenres: analysis.recommendedGenres,
      // Legacy fields (backward compat)
      musicDescription:   analysis.musicDescription,
      musicTags:          analysis.musicTags,
      generatedAudioKey:  analysis.generatedAudioKey,
      generatedAudioUrl:  audioUrl,
      musicDescription2:  analysis.musicDescription2,
      musicTags2:         analysis.musicTags2,
      generatedAudioKey2: analysis.generatedAudioKey2,
      generatedAudioUrl2: audioUrl2,
      // New: accumulated options
      generatedOptions: refreshedOptions,
    },
  });
}
