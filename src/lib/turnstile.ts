/**
 * Cloudflare Turnstile server-side verification.
 * https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 *
 * The secret lives only here (server). The matching public site key is
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY, read by the client widget.
 */

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface TurnstileResult {
  ok: boolean;
  /** Cloudflare's error codes, or our own ("missing-input-response",
   *  "verify-unreachable") when the request never got that far. */
  errors: string[];
}

/** Whether a secret is configured at all. When it isn't, the route skips
 *  Turnstile (and the form doesn't render the widget) rather than locking
 *  everyone out — the other three protections still apply. Logged loudly. */
export function turnstileConfigured(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY;
}

export async function verifyTurnstile(
  token: string | undefined,
  remoteIp: string | null,
  secret = process.env.TURNSTILE_SECRET_KEY
): Promise<TurnstileResult> {
  if (!secret) return { ok: false, errors: ["missing-secret"] };
  if (!token) return { ok: false, errors: ["missing-input-response"] };

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(8000),
    });
    const json = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    return { ok: json.success === true, errors: json["error-codes"] ?? [] };
  } catch (err) {
    return { ok: false, errors: ["verify-unreachable", err instanceof Error ? err.message : String(err)] };
  }
}
