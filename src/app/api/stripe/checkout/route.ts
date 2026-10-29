import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getUserPlan } from "@/lib/usage";
import { isAdminEmail } from "@/lib/admin";
import { getVideoPass } from "@/lib/videoPass";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getStripe(): any {
  return new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder");
}

const PRICE_IDS: Record<string, string> = {
  creator: process.env.STRIPE_CREATOR_PRICE_ID ?? "",
  team: process.env.STRIPE_TEAM_PRICE_ID ?? "",
};

/** The user's Stripe customer id, creating the customer (and the FREE
 *  Subscription row that carries the id) on first use. */
async function ensureCustomer(userId: string, userEmail: string): Promise<string> {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (sub?.stripeCustomerId) return sub.stripeCustomerId;
  const customer = await getStripe().customers.create({ email: userEmail, metadata: { userId } });
  await prisma.subscription.upsert({
    where: { userId },
    update: { stripeCustomerId: customer.id },
    create: { userId, stripeCustomerId: customer.id },
  });
  return customer.id as string;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const plan = searchParams.get("plan");
  const passVideoId = searchParams.get("video");
  // Subscription checkout opened from a results page (/pricing?video=…):
  // cancelling returns to that page, which then offers the Video Pass.
  const fromVideoId = searchParams.get("from");

  const userId = session.user.id;
  const userEmail = session.user.email;
  const base = process.env.NEXTAUTH_URL ?? "https://backbeat.video";

  // ── One-time Video Pass (?video=<id>) ───────────────────────────────────
  // Stripe Checkout in payment mode. The webhook turns the completed session
  // into a VideoPass row; nothing is unlocked here.
  if (passVideoId) {
    const priceId = process.env.STRIPE_SINGLE_VIDEO_PRICE_ID;
    if (!priceId) {
      console.error("[checkout] STRIPE_SINGLE_VIDEO_PRICE_ID is not set");
      return NextResponse.json({ error: "The Video Pass isn't available right now." }, { status: 503 });
    }
    const video = await prisma.video.findFirst({ where: { id: passVideoId, userId }, select: { id: true } });
    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }
    const resultsUrl = `${base}/analyze/${video.id}`;
    // Already unlocked, or on a paid plan (which already includes everything
    // the pass gives): nothing to sell, go back to the results.
    if (await getVideoPass(video.id)) return NextResponse.redirect(resultsUrl);
    if (isAdminEmail(userEmail) || (await getUserPlan(userId)) !== "FREE") return NextResponse.redirect(resultsUrl);

    const customerId = await ensureCustomer(userId, userEmail);
    const checkoutSession = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${resultsUrl}?unlocked=true`,
      cancel_url: resultsUrl,
      metadata: { userId, kind: "video_pass", videoId: video.id },
      payment_intent_data: { metadata: { userId, kind: "video_pass", videoId: video.id } },
    });
    return NextResponse.redirect(checkoutSession.url!);
  }

  // ── Subscription ────────────────────────────────────────────────────────
  if (!plan || !PRICE_IDS[plan]) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const customerId = await ensureCustomer(userId, userEmail);
  const fromVideo = fromVideoId
    ? await prisma.video.findFirst({ where: { id: fromVideoId, userId }, select: { id: true } })
    : null;

  // A free user upgrading with a 30 s-capped analysis lands back on that
  // video's results page, where the page generates the full-length pair
  // (see the ?unlocked effect in /analyze/[id]). Otherwise the dashboard.
  const capped = await prisma.analysis.findFirst({
    where: { cappedSec: { not: null }, video: { userId, status: "ANALYZED" } },
    orderBy: { createdAt: "desc" },
    select: { videoId: true },
  });
  // A free user whose analysis was NOT capped (clip under 30 s) already has
  // one full-length track; land them on it with a "generate your second
  // track" prompt so they don't re-upload. Regenerating on that analysis
  // charges one slot (see slotChargedAt in /api/analyze).
  const uncappedSingle = capped
    ? null
    : await prisma.analysis.findFirst({
        where: { cappedSec: null, slotChargedAt: null, video: { userId, status: "ANALYZED" } },
        orderBy: { createdAt: "desc" },
        select: { videoId: true, generatedOptions: true },
      });
  const uncappedSingleTrack =
    uncappedSingle && Array.isArray(uncappedSingle.generatedOptions) && uncappedSingle.generatedOptions.length < 2
      ? uncappedSingle
      : null;
  const successUrl = capped
    ? `${base}/analyze/${capped.videoId}?unlocked=true&upgraded=true`
    : uncappedSingleTrack
      ? `${base}/analyze/${uncappedSingleTrack.videoId}?upgraded=true&second=true`
      : `${base}/dashboard?upgraded=true`;

  const checkoutSession = await getStripe().checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
    success_url: successUrl,
    cancel_url: fromVideo ? `${base}/analyze/${fromVideo.id}?checkout=cancelled` : `${base}/pricing`,
    metadata: { userId, plan },
  });

  return NextResponse.redirect(checkoutSession.url!);
}
