import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUsageCount, getUsageLimit, getUserPlan, OPTION_CAPS, HARD_MAX_OPTIONS } from "@/lib/usage";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { PLAN_LABELS } from "@/lib/plans";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const admin = isAdminEmail(session.user.email);

  const [used, limit, plan, sub] = await Promise.all([
    getUsageCount(userId, "analysis"),
    getUsageLimit(userId),
    getUserPlan(userId),
    prisma.subscription.findUnique({
      where: { userId },
      select: { status: true, cancelAtPeriodEnd: true, currentPeriodEnd: true },
    }),
  ]);

  return NextResponse.json({
    used,
    limit,
    remaining: Math.max(0, limit - used),
    plan,
    planLabel: PLAN_LABELS[plan] ?? plan,
    isAdmin: admin,
    // Max generated options per analysis for this account (FREE 2 / CREATOR 4 / Pro 6; admin = hard max)
    optionCap: admin ? HARD_MAX_OPTIONS : OPTION_CAPS[plan],
    // Billing state for the account page: "cancels on <date>" / past-due notice
    subscriptionStatus: sub?.status ?? null,
    cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
    currentPeriodEnd: sub?.currentPeriodEnd ?? null,
  });
}
