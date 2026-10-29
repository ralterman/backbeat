"use client";

import { useEffect, useRef, type ReactNode } from "react";

const DESKTOP = "(min-width: 1024px)";

/**
 * Fades its content up 16 px as it enters the viewport, once, over 400 ms.
 * `step` staggers siblings: 60 ms apart from lg; 30 ms apart below lg, where
 * no section's stagger runs past 200 ms. Below lg the reveal also starts
 * early, when the element's top is still 15% of the viewport below the
 * bottom edge, so content is visible by the time it reaches mid-screen even
 * while the hero video is playing; from lg it waits until 10% is in view.
 *
 * Deliberately CSS + IntersectionObserver rather than a motion component:
 * the hidden starting state lives in a prefers-reduced-motion: no-preference
 * media query (globals.css), so reduced-motion users get the content with no
 * animation and nothing is ever server-rendered at opacity 0 for them. A
 * JS-driven initial style would have been baked into the HTML before the
 * preference could be read.
 */
export function Reveal({ children, step = 0, className = "" }: { children: ReactNode; step?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) { el.classList.add("is-visible"); return; }
    const desktop = window.matchMedia(DESKTOP).matches;
    const delay = desktop ? step * 60 : Math.min(step * 30, 200);
    el.style.transitionDelay = delay ? `${delay}ms` : "";
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { el.classList.add("is-visible"); io.disconnect(); }
    }, { rootMargin: desktop ? "0px 0px -10% 0px" : "0px 0px 15% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [step]);
  return (
    <div ref={ref} className={`reveal ${className}`}>
      {children}
    </div>
  );
}
