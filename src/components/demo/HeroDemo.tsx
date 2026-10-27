"use client";

import { DemoPlayer } from "./DemoPlayer";
import { HERO_CLIP } from "./clips";

/**
 * The hero's centerpiece: a clip with real sound, full preload, muted autoplay.
 *
 * From lg the hero is one screen tall (100svh minus the 4rem navbar), so the
 * card's height is what is left after the hero's 3rem of vertical padding
 * and the 102 px toggle + caption block; this column's width is that height
 * at 9:16 (at least 280 px), and the card simply fills the column. Setting
 * the width explicitly, rather than deriving it from a flexed height, keeps
 * the grid column the same width as the card on wide screens. Below lg it
 * is the plain stack.
 */
export function HeroDemo() {
  return (
    <div className="w-full max-w-[300px] sm:max-w-[320px] mx-auto lg:max-w-none lg:w-[max(280px,calc((100svh_-_7rem_-_102px)_*_9_/_16))]">
      <DemoPlayer clip={HERO_CLIP} variant="hero" />
      {/* min-h keeps this two lines tall, so the toggle + caption block stays
          102 px and the text column's centering offset holds at every width. */}
      <p className="text-[#6a6a8a] text-xs text-center mt-3 min-h-[32px]">
        <span className="text-[#a0a0b8]">Original</span> is the clip&rsquo;s own sound.{" "}
        <span className="text-[#a0a0b8]">With Backbeat</span> adds the generated track underneath it.
      </p>
    </div>
  );
}
