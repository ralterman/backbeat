import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateDownloadPresignedUrl } from "@/lib/s3";
import { OUTPUT_BUCKET } from "@/lib/s3";

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

  if (!video.analysis) {
    return NextResponse.json({ status: video.status, videoId });
  }

  const analysis = video.analysis;

  // Always refresh the presigned URL from the stored S3 key so it never expires
  // for the user mid-session (presigned URLs are only valid 24 h).
  let audioUrl = analysis.generatedAudioUrl;
  if (analysis.generatedAudioKey) {
    try {
      audioUrl = await generateDownloadPresignedUrl(OUTPUT_BUCKET, analysis.generatedAudioKey, 86400);
      // Persist the refreshed URL so subsequent GET requests serve it without re-signing.
      await prisma.analysis.update({
        where: { id: analysis.id },
        data: { generatedAudioUrl: audioUrl },
      });
    } catch (err) {
      console.error("[analyze/[id]] presigned URL refresh failed:", err);
      // Fall back to the stored URL — it may still be valid.
    }
  }

  return NextResponse.json({
    status: "completed",
    videoId,
    analysis: {
      id: analysis.id,
      moodTags: analysis.moodTags,
      bpmRange: analysis.bpmRange,
      energyScore: analysis.energyScore,
      sceneTags: analysis.sceneTags,
      recommendedGenres: analysis.recommendedGenres,
      musicDescription: analysis.musicDescription,
      musicTags: analysis.musicTags,
      generatedAudioKey: analysis.generatedAudioKey,
      generatedAudioUrl: audioUrl,
    },
  });
}
