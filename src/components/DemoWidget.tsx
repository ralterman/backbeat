"use client";

import { useEffect, useRef, useState } from "react";

const OPTIONS = [
  {
    label: "Option A",
    description: "Driving synthwave backdrop — builds with the city's kinetic energy",
    tags: ["synthwave", "driving", "energetic"],
  },
  {
    label: "Option B",
    description: "Cinematic orchestral swell — lifts the narrative arc of the footage",
    tags: ["orchestral", "cinematic", "atmospheric"],
  },
] as const;

const ANALYSIS = [
  { label: "Mood",      value: "Energetic & cinematic",                         type: "mood" },
  { label: "Energy",    value: 9,                                               type: "bar"  },
  { label: "Pace",      value: "Fast",                                          type: "text" },
  { label: "Scene",     value: ["Urban", "Driving", "Night city", "Timelapse"], type: "tags" },
  { label: "BPM range", value: "120–140",                                       type: "text" },
] as const;

// Static bar heights for unselected state (8 bars each)
const STATIC_A = [0.35, 0.65, 0.45, 0.80, 0.30, 0.60, 0.40, 0.65];
const STATIC_B = [0.30, 0.55, 0.75, 0.42, 0.68, 0.38, 0.58, 0.48];


// ── Option card ──────────────────────────────────────────────────────────────
interface CardProps {
  label: string;
  description: string;
  tags: readonly string[];
  selected: boolean;
  bars: number[];
  visible: boolean;
}

function OptionCard({ label, description, tags, selected, bars, visible }: CardProps) {
  return (
    <div
      className="flex-1 min-h-[80px] rounded-xl px-3 py-2.5 flex flex-col gap-1.5 overflow-hidden"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateX(0)" : "translateX(14px)",
        background: selected ? "rgba(200,169,110,0.10)" : "rgba(22,22,22,0.75)",
        border: selected ? "1px solid rgba(200,169,110,0.35)" : "1px solid rgba(42,42,42,0.8)",
        transition: "opacity 0.35s ease-out, transform 0.35s ease-out, background 0.5s, border-color 0.4s",
      }}
    >
      {/* Header: label + badge + bars */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[#9090aa] text-[9px] uppercase tracking-widest font-semibold shrink-0">{label}</span>
          {selected && (
            <span className="text-[8px] bg-[#C8A96E]/15 text-[#C8A96E] border border-[#C8A96E]/25 rounded px-1.5 py-px font-semibold shrink-0">
              Playing
            </span>
          )}
        </div>
        {/* Waveform bars */}
        <div
          className="flex items-end gap-px h-3.5 shrink-0"
          style={{ opacity: selected ? 1 : 0.28 }}
        >
          {bars.map((h, i) => (
            <div
              key={i}
              className="w-0.5 rounded-full"
              style={{
                height: `${Math.round(h * 100)}%`,
                background: selected ? "#C8A96E" : "#a0a0b8",
              }}
            />
          ))}
        </div>
      </div>

      {/* Description */}
      <p className="text-[#c0c0d0] text-[9px] leading-snug flex-1">
        {description}
      </p>

      {/* Tags */}
      <div className="flex flex-wrap gap-1">
        {tags.map((tag) => (
          <span
            key={tag}
            className="text-[8px] px-1.5 py-0.5 rounded-full capitalize"
            style={{
              background: selected ? "rgba(200,169,110,0.10)" : "rgba(30,30,30,0.9)",
              color: selected ? "#C8A96E" : "#9090aa",
              border: `1px solid ${selected ? "rgba(200,169,110,0.20)" : "rgba(55,55,55,0.8)"}`,
            }}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── DemoWidget ────────────────────────────────────────────────────────────────
export function DemoWidget() {
  const [phase, setPhase]               = useState(1);
  const [muted, setMuted]               = useState(true);
  const [exportLabel, setExportLabel]   = useState<'exporting' | 'ready'>('exporting');
  const [animTick, setAnimTick]         = useState(0);
  const [analysisCount, setAnalysisCount] = useState(0);
  const videoRef                        = useRef<HTMLVideoElement>(null);
  const audioRef                        = useRef<HTMLAudioElement>(null);
  const containerRef                    = useRef<HTMLDivElement>(null);

  // ── Phase timer ───────────────────────────────────────────────────────────
  // Phase 1  3 s    upload
  // Phase 2  4 s    analyzing + analysis tags
  // Phase 3  3 s    options appear (neither selected)
  // Phase 4  6 s    Option A selected + audio plays
  // Phase 5  6 s    Option B selected + audio restarts
  // Phase 6  4 s    export (2 s exporting → 2 s ready)
  // Phase 7  2 s    fade out / reset
  useEffect(() => {
    const timings = [3000, 4000, 3000, 6000, 6000, 4000, 2000];
    const timer = setTimeout(() => setPhase(p => p === 7 ? 1 : p + 1), timings[phase - 1]);
    return () => clearTimeout(timer);
  }, [phase]);

  // ── Audio sync ────────────────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (phase === 4 || phase === 5) {
      audio.currentTime = 0;
      if (!muted) audio.play().catch(() => {});
    } else if (phase === 7) {
      const fadeOut = setInterval(() => {
        if (audio.volume > 0.05) {
          audio.volume = Math.max(0, audio.volume - 0.05);
        } else {
          audio.pause();
          audio.currentTime = 0;
          audio.volume = 0.5;
          clearInterval(fadeOut);
        }
      }, 75);
      return () => clearInterval(fadeOut);
    } else {
      audio.pause();
      audio.currentTime = 0;
    }
  }, [phase, muted]);

  // ── Video control per phase ───────────────────────────────────────────────
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (phase === 4 || phase === 5) {
      vid.currentTime = 0;
      vid.play().catch(() => {});
    } else if (phase >= 6) {
      vid.pause();
    }
  }, [phase]);

  // ── Phase 6 sub-state: "exporting" for first 2 s, "ready" for next 2 s ───
  useEffect(() => {
    if (phase === 6) {
      setExportLabel('exporting');
      const timer = setTimeout(() => setExportLabel('ready'), 2000);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  // ── Animation tick — drives waveform bars in active phases ────────────────
  useEffect(() => {
    if (phase === 2 || phase === 4 || phase === 5) {
      const id = setInterval(() => setAnimTick(n => n + 1), 60);
      return () => clearInterval(id);
    }
  }, [phase]);

  // ── Analysis items stagger in during phase 2 ─────────────────────────────
  useEffect(() => {
    if (phase !== 2) { setAnalysisCount(0); return; }
    if (analysisCount >= ANALYSIS.length) return;
    const timer = setTimeout(() => setAnalysisCount(c => c + 1), 600);
    return () => clearTimeout(timer);
  }, [phase, analysisCount]);

  // ── Reset when scrolled out ───────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          setPhase(1);
          const audio = audioRef.current;
          if (audio) { audio.pause(); audio.currentTime = 0; audio.volume = 0.5; }
          setMuted(true);
        }
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // ── Mute toggle ───────────────────────────────────────────────────────────
  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (muted) {
      audio.volume = 0.5;
      audio.play().catch(() => {});
      setMuted(false);
    } else {
      audio.pause();
      setMuted(true);
    }
  };

  // ── Derived state ─────────────────────────────────────────────────────────
  const optASelected = phase === 4;
  const optBSelected = phase >= 5; // B stays selected through phases 5, 6, 7

  const aVis = ANALYSIS.map((_, i) => i < analysisCount);

  // Export button: visible phases 3–6 (never in phase 7 or 1–2).
  // selectedLabel is the static "Export Option A/B" text used in phases 3–5;
  // during phase 6 the exportLabel state drives the button content instead.
  const showExport    = phase >= 3 && phase <= 6;
  const selectedLabel = phase >= 5 ? "Export Option B" : "Export Option A";

  // Waveform bars animated by tick (8 bars for option cards, 7 for analyzing)
  const waveH = Array.from({ length: 8 }, (_, i) =>
    0.22 + 0.65 * ((Math.sin(animTick * 0.3 + i * 0.75) + 1) / 2)
  );
  const analyzeH = Array.from({ length: 7 }, (_, i) =>
    0.22 + 0.65 * ((Math.sin(animTick * 0.25 + i * 0.65) + 1) / 2)
  );

  // Video: dim in phase 1 (first frame peek), full for phases 2–5, fade to black 6–7
  const videoOpacity = phase === 1 ? 0.1 : phase >= 6 ? 0 : 1;

  // Widget: fades out entirely during phase 7 (reset)
  const widgetOpacity = phase === 7 ? 0 : 1;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className="block mt-10 sm:mt-16 max-w-3xl mx-auto px-3 sm:px-0"
      style={{ opacity: widgetOpacity, transition: "opacity 1.5s ease" }}
    >
      {/* Hidden audio element — real ElevenLabs-generated track */}
      {/* preload="none" — audio must not load or play until phase 4 */}
      <audio ref={audioRef} src="/demo/demo-track.mp3" loop preload="none" />

      <div className="bg-[#141414]/80 border border-[#2A2A2A] rounded-2xl p-3 sm:p-6 shadow-2xl shadow-black/60">

        {/* ── Window chrome ── */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-3 h-3 rounded-full bg-red-400/50" />
          <div className="w-3 h-3 rounded-full bg-yellow-400/50" />
          <div className="w-3 h-3 rounded-full bg-green-400/50" />
          <div className="flex-1 bg-[#1E1E1E] rounded-lg h-5 ml-2 flex items-center px-3">
            <span className="text-[#9090aa] text-[10px]">backbeat.me/analyze</span>
          </div>
          {/* Mute toggle */}
          <button
            onClick={toggleMute}
            title={muted ? "Play ambient audio" : "Mute"}
            className="ml-1 text-[#C8A96E] opacity-30 hover:opacity-90 transition-opacity"
          >
            {muted ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M15.536 8.464a5 5 0 010 7.072M17.95 5.05a10 10 0 010 13.9" />
              </svg>
            )}
          </button>
        </div>

        {/* ── Main layout ── */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-stretch">

          {/* ── LEFT PANEL — portrait video ── */}
          <div className="sm:flex-shrink-0 w-[180px] sm:w-[280px] mx-auto sm:mx-0">
            <div
              className="rounded-xl overflow-hidden relative w-full"
              style={{
                aspectRatio: "9/16",
                background: "#0a0a0a",
                border: `1px solid rgba(200,169,110,${phase >= 4 && phase <= 5 ? 0.22 : 0})`,
                transition: "border-color 0.6s",
              }}
            >
              <video
                ref={videoRef}
                src="/demo-video.mp4"
                muted loop playsInline preload="auto" controls={false}
                style={{
                  position: "absolute", top: 0, left: 0,
                  width: "100%", height: "100%",
                  objectFit: "cover", zIndex: 0,
                  opacity: videoOpacity,
                  transition: "opacity 0.8s ease",
                }}
              />

              {/* Phase 1: upload drop zone with drag-in animation */}
              {phase === 1 && (
                <div
                  className="absolute inset-0 border-2 border-dashed border-[#2A2A2A] rounded-xl flex flex-col items-center justify-center gap-3"
                  style={{ zIndex: 1 }}
                >
                  <div style={{ animation: "fileDrop 0.45s ease-out 0.4s both" }}>
                    <svg className="w-9 h-9 text-[#C8A96E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div
                    className="flex flex-col items-center gap-1"
                    style={{ animation: "fileDrop 0.45s ease-out 0.55s both" }}
                  >
                    <span className="text-[#a0a0b8] text-xs font-medium">demo-video.mp4</span>
                    <span className="text-[#9090aa] text-[10px]">58 MB</span>
                  </div>
                  {/* Upload progress — CSS animates 0→100% over 2 s */}
                  <div className="w-4/5" style={{ animation: "fileDrop 0.3s ease-out 0.7s both" }}>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-[#9090aa]">Uploading…</span>
                    </div>
                    <div className="h-1.5 bg-[#2A2A2A] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          background: "linear-gradient(90deg,#C8A96E,#e8d09a)",
                          animation: "uploadFill 2s ease-out 0.9s both",
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT PANEL ── */}
          <div className="sm:flex-1 flex flex-col gap-2 min-h-0">

            {/* Phase 1 — quiet placeholder while upload runs */}
            {phase === 1 && (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 py-6">
                <svg className="w-8 h-8 text-[#252530]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                <span className="text-[#383848] text-[11px]">Your AI soundtrack will appear here</span>
              </div>
            )}

            {/* Phase 2 — analyzing waveform + analysis tags staggering in */}
            {phase === 2 && (
              <div className="flex-1 flex flex-col justify-start gap-1.5 pt-2">
                <div className="flex flex-col items-center gap-2 mb-2">
                  <div className="flex items-end gap-0.5 h-6">
                    {analyzeH.map((h, i) => (
                      <div
                        key={i}
                        className="w-1 rounded-full bg-[#C8A96E]/50"
                        style={{ height: `${h * 100}%` }}
                      />
                    ))}
                  </div>
                  <span className="text-[#a0a0b8] text-[11px]">Analyzing your video...</span>
                </div>

                {ANALYSIS.map((item, i) => (
                  <div
                    key={i}
                    className="bg-[#1E1E1E]/60 rounded-lg px-2.5 py-2"
                    style={{
                      opacity: aVis[i] ? 1 : 0,
                      transform: aVis[i] ? "translateY(0)" : "translateY(6px)",
                      transition: "opacity 0.4s ease-out, transform 0.4s ease-out",
                    }}
                  >
                    <div className="text-[#9090aa] text-[9px] uppercase tracking-wide mb-1">{item.label}</div>
                    {item.type === "bar" ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-[#2A2A2A] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: aVis[i] ? `${(item.value as number) * 10}%` : "0%",
                              background: "linear-gradient(90deg,#C8A96E,#e8d09a)",
                              transition: "width 0.9s ease-out",
                            }}
                          />
                        </div>
                        <span className="text-[#C8A96E] text-[10px] font-bold shrink-0">{item.value}/10</span>
                      </div>
                    ) : item.type === "tags" ? (
                      <div className="flex flex-wrap gap-1">
                        {(item.value as readonly string[]).map((tag) => (
                          <span key={tag} className="text-[#C8A96E] text-[9px] bg-[#C8A96E]/10 rounded px-1.5 py-0.5">{tag}</span>
                        ))}
                      </div>
                    ) : item.type === "mood" ? (
                      <span className="text-[#C8A96E] text-[11px] font-semibold">{item.value as string}</span>
                    ) : (
                      <span className="text-white text-[11px]">{item.value as string}</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Phases 3–6 — option cards + export button */}
            {phase >= 3 && phase <= 6 && (
              <div className="flex-1 flex flex-col gap-3 min-h-0">
                <OptionCard
                  label="Option A"
                  description={OPTIONS[0].description}
                  tags={OPTIONS[0].tags}
                  selected={optASelected}
                  bars={optASelected ? waveH : STATIC_A}
                  visible={true}
                />
                <OptionCard
                  label="Option B"
                  description={OPTIONS[1].description}
                  tags={OPTIONS[1].tags}
                  selected={optBSelected}
                  bars={optBSelected ? waveH : STATIC_B}
                  visible={true}
                />

                {/* Export button — not rendered in phases 7, 1, 2 (showExport is false).
                    Phase 6 uses exportLabel state; other phases use selectedLabel string.
                    This guarantees "Export Option A" never appears during the reset fade. */}
                {showExport && (
                  <button
                    className="flex-shrink-0 w-full rounded-xl text-[12px] font-bold h-[36px] flex items-center justify-center gap-2"
                    style={{
                      background: exportLabel === 'ready' ? "rgba(34,197,94,0.12)" : "rgba(200,169,110,0.09)",
                      border: exportLabel === 'ready'
                        ? "1px solid rgba(34,197,94,0.55)"
                        : "1px solid rgba(200,169,110,0.28)",
                      color: exportLabel === 'ready' ? "#4ade80" : "#C8A96E",
                      transition: "background 0.3s, border-color 0.2s, color 0.4s",
                    }}
                  >
                    {phase === 6 ? (
                      exportLabel === 'ready' ? (
                        "✓  Ready to download ↓"
                      ) : (
                        <>
                          <span
                            className="inline-block w-3.5 h-3.5 rounded-full border-2 border-[#C8A96E] border-t-transparent"
                            style={{ animation: "spin 0.7s linear infinite" }}
                          />
                          Exporting...
                        </>
                      )
                    ) : (
                      selectedLabel
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin       { to { transform: rotate(360deg); } }
        @keyframes fileDrop   { from { opacity: 0; transform: translateY(-16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes uploadFill { from { width: 0%; } to { width: 100%; } }
      `}</style>
    </div>
  );
}
