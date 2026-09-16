import ffmpeg from "fluent-ffmpeg";

/**
 * Result of probing a media file with ffprobe.
 *
 * `hasAudioStream` is deliberately tri-state:
 *   true  — probe succeeded and the stream list contains an audio stream
 *   false — probe succeeded and the stream list contains NO audio stream
 *           (a positive finding; safe to persist)
 *   null  — probe failed, timed out, or returned no stream list: UNKNOWN.
 *           Callers must never treat this as "no audio". Both routes
 *           previously collapsed this case into a boolean, and the export
 *           route chose `false`, which permanently disabled the
 *           keep-original-audio toggle for videos that do have audio
 *           whenever ffprobe was unavailable.
 *
 * `durationSec` is null when unknown for the same reasons; callers pick
 * their own fallback.
 *
 * The caller is responsible for having called ffmpeg.setFfprobePath()
 * (both routes do so at module load).
 */
export interface ProbeResult {
  durationSec: number | null;
  hasAudioStream: boolean | null;
  /** Why the probe is unknown, for logging. null on success. */
  error: string | null;
}

export function probeMedia(inputPath: string, timeoutMs = 5000): Promise<ProbeResult> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (r: ProbeResult) => {
      if (settled) return;
      settled = true;
      resolve(r);
    };
    const t = setTimeout(
      () => done({ durationSec: null, hasAudioStream: null, error: `ffprobe timed out after ${timeoutMs}ms` }),
      timeoutMs
    );
    ffmpeg.ffprobe(inputPath, (err, meta) => {
      clearTimeout(t);
      if (err) {
        return done({ durationSec: null, hasAudioStream: null, error: err.message.split("\n")[0] });
      }
      if (!Array.isArray(meta?.streams)) {
        return done({ durationSec: null, hasAudioStream: null, error: "ffprobe returned no stream list" });
      }
      const d = meta.format?.duration;
      done({
        durationSec: typeof d === "number" && isFinite(d) && d > 0 ? d : null,
        hasAudioStream: meta.streams.some((s) => s.codec_type === "audio"),
        error: null,
      });
    });
  });
}
