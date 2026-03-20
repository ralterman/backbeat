import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateUploadPresignedUrl, INPUT_BUCKET } from "@/lib/s3";
import { prisma } from "@/lib/prisma";
import { canAnalyze } from "@/lib/usage";
import { randomUUID } from "crypto";

const ALLOWED_TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/x-msvideo": "avi",
  "video/x-matroska": "mkv",
};

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Check usage limit
  const allowed = await canAnalyze(userId);
  if (!allowed) {
    return NextResponse.json(
      { error: "Monthly analysis limit reached. Please upgrade your plan." },
      { status: 429 }
    );
  }

  const body = await req.json();
  const { filename, contentType, fileSize } = body as {
    filename: string;
    contentType: string;
    fileSize: number;
  };

  if (!filename || !contentType || !fileSize) {
    return NextResponse.json(
      { error: "filename, contentType, and fileSize are required" },
      { status: 400 }
    );
  }

  if (!ALLOWED_TYPES[contentType]) {
    return NextResponse.json(
      { error: "Unsupported file type. Allowed: MP4, MOV, AVI, MKV" },
      { status: 400 }
    );
  }

  if (fileSize > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File too large. Maximum size is 500MB" },
      { status: 400 }
    );
  }

  const videoId = randomUUID();
  const ext = ALLOWED_TYPES[contentType];
  const s3Key = `uploads/${userId}/${videoId}.${ext}`;

  // Create video record in DB
  await prisma.video.create({
    data: {
      id: videoId,
      userId,
      filename: s3Key,
      originalName: filename,
      s3Key,
      s3Bucket: INPUT_BUCKET,
      fileSize,
      mimeType: contentType,
      status: "UPLOADING",
    },
  });

  const presignedUrl = await generateUploadPresignedUrl(s3Key, contentType);

  return NextResponse.json({
    videoId,
    presignedUrl,
    s3Key,
  });
}
