import type { DemoClip } from "./DemoPlayer";

/**
 * Demo media under public/demo. Clips are Pexels stock (free license,
 * commercial use allowed; sources and creators in DEMO_CLIPS.md). Tracks
 * are genuine Backbeat output: each clip was run through the same frame
 * extraction, Claude analysis and ElevenLabs generation the app uses.
 */
export const HERO_CLIP: DemoClip = {
  id: "product",
  label: "Product",
  src: "/demo/product.mp4",
  poster: "/demo/product.jpg",
  track: "/demo/product.mp3",
  hasOriginalAudio: true,
};

export const ROW_CLIPS: DemoClip[] = [
  { id: "travel",   label: "Travel",   src: "/demo/travel.mp4",   poster: "/demo/travel.jpg",   track: "/demo/travel.mp3",   hasOriginalAudio: false },
  { id: "food",     label: "Food",     src: "/demo/food.mp4",     poster: "/demo/food.jpg",     track: "/demo/food.mp3",     hasOriginalAudio: false },
  { id: "sports",   label: "Sports",   src: "/demo/sports.mp4",   poster: "/demo/sports.jpg",   track: "/demo/sports.mp3",   hasOriginalAudio: false },
  { id: "gameplay", label: "Gaming",   src: "/demo/gameplay.mp4", poster: "/demo/gameplay.jpg", track: "/demo/gameplay.mp3", hasOriginalAudio: false },
];
