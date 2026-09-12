"use client";

import React, { useRef, useState } from "react";

interface GeneratedTrackResultProps {
  audioUrl: string;
  description: string;
  tags: string[];
  videoId: string;
  isFreeUser?: boolean;
  onExport?: () => void;
  isExporting?: boolean;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
}

export function GeneratedTrackResult({
  audioUrl,
  description,
  tags,
  isFreeUser = false,
  onExport,
  isExporting = false,
  onRegenerate,
  isRegenerating = false,
}: GeneratedTrackResultProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play();
    }
    setPlaying(!playing);
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    setProgress((audio.currentTime / audio.duration) * 100);
  };

  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (audio) setDuration(audio.duration);
  };

  const handleEnded = () => setPlaying(false);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    audio.currentTime = ratio * audio.duration;
  };

  const formatTime = (s: number) => {
    if (!s || !isFinite(s)) return "0:00";
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  };

  const currentTime = audioRef.current
    ? audioRef.current.currentTime
    : 0;

  return (
    <div className="bg-[#141414] border border-[#C8A96E]/40 rounded-2xl p-6 shadow-[#C8A96E]/10 shadow-lg">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-full bg-[#C8A96E]/15 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-[#C8A96E]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 3v10.55A4 4 0 1014 17V7h4V3h-6z"/>
          </svg>
        </div>
        <div>
          <h2 className="text-white font-bold text-lg leading-tight">AI-Generated Music</h2>
          <p className="text-[#a0a0b8] text-xs">Custom track generated for your video</p>
        </div>
        <span className="ml-auto bg-[#C8A96E]/15 text-[#C8A96E] text-xs font-bold px-3 py-1 rounded-full">
          ElevenLabs
        </span>
      </div>

      {/* Description */}
      <p className="text-[#d0d0d8] text-sm leading-relaxed mb-4 italic">
        &ldquo;{description}&rdquo;
      </p>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="text-xs text-[#a0a0b8] bg-[#1E1E1E] px-2.5 py-0.5 rounded-full capitalize"
          >
            {tag.replace(/-/g, " ")}
          </span>
        ))}
      </div>

      {/* Audio player */}
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        preload="metadata"
      />

      <div className="bg-[#1A1A1A] rounded-xl p-4 mb-5">
        <div className="flex items-center gap-4">
          {/* Play/pause */}
          <button
            onClick={togglePlay}
            className="w-11 h-11 rounded-full bg-[#C8A96E] hover:bg-[#d4b87a] flex items-center justify-center flex-shrink-0 transition-colors"
          >
            {playing ? (
              <svg className="w-5 h-5 text-[#0a0a0f]" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-[#0a0a0f] ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            )}
          </button>

          {/* Progress bar */}
          <div className="flex-1">
            <div
              className="h-2 bg-[#2A2A2A] rounded-full cursor-pointer relative"
              onClick={handleSeek}
            >
              <div
                className="h-2 bg-[#C8A96E] rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[#9090aa] text-xs">{formatTime(currentTime)}</span>
              <span className="text-[#9090aa] text-xs">{formatTime(duration)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onRegenerate}
          disabled={isRegenerating}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1E1E1E] hover:bg-[#2A2A2A] disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors border border-[#2A2A2A]"
        >
          {isRegenerating ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Regenerating...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Regenerate
            </>
          )}
        </button>

        <button
          onClick={onExport}
          disabled={isExporting}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-[#f0f0f0] disabled:bg-[#1E1E1E] disabled:text-[#9090aa] text-[#0a0a0f] rounded-xl text-sm font-bold transition-colors"
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
              {isFreeUser ? "Export (with Watermark)" : "Export Video"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
