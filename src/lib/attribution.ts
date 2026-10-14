/**
 * First-touch signup attribution.
 *
 * Client (AttributionCapture): on the first page view that has no bb_attr
 * cookie, record the external referrer, the landing path (with query) and
 * any utm_* params into the cookie. First touch only — later visits never
 * overwrite it.
 *
 * Server (auth.ts createUser event): when a User row is created, parse the
 * cookie and copy it onto the row. Users whose first visit predates this
 * have nothing, which is the honest answer.
 *
 * The pure functions here (build/serialize/parse) have no browser or server
 * dependencies so they can be unit-tested; only applyAttributionToUser
 * touches the database.
 */

export const ATTRIBUTION_COOKIE = "bb_attr";
export const ATTRIBUTION_MAX_AGE_S = 30 * 24 * 60 * 60; // 30 days

const MAX_LEN = 500;
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

export interface Attribution {
  /** External referrer URL, or "" for direct / same-origin. */
  referrer: string;
  /** Path + query of the first page viewed. */
  landingPath: string;
  utm: Partial<Record<(typeof UTM_KEYS)[number], string>>;
  /** ISO timestamp of the first touch. */
  capturedAt: string;
}

const clip = (s: string) => (s.length > MAX_LEN ? s.slice(0, MAX_LEN) : s);

/** Pure. `origin` is the site's own origin so same-site referrers read as direct. */
export function buildAttribution(input: { referrer: string; href: string; origin: string; now?: Date }): Attribution {
  const url = new URL(input.href);
  const ref = input.referrer || "";
  const sameOrigin = ref.startsWith(input.origin + "/") || ref === input.origin;
  const utm: Attribution["utm"] = {};
  for (const k of UTM_KEYS) {
    const v = url.searchParams.get(k);
    if (v) utm[k] = clip(v);
  }
  return {
    referrer: sameOrigin ? "" : clip(ref),
    landingPath: clip(url.pathname + url.search),
    utm,
    capturedAt: (input.now ?? new Date()).toISOString(),
  };
}

export function serializeAttribution(a: Attribution): string {
  return encodeURIComponent(JSON.stringify(a));
}

/** Pure. Tolerates garbage: returns null for anything that doesn't parse to the expected shape. */
export function parseAttributionCookie(raw: string | undefined | null): Attribution | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(decodeURIComponent(raw)) as Partial<Attribution>;
    if (typeof o !== "object" || o === null) return null;
    const utm: Attribution["utm"] = {};
    if (o.utm && typeof o.utm === "object") {
      for (const k of UTM_KEYS) {
        const v = (o.utm as Record<string, unknown>)[k];
        if (typeof v === "string" && v) utm[k] = clip(v);
      }
    }
    return {
      referrer: typeof o.referrer === "string" ? clip(o.referrer) : "",
      landingPath: typeof o.landingPath === "string" ? clip(o.landingPath) : "",
      utm,
      capturedAt: typeof o.capturedAt === "string" && !isNaN(Date.parse(o.capturedAt)) ? o.capturedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/** Shape written to the User row. Exported so the DB write can be tested without auth. */
export function attributionToUserFields(a: Attribution) {
  return {
    signupReferrer: a.referrer || null,
    signupLandingPath: a.landingPath || null,
    utmSource: a.utm.utm_source ?? null,
    utmMedium: a.utm.utm_medium ?? null,
    utmCampaign: a.utm.utm_campaign ?? null,
    utmTerm: a.utm.utm_term ?? null,
    utmContent: a.utm.utm_content ?? null,
    attributionCapturedAt: new Date(a.capturedAt),
  };
}
