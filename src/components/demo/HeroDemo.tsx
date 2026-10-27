"use client";

import { DemoPlayer } from "./DemoPlayer";
import { HERO_CLIP } from "./clips";

/**
 * The hero's centerpiece: a clip with real sound, full preload, muted autoplay.
 * From lg this column fills the hero's height; the card takes what is left
 * after the toggle and caption and derives its width from 9:16 (at least
 * 280 px wide, so at least 498 px tall). Below lg it is the plain stack.
 */
export function HeroDemo() {
  return (
    <div className="w-full max-w-[300px] sm:max-w-[320px] mx-auto lg:max-w-none lg:w-auto lg:h-full lg:flex lg:flex-col lg:items-center">
      <DemoPlayer clip={HERO_CLIP} variant="hero" className="w-full lg:flex-1 lg:min-h-0" />
      <p className="text-[#6a6a8a] text-xs text-center mt-3 lg:shrink-0 lg:max-w-[340px]">
        <span className="text-[#a0a0b8]">Original</span> is the clip&rsquo;s own sound.{" "}
        <span className="text-[#a0a0b8]">With Backbeat</span> adds the generated track underneath it.
      </p>
    </div>
  );
}
