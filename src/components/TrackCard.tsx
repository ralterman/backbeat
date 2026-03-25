"use client";

import React, { useState } from "react";
import { ScoredTrack } from "@/lib/matching";
import { WaveformBar } from "./WaveformBar";
import { AudioPlayer } from "./AudioPlayer";

interface TrackCardProps {
  track: ScoredTrack;
  rank: number;
  videoId: string;
  isFreeUser?: boolean;
  onExport?: (trackId: string) => void;
  isExporting?: boolean;
  onPreview?: (track: ScoredTrack) => void;
  isPreviewActive?: boolean;
}

const GENRE_COLORS: Record<string, string> = {
  cinematic: "bg-[#2A1F2F] text-[#C4A0D4]",
  "upbeat pop": "bg-[#2A1820] text-[#D4A0B8]",
  "lo-fi": "bg-[#1A2A1A] text-[#90C490]",
  electronic: "bg-[#0A1E2A] text-[#70B4D0]",
  acoustic: "bg-[#2A1E0A] text-[#C8A96E]",
  "hip-hop": "bg-[#2A1508] text-[#D09050]",
  ambient: "bg-[#0A1A2A] text-[#80B8D4]",
  jazz: "bg-[#241C08] text-[#D4C060]",
  rock: "bg-[#2A0A0A] text-[#D46060]",
  indie: "bg-[#1A0A2A] text-[#B080D4]",
};

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? "text-[#C8A96E]" : score >= 60 ? "text-[#A89B6A]" : "text-[#9090aa]";
  return (
    <div className="text-right">
      <span className={`text-2xl font-bold ${color}`}>{score}</span>
      <span className="text-[#9090aa] text-xs ml-1">/ 100</span>
    </div>
  );
}

export function TrackCard({
  track,
  rank,
  videoId,
  isFreeUser = false,
  onExport,
  isExporting = false,
  onPreview,
  isPreviewActive = false,
}: TrackCardProps) {
  const [showPlayer, setShowPlayer] = useState(false);
  const isBestMatch = rank === 1;
  const genreStyle = GENRE_COLORS[track.genre] ?? "bg-[#1E1E1E] text-[#a0a0b8]";

  return (
    <div
      className={`bg-[#141414] border rounded-xl p-5 transition-all hover:border-[#C8A96E]/50 ${
        isBestMatch ? "border-[#C8A96E] shadow-[#C8A96E]/10 shadow-lg" : "border-[#2A2A2A]"
      }`}
    >
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-[#9090aa] font-mono text-sm w-5 text-center flex-shrink-0">
            {rank}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-white font-semibold truncate">{track.title}</h3>
              {isBestMatch && (
                <span className="bg-[#C8A96E] text-[#0a0a0f] text-xs px-2 py-0.5 rounded-full font-bold flex-shrink-0">
                  Best Match
                </span>
              )}
            </div>
            <p className="text-[#a0a0b8] text-sm truncate">{track.artist}</p>
          </div>
        </div>
        <ScoreBadge score={track.match_score} />
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${genreStyle}`}>
          {track.genre}
        </span>
        <span className="text-xs text-[#a0a0b8] bg-[#1E1E1E] px-2 py-0.5 rounded-full">
          {track.bpm} BPM
        </span>
        <span className="text-xs text-[#a0a0b8] bg-[#1E1E1E] px-2 py-0.5 rounded-full">
          Energy {track.energy_score}/10
        </span>
        <span className="text-xs text-[#a0a0b8] bg-[#1E1E1E] px-2 py-0.5 rounded-full">
          {Math.floor(track.duration_seconds / 60)}:{String(track.duration_seconds % 60).padStart(2, "0")}
        </span>
      </div>

      <div className="mb-3">
        <WaveformBar data={track.waveform_data} height={32} />
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {track.mood_tags.slice(0, 4).map((tag) => (
          <span key={tag} className="text-xs text-[#a0a0b8] bg-[#1E1E1E]/60 px-2 py-0.5 rounded">
            {tag}
          </span>
        ))}
      </div>

      {!onPreview && showPlayer && (
        <div className="mb-3">
          <AudioPlayer
            track={track}
            isFreeUser={isFreeUser}
            onClose={() => setShowPlayer(false)}
          />
        </div>
      )}

      <div className="flex gap-2 mt-1">
        {onPreview ? (
          <button
            onClick={() => onPreview(track)}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border ${
              isPreviewActive
                ? "bg-[#C8A96E]/20 border-[#C8A96E]/60 text-[#C8A96E]"
                : "bg-[#1E1E1E] hover:bg-[#2A2A2A] text-white border-[#2A2A2A]"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
            {isPreviewActive ? "Watching..." : "Watch Preview"}
          </button>
        ) : (
          <button
            onClick={() => setShowPlayer(!showPlayer)}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-[#1E1E1E] hover:bg-[#2A2A2A] text-white rounded-lg text-sm font-medium transition-colors border border-[#2A2A2A]"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              {showPlayer ? (
                <>
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </>
              ) : (
                <polygon points="5,3 19,12 5,21" />
              )}
            </svg>
            {showPlayer ? "Stop Preview" : "Preview"}
          </button>
        )}

        <button
          onClick={() => onExport?.(track.id)}
          disabled={isExporting}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-white hover:bg-[#f0f0f0] disabled:bg-[#1E1E1E] disabled:text-[#9090aa] text-[#0a0a0f] rounded-lg text-sm font-bold transition-colors"
        >
          {isExporting ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Exporting...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {isFreeUser ? "Export (with Watermark)" : "Export"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
