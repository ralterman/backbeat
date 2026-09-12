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

/**
 * Build a rich, contextual music brief from Claude's structured analysis.
 * The more specific this description, the better ElevenLabs matches the video.
 */
export function buildMusicDescription(analysis: VideoAnalysis): string {
  const { mood_tags, bpm_range, energy_score, scene_tags, recommended_genres } = analysis;

  const energyPhrase =
    energy_score >= 8 ? "high-energy and driving" :
    energy_score >= 6 ? "moderately energetic and engaging" :
    energy_score >= 4 ? "relaxed and flowing" :
    "calm, ambient, and minimal";

  const genrePhrase =
    recommended_genres.length > 0 ? recommended_genres.join(" / ") : "instrumental";

  const desc =
    `${genrePhrase} background music with a ${mood_tags.join(", ")} mood. ` +
    `${energyPhrase} feel, ideal for ${scene_tags.join(", ")} video content. ` +
    `Tempo ${bpm_range.min}–${bpm_range.max} BPM, energy ${energy_score}/10. ` +
    `Instrumental only — no lyrics. Suitable for video background use.`;

  return desc.slice(0, 1000);
}

/**
 * Build up to 10 ElevenLabs music tags from Claude's analysis.
 */
export function buildMusicTags(analysis: VideoAnalysis): string[] {
  const candidates = [
    ...analysis.mood_tags,
    ...analysis.recommended_genres,
    ...analysis.scene_tags.slice(0, 2),
    analysis.energy_score >= 7 ? "energetic" :
    analysis.energy_score <= 3 ? "ambient" : "moderate",
    "background-music",
    "no-vocals",
  ].map((t) => t.toLowerCase().replace(/\s+/g, "-"));

  return [...new Set(candidates)].slice(0, 10);
}

/**
 * Generate a custom MP3 from a video buffer using the ElevenLabs
 * video-to-music API (Music v2 model, 192 kbps MP3).
 *
 * Throws with a user-friendly message on 403 or empty buffer.
 */
export async function generateMusicFromVideo(
  videoBuffer: Buffer,
  mimeType: string,
  analysis: VideoAnalysis
): Promise<GeneratedMusic> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not configured");
  }

  const description = buildMusicDescription(analysis);
  const tags = buildMusicTags(analysis);

  const formData = new FormData();
  // Buffer.from() creates a fresh copy backed by a plain ArrayBuffer (never SharedArrayBuffer)
  const freshBuf = Buffer.from(videoBuffer);
  const videoBlob = new Blob([freshBuf.buffer as ArrayBuffer], { type: mimeType || "video/mp4" });
  formData.append("videos[]", videoBlob, "video.mp4");
  formData.append("description", description);
  tags.forEach((tag) => formData.append("tags[]", tag));
  formData.append("model_id", "music_v2");

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
    throw new Error("ElevenLabs returned an empty audio buffer");
  }

  return { audioBuffer, description, tags };
}
