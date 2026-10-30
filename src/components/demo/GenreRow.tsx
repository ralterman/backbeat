"use client";

import { useEffect, useRef, useState } from "react";
import { DemoPlayer } from "./DemoPlayer";
import { ROW_CLIPS } from "./clips";
import { Reveal } from "@/components/motion/Reveal";

/**
 * Four more clips. Below lg they sit in one horizontally scrolling line:
 * each card is 75% of the viewport wide at 9:16 and snaps into place, with
 * the next card peeking in from the right so the row reads as swipeable; the
 * scrollbar is hidden. From lg it is the four-up grid. Nothing here is
 * fetched until the row is about to scroll into view (IntersectionObserver),
 * and even then the videos preload metadata only and start on tap.
 *
 * The phone strip is a plain horizontal swipe and nothing else: it scrolls
 * on the x-axis only (touch-action pan-x pan-y, overflow-y hidden, and the
 * swipe does not chain into the page), every card is a fixed 75vw by
 * 75vw*16/9 box with flex: none, the strip reveals as one block rather than
 * card by card, and the cards carry no hover lift below lg (DemoPlayer). A
 * per-card reveal used to slide each card up 16 px as it was swiped into
 * view and, through that translate, gave the strip a vertical scroll range.
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

  const item = "flex-none w-[75vw] h-[calc(75vw*16/9)] snap-start lg:w-auto lg:h-auto";

  return (
    <Reveal>
      <div
        ref={ref}
        className="flex gap-4 overflow-x-auto overflow-y-hidden overscroll-x-contain touch-pan-x touch-pan-y snap-x snap-mandatory scrollbar-none -mx-4 px-4 scroll-px-4 sm:-mx-6 sm:px-6 sm:scroll-px-6 lg:grid lg:grid-cols-4 lg:gap-6 lg:overflow-visible lg:overscroll-x-auto lg:touch-auto lg:mx-0 lg:px-0"
      >
        {ROW_CLIPS.map((clip) =>
          mounted ? (
            <DemoPlayer key={clip.id} clip={clip} variant="row" className={item} />
          ) : (
            <div key={clip.id} className={`${item} lg:aspect-[9/16] rounded-2xl bg-[#141414] border border-[#2A2A2A]`} aria-hidden="true" />
          )
        )}
      </div>
    </Reveal>
  );
}
