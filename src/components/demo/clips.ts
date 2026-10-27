import type { DemoClip } from "./DemoPlayer";

/**
 * Demo media under public/demo. Clips are Pexels stock (free license,
 * commercial use allowed; sources and creators in DEMO_CLIPS.md). Every file
 * has its audio baked in: the row clips carry their generated Backbeat track
 * as the audio stream, and the hero comes as two files, the clip's own sound
 * and the same clip with the track mixed under it at the Balanced level
 * through the export route's ffmpeg chain.
 */
export const HERO_CLIP: DemoClip = {
  id: "hero",
  label: "Food",
  src: "/demo/hero-original.mp4",
  backbeatSrc: "/demo/hero-backbeat.mp4",
  poster: "/demo/hero.jpg",
};

export const ROW_CLIPS: DemoClip[] = [
  { id: "travel",   label: "Travel",  src: "/demo/travel.mp4",   poster: "/demo/travel.jpg" },
  { id: "product",  label: "Product", src: "/demo/product.mp4",  poster: "/demo/product.jpg" },
  { id: "sports",   label: "Sports",  src: "/demo/sports.mp4",   poster: "/demo/sports.jpg" },
  { id: "gameplay", label: "Gaming",  src: "/demo/gameplay.mp4", poster: "/demo/gameplay.jpg" },
];
