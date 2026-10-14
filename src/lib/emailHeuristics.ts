/**
 * Cheap, pure checks on a sign-in email address, run before a magic link is
 * sent. Unit-tested; no I/O.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

/** Max dots allowed in a Gmail local part. Gmail ignores dots entirely, so
 *  "j.o.h.n.smith@gmail.com" is the same inbox as "johnsmith@gmail.com" —
 *  bots exploit that to mint unlimited "distinct" addresses. Real people
 *  rarely have more than two. */
export const MAX_GMAIL_DOTS = 2;

export const GMAIL_VARIANT_MESSAGE =
  "Please use your plain Gmail address — without extra dots or a +tag.";

/** Returns a user-facing error, or null if the address is acceptable. */
export function validateSignInEmail(raw: string | undefined | null): string | null {
  const email = (raw ?? "").trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) return "Please enter a valid email address.";

  const [local, domain] = email.split("@");
  if (GMAIL_DOMAINS.has(domain)) {
    const dots = (local.match(/\./g) ?? []).length;
    if (dots > MAX_GMAIL_DOTS || local.includes("+")) return GMAIL_VARIANT_MESSAGE;
  }
  return null;
}

/** Normalized form used for the actual send. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}
