"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { GeneratedTrackResult } from "@/components/GeneratedTrackResult";

interface AnalysisData {
  id: string;
  moodTags: string[];
  bpmRange: { min: number; max: number };
  energyScore: number;
  sceneTags: string[];
  recommendedGenres: string[];
  // Option 1
  musicDescription: string | null;
  musicTags: string[];
  generatedAudioKey: string | null;
  generatedAudioUrl: string | null;
  // Option 2
  musicDescription2: string | null;
  musicTags2: string[];
  generatedAudioKey2: string | null;
  generatedAudioUrl2: string | null;
}

interface AnalysisResponse {
  status: string;
  videoId: string;
  videoUrl?: string | null;
  analysis?: AnalysisData;
}

export default function AnalysisResultsPage() {
  const params = useParams<{ id: string }>();
  const videoId = params.id;

  const [data, setData] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Track which option is currently exporting (null = neither)
  const [exportingOption, setExportingOption] = useState<1 | 2 | null>(null);
  const [exportResult, setExportResult] = useState<{ exportId: string; downloadUrl: string } | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [isFreeUser, setIsFreeUser] = useState(true);

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
    fetch("/api/user/usage")
      .then((r) => r.ok ? r.json() : null)
      .then((json) => { if (json?.plan) setIsFreeUser(json.plan === "FREE"); })
      .catch(() => {});
  }, []);

  const handleExport = async (option: 1 | 2) => {
    setExportingOption(option);
    setExportResult(null);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId, audioOption: option }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Export failed");
      }
      const result = await res.json();
      setExportResult({ exportId: result.exportId, downloadUrl: result.downloadUrl });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExportingOption(null);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    setLoading(true);
    setData(null);
    setExportResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId, regenerate: true }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Regeneration failed");
      }
      // Trigger a fresh poll so we also get the updated videoUrl
      await fetchResults();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Regeneration failed");
      setLoading(false);
    } finally {
      setRegenerating(false);
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
        <h2 className="text-white text-2xl font-bold mb-2">
          {regenerating ? "Generating new options..." : "Analyzing your video..."}
        </h2>
        <p className="text-[#a0a0b8] max-w-sm mx-auto">
          {regenerating
            ? "Creating two fresh custom tracks with ElevenLabs. This takes 30–120 seconds."
            : "Backbeat AI is analyzing your video and composing two custom music options with ElevenLabs. This takes 30–120 seconds."}
        </p>
      </div>
    );
  }

  const { analysis, videoUrl } = data;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6">
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
        <span className="text-white text-sm">Your Music</span>
      </div>

      {/* Analysis summary */}
      <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6 mb-6">
        <h1 className="text-2xl font-bold text-white mb-4">Video Analysis</h1>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-[#1E1E1E]/60 rounded-xl p-4">
            <p className="text-[#a0a0b8] text-xs mb-1">Energy Score</p>
            <p className="text-[#C8A96E] text-2xl font-bold">
              {analysis.energyScore}<span className="text-[#a0a0b8] text-base">/10</span>
            </p>
          </div>
          <div className="bg-[#1E1E1E]/60 rounded-xl p-4">
            <p className="text-[#a0a0b8] text-xs mb-1">Ideal BPM</p>
            <p className="text-[#C8A96E] text-2xl font-bold">
              {(analysis.bpmRange as { min: number; max: number }).min}–
              {(analysis.bpmRange as { min: number; max: number }).max}
            </p>
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

      {/* Export success banner */}
      {exportResult && (
        <div className="mb-6 bg-green-900/20 border border-green-700/30 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
            </svg>
            <p className="text-green-300 text-sm font-medium">Export complete! Your video is ready.</p>
          </div>
          <a
            href={`/export/${exportResult.exportId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex-shrink-0"
          >
            Download
          </a>
        </div>
      )}

      {/* Generated track options */}
      {(analysis.generatedAudioUrl || analysis.generatedAudioUrl2) ? (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Choose Your Track</h2>
            <span className="text-[#a0a0b8] text-sm">Two styles generated — pick the one that fits</span>
          </div>

          {/* Two cards: side-by-side on ≥md, stacked on mobile */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
            {analysis.generatedAudioUrl && (
              <GeneratedTrackResult
                audioUrl={analysis.generatedAudioUrl}
                videoUrl={videoUrl}
                description={analysis.musicDescription ?? "Custom AI-generated music for your video."}
                tags={analysis.musicTags ?? []}
                videoId={videoId}
                optionLabel="Option A"
                isFreeUser={isFreeUser}
                onExport={() => handleExport(1)}
                isExporting={exportingOption === 1}
              />
            )}

            {analysis.generatedAudioUrl2 && (
              <GeneratedTrackResult
                audioUrl={analysis.generatedAudioUrl2}
                videoUrl={videoUrl}
                description={analysis.musicDescription2 ?? "Cinematic alternative track for your video."}
                tags={analysis.musicTags2 ?? []}
                videoId={videoId}
                optionLabel="Option B"
                isFreeUser={isFreeUser}
                onExport={() => handleExport(2)}
                isExporting={exportingOption === 2}
              />
            )}
          </div>

          {/* Single "Generate New Options" button below both cards */}
          <div className="text-center">
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#1E1E1E] hover:bg-[#2A2A2A] disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors border border-[#2A2A2A]"
            >
              {regenerating ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Generating new options...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Generate New Options
                </>
              )}
            </button>
            <p className="text-[#9090aa] text-xs mt-2">Keeps your video analysis — skips re-analyzing with Claude</p>
          </div>
        </>
      ) : (
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-8 text-center">
          <p className="text-[#a0a0b8]">No audio generated yet. Try re-analyzing this video.</p>
          <button
            onClick={handleRegenerate}
            className="mt-4 px-6 py-2.5 bg-[#C8A96E] hover:bg-[#d4b87a] text-[#0a0a0f] font-bold rounded-xl text-sm transition-colors"
          >
            Generate Music
          </button>
        </div>
      )}
    </div>
  );
}
