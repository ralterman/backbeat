"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";

const MOCK_TRACKS = [
  { id: 1, name: "Golden Hour", artist: "Waverly & Co.", genre: "Cinematic", bpm: 92, score: 98 },
  { id: 2, name: "Drift Away", artist: "Solar Keys", genre: "Lo-Fi", bpm: 78, score: 87 },
  { id: 3, name: "Ultralight", artist: "The Ambient", genre: "Electronic", bpm: 120, score: 74 },
  { id: 4, name: "Late Night Jazz", artist: "Milo Raines", genre: "Jazz", bpm: 84, score: 68 },
  { id: 5, name: "Open Road", artist: "Crestline", genre: "Rock", bpm: 110, score: 52 },
];

const ANALYSIS_STEPS = [
  "Scanning frames...",
  "Detecting mood & energy...",
  "Matching tracks...",
];

type Phase = "idle" | "analyzing" | "results" | "exporting";

function playTone(frequency: number) {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.8);
  } catch {}
}

const TONE_FREQS = [392, 330, 261, 293, 220];

export function DemoWidget() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [selectedTrack, setSelectedTrack] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const runAnalysis = useCallback((url: string) => {
    setVideoUrl(url);
    setPhase("analyzing");
    setAnalysisStep(0);

    let step = 0;
    const interval = setInterval(() => {
      step += 1;
      setAnalysisStep(step);
      if (step >= ANALYSIS_STEPS.length) {
        clearInterval(interval);
        setTimeout(() => setPhase("results"), 300);
      }
    }, 1100);
  }, []);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("video/")) return;
    const url = URL.createObjectURL(file);
    runAnalysis(url);
  }, [runAnalysis]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleExport = () => {
    setPhase("exporting");
    setTimeout(() => setShowPaywall(true), 1200);
  };

  const handleTrackClick = (idx: number) => {
    setSelectedTrack(idx);
    playTone(TONE_FREQS[idx]);
  };

  const progress = phase === "analyzing"
    ? Math.round((analysisStep / ANALYSIS_STEPS.length) * 100)
    : phase === "results" || phase === "exporting" ? 100 : 0;

  return (
    <>
      <div className="hidden sm:block mt-16 max-w-4xl mx-auto bg-[#141414]/80 border border-[#2A2A2A] rounded-2xl p-6 shadow-2xl shadow-black/60">
        {/* Window chrome */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-3 h-3 rounded-full bg-red-400/50" />
          <div className="w-3 h-3 rounded-full bg-yellow-400/50" />
          <div className="w-3 h-3 rounded-full bg-green-400/50" />
          <div className="flex-1 bg-[#1E1E1E] rounded-lg h-5 ml-2 flex items-center px-3">
            <span className="text-[#3a3a5a] text-xs">backbeat.me/dashboard</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {/* Left panel */}
          <div className="col-span-2">
            {phase === "idle" ? (
              <div
                className={`rounded-xl h-48 border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors ${
                  isDragging
                    ? "border-[#C8A96E] bg-[#C8A96E]/5"
                    : "border-[#2A2A2A] bg-[#1E1E1E]/60 hover:border-[#C8A96E]/40 hover:bg-[#C8A96E]/3"
                }`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <svg className="w-8 h-8 text-[#C8A96E]/60 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <p className="text-[#a0a0b8] text-sm font-medium">Drop a video to see Backbeat in action</p>
                <p className="text-[#3a3a5a] text-xs mt-1">MP4, MOV, AVI, MKV</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,.mkv"
                  className="hidden"
                  onChange={onFileChange}
                />
              </div>
            ) : (
              <div className="rounded-xl h-48 bg-black overflow-hidden relative">
                {videoUrl && (
                  <video
                    src={videoUrl}
                    className="w-full h-full object-contain"
                    autoPlay
                    muted
                    loop
                    playsInline
                  />
                )}
                {phase === "analyzing" && (
                  <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-3 px-6">
                    <div className="w-full">
                      <div className="flex justify-between text-xs text-[#a0a0b8] mb-1.5">
                        <span>{ANALYSIS_STEPS[Math.min(analysisStep, ANALYSIS_STEPS.length - 1)]}</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-1.5 bg-[#2A2A2A] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#C8A96E] to-[#E8C87A] rounded-full transition-all duration-700"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      {ANALYSIS_STEPS.map((_, i) => (
                        <div
                          key={i}
                          className={`h-1 rounded-full transition-all duration-500 ${
                            i < analysisStep ? "w-6 bg-[#C8A96E]" : "w-3 bg-[#2A2A2A]"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {phase === "exporting" && !showPaywall && (
                  <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2">
                    <div className="w-8 h-8 border-2 border-[#C8A96E] border-t-transparent rounded-full animate-spin" />
                    <span className="text-[#a0a0b8] text-xs">Preparing export...</span>
                  </div>
                )}
              </div>
            )}

            {/* Export button */}
            {phase === "results" && selectedTrack !== null && (
              <button
                onClick={handleExport}
                className="mt-2 w-full bg-[#C8A96E] hover:bg-[#E8C87A] text-[#0a0a0f] font-semibold text-sm py-2 rounded-lg transition-colors"
              >
                Export with this track
              </button>
            )}
            {phase === "results" && selectedTrack === null && (
              <p className="mt-2 text-center text-[#3a3a5a] text-xs">Select a track to export</p>
            )}
          </div>

          {/* Right panel — track list */}
          <div className="space-y-2">
            {phase === "idle" && (
              <>
                {[98, 87, 74, 68, 52].map((score, i) => (
                  <div key={i} className="bg-[#1E1E1E]/60 rounded-lg px-3 py-2 flex items-center justify-between">
                    <div className="space-y-1">
                      <div className={`h-2 rounded bg-[#2A2A2A] ${i === 0 ? "w-20" : i === 1 ? "w-16" : "w-14"}`} />
                      <div className="h-1.5 w-10 rounded bg-[#1E1E1E]" />
                    </div>
                    <span className={`text-xs font-bold ${i === 0 ? "text-[#c8b97a]" : "text-[#3a3a5a]"}`}>{score}</span>
                  </div>
                ))}
              </>
            )}

            {phase === "analyzing" && (
              <>
                {MOCK_TRACKS.map((_, i) => (
                  <div key={i} className="bg-[#1E1E1E]/60 rounded-lg px-3 py-2 flex items-center justify-between animate-pulse">
                    <div className="space-y-1">
                      <div className="h-2 rounded bg-[#2A2A2A] w-16" />
                      <div className="h-1.5 rounded bg-[#1E1E1E] w-10" />
                    </div>
                    <div className="w-6 h-3 rounded bg-[#2A2A2A]" />
                  </div>
                ))}
              </>
            )}

            {(phase === "results" || phase === "exporting") && (
              <>
                {MOCK_TRACKS.map((track, i) => (
                  <button
                    key={track.id}
                    onClick={() => handleTrackClick(i)}
                    className={`w-full rounded-lg px-3 py-2 flex items-center justify-between text-left transition-all ${
                      selectedTrack === i
                        ? "bg-[#C8A96E]/15 border border-[#C8A96E]/40"
                        : "bg-[#1E1E1E]/60 border border-transparent hover:bg-[#1E1E1E] hover:border-[#2A2A2A]"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-white text-xs font-medium truncate">{track.name}</p>
                      <p className="text-[#3a3a5a] text-[10px] truncate">{track.genre} · {track.bpm} BPM</p>
                    </div>
                    <span className={`text-xs font-bold ml-2 shrink-0 ${
                      i === 0 ? "text-[#C8A96E]" : i === 1 ? "text-[#b8a060]" : "text-[#3a3a5a]"
                    }`}>
                      {track.score}
                    </span>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Paywall modal */}
      {showPaywall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => { setShowPaywall(false); setPhase("results"); }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative bg-[#141414] border border-[#2A2A2A] rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 bg-[#C8A96E]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-[#C8A96E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <h3 className="text-white font-bold text-xl mb-2">Sign up free to export your video</h3>
            <p className="text-[#a0a0b8] text-sm mb-6">
              Create a free account to export with music included. One free analysis, no credit card required.
            </p>
            <Link
              href="/auth/signup"
              className="block w-full bg-white hover:bg-[#f0f0f0] text-[#0a0a0f] font-bold py-3 rounded-xl transition-all mb-3"
            >
              Get started — it&apos;s free
            </Link>
            <button
              onClick={() => { setShowPaywall(false); setPhase("results"); }}
              className="text-[#3a3a5a] text-sm hover:text-[#a0a0b8] transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>
      )}
    </>
  );
}
