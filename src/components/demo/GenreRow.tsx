"use client";

import { useEffect, useRef, useState } from "react";
import { DemoPlayer } from "./DemoPlayer";
import { ROW_CLIPS } from "./clips";

/**
 * Four more clips, two-up on phones, four-up from md. Nothing here is
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
    <div ref={ref} className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
      {ROW_CLIPS.map((clip) =>
        mounted ? (
          <DemoPlayer key={clip.id} clip={clip} variant="row" />
        ) : (
          <div key={clip.id} className="aspect-[9/16] rounded-2xl bg-[#141414] border border-[#2A2A2A]" aria-hidden="true" />
        )
      )}
    </div>
  );
}
