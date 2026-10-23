import { prisma } from "@/lib/prisma";
import type { Attribution } from "@/lib/attribution";
import { attributionToUserFields } from "@/lib/attribution";

/**
 * Server-side hand-off of first-touch attribution across the magic-link
 * round trip.
 *
 * The cookie-based capture (bb_attr → createUser) assumes the browser that
 * opens the sign-in link is the one that first visited the site. For magic
 * links that is often false: the link opens in a mail app's in-app browser,
 * which has no cookie, and the User row is created with nothing. So the
 * magic-link route stores the requesting browser's attribution here, keyed
 * by the normalized email, and createUser takes it from here first.
 *
 * Rows live as long as the link itself (24 h) and are deleted when read.
 * A request from an existing user leaves a row nobody consumes; the sweep
 * clears those once they expire.
 */

/** Matches the Auth.js email-provider token lifetime. */
export const PENDING_ATTRIBUTION_TTL_MS = 24 * 60 * 60 * 1000;

export async function storePendingAttribution(email: string, a: Attribution): Promise<void> {
  const f = attributionToUserFields(a);
  const data = {
    referrer: f.signupReferrer,
    landingPath: f.signupLandingPath,
    utmSource: f.utmSource,
    utmMedium: f.utmMedium,
    utmCampaign: f.utmCampaign,
    utmTerm: f.utmTerm,
    utmContent: f.utmContent,
    capturedAt: f.attributionCapturedAt,
    expires: new Date(Date.now() + PENDING_ATTRIBUTION_TTL_MS),
  };
  await prisma.magicLinkAttribution.upsert({
    where: { email },
    update: data,
    create: { email, ...data },
  });
}

/**
 * Return and delete the pending attribution for this email, or null when
 * there is none or it has expired. Deleting on read keeps the table small and
 * means a later, unrelated signup with the same address can't inherit it.
 */
export async function takePendingAttribution(email: string): Promise<Attribution | null> {
  const row = await prisma.magicLinkAttribution.findUnique({ where: { email } });
  if (!row) return null;
  await prisma.magicLinkAttribution.delete({ where: { email } }).catch(() => {});
  if (row.expires.getTime() < Date.now()) return null;
  const utm: Attribution["utm"] = {};
  if (row.utmSource) utm.utm_source = row.utmSource;
  if (row.utmMedium) utm.utm_medium = row.utmMedium;
  if (row.utmCampaign) utm.utm_campaign = row.utmCampaign;
  if (row.utmTerm) utm.utm_term = row.utmTerm;
  if (row.utmContent) utm.utm_content = row.utmContent;
  return {
    referrer: row.referrer ?? "",
    landingPath: row.landingPath ?? "",
    utm,
    capturedAt: row.capturedAt.toISOString(),
  };
}

/** Drop rows whose link has expired. Cheap (indexed) and safe to call often. */
export async function sweepExpiredAttribution(): Promise<void> {
  await prisma.magicLinkAttribution.deleteMany({ where: { expires: { lt: new Date() } } });
}
