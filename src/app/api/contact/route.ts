import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { validateContact } from "@/lib/contactValidation";
import { verifyTurnstile, turnstileConfigured } from "@/lib/turnstile";

const TO = "hello@backbeat.video";

// ── Rate limit: 3 submissions per IP per hour ───────────────────────────────
// In-memory, per function instance. Limitation: Vercel runs many instances
// and recycles them, so the map is neither shared across instances/regions
// nor durable across cold starts — a determined sender can exceed 3/hour by
// landing on different instances. Good enough as a first brake behind the
// honeypot and Turnstile; move to a shared store (Upstash/Redis, or a
// Postgres table) if that ever matters.
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const submissionsByIp = new Map<string, number[]>();

function clientIp(req: NextRequest): string | null {
  // Vercel sets x-forwarded-for to "client, proxy1, proxy2"; the first is the client.
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim() || null;
  return req.headers.get("x-real-ip");
}

/** Returns seconds until the next allowed submission, or 0 if allowed (and records it). */
function checkRateLimit(ip: string, now: number): number {
  const recent = (submissionsByIp.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    return Math.ceil((recent[0] + RATE_LIMIT_WINDOW_MS - now) / 1000);
  }
  recent.push(now);
  submissionsByIp.set(ip, recent);
  // Opportunistic cleanup so the map can't grow without bound.
  if (submissionsByIp.size > 1000) {
    for (const [k, ts] of submissionsByIp) {
      if (ts.every((t) => now - t >= RATE_LIMIT_WINDOW_MS)) submissionsByIp.delete(k);
    }
  }
  return 0;
}

interface ContactBody {
  name?: string;
  email?: string;
  message?: string;
  /** Honeypot. Real browsers never fill it (it's visually hidden); bots do. */
  website?: string;
  turnstileToken?: string;
}

export async function POST(req: NextRequest) {
  let body: ContactBody;
  try {
    body = (await req.json()) as ContactBody;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { name = "", email = "", message = "", website, turnstileToken } = body;
  const ip = clientIp(req);

  // 1. Honeypot. Answer exactly like a success so the bot learns nothing,
  //    but send nothing.
  if (website && website.trim() !== "") {
    console.log(`[contact] honeypot tripped (ip=${ip ?? "?"}); dropped`);
    return NextResponse.json({ ok: true });
  }

  // 2. Content validation (required fields, email format, spam shape).
  const validationError = validateContact({ name, email, message });
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  // 3. Rate limit, checked before the Turnstile round-trip so abusers don't
  //    cost us siteverify calls.
  if (ip) {
    const wait = checkRateLimit(ip, Date.now());
    if (wait > 0) {
      const minutes = Math.max(1, Math.ceil(wait / 60));
      return NextResponse.json(
        { error: `You've sent a few messages recently — please try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.` },
        { status: 429 }
      );
    }
  }

  // 4. Turnstile. Skipped (loudly) only when no secret is configured at all.
  if (turnstileConfigured()) {
    const result = await verifyTurnstile(turnstileToken, ip);
    if (!result.ok) {
      console.log(`[contact] turnstile rejected (ip=${ip ?? "?"}): ${result.errors.join(",")}`);
      const unreachable = result.errors[0] === "verify-unreachable";
      return NextResponse.json(
        {
          error: unreachable
            ? "We couldn't verify the form right now. Please try again in a moment."
            : "Please complete the verification check and try again.",
        },
        { status: unreachable ? 503 : 400 }
      );
    }
  } else {
    console.warn("[contact] TURNSTILE_SECRET_KEY is not set — Turnstile verification skipped");
  }

  const cleanName = name.trim();
  const cleanEmail = email.trim();
  const cleanMessage = message.trim();

  try {
    // sendEmail() throws on a Resend { error } response (the SDK itself does
    // not), so a rejected send lands in the catch below instead of returning
    // { ok: true } while nothing was delivered.
    const id = await sendEmail({
      to: TO,
      replyTo: cleanEmail,
      subject: `Backbeat contact form: ${cleanName}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;color:#1a1a1a">
          <h2 style="margin-bottom:4px">New contact form submission</h2>
          <hr style="border:none;border-top:1px solid #e5e5e5;margin:16px 0" />
          <p><strong>Name:</strong> ${escapeHtml(cleanName)}</p>
          <p><strong>Email:</strong> <a href="mailto:${escapeHtml(cleanEmail)}">${escapeHtml(cleanEmail)}</a></p>
          <p><strong>Message:</strong></p>
          <blockquote style="margin:0;padding:12px 16px;background:#f5f5f5;border-left:3px solid #C8A96E;white-space:pre-wrap">${escapeHtml(cleanMessage)}</blockquote>
          <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0" />
          <p style="color:#9090aa;font-size:12px">Sent via the contact form at backbeat.video${ip ? ` · ${escapeHtml(ip)}` : ""}</p>
        </div>
      `,
    });

    console.log(`[contact] message from ${cleanEmail} sent to ${TO} id=${id}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`[contact] email send from ${cleanEmail} FAILED:`, err);
    return NextResponse.json({ error: "Failed to send message. Please try again or email us directly." }, { status: 500 });
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
