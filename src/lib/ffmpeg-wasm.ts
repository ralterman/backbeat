/**
 * Shared @ffmpeg/ffmpeg WASM singleton.
 *
 * The loaded instance is cached at module level so warm Vercel function
 * invocations (same Node.js process) skip the ~2-3 s WASM download.
 */

import { FFmpeg } from "@ffmpeg/ffmpeg";

const CORE_VERSION = "0.12.10";
const CDN = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd`;

let instance: FFmpeg | null = null;
let loadPromise: Promise<boolean> | null = null;

export async function getFFmpeg(): Promise<FFmpeg> {
  if (!instance) {
    instance = new FFmpeg();
  }

  if (!loadPromise) {
    loadPromise = instance
      .load({
        coreURL: `${CDN}/ffmpeg-core.js`,
        wasmURL: `${CDN}/ffmpeg-core.wasm`,
      })
      .catch((err: unknown) => {
        // Reset so the next call retries
        instance = null;
        loadPromise = null;
        throw err;
      });
  }

  await loadPromise;
  return instance!;
}
