"use client";

import { DemoPlayer } from "./DemoPlayer";
import { HERO_CLIP } from "./clips";

/** The hero's centerpiece: a clip with real sound, full preload, muted autoplay. */
export function HeroDemo() {
  return (
    <div className="w-full max-w-[300px] sm:max-w-[320px] mx-auto">
      <DemoPlayer clip={HERO_CLIP} variant="hero" />
      <p className="text-[#6a6a8a] text-xs text-center mt-3">
        <span className="text-[#a0a0b8]">Original</span> is the clip&rsquo;s own sound.{" "}
        <span className="text-[#a0a0b8]">With Backbeat</span> adds the generated track underneath it.
      </p>
    </div>
  );
}
