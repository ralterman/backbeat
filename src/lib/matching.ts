import { tracks, Track } from "@/data/tracks";

export interface VideoAnalysis {
  mood_tags: string[];
  bpm_range: { min: number; max: number };
  energy_score: number;
  scene_tags: string[];
  recommended_genres: string[];
}

export interface ScoredTrack extends Track {
  match_score: number;
  score_breakdown: {
    mood: number;
    bpm: number;
    energy: number;
    genre: number;
  };
}

/**
 * Compute Jaccard similarity between two string arrays.
 */
function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const setA = new Set(a.map((s) => s.toLowerCase()));
  const setB = new Set(b.map((s) => s.toLowerCase()));
  const intersection = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Score a track against the video analysis result.
 * Returns a value 0–100.
 */
export function scoreTrack(track: Track, analysis: VideoAnalysis): ScoredTrack {
  // Mood similarity (0-1)
  const moodScore =
    jaccardSimilarity(track.mood_tags, [
      ...analysis.mood_tags,
      ...analysis.scene_tags,
    ]) * 100;

  // BPM compatibility (0-1)
  // Score full points if track BPM falls within the detected range; graceful falloff outside
  const { min: bpmMin, max: bpmMax } = analysis.bpm_range;
  let bpmScore: number;
  if (track.bpm >= bpmMin && track.bpm <= bpmMax) {
    bpmScore = 100;
  } else {
    const midpoint = (bpmMin + bpmMax) / 2;
    const range = Math.max(bpmMax - bpmMin, 20); // floor range to avoid division issues
    const distance = Math.abs(track.bpm - midpoint);
    bpmScore = Math.max(0, 100 - (distance / range) * 100);
  }

  // Energy compatibility – closer to video energy = better (0-100)
  const energyDiff = Math.abs(track.energy_score - analysis.energy_score);
  const energyScore = Math.max(0, 100 - energyDiff * 12);

  // Genre match (0 or 100, with partial credit via substring)
  const recGenresLower = analysis.recommended_genres.map((g) => g.toLowerCase());
  const trackGenreLower = track.genre.toLowerCase();
  let genreScore = 0;
  if (recGenresLower.includes(trackGenreLower)) {
    genreScore = 100;
  } else if (
    recGenresLower.some(
      (g) => g.includes(trackGenreLower) || trackGenreLower.includes(g)
    )
  ) {
    genreScore = 60;
  }

  // Weighted average
  const weights = { mood: 0.35, bpm: 0.2, energy: 0.3, genre: 0.15 };
  const finalScore =
    moodScore * weights.mood +
    bpmScore * weights.bpm +
    energyScore * weights.energy +
    genreScore * weights.genre;

  return {
    ...track,
    match_score: Math.round(Math.min(100, Math.max(0, finalScore))),
    score_breakdown: {
      mood: Math.round(moodScore),
      bpm: Math.round(bpmScore),
      energy: Math.round(energyScore),
      genre: Math.round(genreScore),
    },
  };
}

/**
 * Return the top N tracks sorted by match score.
 */
export function matchTracks(
  analysis: VideoAnalysis,
  topN: number = 5
): ScoredTrack[] {
  const scored = tracks.map((track) => scoreTrack(track, analysis));
  scored.sort((a, b) => b.match_score - a.match_score);
  return scored.slice(0, topN);
}
