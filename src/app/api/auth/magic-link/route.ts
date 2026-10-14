import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { validateSignInEmail, normalizeEmail } from "@/lib/emailHeuristics";
import { verifyTurnstile, turnstileConfigured } from "@/lib/turnstile";

/**
 * Sends a magic link, after the checks Auth.js's own signin endpoint can't
 * do: Turnstile verification and the Gmail-variant rule. Both sign-in pages
 * and the resend button post here instead of calling next-auth's client
 * signIn("resend") directly. The actual token + email still go through
 * Auth.js (server-side signIn → ResendProvider.sendVerificationRequest).
 *
 * Note: this path is /api/auth/magic-link; Next prefers the static segment
 * over Auth.js's [...nextauth] catch-all.
 */

function clientIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim() || null;
  return req.headers.get("x-real-ip");
}

/** Only same-site paths; anything else falls back, so this can't open-redirect. */
function safeCallbackUrl(v: unknown): string {
  return typeof v === "string" && v.startsWith("/") && !v.startsWith("//") ? v : "/dashboard";
}

export async function POST(req: NextRequest) {
  let body: { email?: string; callbackUrl?: string; turnstileToken?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const emailError = validateSignInEmail(body.email);
  if (emailError) {
    return NextResponse.json({ error: emailError }, { status: 400 });
  }
  const email = normalizeEmail(body.email!);
  const callbackUrl = safeCallbackUrl(body.callbackUrl);

  if (turnstileConfigured()) {
    const result = await verifyTurnstile(body.turnstileToken, clientIp(req));
    if (!result.ok) {
      console.log(`[magic-link] turnstile rejected for ${email.split("@")[1]} (ip=${clientIp(req) ?? "?"}): ${result.errors.join(",")}`);
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
    console.warn("[magic-link] TURNSTILE_SECRET_KEY is not set — Turnstile verification skipped");
  }

  try {
    // redirect:false → resolves with the verify-request URL instead of
    // throwing NEXT_REDIRECT; we only care that the send happened.
    await signIn("resend", { email, redirect: false, redirectTo: callbackUrl });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const detail = err instanceof AuthError ? err.type : err instanceof Error ? err.message : String(err);
    console.error(`[magic-link] send failed for ${email.split("@")[1]}: ${detail}`);
    return NextResponse.json(
      { error: "We couldn't send the sign-in email right now. Please try again, or continue with Google." },
      { status: 500 }
    );
  }
}
