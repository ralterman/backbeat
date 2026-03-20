import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUsageCount, getUsageLimit, getUserPlan } from "@/lib/usage";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const [used, limit, plan] = await Promise.all([
    getUsageCount(userId, "analysis"),
    getUsageLimit(userId),
    getUserPlan(userId),
  ]);

  return NextResponse.json({
    used,
    limit,
    remaining: Math.max(0, limit - used),
    plan,
  });
}
