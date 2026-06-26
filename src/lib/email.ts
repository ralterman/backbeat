import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? "hello@backbeat.me";

const PLAN_LABELS: Record<string, string> = {
  CREATOR: "Creator",
  TEAM: "Team",
  FREE: "Free",
};

const PLAN_LIMITS: Record<string, string> = {
  CREATOR: "30 video analyses per month",
  TEAM: "Unlimited video analyses",
  FREE: "1 lifetime analysis",
};

function shell(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:48px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px">

        <!-- Logo -->
        <tr><td align="center" style="padding-bottom:32px">
          <table cellpadding="0" cellspacing="0"><tr><td>
            <div style="display:inline-flex;align-items:center;gap:10px">
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="18" cy="18" r="16" fill="#C8A96E" fill-opacity="0.15"/>
                <circle cx="18" cy="18" r="15.5" stroke="#C8A96E" stroke-width="1.25"/>
                <circle cx="18" cy="18" r="5.5" fill="#C8A96E"/>
                <polygon points="16.5,15.5 16.5,20.5 21.5,18" fill="#0A0A0A"/>
              </svg>
              <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px">Backbeat</span>
            </div>
          </td></tr></table>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:#141414;border:1px solid #2a2a2a;border-radius:16px;padding:40px 36px">
          ${content}
        </td></tr>

        <!-- Footer -->
        <tr><td align="center" style="padding-top:24px">
          <p style="margin:0;color:#3a3a5a;font-size:12px">
            Sent by <a href="https://backbeat.me" style="color:#3a3a5a;text-decoration:underline">backbeat.me</a> · AI-powered music for your videos
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function ctaButton(label: string, url: string): string {
  return `<table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
    <a href="${url}"
       style="display:inline-block;background:#C8A96E;color:#0a0a0a;font-size:15px;font-weight:700;padding:14px 36px;border-radius:10px;text-decoration:none;letter-spacing:0.01em">
      ${label}
    </a>
  </td></tr></table>`;
}

function divider(): string {
  return `<table cellpadding="0" cellspacing="0" width="100%" style="margin:28px 0">
    <tr><td style="border-top:1px solid #2a2a2a"></td></tr>
  </table>`;
}

export async function sendUpgradeEmail(to: string, plan: string): Promise<void> {
  const label = PLAN_LABELS[plan] ?? plan;
  const limit = PLAN_LIMITS[plan] ?? "";
  const dashboardUrl = `${process.env.NEXTAUTH_URL ?? "https://backbeat.me"}/dashboard`;

  const html = shell(`
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

  await resend.emails.send({
    from: FROM,
    to,
    subject: `You're on the ${label} plan`,
    html,
  });
}

export async function sendCancellationEmail(to: string, periodEnd: Date | null): Promise<void> {
  const portalUrl = `${process.env.NEXTAUTH_URL ?? "https://backbeat.me"}/api/stripe/portal`;

  const accessLine = periodEnd
    ? `Your paid features remain active until <strong style="color:#ffffff">${periodEnd.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</strong>, then your account moves to the Free plan.`
    : `Your account has moved to the Free plan.`;

  const html = shell(`
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

  await resend.emails.send({
    from: FROM,
    to,
    subject: "Your Backbeat subscription has been canceled",
    html,
  });
}

export async function sendPlanChangeEmail(
  to: string,
  fromPlan: string,
  toPlan: string
): Promise<void> {
  const fromLabel = PLAN_LABELS[fromPlan] ?? fromPlan;
  const toLabel = PLAN_LABELS[toPlan] ?? toPlan;
  const limit = PLAN_LIMITS[toPlan] ?? "";
  const dashboardUrl = `${process.env.NEXTAUTH_URL ?? "https://backbeat.me"}/dashboard`;

  const html = shell(`
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

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Your Backbeat plan changed to ${toLabel}`,
    html,
  });
}
