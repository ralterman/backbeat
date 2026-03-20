import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateDownloadPresignedUrl, OUTPUT_BUCKET } from "@/lib/s3";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: exportId } = await params;

  const exportRecord = await prisma.export.findFirst({
    where: { id: exportId, userId: session.user.id },
  });

  if (!exportRecord) {
    return NextResponse.json({ error: "Export not found" }, { status: 404 });
  }

  if (exportRecord.status !== "COMPLETED" || !exportRecord.s3OutputKey) {
    return NextResponse.json({ status: exportRecord.status });
  }

  // Refresh download URL if close to expiry or missing
  const now = new Date();
  let downloadUrl = exportRecord.downloadUrl;

  if (
    !downloadUrl ||
    !exportRecord.expiresAt ||
    exportRecord.expiresAt.getTime() - now.getTime() < 3600 * 1000
  ) {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    downloadUrl = await generateDownloadPresignedUrl(
      OUTPUT_BUCKET,
      exportRecord.s3OutputKey,
      86400
    );
    await prisma.export.update({
      where: { id: exportId },
      data: { downloadUrl, expiresAt },
    });
  }

  return NextResponse.json({
    status: "completed",
    exportId,
    downloadUrl,
    expiresAt: exportRecord.expiresAt,
    hasWatermark: exportRecord.hasWatermark,
  });
}
