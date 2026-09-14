import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? "hello@backbeat.video";
const TO = "hello@backbeat.video";

// In-memory rate limiter: email → timestamp of last submission
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 5 * 60 * 1000; // 5 minutes

export async function POST(req: NextRequest) {
  const body = await req.json() as { name?: string; email?: string; message?: string };
  const { name, email, message } = body;

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "Name, email, and message are all required." }, { status: 400 });
  }

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  // Rate limit: one submission per email per 5 minutes
  const key = email.toLowerCase();
  const last = rateLimitMap.get(key);
  const now = Date.now();
  if (last && now - last < RATE_LIMIT_MS) {
    const remaining = Math.ceil((RATE_LIMIT_MS - (now - last)) / 1000 / 60);
    return NextResponse.json(
      { error: `Please wait ${remaining} more minute${remaining === 1 ? "" : "s"} before submitting again.` },
      { status: 429 }
    );
  }
  rateLimitMap.set(key, now);

  // Clean up stale entries periodically
  if (rateLimitMap.size > 500) {
    for (const [k, t] of rateLimitMap) {
      if (now - t > RATE_LIMIT_MS) rateLimitMap.delete(k);
    }
  }

  try {
    await resend.emails.send({
      from: FROM,
      to: TO,
      replyTo: email,
      subject: `Backbeat contact form: ${name}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;color:#1a1a1a">
          <h2 style="margin-bottom:4px">New contact form submission</h2>
          <hr style="border:none;border-top:1px solid #e5e5e5;margin:16px 0" />
          <p><strong>Name:</strong> ${escapeHtml(name)}</p>
          <p><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
          <p><strong>Message:</strong></p>
          <blockquote style="margin:0;padding:12px 16px;background:#f5f5f5;border-left:3px solid #C8A96E;white-space:pre-wrap">${escapeHtml(message)}</blockquote>
          <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0" />
          <p style="color:#9090aa;font-size:12px">Sent via the contact form at backbeat.video</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[contact] email send failed:", err);
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
