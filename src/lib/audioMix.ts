/**
 * Shared between the export route (server, ffmpeg) and the results-page
 * player (client, HTMLMediaElement.volume) so the in-browser preview and the
 * actual export use the exact same relative music level — one source of truth
 * instead of two hand-copied number tables that could drift apart.
 */

export type AudioMode = "mix" | "replace";
export type MusicLevel = "quiet" | "balanced" | "loud";

/** Music gain in dB relative to the original audio track, applied only in "mix" mode. */
export const MUSIC_GAIN_DB: Record<MusicLevel, number> = {
  quiet: -20,
  balanced: -14,
  loud: -8,
};

/**
 * The same gains as linear amplitude (0..1), for HTMLMediaElement.volume.
 * volume(linear) = 10 ^ (dB / 20)
 */
export const MUSIC_GAIN_LINEAR: Record<MusicLevel, number> = Object.fromEntries(
  (Object.entries(MUSIC_GAIN_DB) as [MusicLevel, number][]).map(
    ([level, db]) => [level, Math.pow(10, db / 20)]
  )
) as Record<MusicLevel, number>;

export const DEFAULT_AUDIO_MODE: AudioMode = "mix";
export const DEFAULT_MUSIC_LEVEL: MusicLevel = "balanced";

export function isAudioMode(v: unknown): v is AudioMode {
  return v === "mix" || v === "replace";
}

export function isMusicLevel(v: unknown): v is MusicLevel {
  return v === "quiet" || v === "balanced" || v === "loud";
}
