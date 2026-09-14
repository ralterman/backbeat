/**
 * ElevenLabs video-to-music integration.
 *
 * Converts a Claude VideoAnalysis into a music description + tags,
 * then calls the ElevenLabs Music v2 API to generate a custom MP3
 * that matches the video's mood, energy, and scene context.
 */

import { VideoAnalysis } from "@/lib/analyze";

export interface GeneratedMusic {
  audioBuffer: ArrayBuffer;
  description: string;
  tags: string[];
}

export interface GeneratedMusicOptions {
  option1: GeneratedMusic;
  option2: GeneratedMusic;
}

// ── Description builders ──────────────────────────────────────────────────────

/**
 * Build a rich, contextual music brief from Claude's structured analysis.
 * The more specific this description, the better ElevenLabs matches the video.
 */
export function buildMusicDescription(analysis: VideoAnalysis, includeVocals = false): string {
  const { mood_tags, bpm_range, energy_score, scene_tags, recommended_genres } = analysis;

  const energyPhrase =
    energy_score >= 8 ? "high-energy and driving" :
    energy_score >= 6 ? "moderately energetic and engaging" :
    energy_score >= 4 ? "relaxed and flowing" :
    "calm, ambient, and minimal";

  const genrePhrase =
    recommended_genres.length > 0 ? recommended_genres.join(" / ") : "instrumental";

  const vocalInstruction = includeVocals
    ? "Include sung vocals with lyrics that match the mood and scene. Natural voice, not robotic."
    : "Instrumental only — no lyrics. Suitable for video background use.";

  const desc =
    `${genrePhrase} background music with a ${mood_tags.join(", ")} mood. ` +
    `${energyPhrase} feel, ideal for ${scene_tags.join(", ")} video content. ` +
    `Tempo ${bpm_range.min}–${bpm_range.max} BPM, energy ${energy_score}/10. ` +
    `${vocalInstruction}`;

  return desc.slice(0, 1000);
}

/**
 * Build an alternative, more cinematic/orchestral description for option 2.
 */
export function buildAlternativeMusicDescription(analysis: VideoAnalysis, includeVocals = false): string {
  const { mood_tags, bpm_range, energy_score, scene_tags, recommended_genres } = analysis;

  const energyPhrase =
    energy_score >= 8 ? "epic and powerful" :
    energy_score >= 6 ? "cinematic and emotive" :
    energy_score >= 4 ? "atmospheric and introspective" :
    "delicate, sparse, and meditative";

  const altGenres = ["cinematic", "orchestral", ...recommended_genres].slice(0, 3);
  const genrePhrase = altGenres.join(" / ");

  const vocalInstruction = includeVocals
    ? "Rich orchestration with sung vocals — lyrics that match the mood and scene. Natural voice, not robotic."
    : "Full orchestration, no lyrics. Perfect for cinematic video overlay.";

  const desc =
    `${genrePhrase} score with a ${mood_tags.join(", ")} emotional tone. ` +
    `${energyPhrase} composition for ${scene_tags.join(", ")} visuals. ` +
    `Tempo ${bpm_range.min}–${bpm_range.max} BPM, energy ${energy_score}/10. ` +
    `${vocalInstruction}`;

  return desc.slice(0, 1000);
}

// ── Tag builders ──────────────────────────────────────────────────────────────

/**
 * Build up to 10 ElevenLabs music tags from Claude's analysis (option 1).
 */
export function buildMusicTags(analysis: VideoAnalysis, includeVocals = false): string[] {
  const candidates = [
    ...analysis.mood_tags,
    ...analysis.recommended_genres,
    ...analysis.scene_tags.slice(0, 2),
    analysis.energy_score >= 7 ? "energetic" :
    analysis.energy_score <= 3 ? "ambient" : "moderate",
    "background-music",
    includeVocals ? "vocals" : "no-vocals",
  ].map((t) => t.toLowerCase().replace(/\s+/g, "-"));

  return [...new Set(candidates)].slice(0, 10);
}

/**
 * Build alternative tags tilted toward cinematic/orchestral for option 2.
 */
export function buildAlternativeMusicTags(analysis: VideoAnalysis, includeVocals = false): string[] {
  const candidates = [
    "cinematic",
    "orchestral",
    ...analysis.mood_tags,
    ...analysis.scene_tags.slice(0, 2),
    includeVocals ? "vocals" : "no-vocals",
    "score",
    analysis.energy_score >= 7 ? "epic" : "ambient",
  ].map((t) => t.toLowerCase().replace(/\s+/g, "-"));

  return [...new Set(candidates)].slice(0, 10);
}

// ── Core API call ─────────────────────────────────────────────────────────────

/**
 * Low-level: POST to ElevenLabs video-to-music with explicit description + tags.
 * Throws with a user-friendly message on 403 or empty buffer.
 */
async function callElevenLabsMusicAPI(
  videoBuffer: Buffer,
  mimeType: string,
  description: string,
  tags: string[],
  label = ""
): Promise<ArrayBuffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not configured");

  if (!videoBuffer || videoBuffer.length === 0) {
    throw new Error("Video buffer is empty — S3 fetch may have failed");
  }

  const formData = new FormData();
  // Buffer.from() creates a fresh copy backed by a plain ArrayBuffer (never SharedArrayBuffer)
  const freshBuf = Buffer.from(videoBuffer);
  const videoBlob = new Blob([freshBuf.buffer as ArrayBuffer], { type: mimeType || "video/mp4" });

  // ElevenLabs expects the field names 'videos' and 'tags' (not 'videos[]' / 'tags[]')
  formData.append("videos", videoBlob, "video.mp4");
  formData.append("description", description);
  tags.forEach((tag) => formData.append("tags", tag));
  formData.append("model_id", "music_v2");

  console.log(`[elevenlabs${label}] videoBlob: ${videoBlob.size}b, desc (${description.length} ch): ${description.slice(0, 80)}...`);
  console.log(`[elevenlabs${label}] tags: ${tags.join(", ")}`);
  console.log(`[elevenlabs${label}] calling video-to-music API...`);

  const response = await fetch(
    "https://api.elevenlabs.io/v1/music/video-to-music?output_format=mp3_44100_192",
    {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: formData,
    }
  );

  if (response.status === 403) {
    throw new Error("Music generation unavailable — please try again shortly.");
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "(no body)");
    throw new Error(`ElevenLabs error (${response.status}): ${errText}`);
  }

  const audioBuffer = await response.arrayBuffer();

  if (!audioBuffer || audioBuffer.byteLength === 0) {
    throw new Error(`ElevenLabs returned an empty audio buffer${label ? ` (${label})` : ""}`);
  }

  return audioBuffer;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate a single custom MP3 from a video buffer.
 * Uses the primary genre-matched music style.
 */
export async function generateMusicFromVideo(
  videoBuffer: Buffer,
  mimeType: string,
  analysis: VideoAnalysis
): Promise<GeneratedMusic> {
  const description = buildMusicDescription(analysis);
  const tags = buildMusicTags(analysis);
  const audioBuffer = await callElevenLabsMusicAPI(videoBuffer, mimeType, description, tags);
  return { audioBuffer, description, tags };
}

/**
 * Generate TWO music options in parallel from the same video:
 *   Option 1 — primary genre match
 *   Option 2 — cinematic / orchestral alternative
 *
 * Both API calls fire simultaneously; total time ≈ time of the slower call.
 */
export async function generateMusicOptionsFromVideo(
  videoBuffer: Buffer,
  mimeType: string,
  analysis: VideoAnalysis,
  includeVocals = false
): Promise<GeneratedMusicOptions> {
  console.log(`[elevenlabs] generateMusicOptionsFromVideo: includeVocals=${includeVocals}`);
  const desc1 = buildMusicDescription(analysis, includeVocals);
  const tags1 = buildMusicTags(analysis, includeVocals);
  const desc2 = buildAlternativeMusicDescription(analysis, includeVocals);
  const tags2 = buildAlternativeMusicTags(analysis, includeVocals);

  const [buf1, buf2] = await Promise.all([
    callElevenLabsMusicAPI(videoBuffer, mimeType, desc1, tags1, ":opt1"),
    callElevenLabsMusicAPI(videoBuffer, mimeType, desc2, tags2, ":opt2"),
  ]);

  return {
    option1: { audioBuffer: buf1, description: desc1, tags: tags1 },
    option2: { audioBuffer: buf2, description: desc2, tags: tags2 },
  };
}
