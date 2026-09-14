import { createHash } from "crypto";

/** sha256 hex of a raw token. Only the hash is stored; the raw token lives in the email link. */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Lowercase + trim. Every email comparison and write goes through this. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}
