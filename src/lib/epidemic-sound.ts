/**
 * Epidemic Sound Integration
 *
 * Automatically switches between mock and live mode based on the presence
 * of EPIDEMIC_SOUND_API_KEY in the environment.
 *
 * Mock mode  → scores the local placeholder track library (src/data/tracks.ts)
 * Live mode  → queries the Epidemic Sound API using analysis parameters
 *
 * To go live: add EPIDEMIC_SOUND_API_KEY=<your_key> to .env.local — no other changes needed.
 */

import { VideoAnalysis, ScoredTrack, scoreTrack } from "./matching";
import { tracks } from "@/data/tracks";

const API_KEY = process.env.EPIDEMIC_SOUND_API_KEY;

export async function fetchMatchedTracks(
  analysis: VideoAnalysis,
  topN: number
): Promise<ScoredTrack[]> {
  if (!API_KEY) {
    console.warn(
      "\n⚠️  [MOCK MODE - Epidemic Sound not connected]\n" +
      "   Returning placeholder tracks scored against your video analysis.\n" +
      "   To switch to live mode, add EPIDEMIC_SOUND_API_KEY to .env.local.\n"
    );
    return mockMatchedTracks(analysis, topN);
  }

  return liveMatchedTracks(analysis, topN);
}

// ---------------------------------------------------------------------------
// Mock mode — score the local placeholder library and return top N
// ---------------------------------------------------------------------------

function mockMatchedTracks(analysis: VideoAnalysis, topN: number): ScoredTrack[] {
  const scored = tracks.map((track) => scoreTrack(track, analysis));
  scored.sort((a, b) => b.match_score - a.match_score);
  return scored.slice(0, topN);
}

// ---------------------------------------------------------------------------
// Live mode — Epidemic Sound API
// ---------------------------------------------------------------------------

interface EpidemicTrack {
  id: string;
  title: string;
  bpm?: number;
  length?: number;
  energy?: number;
  mainArtists?: Array<{ name: string }>;
  genres?: Array<{ name: string }>;
  moods?: Array<{ name: string }>;
  stems?: Array<{ lossyUrl: string }>;
  previewUrl?: string;
}

interface EpidemicSearchResponse {
  results: EpidemicTrack[];
}

async function liveMatchedTracks(
  analysis: VideoAnalysis,
  topN: number
): Promise<ScoredTrack[]> {
  const params = new URLSearchParams({
    genres: analysis.recommended_genres.join(","),
    moods: analysis.mood_tags.join(","),
    bpmMin: String(analysis.bpm_range.min),
    bpmMax: String(analysis.bpm_range.max),
    limit: String(Math.max(topN * 2, 20)), // fetch extra to allow scoring + trimming
  });

  const res = await fetch(
    `https://api.epidemicsound.com/v2/tracks/search?${params}`,
    {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) {
    throw new Error(`Epidemic Sound API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as EpidemicSearchResponse;

  const mapped: ScoredTrack[] = data.results.map((item, i) => ({
    id: item.id,
    title: item.title,
    artist: item.mainArtists?.[0]?.name ?? "Unknown Artist",
    genre: item.genres?.[0]?.name?.toLowerCase() ?? analysis.recommended_genres[0] ?? "unknown",
    bpm: item.bpm ?? Math.round((analysis.bpm_range.min + analysis.bpm_range.max) / 2),
    duration_seconds: item.length ?? 180,
    mood_tags: item.moods?.map((m) => m.name.toLowerCase()) ?? analysis.mood_tags,
    energy_score: item.energy != null ? Math.round(item.energy * 10) : analysis.energy_score,
    preview_url: item.stems?.[0]?.lossyUrl ?? item.previewUrl ?? "",
    waveform_data: seededWaveform(item.id),
    match_score: Math.max(0, Math.min(100, 96 - i * 4)),
    score_breakdown: { mood: 0, bpm: 0, energy: 0, genre: 0 },
  }));

  return mapped.slice(0, topN);
}

// Deterministic waveform from a string seed
function seededWaveform(seed: string): number[] {
  let val = seed.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const bars: number[] = [];
  for (let i = 0; i < 60; i++) {
    val = ((val * 1103515245) + 12345) & 0x7fffffff;
    bars.push(Math.round((val % 80) + 10));
  }
  return bars;
}
