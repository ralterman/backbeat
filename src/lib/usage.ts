import { prisma } from "@/lib/prisma";
import { SubscriptionPlan, type Prisma } from "@prisma/client";

/** Either the global client or a transaction client — the helpers below
 *  work inside reserveAnalysisSlot's transaction as well as outside it. */
type Db = Prisma.TransactionClient;

// FREE    = 1 lifetime analysis (not monthly)
// CREATOR = 15/month
// TEAM    = 40/month  (marketed as "Pro" — see src/lib/plans.ts)
const MONTHLY_LIMITS: Record<SubscriptionPlan, number> = {
  FREE: 1,
  CREATOR: 15,
  TEAM: 40,
};

/**
 * Maximum generated soundtrack options per analysis, by plan.
 * Every analysis produces 2; each regeneration adds 2 more up to this cap.
 *   FREE    = 2 (no regeneration)
 *   CREATOR = 4 (one regeneration)
 *   TEAM    = 6 (two regenerations)
 * Regeneration does not consume an analysis credit — the cap is its limit.
 */
export const OPTION_CAPS: Record<SubscriptionPlan, number> = {
  FREE: 2,
  CREATOR: 4,
  TEAM: 6,
};

/** Absolute ceiling regardless of plan (admins, and the size of the A–F label set). */
export const HARD_MAX_OPTIONS = 6;

export async function getOptionCap(userId: string): Promise<number> {
  const plan = await getUserPlan(userId);
  return OPTION_CAPS[plan];
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function getUserPlan(userId: string, db: Db = prisma): Promise<SubscriptionPlan> {
  const sub = await db.subscription.findUnique({ where: { userId } });
  if (!sub || sub.status === "CANCELED") return "FREE";
  return sub.plan;
}

/**
 * For FREE users: returns lifetime total across all months.
 * For paid users: returns count for the current month only.
 */
export async function getUsageCount(
  userId: string,
  action: "analysis" | "export" = "analysis",
  db: Db = prisma
): Promise<number> {
  const plan = await getUserPlan(userId, db);

  if (plan === "FREE") {
    // Lifetime count — sum all months
    const records = await db.usageRecord.findMany({
      where: { userId, action },
    });
    return records.reduce((sum, r) => sum + r.count, 0);
  }

  // Monthly count for paid plans
  const month = currentMonth();
  const record = await db.usageRecord.findUnique({
    where: { userId_action_month: { userId, action, month } },
  });
  return record?.count ?? 0;
}

/**
 * Claim an analysis slot BEFORE generation starts. Returns false if the
 * user is at their limit.
 *
 * Check-and-increment runs in one transaction under a per-user advisory
 * lock, so two requests racing for the same user's last slot serialize:
 * the second waits, re-reads the count the first just wrote, and is
 * refused. (The old flow checked at request start and incremented only
 * after a successful generation — a free user could start a second
 * analysis while the first was still generating and get two.)
 *
 * Pair with releaseAnalysisSlot() on any failure so a crash, timeout or
 * out-of-credits pause doesn't burn the slot.
 */
export async function reserveAnalysisSlot(userId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    const plan = await getUserPlan(userId, tx);
    const used = await getUsageCount(userId, "analysis", tx);
    if (used >= MONTHLY_LIMITS[plan]) return false;
    const month = currentMonth();
    await tx.usageRecord.upsert({
      where: { userId_action_month: { userId, action: "analysis", month } },
      update: { count: { increment: 1 } },
      create: { userId, action: "analysis", month, count: 1 },
    });
    return true;
  });
}

/** Give back a slot claimed by reserveAnalysisSlot(). Decrements this
 *  month's record, or — if the reservation straddled a month boundary —
 *  the most recent record that still has a count. Never goes below zero. */
export async function releaseAnalysisSlot(userId: string): Promise<void> {
  const month = currentMonth();
  const r = await prisma.usageRecord.updateMany({
    where: { userId, action: "analysis", month, count: { gt: 0 } },
    data: { count: { decrement: 1 } },
  });
  if (r.count > 0) return;
  const latest = await prisma.usageRecord.findFirst({
    where: { userId, action: "analysis", count: { gt: 0 } },
    orderBy: { month: "desc" },
  });
  if (latest) {
    await prisma.usageRecord.update({ where: { id: latest.id }, data: { count: { decrement: 1 } } });
  }
}

export async function getUsageLimit(userId: string): Promise<number> {
  const plan = await getUserPlan(userId);
  return MONTHLY_LIMITS[plan];
}

export async function getRemainingAnalyses(userId: string): Promise<number> {
  const [used, limit] = await Promise.all([
    getUsageCount(userId, "analysis"),
    getUsageLimit(userId),
  ]);
  return Math.max(0, limit - used);
}

export async function incrementUsage(
  userId: string,
  action: "analysis" | "export" = "analysis"
): Promise<void> {
  const month = currentMonth();
  await prisma.usageRecord.upsert({
    where: { userId_action_month: { userId, action, month } },
    update: { count: { increment: 1 } },
    create: { userId, action, month, count: 1 },
  });
}

export async function canAnalyze(userId: string): Promise<boolean> {
  const remaining = await getRemainingAnalyses(userId);
  return remaining > 0;
}
