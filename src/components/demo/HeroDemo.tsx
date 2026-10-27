"use client";

import { DemoPlayer } from "./DemoPlayer";
import { HERO_CLIP } from "./clips";

/**
 * The hero's centerpiece: a clip with real sound, full preload, muted autoplay.
 * From lg the card is a fixed 340 px wide (604 px tall at 9:16); the grid
 * top-aligns the columns so the lockup icon's top meets the card's top, and
 * this column simply runs as tall as it needs to.
 */
export function HeroDemo() {
  return (
    <div className="w-full max-w-[300px] sm:max-w-[320px] lg:max-w-none lg:w-[340px] mx-auto">
      <DemoPlayer clip={HERO_CLIP} variant="hero" />
      <p className="text-[#6a6a8a] text-xs text-center mt-3">
        <span className="text-[#a0a0b8]">Original</span> is the clip&rsquo;s own sound.{" "}
        <span className="text-[#a0a0b8]">With Backbeat</span> adds the generated track underneath it.
      </p>
    </div>
  );
}
