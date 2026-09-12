"use client";

import { useEffect, useState } from "react";

const CONSENT_KEY = "backbeat_cookie_consent";

export type ConsentValue = "accepted" | "declined" | null;

export function useCookieConsent(): ConsentValue {
  const [consent, setConsent] = useState<ConsentValue>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CONSENT_KEY);
      if (stored === "accepted" || stored === "declined") setConsent(stored);
    } catch {}
  }, []);

  return consent;
}

export function CookieBanner({ onConsent }: { onConsent: (v: ConsentValue) => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CONSENT_KEY);
      if (!stored) setVisible(true);
    } catch {
      // If localStorage is unavailable (private mode etc.), don't show banner
    }
  }, []);

  const handle = (value: "accepted" | "declined") => {
    try {
      localStorage.setItem(CONSENT_KEY, value);
    } catch {}
    setVisible(false);
    onConsent(value);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-50 p-4"
    >
      <div className="max-w-3xl mx-auto bg-[#141414] border border-[#2A2A2A] rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 shadow-2xl">
        <p className="text-[#a0a0b8] text-sm leading-relaxed flex-1">
          We use cookies for authentication and optional analytics.{" "}
          <a href="/cookies" className="text-[#C8A96E] hover:underline">
            Cookie Policy
          </a>
        </p>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => handle("declined")}
            className="border border-[#2A2A2A] hover:border-[#9090aa] text-[#a0a0b8] hover:text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
          >
            Decline
          </button>
          <button
            onClick={() => handle("accepted")}
            className="bg-[#C8A96E] hover:bg-[#d4b87a] text-[#0a0a0a] text-sm font-bold px-5 py-2 rounded-xl transition-colors"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
