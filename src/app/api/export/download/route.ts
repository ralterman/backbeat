import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { s3Client, OUTPUT_BUCKET } from "@/lib/s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

/**
 * GET /api/export/download?key=exports/{userId}/{exportId}.mp4
 *
 * Proxies an exported MP4 from S3 back through the app's own origin so that
 * the browser's `<a download>` attribute works.  Cross-origin S3 presigned
 * URLs ignore the `download` attribute and navigate the page instead; a
 * same-origin response with Content-Disposition: attachment does not.
 *
 * Security: the key must match the pattern `exports/{userId}/{exportId}.mp4`
 * where {userId} equals the authenticated session user id, and the export
 * record must exist in the database.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = req.nextUrl.searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }

  // Validate key structure: exports/{userId}/{exportId}.mp4
  const parts = key.split("/");
  if (parts.length !== 3 || parts[0] !== "exports" || !parts[2].endsWith(".mp4")) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  const keyUserId = parts[1];
  const exportId  = parts[2].slice(0, -4); // strip ".mp4"

  // Verify ownership — key's embedded userId must match the session
  if (keyUserId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Also confirm the DB record exists and belongs to this user
  const exportRecord = await prisma.export.findFirst({
    where: { id: exportId, userId: session.user.id },
  });
  if (!exportRecord) {
    return NextResponse.json({ error: "Export not found" }, { status: 404 });
  }

  try {
    const s3Obj = await s3Client.send(
      new GetObjectCommand({ Bucket: OUTPUT_BUCKET, Key: key })
    );
    const buffer = await streamToBuffer(s3Obj.Body as Readable);

    return new NextResponse(buffer.buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": 'attachment; filename="backbeat-export.mp4"',
        "Content-Length": buffer.length.toString(),
        // Prevent downstream caches from storing the file
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Download failed";
    console.error("[export/download] S3 fetch error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
