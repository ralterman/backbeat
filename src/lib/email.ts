import { Resend } from "resend";
import { PLAN_LABELS } from "@/lib/plans";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? "hello@backbeat.video";

const PLAN_LIMITS: Record<string, string> = {
  CREATOR: "15 video analyses per month and up to 4 soundtrack options per video",
  TEAM: "40 video analyses per month and up to 6 soundtrack options per video",
  FREE: "1 lifetime analysis",
};

/**
 * Send via Resend and return the message id.
 *
 * The Resend SDK does NOT throw on API errors — it resolves with
 * `{ data: null, error }`. Every caller previously did `.catch(...)` on these
 * helpers, which could never fire. Normalise here: throw on `error`, return
 * the id on success so callers can log it.
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  /** Plain-text alternative. Strongly recommended for deliverability — an
   *  HTML-only email is a spam signal to several filters. */
  text?: string;
  replyTo?: string;
}): Promise<string> {
  const { data, error } = await resend.emails.send({ from: FROM, ...opts });
  if (error) {
    throw new Error(`Resend ${error.name ?? "error"}: ${error.message}`);
  }
  if (!data?.id) {
    throw new Error("Resend returned no message id");
  }
  return data.id;
}

/** Absolute URL for the current brand mark — email clients can't load relative paths or inline SVG reliably. */
export const LOGO_ICON_URL = `${process.env.NEXTAUTH_URL ?? "https://backbeat.video"}/brand/logo-icon.png`;

/**
 * Shared chrome for every transactional email: site-dark background
 * (#0a0a0f), the current "B" mark as a hosted PNG, and the gold serif
 * wordmark (Georgia is the email-safe stand-in for TAN Pearl — custom web
 * fonts are stripped by most clients). Exported so auth.ts and the contact
 * route render on the same shell instead of carrying their own copies.
 */
export function emailShell(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:48px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px">

        <!-- Logo: mark + wordmark, table-based so it survives Gmail/Outlook -->
        <tr><td align="center" style="padding-bottom:32px">
          <table cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="padding-right:12px;vertical-align:middle">
              <img src="${LOGO_ICON_URL}" width="28" height="43" alt="" style="display:block;width:28px;height:43px;border:0">
            </td>
            <td style="vertical-align:middle">
              <span style="color:#C8A96E;font-size:26px;font-weight:400;line-height:1;letter-spacing:0.04em;font-family:Georgia,'Times New Roman',serif">Backbeat</span>
            </td>
          </tr></table>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:#141414;border:1px solid #2a2a2a;border-top:3px solid #C8A96E;border-radius:16px;padding:40px 36px">
          ${content}
        </td></tr>

        <!-- Footer -->
        <tr><td align="center" style="padding-top:24px">
          <p style="margin:0;color:#3a3a5a;font-size:12px">
            Sent by <a href="https://backbeat.video" style="color:#3a3a5a;text-decoration:underline">backbeat.video</a> · AI-powered music for your videos
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function ctaButton(label: string, url: string): string {
  return `<table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
    <a href="${url}"
       style="display:inline-block;background:#C8A96E;color:#0a0a0a;font-size:15px;font-weight:700;padding:14px 36px;border-radius:10px;text-decoration:none;letter-spacing:0.01em">
      ${label}
    </a>
  </td></tr></table>`;
}

export function divider(): string {
  return `<table cellpadding="0" cellspacing="0" width="100%" style="margin:28px 0">
    <tr><td style="border-top:1px solid #2a2a2a"></td></tr>
  </table>`;
}

export async function sendUpgradeEmail(to: string, plan: string): Promise<string> {
  const label = PLAN_LABELS[plan] ?? plan;
  const limit = PLAN_LIMITS[plan] ?? "";
  const dashboardUrl = `${process.env.NEXTAUTH_URL ?? "https://backbeat.video"}/dashboard`;

  const html = emailShell(`
    <p style="margin:0 0 8px;color:#C8A96E;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase">Plan upgraded</p>
    <h1 style="margin:0 0 16px;color:#ffffff;font-size:26px;font-weight:700;line-height:1.2">Welcome to ${label}!</h1>
    <p style="margin:0 0 8px;color:#a0a0b8;font-size:15px;line-height:1.6">
      Your Backbeat account has been upgraded to the <strong style="color:#ffffff">${label} plan</strong>.
    </p>
    <p style="margin:0 0 32px;color:#a0a0b8;font-size:15px;line-height:1.6">
      You now have <strong style="color:#C8A96E">${limit}</strong>. Head to your dashboard to start analyzing.
    </p>
    ${ctaButton("Go to dashboard →", dashboardUrl)}
    ${divider()}
    <p style="margin:0;color:#6a6a8a;font-size:12px">
      Questions? Reply to this email — we're happy to help.
    </p>
  `);

  return sendEmail({ to, subject: `You're on the ${label} plan`, html });
}

export async function sendCancellationEmail(to: string, periodEnd: Date | null): Promise<string> {
  const portalUrl = `${process.env.NEXTAUTH_URL ?? "https://backbeat.video"}/api/stripe/portal`;

  const accessLine = periodEnd
    ? `Your paid features remain active until <strong style="color:#ffffff">${periodEnd.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</strong>, then your account moves to the Free plan.`
    : `Your account has moved to the Free plan.`;

  const html = emailShell(`
    <p style="margin:0 0 8px;color:#a0a0b8;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase">Subscription canceled</p>
    <h1 style="margin:0 0 16px;color:#ffffff;font-size:26px;font-weight:700;line-height:1.2">Your subscription has been canceled</h1>
    <p style="margin:0 0 8px;color:#a0a0b8;font-size:15px;line-height:1.6">
      We've received your cancellation request.
    </p>
    <p style="margin:0 0 32px;color:#a0a0b8;font-size:15px;line-height:1.6">
      ${accessLine}
    </p>
    ${ctaButton("Reactivate subscription →", portalUrl)}
    ${divider()}
    <p style="margin:0;color:#6a6a8a;font-size:12px">
      Changed your mind? You can reactivate any time from the billing portal. Questions? Just reply to this email.
    </p>
  `);

  return sendEmail({ to, subject: "Your Backbeat subscription has been canceled", html });
}

/**
 * Sent to the NEW address when a user requests an email change.
 * The address is only written to the account once this link is used.
 */
export async function sendEmailChangeVerification(
  to: string,
  confirmUrl: string,
  currentEmail: string
): Promise<string> {
  const html = emailShell(`
    <p style="margin:0 0 8px;color:#C8A96E;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase">Confirm your new email</p>
    <h1 style="margin:0 0 16px;color:#ffffff;font-size:26px;font-weight:700;line-height:1.2">Verify this address</h1>
    <p style="margin:0 0 8px;color:#a0a0b8;font-size:15px;line-height:1.6">
      Someone signed in as <strong style="color:#ffffff">${currentEmail}</strong> asked to move their Backbeat account to this address.
    </p>
    <p style="margin:0 0 32px;color:#a0a0b8;font-size:15px;line-height:1.6">
      Click below to confirm. This link expires in <strong style="color:#ffffff">24 hours</strong>. Nothing changes until you do.
    </p>
    ${ctaButton("Confirm new email →", confirmUrl)}
    ${divider()}
    <p style="margin:0 0 8px;color:#6a6a8a;font-size:12px">Didn't request this? Ignore this email and the request will expire on its own.</p>
    <p style="margin:0;color:#6a6a8a;font-size:12px">If the button doesn't work, copy and paste this link:</p>
    <p style="margin:8px 0 0;word-break:break-all"><a href="${confirmUrl}" style="color:#C8A96E;font-size:12px;text-decoration:none">${confirmUrl}</a></p>
  `);

  return sendEmail({ to, subject: "Confirm your new Backbeat email", html });
}

/**
 * Sent to the OLD (current) address when an email change is requested,
 * so the real owner is warned if their session was hijacked.
 */
export async function sendEmailChangeNotice(to: string, newEmail: string): Promise<string> {
  const html = emailShell(`
    <p style="margin:0 0 8px;color:#a0a0b8;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase">Security notice</p>
    <h1 style="margin:0 0 16px;color:#ffffff;font-size:26px;font-weight:700;line-height:1.2">Email change requested</h1>
    <p style="margin:0 0 8px;color:#a0a0b8;font-size:15px;line-height:1.6">
      Someone requested to change this account's email address to <strong style="color:#ffffff">${newEmail}</strong>.
    </p>
    <p style="margin:0 0 8px;color:#a0a0b8;font-size:15px;line-height:1.6">
      The change only takes effect once a confirmation link sent to the new address is clicked. If this was you, no action is needed.
    </p>
    <p style="margin:0 0 0;color:#a0a0b8;font-size:15px;line-height:1.6">
      <strong style="color:#ffffff">If this wasn't you</strong>, contact us right away at <a href="mailto:hello@backbeat.video" style="color:#C8A96E">hello@backbeat.video</a>.
    </p>
  `);

  return sendEmail({ to, subject: "Someone requested to change your Backbeat email", html });
}

/**
 * Dunning email for a failed recurring payment.
 */
export async function sendPaymentFailedEmail(to: string, plan: string): Promise<string> {
  const label = PLAN_LABELS[plan] ?? plan;
  const portalUrl = `${process.env.NEXTAUTH_URL ?? "https://backbeat.video"}/api/stripe/portal`;

  const html = emailShell(`
    <p style="margin:0 0 8px;color:#e5484d;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase">Payment failed</p>
    <h1 style="margin:0 0 16px;color:#ffffff;font-size:26px;font-weight:700;line-height:1.2">We couldn't process your payment</h1>
    <p style="margin:0 0 8px;color:#a0a0b8;font-size:15px;line-height:1.6">
      Your latest payment for the <strong style="color:#ffffff">${label} plan</strong> didn't go through. This is usually an expired card or a bank decline.
    </p>
    <p style="margin:0 0 32px;color:#a0a0b8;font-size:15px;line-height:1.6">
      Please update your payment method to keep your plan active. Stripe will retry automatically over the next few days.
    </p>
    ${ctaButton("Update payment method →", portalUrl)}
    ${divider()}
    <p style="margin:0;color:#6a6a8a;font-size:12px">
      Already fixed it? You can ignore this. Questions? Reply to this email.
    </p>
  `);

  return sendEmail({ to, subject: "Action needed: your Backbeat payment failed", html });
}

export async function sendPlanChangeEmail(
  to: string,
  fromPlan: string,
  toPlan: string
): Promise<string> {
  const fromLabel = PLAN_LABELS[fromPlan] ?? fromPlan;
  const toLabel = PLAN_LABELS[toPlan] ?? toPlan;
  const limit = PLAN_LIMITS[toPlan] ?? "";
  const dashboardUrl = `${process.env.NEXTAUTH_URL ?? "https://backbeat.video"}/dashboard`;

  const html = emailShell(`
    <p style="margin:0 0 8px;color:#C8A96E;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase">Plan changed</p>
    <h1 style="margin:0 0 16px;color:#ffffff;font-size:26px;font-weight:700;line-height:1.2">You've switched to ${toLabel}</h1>
    <p style="margin:0 0 8px;color:#a0a0b8;font-size:15px;line-height:1.6">
      Your Backbeat plan has changed from <strong style="color:#ffffff">${fromLabel}</strong> to <strong style="color:#ffffff">${toLabel}</strong>.
    </p>
    <p style="margin:0 0 32px;color:#a0a0b8;font-size:15px;line-height:1.6">
      You now have <strong style="color:#C8A96E">${limit}</strong>.
    </p>
    ${ctaButton("Go to dashboard →", dashboardUrl)}
    ${divider()}
    <p style="margin:0;color:#6a6a8a;font-size:12px">
      Questions about your plan? Reply to this email.
    </p>
  `);

  return sendEmail({ to, subject: `Your Backbeat plan changed to ${toLabel}`, html });
}
