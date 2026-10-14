import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { ADMIN_EMAILS } from "@/lib/admin";

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
