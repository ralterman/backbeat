"use client";

import { useState } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { CookieBanner, ConsentValue } from "@/components/CookieBanner";

export function ConditionalAnalytics() {
  const [consent, setConsent] = useState<ConsentValue>(() => {
    // Read consent synchronously on first render (client only)
    if (typeof window === "undefined") return null;
    try {
      const stored = localStorage.getItem("backbeat_cookie_consent");
      if (stored === "accepted" || stored === "declined") return stored;
    } catch {}
    return null;
  });

  return (
    <>
      {consent === "accepted" && (
        <>
          <Analytics />
          <SpeedInsights />
        </>
      )}
      <CookieBanner onConsent={(v) => setConsent(v)} />
    </>
  );
}
