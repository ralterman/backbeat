"use client";

import React, { useEffect, useRef } from "react";

/**
 * Cloudflare Turnstile widget (explicit render mode).
 *
 * Renders nothing when NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset, so the form
 * keeps working before the keys are configured; the server skips
 * verification in the same case. Tokens are single-use, so the parent
 * resets the widget (via the handle in onReady) after any failed submit.
 */

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export interface TurnstileHandle {
  reset: () => void;
}

interface TurnstileProps {
  onToken: (token: string | null) => void;
  onReady?: (handle: TurnstileHandle) => void;
}

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
  return new Promise((resolve, reject) => {
    const s = existing ?? document.createElement("script");
    const done = () => resolve();
    s.addEventListener("load", done, { once: true });
    s.addEventListener("error", () => reject(new Error("Turnstile script failed to load")), { once: true });
    if (!existing) {
      s.src = SCRIPT_SRC;
      s.async = true;
      s.defer = true;
      document.head.appendChild(s);
    } else if (window.turnstile) {
      done();
    }
  });
}

export function Turnstile({ onToken, onReady }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  // Keep the latest callbacks without re-rendering the widget.
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !containerRef.current) return;
    let cancelled = false;

    loadScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: "dark",
          callback: (token: string) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(null),
          "error-callback": () => onTokenRef.current(null),
        });
        onReady?.({
          reset: () => {
            if (widgetIdRef.current && window.turnstile) window.turnstile.reset(widgetIdRef.current);
            onTokenRef.current(null);
          },
        });
      })
      .catch((err) => console.error("[turnstile]", err));

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current); } catch {}
        widgetIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={containerRef} className="min-h-[65px]" />;
}
