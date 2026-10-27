"use client";

import { DemoPlayer } from "./DemoPlayer";
import { HERO_CLIP } from "./clips";

/**
 * The hero's centerpiece: a clip with real sound, full preload, muted autoplay.
 *
 * From lg the column is stretched to the grid row (whose height comes from
 * the text column alone, because this column's content is absolutely
 * positioned and so adds nothing to the row). Inside, the card takes the
 * height left over by the toggle and caption and derives its width from the
 * 9:16 ratio, so the icon top meets the card top and the caption bottom
 * meets the "No credit card required" line. Below lg it is the plain stack.
 */
export function HeroDemo() {
  return (
    <div className="w-full max-w-[300px] sm:max-w-[320px] mx-auto lg:max-w-none lg:w-[320px] lg:self-stretch lg:relative">
      <div className="flex flex-col items-center lg:absolute lg:inset-0">
        <DemoPlayer clip={HERO_CLIP} variant="hero" className="w-full lg:flex-1 lg:min-h-0" />
        <p className="text-[#6a6a8a] text-xs text-center mt-3 lg:shrink-0">
          <span className="text-[#a0a0b8]">Original</span> is the clip&rsquo;s own sound.{" "}
          <span className="text-[#a0a0b8]">With Backbeat</span> adds the generated track underneath it.
        </p>
      </div>
    </div>
  );
}
