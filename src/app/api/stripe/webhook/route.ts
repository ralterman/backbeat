import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

type SubscriptionPlan = "FREE" | "CREATOR" | "TEAM";
type SubscriptionStatus = "ACTIVE" | "PAST_DUE" | "CANCELED" | "TRIALING";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getStripe(): any {
  return new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder");
}

const PRICE_TO_PLAN: Record<string, SubscriptionPlan> = {
  [process.env.STRIPE_CREATOR_PRICE_ID ?? ""]: "CREATOR",
  [process.env.STRIPE_TEAM_PRICE_ID ?? ""]: "TEAM",
};

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const plan = session.metadata?.plan;

      if (userId && plan) {
        const stripePlan = plan.toUpperCase() as SubscriptionPlan;
        await prisma.subscription.upsert({
          where: { userId },
          update: {
            stripeSubscriptionId: session.subscription as string,
            plan: stripePlan,
            status: "ACTIVE",
          },
          create: {
            userId,
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
            plan: stripePlan,
            status: "ACTIVE",
          },
        });
      }
      break;
    }

    case "customer.subscription.updated": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subscription = event.data.object as any;
      const priceId = subscription.items?.data?.[0]?.price?.id;
      const plan: SubscriptionPlan = PRICE_TO_PLAN[priceId] ?? "FREE";

      const stripeStatus = subscription.status as string;
      let dbStatus: SubscriptionStatus = "ACTIVE";
      if (stripeStatus === "past_due") dbStatus = "PAST_DUE";
      else if (stripeStatus === "canceled") dbStatus = "CANCELED";
      else if (stripeStatus === "trialing") dbStatus = "TRIALING";

      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: {
          plan,
          status: dbStatus,
          currentPeriodStart: subscription.current_period_start
            ? new Date(subscription.current_period_start * 1000)
            : undefined,
          currentPeriodEnd: subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000)
            : undefined,
        },
      });
      break;
    }

    case "customer.subscription.deleted": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subscription = event.data.object as any;
      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: { plan: "FREE", status: "CANCELED" },
      });
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
