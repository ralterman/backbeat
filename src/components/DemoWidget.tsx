"use client";

import { useEffect, useRef, useState } from "react";

const LOOP = 24000; // total loop duration ms

const TRACKS = [
  { name: "Neon Noir",         artist: "Chrome Theory",    genre: "Synthwave",              bpm: 128, score: 97 },
  { name: "City Never Sleeps", artist: "Urban Wave",       genre: "Synthwave",              bpm: 124, score: 92 },
  { name: "Midnight Drive",    artist: "The Grid",         genre: "Electronic",             bpm: 135, score: 86 },
  { name: "Downtown Rush",     artist: "Neon Atlas",       genre: "Cinematic / Upbeat",     bpm: 122, score: 79 },
  { name: "Pulse of the City", artist: "Urban Circuit",    genre: "Electronic",             bpm: 119, score: 71 },
];

const ANALYSIS = [
  { label: "Mood",       value: "Energetic & cinematic",                        type: "mood" },
  { label: "Energy",     value: 9,                                              type: "bar"  },
  { label: "Pace",       value: "Fast",                                         type: "text" },
  { label: "Scene",      value: ["Urban", "Driving", "Night city", "Timelapse"], type: "tags" },
  { label: "BPM range",  value: "120–140",                                      type: "text" },
] as const;

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function norm(v: number, lo: number, hi: number)   { return clamp((v - lo) / (hi - lo), 0, 1); }

export function DemoWidget() {
  const [t, setT]       = useState(0);
  const [muted, setMuted] = useState(true);
  const rafRef   = useRef<number>(0);
  const startRef = useRef<number | null>(null);
  const audioElRef  = useRef<HTMLAudioElement | null>(null);
  const videoRef    = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const musicActiveRef = useRef(false);

  // ── Video: show first frame immediately, then play continuously ───────────
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = true;

    // Seek to 0.1s as soon as metadata loads — browser renders that frame
    // immediately even before play() is called, so no black screen on load.
    const onMeta = () => { vid.currentTime = 0.1; };
    vid.addEventListener("loadedmetadata", onMeta, { once: true });

    const tryPlay = () =>
      vid.play().catch(() => {
        const retry = () => vid.play().catch(() => {});
        document.addEventListener("click", retry, { once: true });
        document.addEventListener("touchstart", retry, { once: true });
      });

    // If metadata already loaded (cached), seek + play immediately
    if (vid.readyState >= 1) {
      vid.currentTime = 0.1;
      tryPlay();
    } else {
      vid.addEventListener("loadedmetadata", tryPlay, { once: true });
    }

    vid.addEventListener("error", (e) => console.error("Demo video error:", e));
  }, []);

  // ── Animation loop ────────────────────────────────────────────────────────
  useEffect(() => {
    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      setT((now - startRef.current) % LOOP);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // ── Derived state ─────────────────────────────────────────────────────────
  const phase = t < 2000 ? 1 : t < 5000 ? 2 : t < 9000 ? 3 : t < 15000 ? 4 : t < 18000 ? 5 : t < 21000 ? 6 : 7;

  // Phase 1 – file drop
  const fileDrop     = norm(t, 400, 750);           // slides in 400→750 ms
  const fileVisible  = t > 400 && t < 2000;

  // Phase 2 – upload progress
  const uploadPct    = Math.round(clamp(norm(t, 2100, 3900) * 100, 0, 100));
  const thumbVisible = t > 3900;

  // Phase 3 – analysis fade-in (right panel), 5 items × 600 ms apart
  const aVis = ANALYSIS.map((_, i) => t > 5000 + i * 600);

  // Phase 4 – track slide-in
  const tkVis    = TRACKS.map((_, i) => t > 9000 + i * 1100);
  const tkScores = TRACKS.map((tr, i) => Math.round(tr.score * norm(t, 9000 + i * 1100, 9000 + i * 1100 + 900)));

  // Phase 5 – highlight + export
  const highlighted  = t > 15000 && t < 21000;
  const showExport   = t > 15200 && t < 21000;
  const pulseBorder  = highlighted && !showExport ? 0.25 + 0.15 * Math.sin(t / 400) : 0.25;

  // Phase 6 – export animation
  const exportSpin   = t > 18000 && t < 19600;
  const exportDone   = t > 19600 && t < 21000;

  // Fade in / fade out envelope
  const opacity = t < 600 ? t / 600 : t > 21000 ? clamp(1 - (t - 21000) / 1800, 0, 1) : 1;

  // Animated border glow (phase 3–6)
  const borderGlow = phase >= 3 && phase <= 6 ? 0.15 + 0.12 * Math.sin(t / 900) : 0;

  // Waveform heights (12 bars, live-animated from t)
  const waveH = Array.from({ length: 12 }, (_, i) =>
    0.22 + 0.65 * ((Math.sin(t / 270 + i * 0.75) + 1) / 2)
  );

  // ── Phase-gated music: plays only while tracks are shown (t 9000–21000) ──
  useEffect(() => {
    const audio = audioElRef.current;
    if (!audio) return;
    const inMusicZone = t >= 9000 && t <= 21000;
    const shouldPlay = !muted && inMusicZone;
    if (shouldPlay === musicActiveRef.current) return;
    musicActiveRef.current = shouldPlay;
    if (shouldPlay) {
      audio.volume = 0.75;
      audio.play().catch(() => {});
    } else {
      audio.pause();
      audio.currentTime = 0;
    }
  }, [t, muted]);

  // ── Silence when tab hidden ───────────────────────────────────────────────
  useEffect(() => {
    const onVisibility = () => {
      const audio = audioElRef.current;
      if (!audio) return;
      if (document.hidden) {
        audio.pause();
      } else if (!muted && musicActiveRef.current) {
        audio.play().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [muted]);

  // ── Reset loop + mute when demo scrolls out of view ──────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          const audio = audioElRef.current;
          if (audio) { audio.pause(); audio.currentTime = 0; }
          musicActiveRef.current = false;
          startRef.current = null; // resets animation loop to t=0
          setMuted(true);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ── Stop audio on unmount / page navigation ───────────────────────────────
  useEffect(() => {
    return () => {
      const audio = audioElRef.current;
      if (audio) { audio.pause(); audio.currentTime = 0; }
    };
  }, []);

  // ── Audio ─────────────────────────────────────────────────────────────────
  const toggleMute = () => setMuted((prev) => !prev);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className="block mt-10 sm:mt-16 max-w-3xl mx-auto px-3 sm:px-0" style={{ opacity }}>
      <audio ref={audioElRef} src="https://archive.org/download/DWK312/Centz_-_14_-_Neon_Noir.mp3" preload="auto" loop />
      <div className="bg-[#141414]/80 border border-[#2A2A2A] rounded-2xl p-3 sm:p-6 shadow-2xl shadow-black/60">

        {/* Window chrome */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-3 h-3 rounded-full bg-red-400/50" />
          <div className="w-3 h-3 rounded-full bg-yellow-400/50" />
          <div className="w-3 h-3 rounded-full bg-green-400/50" />
          <div className="flex-1 bg-[#1E1E1E] rounded-lg h-5 ml-2 flex items-center px-3">
            <span className="text-[#9090aa] text-[10px]">backbeat.me/dashboard</span>
          </div>
          {/* Mute toggle */}
          <button
            onClick={toggleMute}
            title={muted ? "Play ambient audio" : "Mute"}
            className="ml-1 text-[#c8b97a] opacity-30 hover:opacity-90 transition-opacity"
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

        <div className="flex flex-col sm:flex-row gap-3">

          {/* ── LEFT PANEL — portrait video column ── */}
          <div className="flex flex-col gap-2 sm:flex-shrink-0 w-[180px] sm:w-[300px] mx-auto sm:mx-0">
            <div
              className="rounded-xl overflow-hidden relative w-full"
              style={{
                aspectRatio: "9/16",
                background: "#0a0a0a",
                border: `1px solid rgba(200,185,122,${borderGlow})`,
                transition: "border-color 0.6s",
              }}
            >
              {/* Real video — plays continuously underneath all overlays */}
              <video
                ref={videoRef}
                src="/demo-video.mp4"
                autoPlay
                muted
                loop
                playsInline
                controls={false}
                style={{
                  position: "absolute",
                  top: 0, left: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  zIndex: 0,
                  opacity: phase === 1 ? 0.25 : phase >= 2 && phase <= 6 ? 1 : 0,
                  transition: "opacity 0.8s ease",
                }}
              />

              {/* Phase 1: upload zone overlay (sits on top of dimmed video) */}
              {phase === 1 && (
                <div className="absolute inset-0 border-2 border-dashed border-[#2A2A2A] rounded-xl flex flex-col items-center justify-center" style={{ zIndex: 1 }}>
                  {fileVisible ? (
                    <div
                      className="flex flex-col items-center gap-1.5"
                      style={{
                        opacity: fileDrop,
                        transform: `translateY(${(1 - fileDrop) * -36}px)`,
                      }}
                    >
                      <svg className="w-9 h-9 text-[#c8b97a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      <span className="text-[#a0a0b8] text-xs font-medium">demo-video.mp4</span>
                      <span className="text-[#9090aa] text-[10px]">58 MB</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-[#9090aa]">
                      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      <span className="text-xs">Drop a video to analyze</span>
                    </div>
                  )}
                </div>
              )}

              {/* Upload progress overlay */}
              {phase === 2 && (
                <div className="absolute inset-0 bg-black/30 rounded-xl flex flex-col justify-end p-4" style={{ zIndex: 1 }}>
                  <div className="flex justify-between text-[10px] mb-1.5">
                    <span className="text-[#a0a0b8]">demo-video.mp4</span>
                    <span className="text-[#c8b97a] font-semibold">{uploadPct}%</span>
                  </div>
                  <div className="h-1.5 bg-[#2A2A2A] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${uploadPct}%`,
                        background: "linear-gradient(90deg, #c8b97a, #e8d09a)",
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* ── RIGHT PANEL ── */}
          {/* h-[340px] on mobile exceeds max content (measured 331px scrollHeight),
              locking the widget height so phase transitions never shift the page */}
          <div className="sm:flex-1 space-y-1.5 overflow-hidden min-w-0 h-[340px] sm:h-auto">

            {/* Analyzing animation */}
            {phase === 2 && (
              <div className="flex flex-col items-center justify-center min-h-[120px] h-full gap-2 py-6">
                <div className="flex items-end gap-0.5 h-6">
                  {[0.4, 0.8, 1.0, 0.6, 0.9, 0.5, 0.75].map((base, i) => (
                    <div
                      key={i}
                      className="w-1 rounded-full bg-[#c8b97a]/50"
                      style={{ height: `${(0.3 + 0.7 * base * ((Math.sin(t / 180 + i * 0.65) + 1) / 2)) * 100}%` }}
                    />
                  ))}
                </div>
                <span className="text-[#a0a0b8] text-[11px]">Analyzing your video...</span>
              </div>
            )}

            {/* Analysis results */}
            {phase === 3 && ANALYSIS.map((item, i) => (
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
                          background: "linear-gradient(90deg,#c8b97a,#e8d09a)",
                          transition: "width 0.9s ease-out",
                        }}
                      />
                    </div>
                    <span className="text-[#c8b97a] text-[10px] font-bold shrink-0">{item.value}/10</span>
                  </div>
                ) : item.type === "tags" ? (
                  <div className="flex flex-wrap gap-1">
                    {(item.value as readonly string[]).map((tag) => (
                      <span key={tag} className="text-[#c8b97a] text-[9px] bg-[#c8b97a]/10 rounded px-1.5 py-0.5">{tag}</span>
                    ))}
                  </div>
                ) : item.type === "mood" ? (
                  <span className="text-[#c8b97a] text-[11px] font-semibold">{item.value as string}</span>
                ) : (
                  <span className="text-white text-[11px]">{item.value as string}</span>
                )}
              </div>
            ))}

            {/* Track list */}
            {phase >= 4 && TRACKS.map((track, i) => (
              <div
                key={i}
                className="rounded-lg px-2.5 py-1.5"
                style={{
                  opacity: tkVis[i] ? 1 : 0,
                  transform: tkVis[i] ? "translateX(0)" : "translateX(14px)",
                  background: highlighted && i === 0 ? "rgba(200,185,122,0.10)" : "rgba(30,30,30,0.6)",
                  border: highlighted && i === 0 ? "1px solid rgba(200,185,122,0.32)" : "1px solid transparent",
                  transition: "opacity 0.35s ease-out, transform 0.35s ease-out, background 0.5s, border-color 0.5s",
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 mb-0.5">
                      <span className="text-white text-[11px] font-medium truncate">{track.name}</span>
                      {i === 0 && highlighted && (
                        <span className="shrink-0 text-[8px] bg-[#c8b97a]/15 text-[#c8b97a] border border-[#c8b97a]/25 rounded px-1 py-px">
                          Best match
                        </span>
                      )}
                    </div>
                    {highlighted && i === 0 ? (
                      <div className="flex items-end gap-px h-3">
                        {waveH.slice(0, 10).map((h, wi) => (
                          <div
                            key={wi}
                            className="w-0.5 rounded-full bg-[#c8b97a]/65"
                            style={{ height: `${h * 100}%` }}
                          />
                        ))}
                      </div>
                    ) : (
                      <span className="text-[#9090aa] text-[9px]">{track.genre} · {track.bpm} BPM</span>
                    )}
                  </div>
                  <span
                    className="text-[11px] font-bold ml-2 shrink-0"
                    style={{ color: i === 0 ? "#c8b97a" : i === 1 ? "#9a8a55" : "#9090aa" }}
                  >
                    {tkScores[i]}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Export button — always in DOM so it reserves space; visible via opacity */}
        <button
          className="w-full rounded-lg py-2 text-[12px] font-semibold mt-2"
          style={{
            opacity: showExport ? 1 : 0,
            pointerEvents: showExport ? "auto" : "none",
            background: exportDone ? "rgba(34,197,94,0.12)" : "rgba(200,185,122,0.10)",
            border: exportDone
              ? "1px solid rgba(34,197,94,0.4)"
              : `1px solid rgba(200,185,122,${pulseBorder})`,
            color: exportDone ? "#4ade80" : "#c8b97a",
            transition: "opacity 0.4s, background 0.4s, border-color 0.3s, color 0.4s",
          }}
        >
          {exportSpin ? (
            <span className="flex items-center justify-center gap-2">
              <span
                className="inline-block w-3.5 h-3.5 rounded-full border-2 border-[#c8b97a] border-t-transparent"
                style={{ animation: "spin 0.7s linear infinite" }}
              />
              Exporting...
            </span>
          ) : exportDone ? (
            "✓  Ready to download — city-timelapse-backbeat.mp4"
          ) : (
            "Export with this track"
          )}
        </button>
      </div>

      {/* Spin keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
