import { prisma } from "@/lib/prisma";
import { SubscriptionPlan } from "@prisma/client";

// FREE = 1 lifetime analysis (not monthly)
// CREATOR = 30/month
// TEAM = unlimited (effectively no cap)
const MONTHLY_LIMITS: Record<SubscriptionPlan, number> = {
  FREE: 1,
  CREATOR: 30,
  TEAM: 999999,
};

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function getUserPlan(userId: string): Promise<SubscriptionPlan> {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  return sub?.plan ?? "FREE";
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
