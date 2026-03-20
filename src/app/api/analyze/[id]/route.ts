import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tracks } from "@/data/tracks";

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
      analysis: {
        include: {
          trackMatches: { orderBy: { rank: "asc" } },
        },
      },
    },
  });

  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  if (!video.analysis) {
    return NextResponse.json({
      status: video.status,
      videoId,
    });
  }

  // Enrich track matches with full track data
  const enrichedMatches = video.analysis.trackMatches.map((match: { id: string; analysisId: string; trackId: string; matchScore: number; rank: number; createdAt: Date }) => {
    const trackData = tracks.find((t) => t.id === match.trackId);
    return {
      ...match,
      track: trackData ?? null,
    };
  });

  return NextResponse.json({
    status: "completed",
    videoId,
    analysis: {
      id: video.analysis.id,
      moodTags: video.analysis.moodTags,
      bpmRange: video.analysis.bpmRange,
      energyScore: video.analysis.energyScore,
      sceneTags: video.analysis.sceneTags,
      recommendedGenres: video.analysis.recommendedGenres,
    },
    matches: enrichedMatches,
  });
}
