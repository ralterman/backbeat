import { prisma } from "@/lib/prisma";
import { SubscriptionPlan } from "@prisma/client";

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

export async function getUserPlan(userId: string): Promise<SubscriptionPlan> {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub || sub.status === "CANCELED") return "FREE";
  return sub.plan;
}

/**
 * For FREE users: returns lifetime total across all months.
 * For paid users: returns count for the current month only.
 */
export async function getUsageCount(
  userId: string,
  action: "analysis" | "export" = "analysis"
): Promise<number> {
  const plan = await getUserPlan(userId);

  if (plan === "FREE") {
    // Lifetime count — sum all months
    const records = await prisma.usageRecord.findMany({
      where: { userId, action },
    });
    return records.reduce((sum, r) => sum + r.count, 0);
  }

  // Monthly count for paid plans
  const month = currentMonth();
  const record = await prisma.usageRecord.findUnique({
    where: { userId_action_month: { userId, action, month } },
  });
  return record?.count ?? 0;
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
