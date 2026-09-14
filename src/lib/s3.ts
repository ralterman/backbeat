import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
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
 * Delete every object under a key prefix (e.g. `uploads/<userId>/`).
 * Pages through ListObjectsV2 and batch-deletes up to 1000 keys per call.
 * Returns the number of objects deleted; throws on the first failed batch
 * so the caller can decide whether to abort or continue.
 */
export async function deleteS3Prefix(bucket: string, prefix: string): Promise<number> {
  if (!prefix || prefix === "/") throw new Error("Refusing to delete with an empty prefix");
  let deleted = 0;
  let continuationToken: string | undefined;

  do {
    const page = await s3Client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: continuationToken })
    );
    const keys = (page.Contents ?? []).map((o) => o.Key).filter((k): k is string => !!k);

    if (keys.length > 0) {
      const res = await s3Client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
        })
      );
      if (res.Errors && res.Errors.length > 0) {
        const first = res.Errors[0];
        throw new Error(`S3 batch delete failed for ${res.Errors.length} key(s) in ${bucket}/${prefix}: ${first.Key} — ${first.Code} ${first.Message}`);
      }
      deleted += keys.length;
    }

    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);

  return deleted;
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
