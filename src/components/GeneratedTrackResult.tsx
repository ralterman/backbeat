"use client";

import React, { useRef, useState, useEffect } from "react";

interface GeneratedTrackResultProps {
  audioUrl: string;
  videoUrl?: string | null;
  description: string;
  tags: string[];
  videoId: string;
  optionLabel?: string;             // e.g. "Option A" / "Option B"
  isFreeUser?: boolean;
  /** Called on export click; must return the presigned download URL on success. */
  onExport?: () => Promise<string>;
}

export function GeneratedTrackResult({
  audioUrl,
  videoUrl,
  description,
  tags,
  optionLabel,
  isFreeUser = false,
  onExport,
}: GeneratedTrackResultProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying]           = useState(false);
  const [progress, setProgress]         = useState(0);
  const [duration, setDuration]         = useState(0);
  const [currentTime, setCurrentTime]   = useState(0);
  const [isExporting, setIsExporting]   = useState(false);
  const [exportComplete, setExportComplete] = useState(false);
  const [downloadUrl, setDownloadUrl]   = useState<string | null>(null);

  // Keep the muted video in sync with the audio element.
  useEffect(() => {
    const audio = audioRef.current;
    const video = videoRef.current;
    if (!audio || !video) return;

    const onPlay   = () => { video.currentTime = audio.currentTime; video.play().catch(() => {}); };
    const onPause  = () => { video.pause(); };
    const onSeeked = () => { video.currentTime = audio.currentTime; };
    const onEnded  = () => { video.pause(); video.currentTime = 0; };

    audio.addEventListener("play",   onPlay);
    audio.addEventListener("pause",  onPause);
    audio.addEventListener("seeked", onSeeked);
    audio.addEventListener("ended",  onEnded);

    return () => {
      audio.removeEventListener("play",   onPlay);
      audio.removeEventListener("pause",  onPause);
      audio.removeEventListener("seeked", onSeeked);
      audio.removeEventListener("ended",  onEnded);
    };
  }, [audioUrl, videoUrl]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    playing ? audio.pause() : audio.play();
    setPlaying(!playing);
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    setProgress((audio.currentTime / audio.duration) * 100);
    setCurrentTime(audio.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) setDuration(audioRef.current.duration);
  };

  const handleEnded = () => { setPlaying(false); setProgress(0); setCurrentTime(0); };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const rect = e.currentTarget.getBoundingClientRect();
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
  };

  const handleExportClick = async () => {
    if (!onExport) return;
    setIsExporting(true);
    try {
      const url = await onExport();
      setDownloadUrl(url);
      setExportComplete(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  const fmt = (s: number) => {
    if (!s || !isFinite(s)) return "0:00";
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  };

  return (
    <div className="bg-[#141414] border border-[#C8A96E]/40 rounded-2xl overflow-hidden shadow-[#C8A96E]/10 shadow-lg flex flex-col">

      {/* Portrait video preview */}
      {videoUrl && (
        <div className="flex justify-center pt-5 px-5">
          <div className="w-full max-w-[220px] aspect-[9/16] rounded-xl overflow-hidden bg-black">
            <video
              ref={videoRef}
              src={videoUrl}
              muted
              playsInline
              preload="metadata"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      )}

      {/* Card body */}
      <div className="p-5 flex flex-col flex-1">

        {/* Subtle option label */}
        {optionLabel && (
          <p className="text-[#6a6a8a] text-xs font-semibold uppercase tracking-widest mb-3">
            {optionLabel}
          </p>
        )}

        {/* Music description */}
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

        {/* Hidden audio element — drives all playback */}
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
          preload="metadata"
        />

        {/* Player controls */}
        <div className="bg-[#1A1A1A] rounded-xl p-4 mb-4">
          <div className="flex items-center gap-4">
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

            <div className="flex-1">
              <div
                className="h-2 bg-[#2A2A2A] rounded-full cursor-pointer"
                onClick={handleSeek}
              >
                <div
                  className="h-2 bg-[#C8A96E] rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[#9090aa] text-xs">{fmt(currentTime)}</span>
                <span className="text-[#9090aa] text-xs">{fmt(duration)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Export button — or success state when export is done */}
        <div className="mt-auto">
          {exportComplete && downloadUrl ? (
            /* Success state — same size/position as the export button */
            <div className="w-full flex items-center justify-between gap-3 px-4 py-2.5 bg-green-900/30 border border-green-700/40 rounded-xl">
              <div className="flex items-center gap-2 min-w-0">
                <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-green-300 text-sm font-medium truncate">Export complete!</span>
              </div>
              <a
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </a>
            </div>
          ) : (
            <button
              onClick={handleExportClick}
              disabled={isExporting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-[#f0f0f0] disabled:bg-[#1E1E1E] disabled:text-[#9090aa] text-[#0a0a0f] rounded-xl text-sm font-bold transition-colors"
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
          )}
        </div>
      </div>
    </div>
  );
}
