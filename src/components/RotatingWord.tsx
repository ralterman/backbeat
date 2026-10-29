"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

// Every word must fit beside "Upload your" on one line at 375 px (127 px of
// room at the phone headline size): "product video" (247 px), "highlight
// tape" and "game clip" (175 px) did not, so the mobile headline stays two
// lines with this set.
export const ROTATING_WORDS = ["video", "reel", "ad", "demo", "vlog", "clip"] as const;

/**
 * The rotating noun in the hero headline: "Upload your <word>." Holds each
 * word 2.2 s, swaps with a 250 ms vertical slide-and-fade, pauses while the
 * tab is hidden, and under prefers-reduced-motion shows "video" and never
 * rotates. The cell is a Framer layout-animated inline box, so its width
 * eases to each word's own width over the same 250 ms and "Upload your ad."
 * reads as one phrase with normal spacing. Only the width changes: the box
 * is one line tall whatever the word, so the second headline line never moves.
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
    <motion.span
      layout
      transition={{ layout: { duration: 0.25, ease: "easeOut" } }}
      className={`relative inline-flex align-top whitespace-nowrap ${className}`}
    >
      {/* popLayout lifts the leaving word out of flow, so the box is measured
          at the new word's width and the layout animation eases to it. The
          inner span carries `layout` too, so Framer counter-scales it and the
          glyphs are never stretched while the box resizes. */}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={word}
          layout
          className="inline-block"
          initial={{ y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -14, opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          {word}.
        </motion.span>
      </AnimatePresence>
    </motion.span>
  );
}
