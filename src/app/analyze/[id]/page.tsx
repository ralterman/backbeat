"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { GeneratedTrackResult } from "@/components/GeneratedTrackResult";
import type { GeneratedOption } from "@/app/api/analyze/route";
import type { AudioMode, MusicLevel } from "@/lib/audioMix";

interface AnalysisData {
  id: string;
  moodTags: string[];
  bpmRange: { min: number; max: number };
  energyScore: number;
  sceneTags: string[];
  recommendedGenres: string[];
  hasOriginalAudio: boolean;
  // Legacy fields (backward compat for pre-migration rows)
  musicDescription: string | null;
  musicTags: string[];
  generatedAudioKey: string | null;
  generatedAudioUrl: string | null;
  musicDescription2: string | null;
  musicTags2: string[];
  generatedAudioKey2: string | null;
  generatedAudioUrl2: string | null;
  // New: accumulated options
  generatedOptions: GeneratedOption[];
}

interface AnalysisResponse {
  status: string;
  videoId: string;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  analysis?: AnalysisData;
}

// Fallback until /api/user/usage answers; the real cap is plan-specific
// (FREE 2 / CREATOR 4 / TEAM 6) and comes from the server.
const DEFAULT_OPTION_CAP = 6;

export default function AnalysisResultsPage() {
  const params = useParams<{ id: string }>();
  const videoId = params.id;

  const [data, setData] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);
  const [isFreeUser, setIsFreeUser] = useState(true);
  const [optionCap, setOptionCap] = useState(DEFAULT_OPTION_CAP);
  const [planName, setPlanName] = useState<string>("");
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);

  const fetchResults = useCallback(async () => {
    try {
      const res = await fetch(`/api/analyze/${videoId}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to load results");
      }
      const json = (await res.json()) as AnalysisResponse;
      setData(json);
      if (json.status === "completed") {
        setTimeout(() => setLoading(false), 1500);
        // Auto-select first option if nothing is selected yet
        const opts = json.analysis?.generatedOptions ?? [];
        if (opts.length > 0) {
          setSelectedOptionId((prev) => prev ?? opts[0].id);
        }
      }
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
      .then((json) => {
        if (!json) return;
        setIsFreeUser(json.plan === "FREE" && !json.isAdmin);
        if (typeof json.optionCap === "number") setOptionCap(json.optionCap);
        if (typeof json.planLabel === "string") setPlanName(json.planLabel);
      })
      .catch(() => {});
  }, []);

  const handleExport = async (
    optionId: string,
    audioMode: AudioMode,
    musicLevel: MusicLevel
  ): Promise<{ exportId: string; outputKey: string; downloadUrl: string }> => {
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId, optionId, audioMode, musicLevel }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Export failed");
    }
    const result = await res.json();
    return {
      exportId:    result.exportId    as string,
      outputKey:   result.outputKey   as string,
      downloadUrl: result.downloadUrl as string,
    };
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    setRegenError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId, regenerate: true }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Regeneration failed");
      }
      // Refresh to get updated data with new options
      await fetchResults();
    } catch (err) {
      setRegenError(err instanceof Error ? err.message : "Regeneration failed");
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
    const videoStatus = data?.status;
    const statusMessage =
      videoStatus === "GENERATING" || regenerating
        ? "Generating your soundtracks — usually 30–40 seconds..."
        : videoStatus === "ANALYZING"
        ? "Analyzing with AI — reading mood, energy, and scene..."
        : "Creating your music...";

    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <div className="w-16 h-16 rounded-full bg-[#C8A96E]/10 flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-[#C8A96E] animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
          </svg>
        </div>
        <p className="text-white font-semibold text-lg">{statusMessage}</p>
      </div>
    );
  }

  const { analysis, videoUrl, thumbnailUrl } = data;

  // Resolve which options to render: prefer generatedOptions, fall back to legacy fields
  const allOptions: GeneratedOption[] = analysis.generatedOptions?.length > 0
    ? analysis.generatedOptions
    : [
        ...(analysis.generatedAudioUrl ? [{
          id: "opt_1", round: 1, label: "A",
          audioKey: analysis.generatedAudioKey ?? "",
          audioUrl: analysis.generatedAudioUrl,
          description: analysis.musicDescription ?? "Custom AI-generated music.",
          tags: analysis.musicTags ?? [],
          createdAt: "",
        }] : []),
        ...(analysis.generatedAudioUrl2 ? [{
          id: "opt_2", round: 1, label: "B",
          audioKey: analysis.generatedAudioKey2 ?? "",
          audioUrl: analysis.generatedAudioUrl2,
          description: analysis.musicDescription2 ?? "Cinematic alternative track.",
          tags: analysis.musicTags2 ?? [],
          createdAt: "",
        }] : []),
      ];

  // Group options by round
  const rounds = Array.from(new Set(allOptions.map((o) => o.round))).sort();
  const optionsByRound = new Map<number, GeneratedOption[]>();
  for (const opt of allOptions) {
    const r = optionsByRound.get(opt.round) ?? [];
    r.push(opt);
    optionsByRound.set(opt.round, r);
  }

  const optionCount = allOptions.length;
  const atMax = optionCount >= optionCap;
  const canUpgradeForMore = !isFreeUser && optionCap < DEFAULT_OPTION_CAP; // Creator (4) → Pro (6)

  const RegenButton = () => {
    if (atMax && !isFreeUser) {
      return (
        <p className="text-[#9090aa] text-sm">
          You&rsquo;ve generated {optionCount} option{optionCount === 1 ? "" : "s"}
          {planName ? ` — the ${planName} plan maximum` : ""}.{" "}
          {canUpgradeForMore ? (
            <>
              <Link href="/pricing" className="text-[#C8A96E] hover:text-white underline transition-colors">
                Upgrade to Pro
              </Link>{" "}
              for up to {DEFAULT_OPTION_CAP} per video, or{" "}
            </>
          ) : (
            <>Pick your favorite or{" "}</>
          )}
          <Link href="/dashboard" className="text-[#C8A96E] hover:text-white underline transition-colors">
            upload a new video
          </Link>
          .
        </p>
      );
    }
    if (isFreeUser) {
      return (
        <Link
          href="/pricing"
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#C8A96E] hover:bg-[#d4b87a] text-[#0a0a0f] rounded-xl text-sm font-bold transition-colors"
        >
          Upgrade to generate more options
        </Link>
      );
    }
    return (
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
            Generate New Options ({optionCount}/{optionCap})
          </>
        )}
      </button>
    );
  };

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
                <span key={tag} className="text-xs text-[#a0a0b8] bg-[#1E1E1E] px-2 py-0.5 rounded-full capitalize">{tag}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <div>
            <p className="text-[#a0a0b8] text-xs mb-2">Scene Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {analysis.sceneTags.map((tag) => (
                <span key={tag} className="text-xs text-[#a0a0b8] bg-[#1E1E1E] px-2 py-0.5 rounded capitalize">{tag}</span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[#a0a0b8] text-xs mb-2">Recommended Genres</p>
            <div className="flex flex-wrap gap-1.5">
              {analysis.recommendedGenres.map((genre) => (
                <span key={genre} className="text-xs text-[#C4A0D4] bg-[#2A1F2F] px-2 py-0.5 rounded-full capitalize">{genre}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Generated track options */}
      {allOptions.length > 0 ? (
        <>
          <h2 className="text-xl font-bold text-white mb-1">Choose Your Track</h2>
          <p className="text-[#9090aa] text-sm mb-6">Click a card to select it, then export.</p>

          {/* Options grouped by round */}
          {rounds.map((round, roundIdx) => {
            const roundOpts = optionsByRound.get(round) ?? [];
            return (
              <div key={round}>
                {/* Round divider */}
                <div className="flex items-center gap-3 mb-4 mt-2">
                  <span className="text-[#6a6a8a] text-xs font-semibold uppercase tracking-widest whitespace-nowrap">
                    Round {round}
                  </span>
                  <div className="flex-1 h-px bg-[#2A2A2A]" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {roundOpts.map((opt) => (
                    <GeneratedTrackResult
                      key={opt.id}
                      audioUrl={opt.audioUrl}
                      videoUrl={videoUrl}
                      thumbnailUrl={thumbnailUrl}
                      hasOriginalAudio={analysis.hasOriginalAudio}
                      description={opt.description}
                      tags={opt.tags}
                      videoId={videoId}
                      optionLabel={`Option ${opt.label}`}
                      isFreeUser={isFreeUser}
                      isSelected={selectedOptionId === opt.id}
                      onSelect={() => setSelectedOptionId(opt.id)}
                      onExport={(opts) => handleExport(opt.id, opts.audioMode, opts.musicLevel)}
                    />
                  ))}
                </div>

                {/* Spacer between rounds */}
                {roundIdx < rounds.length - 1 && <div className="mb-2" />}
              </div>
            );
          })}

          {/* Generate / upgrade / at-max button */}
          <div className="text-center mt-2">
            <RegenButton />
            {regenError && (
              <p className="text-red-400 text-sm mt-3">{regenError}</p>
            )}
            {!atMax && !isFreeUser && (
              <p className="text-[#9090aa] text-xs mt-2">
                Keeps your video analysis — skips re-analyzing with Claude
              </p>
            )}
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
