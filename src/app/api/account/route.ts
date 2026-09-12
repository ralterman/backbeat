import { NextResponse } from "next/server";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getStripe(): any {
  return new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder");
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // 1. Cancel active Stripe subscription (log and continue on failure)
  try {
    const sub = await prisma.subscription.findUnique({ where: { userId } });
    if (sub?.stripeSubscriptionId && sub.status !== "CANCELED") {
      const stripe = getStripe();
      await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
      console.log(`[account/delete] canceled Stripe subscription ${sub.stripeSubscriptionId}`);
    }
  } catch (err) {
    // Non-fatal: log and continue so data is still deleted
    console.error("[account/delete] Stripe cancellation failed:", err);
  }

  // 2. Delete user — all related rows cascade via FK constraints:
  //    Export, TrackMatch, Analysis, Video, UsageRecord, Subscription,
  //    Session, Account, VerificationToken all have ON DELETE CASCADE.
  try {
    await prisma.user.delete({ where: { id: userId } });
    console.log(`[account/delete] deleted user ${userId}`);
  } catch (err) {
    console.error("[account/delete] DB deletion failed:", err);
    return NextResponse.json(
      { error: "Failed to delete account. Please try again or contact support." },
      { status: 500 }
    );
  }

  // 3. Sign out (clears the session cookie)
  await signOut({ redirect: false });

  return NextResponse.json({ success: true });
}
