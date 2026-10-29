"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

// Every word must fit beside "Upload your" on one line at 375 px (127 px of
// room at the phone headline size): "product video" (247 px), "highlight
// tape" and "game clip" (175 px) did not, so the mobile headline stays two
// lines with this set.
export const ROTATING_WORDS = ["video", "reel", "ad", "vlog"] as const;

/**
 * The rotating noun in the hero headline: "Upload your <word>." Holds each
 * word 2.2 s, swaps with a 250 ms vertical slide-and-fade, pauses while the
 * tab is hidden, and under prefers-reduced-motion shows "video" and never
 * rotates. Every word is laid out invisibly in the same grid cell, so the
 * cell is always as wide as the widest word and the line never reflows.
 */
export function RotatingWord({ className = "" }: { className?: string }) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduce) return;
    let timer: number | null = null;
    const start = () => { if (timer == null) timer = window.setInterval(() => setIndex((n) => (n + 1) % ROTATING_WORDS.length), 2200); };
    const stop = () => { if (timer != null) { window.clearInterval(timer); timer = null; } };
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);
    if (!document.hidden) start();
    return () => { stop(); document.removeEventListener("visibilitychange", onVisibility); };
  }, [reduce]);

  const word = reduce ? ROTATING_WORDS[0] : ROTATING_WORDS[index];

  return (
    <span className={`inline-grid align-top justify-items-center lg:justify-items-start ${className}`}>
      {ROTATING_WORDS.map((w) => (
        <span key={w} aria-hidden="true" className="invisible whitespace-nowrap [grid-area:1/1]">{w}.</span>
      ))}
      <span className="relative whitespace-nowrap [grid-area:1/1]">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={word}
            className="inline-block"
            initial={{ y: 14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -14, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            {word}.
          </motion.span>
        </AnimatePresence>
      </span>
    </span>
  );
}
