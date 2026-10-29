"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

// Every word must fit beside "Upload your" on one line at 375 px (127 px of
// room at the phone headline size): "product video" (247 px), "highlight
// tape" and "game clip" (175 px) did not, so the mobile headline stays two
// lines with this set.
export const ROTATING_WORDS = ["video", "reel", "ad", "demo", "vlog", "clip"] as const;

const DESKTOP = "(min-width: 1024px)";
const subscribeDesktop = (cb: () => void) => {
  const mq = window.matchMedia(DESKTOP);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
/** True from Tailwind's lg breakpoint; false on the server and before hydration. */
function useIsDesktop() {
  return useSyncExternalStore(subscribeDesktop, () => window.matchMedia(DESKTOP).matches, () => false);
}

/**
 * The hero headline's first line: "<lead> <word>." with a rotating noun.
 * Holds each word 2.2 s, swaps over 250 ms, pauses while the tab is hidden,
 * and under prefers-reduced-motion shows "video" and never rotates.
 *
 * Below lg the whole line sits in an inline box as wide as the widest
 * phrase (every phrase is laid out invisibly in one grid cell), text left-
 * aligned inside it and the box centered by the h1. So the lead never moves,
 * the word crossfades in place with no width change, and any spare room
 * sits at the right edge. From lg the box is plain inline and the word's
 * cell is a Framer layout-animated inline box whose width eases to each
 * word as it slides in, so "Upload your ad." reads with normal spacing.
 * Either way the line stays one line tall, so the second line never moves.
 */
export function RotatingHeadline({ lead }: { lead: string }) {
  const reduce = useReducedMotion();
  const desktop = useIsDesktop();
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
    <span className="inline-grid text-left lg:inline">
      {ROTATING_WORDS.map((w) => (
        <span key={w} aria-hidden="true" className="invisible whitespace-nowrap [grid-area:1/1] lg:hidden">{lead} {w}.</span>
      ))}
      <span className="whitespace-nowrap [grid-area:1/1]">
        {lead}{" "}
        {desktop ? (
          <motion.span
            layout
            transition={{ layout: { duration: 0.25, ease: "easeOut" } }}
            className="relative inline-flex align-top whitespace-nowrap"
          >
            {/* popLayout lifts the leaving word out of flow, so the box is
                measured at the new word's width and the layout animation
                eases to it. The inner span carries `layout` too, so Framer
                counter-scales it and the glyphs are never stretched. */}
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
        ) : (
          <span className="inline-grid align-top whitespace-nowrap">
            {/* Leaving and arriving words share one grid cell and crossfade. */}
            <AnimatePresence initial={false}>
              <motion.span
                key={word}
                className="[grid-area:1/1]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                {word}.
              </motion.span>
            </AnimatePresence>
          </span>
        )}
      </span>
    </span>
  );
}
