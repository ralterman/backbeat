import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const s3Client = new S3Client({
  region: process.env.AWS_REGION ?? "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export const INPUT_BUCKET = process.env.AWS_S3_BUCKET_INPUT ?? "backbeat-videos-input";
export const OUTPUT_BUCKET = process.env.AWS_S3_BUCKET_OUTPUT ?? "backbeat-videos-output";

/**
 * Generate a presigned URL for direct client upload to S3.
 */
export async function generateUploadPresignedUrl(
  key: string,
  contentType: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: INPUT_BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Generate a presigned URL for downloading a file from S3.
 */
export async function generateDownloadPresignedUrl(
  bucket: string,
  key: string,
  expiresIn: number = 86400 // 24 hours
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  return getSignedUrl(s3Client, command, { expiresIn });
}
