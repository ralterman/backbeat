"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { TrackCard } from "@/components/TrackCard";
import { SyncedPreviewPlayer } from "@/components/SyncedPreviewPlayer";
import { Track } from "@/data/tracks";
import { ScoredTrack } from "@/lib/matching";

interface AnalysisData {
  id: string;
  moodTags: string[];
  bpmRange: { min: number; max: number };
  energyScore: number;
  sceneTags: string[];
  recommendedGenres: string[];
}

interface TrackMatch {
  id: string;
  trackId: string;
  matchScore: number;
  rank: number;
  track: Track & { match_score: number; score_breakdown: { mood: number; bpm: number; energy: number; genre: number } };
}

interface AnalysisResponse {
  status: string;
  videoId: string;
  analysis?: AnalysisData;
  matches?: TrackMatch[];
}

export default function AnalysisResultsPage() {
  const params = useParams<{ id: string }>();
  const videoId = params.id;

  const [data, setData] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [exportResult, setExportResult] = useState<{ trackId: string; exportId: string } | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [previewTrack, setPreviewTrack] = useState<ScoredTrack | null>(null);
  const [isFreeUser, setIsFreeUser] = useState(true); // default to true (restrictive) until confirmed

  const fetchResults = useCallback(async () => {
    try {
      const res = await fetch(`/api/analyze/${videoId}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to load results");
      }
      const json = (await res.json()) as AnalysisResponse;
      setData(json);
      if (json.status === "completed") setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load results");
      setLoading(false);
    }
  }, [videoId]);

  useEffect(() => {
    fetchResults();
    const interval = setInterval(() => {
      if (data?.status !== "completed") fetchResults();
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchResults, data?.status]);

  useEffect(() => {
    fetch(`/api/videos/${videoId}`)
      .then((r) => {
        if (!r.ok) { console.error("[backbeat] video URL fetch failed:", r.status); return null; }
        return r.json();
      })
      .then((json) => {
        console.log("[backbeat] video URL response:", json);
        if (json?.playbackUrl) setVideoUrl(json.playbackUrl);
      })
      .catch((e) => console.error("[backbeat] video URL error:", e));

    fetch("/api/user/usage")
      .then((r) => r.ok ? r.json() : null)
      .then((json) => { if (json?.plan) setIsFreeUser(json.plan === "FREE"); })
      .catch(() => {}); // leave as true (restrictive default) on error
  }, [videoId]);

  const handlePreview = useCallback((track: ScoredTrack) => {
    setPreviewTrack((prev) => (prev?.id === track.id ? null : track));
  }, []);

  const handleExport = async (trackId: string) => {
    setExportingId(trackId);
    setExportResult(null);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId, trackId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Export failed");
      }
      const { exportId } = await res.json();
      setExportResult({ trackId, exportId });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExportingId(null);
    }
  };

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="bg-red-900/20 border border-red-800/30 rounded-2xl p-10">
          <p className="text-red-400 text-lg font-medium mb-4">{error}</p>
          <Link href="/dashboard" className="text-[#C8A96E] hover:text-white transition-colors">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (loading || !data?.analysis) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-20 h-20 bg-[#C8A96E]/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-[#C8A96E] animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
          </svg>
        </div>
        <h2 className="text-white text-2xl font-bold mb-2">Analyzing your video...</h2>
        <p className="text-[#a0a0b8]">
          Claude is extracting frames and identifying the perfect music for your content. This takes 10–30 seconds.
        </p>
      </div>
    );
  }

  const { analysis, matches = [] } = data;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <Link
          href="/dashboard"
          className="text-[#a0a0b8] hover:text-white transition-colors flex items-center gap-1.5 text-sm"
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Dashboard
        </Link>
        <span className="text-[#9090aa]">/</span>
        <span className="text-white text-sm">Analysis Results</span>
      </div>

      {/* Analysis summary */}
      <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6 mb-8">
        <h1 className="text-2xl font-bold text-white mb-4">Video Analysis</h1>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-[#1E1E1E]/60 rounded-xl p-4">
            <p className="text-[#a0a0b8] text-xs mb-1">Energy Score</p>
            <p className="text-[#C8A96E] text-2xl font-bold">{analysis.energyScore}<span className="text-[#a0a0b8] text-base">/10</span></p>
          </div>
          <div className="bg-[#1E1E1E]/60 rounded-xl p-4">
            <p className="text-[#a0a0b8] text-xs mb-1">Ideal BPM</p>
            <p className="text-[#C8A96E] text-2xl font-bold">{(analysis.bpmRange as { min: number; max: number }).min}–{(analysis.bpmRange as { min: number; max: number }).max}</p>
          </div>
          <div className="bg-[#1E1E1E]/60 rounded-xl p-4 col-span-2">
            <p className="text-[#a0a0b8] text-xs mb-2">Detected Mood</p>
            <div className="flex flex-wrap gap-1.5">
              {analysis.moodTags.map((tag) => (
                <span key={tag} className="text-xs text-[#a0a0b8] bg-[#1E1E1E] px-2 py-0.5 rounded-full capitalize">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <div>
            <p className="text-[#a0a0b8] text-xs mb-2">Scene Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {analysis.sceneTags.map((tag) => (
                <span key={tag} className="text-xs text-[#a0a0b8] bg-[#1E1E1E] px-2 py-0.5 rounded capitalize">
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[#a0a0b8] text-xs mb-2">Recommended Genres</p>
            <div className="flex flex-wrap gap-1.5">
              {analysis.recommendedGenres.map((genre) => (
                <span key={genre} className="text-xs text-[#C4A0D4] bg-[#2A1F2F] px-2 py-0.5 rounded-full capitalize">
                  {genre}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Export success */}
      {exportResult && (
        <div className="mb-6 bg-green-900/20 border border-green-700/30 rounded-xl px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
            </svg>
            <p className="text-green-300 text-sm font-medium">
              Export complete! Your video is ready.
            </p>
          </div>
          <a
            href={`/export/${exportResult.exportId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex-shrink-0"
          >
            Click to View
          </a>
        </div>
      )}

      {/* Track list */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">
            Recommended Tracks
            <span className="text-[#6a6a8a] font-normal text-base ml-2">
              ({matches.length} matches)
            </span>
          </h2>
          <span className="text-[#6a6a8a] text-sm">Sorted by match score</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {matches.map((match) => {
            const scoredTrack = {
              ...match.track,
              match_score: match.matchScore,
              score_breakdown: match.track.score_breakdown ?? { mood: 0, bpm: 0, energy: 0, genre: 0 },
            };
            return (
              <TrackCard
                key={match.id}
                track={scoredTrack}
                rank={match.rank}
                videoId={videoId}
                isFreeUser={isFreeUser}
                onExport={handleExport}
                isExporting={exportingId === match.trackId}
                onPreview={videoUrl ? handlePreview : undefined}
                isPreviewActive={previewTrack?.id === match.track.id}
              />
            );
          })}
        </div>
      </div>

      {/* Synced preview modal */}
      {previewTrack && videoUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          onClick={() => setPreviewTrack(null)}
        >
          <div
            className="w-full max-w-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <SyncedPreviewPlayer
              videoUrl={videoUrl}
              track={previewTrack}
              isFreeUser={isFreeUser}
              onClose={() => setPreviewTrack(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
