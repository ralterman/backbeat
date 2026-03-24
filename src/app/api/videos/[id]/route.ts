import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateDownloadPresignedUrl } from "@/lib/s3";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: videoId } = await params;

  const video = await prisma.video.findFirst({
    where: { id: videoId, userId: session.user.id },
  });

  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  // Generate a 1-hour presigned URL for browser playback
  const playbackUrl = await generateDownloadPresignedUrl(video.s3Bucket, video.s3Key, 3600);

  return NextResponse.json({
    videoId: video.id,
    originalName: video.originalName,
    playbackUrl,
  });
}
