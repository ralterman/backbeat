"use client";

import { useEffect, useRef, useState } from "react";
import { DemoPlayer } from "./DemoPlayer";
import { ROW_CLIPS } from "./clips";
import { Reveal } from "@/components/motion/Reveal";

/**
 * Four more clips. Below lg they sit in one horizontally scrolling line:
 * each card is 75% of the viewport wide and snaps into place, with the next
 * card peeking in from the right so the row reads as swipeable; the
 * scrollbar is hidden. From lg it is the four-up grid. Nothing here is
 * fetched until the row is about to scroll into view (IntersectionObserver),
 * and even then the videos preload metadata only and start on tap.
 */
export function GenreRow() {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) { setMounted(true); return; }
    const io = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) { setMounted(true); io.disconnect(); } },
      { rootMargin: "400px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-none -mx-4 px-4 scroll-px-4 sm:-mx-6 sm:px-6 sm:scroll-px-6 lg:grid lg:grid-cols-4 lg:gap-6 lg:overflow-visible lg:mx-0 lg:px-0"
    >
      {ROW_CLIPS.map((clip, i) =>
        mounted ? (
          <Reveal key={clip.id} step={i} className="shrink-0 w-[75vw] snap-start lg:w-auto lg:shrink">
            <DemoPlayer clip={clip} variant="row" />
          </Reveal>
        ) : (
          <div key={clip.id} className="shrink-0 w-[75vw] snap-start lg:w-auto lg:shrink aspect-[9/16] rounded-2xl bg-[#141414] border border-[#2A2A2A]" aria-hidden="true" />
        )
      )}
    </div>
  );
}
