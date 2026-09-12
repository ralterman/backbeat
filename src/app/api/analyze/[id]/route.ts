import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateDownloadPresignedUrl } from "@/lib/s3";
import { INPUT_BUCKET, OUTPUT_BUCKET } from "@/lib/s3";

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
    include: {
      analysis: true,
    },
  });

  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  // Generate a presigned URL for the original video (for synced preview player).
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

  // Always refresh presigned audio URLs from stored S3 keys so they never
  // expire for the user mid-session (presigned URLs are only valid 24 h).
  let audioUrl = analysis.generatedAudioUrl;
  if (analysis.generatedAudioKey) {
    try {
      audioUrl = await generateDownloadPresignedUrl(OUTPUT_BUCKET, analysis.generatedAudioKey, 86400);
      await prisma.analysis.update({
        where: { id: analysis.id },
        data: { generatedAudioUrl: audioUrl },
      });
    } catch (err) {
      console.error("[analyze/[id]] presigned URL refresh failed (opt1):", err);
    }
  }

  let audioUrl2 = analysis.generatedAudioUrl2;
  if (analysis.generatedAudioKey2) {
    try {
      audioUrl2 = await generateDownloadPresignedUrl(OUTPUT_BUCKET, analysis.generatedAudioKey2, 86400);
      await prisma.analysis.update({
        where: { id: analysis.id },
        data: { generatedAudioUrl2: audioUrl2 },
      });
    } catch (err) {
      console.error("[analyze/[id]] presigned URL refresh failed (opt2):", err);
    }
  }

  return NextResponse.json({
    status: "completed",
    videoId,
    videoUrl,
    analysis: {
      id:                 analysis.id,
      moodTags:           analysis.moodTags,
      bpmRange:           analysis.bpmRange,
      energyScore:        analysis.energyScore,
      sceneTags:          analysis.sceneTags,
      recommendedGenres:  analysis.recommendedGenres,
      // Option 1
      musicDescription:  analysis.musicDescription,
      musicTags:         analysis.musicTags,
      generatedAudioKey: analysis.generatedAudioKey,
      generatedAudioUrl: audioUrl,
      // Option 2
      musicDescription2:  analysis.musicDescription2,
      musicTags2:         analysis.musicTags2,
      generatedAudioKey2: analysis.generatedAudioKey2,
      generatedAudioUrl2: audioUrl2,
    },
  });
}
