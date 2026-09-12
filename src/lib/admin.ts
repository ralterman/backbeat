/**
 * Server-side admin configuration.
 * Never import this from client components — it must stay server-only.
 *
 * Accounts listed here bypass plan-gating and usage limits so test uploads
 * don't consume credits.
 */
export const ADMIN_EMAILS: readonly string[] = [
  "robertdalterman@gmail.com",
];

export function isAdminEmail(email: string | null | undefined): boolean {
  return ADMIN_EMAILS.includes(email ?? "");
}
