import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { ADMIN_EMAILS } from "@/lib/admin";
import { PLAN_LABELS } from "@/lib/plans";

/**
 * Operational alerts to the admin inbox, throttled to one email per `key`
 * per `windowMs` across every function instance.
 *
 * The throttle is a single atomic statement against AlertThrottle: insert the
 * key, or update it only if the previous send is older than the window.
 * Exactly one concurrent caller gets a row back and sends; the rest get
 * nothing and skip. No read-then-write race, no per-instance memory.
 *
 * Never throws: an alert must not turn a handled failure into an unhandled
 * one. Returns true if an email was sent.
 */
export async function notifyAdminThrottled(
  key: string,
  windowMs: number,
  mail: { subject: string; html: string; text: string }
): Promise<boolean> {
  try {
    const claimed = await prisma.$queryRaw<{ key: string }[]>`
      INSERT INTO "AlertThrottle" ("key", "lastSentAt")
      VALUES (${key}, NOW())
      ON CONFLICT ("key") DO UPDATE SET "lastSentAt" = NOW()
        WHERE "AlertThrottle"."lastSentAt" < NOW() - (${windowMs} * INTERVAL '1 millisecond')
      RETURNING "key"`;
    if (claimed.length === 0) {
      console.log(`[alerts] ${key}: suppressed (sent within the last ${Math.round(windowMs / 60000)} min)`);
      return false;
    }
    await Promise.all(ADMIN_EMAILS.map((to) => sendEmail({ to, ...mail })));
    console.log(`[alerts] ${key}: sent to ${ADMIN_EMAILS.join(", ")}`);
    return true;
  } catch (err) {
    console.error(`[alerts] ${key}: failed to send:`, err);
    return false;
  }
}

export const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Send one email to every admin, unthrottled. For events that are each worth
 * knowing about (a cancellation, say), not for failures that can repeat.
 * Never throws. Returns true if every send succeeded.
 */
export async function notifyAdmin(
  label: string,
  mail: { subject: string; html: string; text: string }
): Promise<boolean> {
  try {
    const ids = await Promise.all(ADMIN_EMAILS.map((to) => sendEmail({ to, ...mail })));
    console.log(`[alerts] ${label}: sent to ${ADMIN_EMAILS.join(", ")} id=${ids.join(",")}`);
    return true;
  } catch (err) {
    console.error(`[alerts] ${label}: failed to send:`, err);
    return false;
  }
}

/** "3 months, 12 days" / "18 days" / "under a day". */
export function formatDuration(from: Date, to: Date): string {
  const days = Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000));
  if (days < 1) return "under a day";
  const months = Math.floor(days / 30);
  const rest = days % 30;
  const d = (n: number) => `${n} day${n === 1 ? "" : "s"}`;
  if (months === 0) return d(days);
  const m = `${months} month${months === 1 ? "" : "s"}`;
  return rest === 0 ? m : `${m}, ${d(rest)}`;
}

/**
 * The "a subscriber canceled" alert, sent when a cancellation is scheduled
 * in the portal (cancel_at_period_end) and again when the subscription
 * actually ends (customer.subscription.deleted).
 */
export function subscriptionCancellationAlert(context: {
  kind: "scheduled" | "ended";
  email: string;
  plan: string;
  /** When the Stripe subscription was created. */
  subscribedAt: Date | null;
  /** For "scheduled": when access ends. For "ended": when it ended. */
  endsAt: Date | null;
  stripeSubscriptionId: string;
  stripeCustomerId: string | null;
}) {
  const now = new Date();
  const end = context.kind === "ended" ? (context.endsAt ?? now) : now;
  const duration = context.subscribedAt ? formatDuration(context.subscribedAt, end) : "unknown";
  const since = context.subscribedAt ? context.subscribedAt.toISOString().slice(0, 10) : "unknown";
  const endsOn = context.endsAt ? context.endsAt.toISOString().slice(0, 10) : null;
  const plan = PLAN_LABELS[context.plan] ?? context.plan;
  const headline =
    context.kind === "scheduled"
      ? `${context.email} scheduled a cancellation (${plan})`
      : `${context.email}’s ${plan} subscription ended`;
  const when =
    context.kind === "scheduled"
      ? `Access continues until ${endsOn ?? "the end of the current period"}, then the account drops to Free.`
      : `The account is now on Free.`;
  const facts =
    `Customer: ${context.email}\n` +
    `Plan: ${plan}\n` +
    `Subscribed since: ${since}\n` +
    `Subscribed for: ${duration}\n` +
    (endsOn ? `${context.kind === "scheduled" ? "Ends" : "Ended"}: ${endsOn}\n` : "") +
    `Stripe subscription: ${context.stripeSubscriptionId}\n` +
    `Stripe customer: ${context.stripeCustomerId ?? "unknown"}`;
  const customerUrl = context.stripeCustomerId ? `https://dashboard.stripe.com/customers/${context.stripeCustomerId}` : null;
  return {
    subject: `Backbeat: ${headline}`,
    text: `${headline}.\n${when}\n\n${facts}\n` + (customerUrl ? `\n${customerUrl}\n` : ""),
    html:
      `<div style="font-family:sans-serif;max-width:600px;color:#1a1a1a">` +
      `<h2 style="margin-bottom:4px">${escapeHtml(headline)}</h2>` +
      `<p>${escapeHtml(when)}</p>` +
      `<pre style="background:#f5f5f5;padding:12px;border-left:3px solid #C8A96E;white-space:pre-wrap">${escapeHtml(facts)}</pre>` +
      (customerUrl ? `<p><a href="${customerUrl}">Open in Stripe</a></p>` : "") +
      `</div>`,
  };
}

/** The "ElevenLabs is out of credits" alert. */
export function elevenLabsQuotaAlert(context: { videoId: string; userId: string; detail: string }) {
  const when = new Date().toISOString();
  return {
    subject: "Backbeat: ElevenLabs credits exhausted — music generation paused",
    text:
      `ElevenLabs rejected a music generation for insufficient credits at ${when}.\n\n` +
      `The video has been marked PAUSED (not FAILED) and the user was told generation is temporarily paused.\n` +
      `Top up credits at https://elevenlabs.io/app/subscription, then the user can retry from their dashboard.\n\n` +
      `videoId: ${context.videoId}\nuserId: ${context.userId}\nElevenLabs said: ${context.detail}\n\n` +
      `You'll get at most one of these per hour.`,
    html:
      `<div style="font-family:sans-serif;max-width:600px;color:#1a1a1a">` +
      `<h2 style="margin-bottom:4px">ElevenLabs credits exhausted</h2>` +
      `<p>A music generation was rejected for insufficient credits at <strong>${when}</strong>.</p>` +
      `<p>The video is marked <strong>PAUSED</strong> (not FAILED) and the user was told generation is temporarily paused. ` +
      `Top up at <a href="https://elevenlabs.io/app/subscription">elevenlabs.io/app/subscription</a>; the user can then retry from their dashboard.</p>` +
      `<pre style="background:#f5f5f5;padding:12px;border-left:3px solid #C8A96E;white-space:pre-wrap">videoId: ${context.videoId}\nuserId: ${context.userId}\n${escapeHtml(context.detail)}</pre>` +
      `<p style="color:#9090aa;font-size:12px">At most one of these per hour.</p></div>`,
  };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
