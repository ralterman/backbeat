import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getStripe(): any {
  return new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder");
}

const PRICE_IDS: Record<string, string> = {
  creator: process.env.STRIPE_CREATOR_PRICE_ID ?? "",
  team: process.env.STRIPE_TEAM_PRICE_ID ?? "",
};

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const plan = searchParams.get("plan");

  if (!plan || !PRICE_IDS[plan]) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const userId = session.user.id;
  const userEmail = session.user.email;
  const stripe = getStripe();

  // Get or create Stripe customer
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  let customerId = sub?.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: userEmail,
      metadata: { userId },
    });
    customerId = customer.id;

    await prisma.subscription.upsert({
      where: { userId },
      update: { stripeCustomerId: customerId },
      create: { userId, stripeCustomerId: customerId },
    });
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
    success_url: `${process.env.NEXTAUTH_URL}/dashboard?upgraded=true`,
    cancel_url: `${process.env.NEXTAUTH_URL}/pricing`,
    metadata: { userId, plan },
  });

  return NextResponse.redirect(checkoutSession.url!);
}
