"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Fades its content up 16 px as it enters the viewport, once, over 400 ms;
 * `delay` (seconds) staggers siblings.
 *
 * Deliberately CSS + IntersectionObserver rather than a motion component:
 * the hidden starting state lives in a prefers-reduced-motion: no-preference
 * media query (globals.css), so reduced-motion users get the content with no
 * animation and nothing is ever server-rendered at opacity 0 for them. A
 * JS-driven initial style would have been baked into the HTML before the
 * preference could be read.
 */
export function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) { el.classList.add("is-visible"); return; }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { el.classList.add("is-visible"); io.disconnect(); }
    }, { rootMargin: "0px 0px -10% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${className}`} style={delay ? { transitionDelay: `${delay}s` } : undefined}>
      {children}
    </div>
  );
}
