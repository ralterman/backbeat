"use client";

import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { CookieBanner, ConsentValue } from "@/components/CookieBanner";

export function ConditionalAnalytics() {
  // Consent is read after mount, never during render: the server renders
  // nothing here, and reading localStorage in the first client render made
  // the client tree differ from the server's for anyone who had accepted,
  // which React reports as a hydration mismatch and re-renders the tree.
  const [consent, setConsent] = useState<ConsentValue>(null);
  useEffect(() => {
    try {
      const stored = localStorage.getItem("backbeat_cookie_consent");
      if (stored === "accepted" || stored === "declined") setConsent(stored);
    } catch {}
  }, []);

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
