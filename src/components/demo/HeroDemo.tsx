"use client";

import { DemoPlayer } from "./DemoPlayer";
import { HERO_CLIP } from "./clips";

/** The hero's centerpiece: the product clip with real audio, full preload. */
export function HeroDemo() {
  return (
    <div className="w-full max-w-[300px] sm:max-w-[320px] mx-auto">
      <DemoPlayer clip={HERO_CLIP} variant="hero" />
      <p className="text-[#6a6a8a] text-xs text-center mt-3">
        Tap <span className="text-[#a0a0b8]">With Backbeat</span> to hear the generated track under the clip&rsquo;s own sound.
      </p>
    </div>
  );
}
