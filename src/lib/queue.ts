import { Queue, Worker, Job } from "bullmq";
import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

// Lazy connection – only created when needed
let connection: IORedis | null = null;

function getRedisConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
    });
  }
  return connection;
}

// Analysis queue
export const analysisQueue = new Queue("video-analysis", {
  connection: {
    host: new URL(redisUrl).hostname,
    port: parseInt(new URL(redisUrl).port ?? "6379"),
  },
});

// Export queue
export const exportQueue = new Queue("video-export", {
  connection: {
    host: new URL(redisUrl).hostname,
    port: parseInt(new URL(redisUrl).port ?? "6379"),
  },
});

export interface AnalysisJobData {
  videoId: string;
  s3Key: string;
  s3Bucket: string;
  userId: string;
}

export interface ExportJobData {
  exportId: string;
  videoId: string;
  trackId: string;
  userId: string;
  hasWatermark: boolean;
}

export async function enqueueAnalysis(data: AnalysisJobData): Promise<string> {
  const job = await analysisQueue.add("analyze", data, {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  });
  return job.id ?? "";
}

export async function enqueueExport(data: ExportJobData): Promise<string> {
  const job = await exportQueue.add("export", data, {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  });
  return job.id ?? "";
}
