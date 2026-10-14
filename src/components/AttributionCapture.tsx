"use client";

import { useEffect } from "react";
import { ATTRIBUTION_COOKIE, ATTRIBUTION_MAX_AGE_S, buildAttribution, serializeAttribution } from "@/lib/attribution";

/**
 * Sets the first-touch attribution cookie on the first page view that
 * doesn't already have one. Renders nothing. Mounted once in the root
 * layout so it runs whichever page the visitor lands on.
 *
 * Not consent-gated: this is first-party, holds no identifier, and exists
 * only so a signup can be tied to how the person found the site. It is
 * read exactly once, when a User row is created.
 */
export function AttributionCapture() {
  useEffect(() => {
    try {
      if (document.cookie.split("; ").some((c) => c.startsWith(ATTRIBUTION_COOKIE + "="))) return;
      const a = buildAttribution({ referrer: document.referrer, href: location.href, origin: location.origin });
      const secure = location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `${ATTRIBUTION_COOKIE}=${serializeAttribution(a)}; Max-Age=${ATTRIBUTION_MAX_AGE_S}; Path=/; SameSite=Lax${secure}`;
    } catch {
      // Attribution is best-effort; never let it affect the page.
    }
  }, []);
  return null;
}
