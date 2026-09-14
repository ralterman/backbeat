import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import {
  sendUpgradeEmail,
  sendCancellationEmail,
  sendPlanChangeEmail,
  sendPaymentFailedEmail,
} from "@/lib/email";

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

const toDate = (sec: unknown): Date | undefined =>
  typeof sec === "number" && sec > 0 ? new Date(sec * 1000) : undefined;

/**
 * Stripe API 2025-03-31 (Basil) and later moved current_period_start/end
 * from the Subscription root to each SubscriptionItem. Read the item first
 * and fall back to the root for older API versions.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function periodFromSubscription(sub: any): { start?: Date; end?: Date } {
  const item = sub?.items?.data?.[0];
  return {
    start: toDate(item?.current_period_start ?? sub?.current_period_start),
    end:   toDate(item?.current_period_end   ?? sub?.current_period_end),
  };
}

/** Basil moved invoice.subscription → invoice.parent.subscription_details.subscription. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function subscriptionIdFromInvoice(inv: any): string | null {
  const v = inv?.parent?.subscription_details?.subscription ?? inv?.subscription ?? null;
  return typeof v === "string" ? v : v?.id ?? null;
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // ── Idempotency ──────────────────────────────────────────────────────────
  // Stripe delivers at-least-once and retries on non-2xx. Claim the event id
  // up front (the PK insert is the lock, so two concurrent deliveries can't
  // both proceed). If processing throws, release the claim and return 500 so
  // Stripe's retry gets a clean run.
  try {
    await prisma.stripeEvent.create({ data: { id: event.id, type: event.type } });
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "P2002") {
      console.log(`[webhook] duplicate delivery ignored: ${event.id} (${event.type})`);
      return NextResponse.json({ received: true, duplicate: true });
    }
    throw err;
  }

  try {
    await handleEvent(event);
  } catch (err) {
    console.error(`[webhook] ${event.type} ${event.id} failed; releasing claim for retry:`, err);
    await prisma.stripeEvent.delete({ where: { id: event.id } }).catch(() => {});
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const plan = session.metadata?.plan;
      if (!userId || !plan) break;

      const upper = plan.toUpperCase();
      if (upper !== "CREATOR" && upper !== "TEAM") {
        console.error(`[webhook] checkout.session.completed with unknown plan metadata "${plan}" for user ${userId}`);
        break;
      }
      const stripePlan = upper as SubscriptionPlan;

      await prisma.subscription.upsert({
        where: { userId },
        update: {
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: session.subscription as string,
          plan: stripePlan,
          status: "ACTIVE",
          cancelAtPeriodEnd: false,
        },
        create: {
          userId,
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: session.subscription as string,
          plan: stripePlan,
          status: "ACTIVE",
        },
      });

      const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
      if (user?.email) {
        await sendUpgradeEmail(user.email, stripePlan).catch((err) =>
          console.error("[webhook] upgrade email failed:", err)
        );
      }
      break;
    }

    case "customer.subscription.updated": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subscription = event.data.object as any;
      const priceId: string | undefined = subscription.items?.data?.[0]?.price?.id;
      const { start: periodStart, end: periodEnd } = periodFromSubscription(subscription);
      const cancelAtPeriodEnd: boolean = subscription.cancel_at_period_end === true;

      const stripeStatus = subscription.status as string;
      let dbStatus: SubscriptionStatus = "ACTIVE";
      if (stripeStatus === "past_due" || stripeStatus === "unpaid") dbStatus = "PAST_DUE";
      else if (stripeStatus === "canceled") dbStatus = "CANCELED";
      else if (stripeStatus === "trialing") dbStatus = "TRIALING";

      const existing = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: subscription.id },
        include: { user: { select: { email: true } } },
      });
      if (!existing) {
        console.warn(`[webhook] subscription.updated for unknown subscription ${subscription.id}`);
        break;
      }
      const oldPlan = existing.plan;

      // If canceled, force FREE regardless of the price still attached.
      // Otherwise map from price id — but never silently downgrade a paying
      // customer because a price id we don't recognise showed up.
      let newPlan: SubscriptionPlan;
      if (dbStatus === "CANCELED") {
        newPlan = "FREE";
      } else if (priceId && PRICE_TO_PLAN[priceId]) {
        newPlan = PRICE_TO_PLAN[priceId];
      } else {
        console.error(`[webhook] unknown price id "${priceId}" on ${subscription.id}; keeping plan ${oldPlan}`);
        newPlan = oldPlan as SubscriptionPlan;
      }

      await prisma.subscription.update({
        where: { id: existing.id },
        data: {
          plan: newPlan,
          status: dbStatus,
          stripePriceId: priceId ?? existing.stripePriceId,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd,
        },
      });

      const email = existing.user?.email;
      if (!email) break;

      if (dbStatus === "CANCELED") {
        await sendCancellationEmail(email, periodEnd ?? null).catch((err) =>
          console.error("[webhook] cancellation email failed:", err)
        );
      } else if (cancelAtPeriodEnd && !existing.cancelAtPeriodEnd) {
        // User just scheduled a cancellation in the portal. Stripe keeps the
        // subscription "active" until period end, so without this branch the
        // cancellation email would only go out weeks later on .deleted.
        console.log(`[webhook] ${subscription.id} scheduled to cancel at ${periodEnd?.toISOString() ?? "period end"}`);
        await sendCancellationEmail(email, periodEnd ?? null).catch((err) =>
          console.error("[webhook] scheduled-cancellation email failed:", err)
        );
      } else if (newPlan !== oldPlan) {
        await sendPlanChangeEmail(email, oldPlan, newPlan).catch((err) =>
          console.error("[webhook] plan change email failed:", err)
        );
      }
      break;
    }

    case "customer.subscription.deleted": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subscription = event.data.object as any;

      const existing = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: subscription.id },
        include: { user: { select: { email: true } } },
      });

      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: { plan: "FREE", status: "CANCELED", cancelAtPeriodEnd: false },
      });

      // If we already sent the "cancels on <date>" email when it was scheduled,
      // don't send a second one now that the date has arrived.
      const email = existing?.user?.email;
      if (email && !existing?.cancelAtPeriodEnd) {
        await sendCancellationEmail(email, null).catch((err) =>
          console.error("[webhook] cancellation email failed:", err)
        );
      }
      break;
    }

    case "invoice.payment_failed": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invoice = event.data.object as any;
      const subId = subscriptionIdFromInvoice(invoice);
      const attempt = invoice.attempt_count ?? "?";
      const nextAttempt = toDate(invoice.next_payment_attempt);

      if (!subId) {
        console.warn(`[webhook] invoice.payment_failed ${invoice.id} has no subscription; ignoring`);
        break;
      }

      const existing = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: subId },
        include: { user: { select: { email: true } } },
      });
      if (!existing) {
        console.warn(`[webhook] invoice.payment_failed for unknown subscription ${subId}`);
        break;
      }

      await prisma.subscription.update({
        where: { id: existing.id },
        data: { status: "PAST_DUE" },
      });

      console.error(
        `[webhook][DUNNING] payment failed for user ${existing.userId} (${existing.user?.email ?? "no email"}) ` +
        `plan=${existing.plan} sub=${subId} invoice=${invoice.id} attempt=${attempt} ` +
        `amount=${((invoice.amount_due ?? 0) / 100).toFixed(2)} ${String(invoice.currency ?? "").toUpperCase()} ` +
        `next_attempt=${nextAttempt?.toISOString() ?? "none (final)"}`
      );

      if (existing.user?.email) {
        await sendPaymentFailedEmail(existing.user.email, existing.plan).catch((err) =>
          console.error("[webhook] payment-failed email failed:", err)
        );
      }
      break;
    }

    default:
      break;
  }
}
