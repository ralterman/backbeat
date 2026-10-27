import { prisma } from "@/lib/prisma";
import { isAdminEmail } from "@/lib/admin";
import { OUTPUT_BUCKET, listS3Prefix, deleteS3Keys, type S3ObjectInfo } from "@/lib/s3";

/**
 * Storage retention. Runs daily from /api/cron/retention.
 *
 * Rules (also stated in the Privacy policy, section 4):
 *  - Free-tier videos: removed 30 days after the video's last activity
 *    (upload, generation or export).
 *  - Subscriber videos: kept while the subscription is active (including
 *    past-due and trialing); removed 90 days after it ends.
 *  - Video Pass videos: removed 90 days after the pass purchase.
 *  - Admin videos: never.
 *
 * Removal deletes the source video, generated tracks, thumbnail and exports
 * from S3 and marks the Video and Analysis rows expired (rows are kept so
 * the UI can say "This video has expired"). User rows are never touched.
 */
export const RETENTION = {
  FREE_DAYS: 30,
  SUBSCRIBER_DAYS_AFTER_END: 90,
  PASS_DAYS: 90,
} as const;

export type RetentionRule = "free" | "subscriber" | "pass" | "admin";

const DAY_MS = 24 * 60 * 60 * 1000;
const addDays = (d: Date, days: number) => new Date(d.getTime() + days * DAY_MS);

interface CandidateVideo {
  id: string;
  userId: string;
  s3Bucket: string;
  s3Key: string;
  createdAt: Date;
  updatedAt: Date;
  user: {
    email: string | null;
    subscription: { plan: string; status: string; currentPeriodEnd: Date | null; updatedAt: Date } | null;
  };
  pass: { createdAt: Date } | null;
  analysis: { createdAt: Date; generatedOptions: unknown } | null;
  exports: { createdAt: Date; s3OutputKey: string | null }[];
}

export interface Classification {
  rule: RetentionRule;
  /** Plan label for logs: FREE, CREATOR, TEAM, or ADMIN. */
  plan: string;
  /** When the video becomes removable; null = never (admin, active subscriber). */
  deleteAfter: Date | null;
  /** Why, for the dry-run report. */
  basis: string;
}

/** Latest of upload, generation and export timestamps. */
export function lastActivity(v: Pick<CandidateVideo, "createdAt" | "updatedAt" | "analysis" | "exports">): Date {
  let t = Math.max(v.createdAt.getTime(), v.updatedAt.getTime());
  if (v.analysis) {
    t = Math.max(t, v.analysis.createdAt.getTime());
    const opts = Array.isArray(v.analysis.generatedOptions) ? (v.analysis.generatedOptions as { createdAt?: string }[]) : [];
    for (const o of opts) {
      const ms = o?.createdAt ? Date.parse(o.createdAt) : NaN;
      if (!Number.isNaN(ms)) t = Math.max(t, ms);
    }
  }
  for (const e of v.exports) t = Math.max(t, e.createdAt.getTime());
  return new Date(t);
}

export function classifyVideo(v: CandidateVideo): Classification {
  if (isAdminEmail(v.user.email)) {
    return { rule: "admin", plan: "ADMIN", deleteAfter: null, basis: "admin account" };
  }
  const sub = v.user.subscription;
  const paidActive = !!sub && sub.plan !== "FREE" && sub.status !== "CANCELED";
  if (paidActive) {
    return { rule: "subscriber", plan: sub.plan, deleteAfter: null, basis: `subscription ${sub.status}` };
  }
  if (v.pass) {
    return {
      rule: "pass",
      plan: "FREE",
      deleteAfter: addDays(v.pass.createdAt, RETENTION.PASS_DAYS),
      basis: `pass bought ${v.pass.createdAt.toISOString()}`,
    };
  }
  if (sub && sub.status === "CANCELED") {
    // End of access: the last period end if Stripe told us one, or the time
    // the cancellation was recorded, whichever is later.
    const ended = new Date(Math.max(sub.currentPeriodEnd?.getTime() ?? 0, sub.updatedAt.getTime()));
    return {
      rule: "subscriber",
      plan: "FREE",
      deleteAfter: addDays(ended, RETENTION.SUBSCRIBER_DAYS_AFTER_END),
      basis: `subscription ended ${ended.toISOString()}`,
    };
  }
  const last = lastActivity(v);
  return {
    rule: "free",
    plan: "FREE",
    deleteAfter: addDays(last, RETENTION.FREE_DAYS),
    basis: `last activity ${last.toISOString()}`,
  };
}

/** Every S3 object that belongs to a video, grouped by bucket. */
export async function collectVideoObjects(v: CandidateVideo): Promise<Map<string, S3ObjectInfo[]>> {
  const byBucket = new Map<string, S3ObjectInfo[]>();
  const add = (bucket: string, objs: S3ObjectInfo[]) => {
    if (objs.length === 0) return;
    byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), ...objs]);
  };
  add(v.s3Bucket, await listS3Prefix(v.s3Bucket, v.s3Key));
  add(OUTPUT_BUCKET, await listS3Prefix(OUTPUT_BUCKET, `thumbnails/${v.id}/`));
  add(OUTPUT_BUCKET, await listS3Prefix(OUTPUT_BUCKET, `generated-music/${v.id}/`));
  for (const e of v.exports) {
    if (e.s3OutputKey) add(OUTPUT_BUCKET, await listS3Prefix(OUTPUT_BUCKET, e.s3OutputKey));
  }
  // De-duplicate in case two prefixes overlapped.
  for (const [bucket, objs] of byBucket) {
    const seen = new Map<string, S3ObjectInfo>();
    for (const o of objs) seen.set(o.key, o);
    byBucket.set(bucket, [...seen.values()]);
  }
  return byBucket;
}

export interface RuleTotals {
  videos: number;
  objects: number;
  bytes: number;
}

export interface RetentionVideoResult {
  id: string;
  rule: RetentionRule;
  plan: string;
  deleteAfter: string;
  basis: string;
  objects: number;
  bytes: number;
  error?: string;
}

export interface RetentionRunResult {
  dryRun: boolean;
  now: string;
  /** Videos removed (or, in a dry run, that would be removed). */
  byRule: Record<"free" | "subscriber" | "pass", RuleTotals>;
  totals: RuleTotals;
  /** Videos not touched, by reason. */
  kept: { admin: number; subscriberActive: number; notDue: number; alreadyExpired: number };
  /** Due videos beyond maxVideos, left for the next run. */
  deferred: number;
  videos: RetentionVideoResult[];
  errors: number;
}

export interface RunRetentionOptions {
  dryRun: boolean;
  now?: Date;
  /** Cap per run so the function stays inside its time limit. */
  maxVideos?: number;
  log?: (line: string) => void;
}

export async function runRetention(opts: RunRetentionOptions): Promise<RetentionRunResult> {
  const now = opts.now ?? new Date();
  const maxVideos = opts.maxVideos ?? 100;
  const log = opts.log ?? ((line: string) => console.log(line));
  const tag = opts.dryRun ? "[cron:retention][dry-run]" : "[cron:retention]";

  const candidates = (await prisma.video.findMany({
    where: { expiredAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      userId: true,
      s3Bucket: true,
      s3Key: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          email: true,
          subscription: { select: { plan: true, status: true, currentPeriodEnd: true, updatedAt: true } },
        },
      },
      pass: { select: { createdAt: true } },
      analysis: { select: { createdAt: true, generatedOptions: true } },
      exports: { select: { createdAt: true, s3OutputKey: true } },
    },
  })) as CandidateVideo[];
  const alreadyExpired = await prisma.video.count({ where: { expiredAt: { not: null } } });

  const result: RetentionRunResult = {
    dryRun: opts.dryRun,
    now: now.toISOString(),
    byRule: {
      free: { videos: 0, objects: 0, bytes: 0 },
      subscriber: { videos: 0, objects: 0, bytes: 0 },
      pass: { videos: 0, objects: 0, bytes: 0 },
    },
    totals: { videos: 0, objects: 0, bytes: 0 },
    kept: { admin: 0, subscriberActive: 0, notDue: 0, alreadyExpired },
    deferred: 0,
    videos: [],
    errors: 0,
  };

  const due: { v: CandidateVideo; c: Classification }[] = [];
  for (const v of candidates) {
    const c = classifyVideo(v);
    if (c.rule === "admin") result.kept.admin++;
    else if (c.deleteAfter === null) result.kept.subscriberActive++;
    else if (c.deleteAfter > now) result.kept.notDue++;
    else due.push({ v, c });
  }
  result.deferred = Math.max(0, due.length - maxVideos);

  for (const { v, c } of due.slice(0, maxVideos)) {
    const rule = c.rule as "free" | "subscriber" | "pass";
    const entry: RetentionVideoResult = {
      id: v.id,
      rule,
      plan: c.plan,
      deleteAfter: c.deleteAfter!.toISOString(),
      basis: c.basis,
      objects: 0,
      bytes: 0,
    };
    try {
      const byBucket = await collectVideoObjects(v);
      for (const objs of byBucket.values()) {
        entry.objects += objs.length;
        entry.bytes += objs.reduce((s, o) => s + o.size, 0);
      }

      if (!opts.dryRun) {
        for (const [bucket, objs] of byBucket) {
          await deleteS3Keys(bucket, objs.map((o) => o.key));
        }
        await prisma.$transaction([
          prisma.video.update({ where: { id: v.id }, data: { expiredAt: now, thumbnailUrl: null } }),
          prisma.analysis.updateMany({
            where: { videoId: v.id },
            data: { expiredAt: now, generatedAudioUrl: null, generatedAudioUrl2: null },
          }),
          prisma.export.updateMany({ where: { videoId: v.id }, data: { downloadUrl: null, expiresAt: now } }),
        ]);
      }

      result.byRule[rule].videos++;
      result.byRule[rule].objects += entry.objects;
      result.byRule[rule].bytes += entry.bytes;
      result.totals.videos++;
      result.totals.objects += entry.objects;
      result.totals.bytes += entry.bytes;
      log(
        `${tag} ${opts.dryRun ? "would delete" : "deleted"} video=${v.id} user_plan=${c.plan} rule=${rule} ` +
        `objects=${entry.objects} bytes_freed=${entry.bytes} (${c.basis})`
      );
    } catch (err) {
      entry.error = err instanceof Error ? err.message : String(err);
      result.errors++;
      log(`${tag} FAILED video=${v.id} rule=${rule}: ${entry.error}`);
    }
    result.videos.push(entry);
  }

  log(
    `${tag} summary: ${result.totals.videos} videos, ${result.totals.objects} objects, ` +
    `${(result.totals.bytes / 1e9).toFixed(2)} GB ` +
    `(free ${result.byRule.free.videos}, subscriber ${result.byRule.subscriber.videos}, pass ${result.byRule.pass.videos}); ` +
    `kept: admin ${result.kept.admin}, active subscribers ${result.kept.subscriberActive}, not due ${result.kept.notDue}; ` +
    `deferred ${result.deferred}; errors ${result.errors}`
  );
  return result;
}
