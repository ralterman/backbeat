"use client";

import { useEffect, useRef, useState } from "react";

const LOOP = 28000;

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

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function norm(v: number, lo: number, hi: number)   { return clamp((v - lo) / (hi - lo), 0, 1); }

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
  const [t, setT]       = useState(0);
  const [muted, setMuted] = useState(true);
  const rafRef          = useRef<number>(0);
  const startRef        = useRef<number | null>(null);
  const videoRef        = useRef<HTMLVideoElement>(null);
  const containerRef    = useRef<HTMLDivElement>(null);
  const audioCtxRef     = useRef<AudioContext | null>(null);
  const gainRef         = useRef<GainNode | null>(null);

  // ── Video setup ───────────────────────────────────────────────────────────
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = true;
    const onMeta = () => { vid.currentTime = 0.1; };
    vid.addEventListener("loadedmetadata", onMeta, { once: true });
    const tryPlay = () =>
      vid.play().catch(() => {
        const retry = () => vid.play().catch(() => {});
        document.addEventListener("click", retry, { once: true });
        document.addEventListener("touchstart", retry, { once: true });
      });
    if (vid.readyState >= 1) { vid.currentTime = 0.1; tryPlay(); }
    else vid.addEventListener("loadedmetadata", tryPlay, { once: true });
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

  // ── Reset + mute when scrolled out ───────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          startRef.current = null;
          if (gainRef.current && audioCtxRef.current) {
            gainRef.current.gain.linearRampToValueAtTime(0, audioCtxRef.current.currentTime + 0.3);
            setTimeout(() => {
              audioCtxRef.current?.close().catch(() => {});
              audioCtxRef.current = null;
              gainRef.current = null;
            }, 400);
          }
          setMuted(true);
        }
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []); // no deps needed — all accesses are through refs

  // ── Cleanup audio on unmount ──────────────────────────────────────────────
  useEffect(() => () => {
    audioCtxRef.current?.close().catch(() => {});
  }, []);

  // ── Mute toggle ───────────────────────────────────────────────────────────
  const toggleMute = () => {
    if (muted) {
      // Start audio — requires user gesture
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
        const ctx = new Ctx();
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.055, ctx.currentTime + 0.8);
        gain.connect(ctx.destination);
        // C major chord (C3 + E3 + G3) as a simple musical reference tone
        ([130.81, 164.81, 196.00] as number[]).forEach((freq) => {
          const osc = ctx.createOscillator();
          osc.type = "sine";
          osc.frequency.value = freq;
          osc.connect(gain);
          osc.start();
        });
        audioCtxRef.current = ctx;
        gainRef.current = gain;
      } catch {}
      setMuted(false);
    } else {
      // Fade out and close
      if (gainRef.current && audioCtxRef.current) {
        gainRef.current.gain.linearRampToValueAtTime(0, audioCtxRef.current.currentTime + 0.5);
        const ctx = audioCtxRef.current;
        setTimeout(() => {
          ctx.close().catch(() => {});
          if (audioCtxRef.current === ctx) {
            audioCtxRef.current = null;
            gainRef.current = null;
          }
        }, 600);
      }
      setMuted(true);
    }
  };

  // ── Derived state ─────────────────────────────────────────────────────────
  //
  // Phase 1  0–2 s   file drop
  // Phase 2  2–5 s   upload + analyzing
  // Phase 3  5–10 s  analysis results
  // Phase 4  10–25 s generating → both option cards → A selected → B selected → export
  // Phase 7  25 s+   fade to loop
  //
  const phase = t < 2000 ? 1 : t < 5000 ? 2 : t < 10000 ? 3 : t < 25000 ? 4 : 7;

  // Phase 1
  const fileDrop    = norm(t, 400, 750);
  const fileVisible = t > 400 && t < 2000;

  // Phase 2
  const uploadPct = Math.round(clamp(norm(t, 2100, 3900) * 100, 0, 100));

  // Phase 3 — analysis items fade in
  const aVis = ANALYSIS.map((_, i) => t > 5000 + i * 600);

  // Phase 4 — option cards appear, then selection cycles
  const optVis: [boolean, boolean] = [t > 12200, t > 14200];
  const optASelected = t >= 12200 && t < 17500;
  const optBSelected = t >= 17500 && t < 23500;

  // Export sequence
  const showExport   = optVis[0];
  const exportLabel  = optBSelected ? "Export Option B" : "Export Option A";
  const exportPulse  = t >= 21500 && t < 23200;
  const exportSpin   = t >= 23200 && t < 24500;
  const exportDone   = t >= 24500 && t < 26500;
  const exportBorder = exportPulse
    ? 0.25 + 0.28 * ((Math.sin(t / 190) + 1) / 2)
    : exportDone ? 0.7 : 0.28;

  // Animated waveform bars (8 bars, driven by t)
  const waveH = Array.from({ length: 8 }, (_, i) =>
    0.22 + 0.65 * ((Math.sin(t / 270 + i * 0.75) + 1) / 2)
  );

  // Borders / glows
  const borderGlow = phase >= 3 ? 0.15 + 0.12 * Math.sin(t / 900) : 0;

  // Fade envelope
  const opacity = t < 600 ? t / 600 : t > 25000 ? clamp(1 - (t - 25000) / 3000, 0, 1) : 1;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className="block mt-10 sm:mt-16 max-w-3xl mx-auto px-3 sm:px-0" style={{ opacity }}>
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
        {/* items-stretch so right panel inherits left panel's height on desktop */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-stretch">

          {/* ── LEFT PANEL — portrait video ── */}
          <div className="sm:flex-shrink-0 w-[180px] sm:w-[280px] mx-auto sm:mx-0">
            <div
              className="rounded-xl overflow-hidden relative w-full"
              style={{
                aspectRatio: "9/16",
                background: "#0a0a0a",
                border: `1px solid rgba(200,169,110,${borderGlow})`,
                transition: "border-color 0.6s",
              }}
            >
              <video
                ref={videoRef}
                src="/demo-video.mp4"
                autoPlay muted loop playsInline controls={false}
                style={{
                  position: "absolute", top: 0, left: 0,
                  width: "100%", height: "100%",
                  objectFit: "cover", zIndex: 0,
                  opacity: phase === 1 ? 0.25 : phase >= 2 ? 1 : 0,
                  transition: "opacity 0.8s ease",
                }}
              />

              {/* Phase 1: drop zone */}
              {phase === 1 && (
                <div
                  className="absolute inset-0 border-2 border-dashed border-[#2A2A2A] rounded-xl flex flex-col items-center justify-center"
                  style={{ zIndex: 1 }}
                >
                  {fileVisible ? (
                    <div
                      className="flex flex-col items-center gap-1.5"
                      style={{ opacity: fileDrop, transform: `translateY(${(1 - fileDrop) * -36}px)` }}
                    >
                      <svg className="w-9 h-9 text-[#C8A96E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

              {/* Phase 2: upload progress bar */}
              {phase === 2 && (
                <div
                  className="absolute inset-0 bg-black/30 rounded-xl flex flex-col justify-end p-4"
                  style={{ zIndex: 1 }}
                >
                  <div className="flex justify-between text-[10px] mb-1.5">
                    <span className="text-[#a0a0b8]">demo-video.mp4</span>
                    <span className="text-[#C8A96E] font-semibold">{uploadPct}%</span>
                  </div>
                  <div className="h-1.5 bg-[#2A2A2A] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${uploadPct}%`, background: "linear-gradient(90deg,#C8A96E,#e8d09a)" }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT PANEL ── */}
          {/* flex-col + flex-1 on children fills the full panel height on desktop */}
          <div className="sm:flex-1 flex flex-col gap-2 min-h-0">

            {/* Phase 2 — analyzing waveform */}
            {phase === 2 && (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 py-6">
                <div className="flex items-end gap-0.5 h-6">
                  {[0.4, 0.8, 1.0, 0.6, 0.9, 0.5, 0.75].map((base, i) => (
                    <div
                      key={i}
                      className="w-1 rounded-full bg-[#C8A96E]/50"
                      style={{ height: `${(0.3 + 0.7 * base * ((Math.sin(t / 180 + i * 0.65) + 1) / 2)) * 100}%` }}
                    />
                  ))}
                </div>
                <span className="text-[#a0a0b8] text-[11px]">Analyzing your video...</span>
              </div>
            )}

            {/* Phase 3 — analysis results */}
            {phase === 3 && (
              <div className="flex-1 flex flex-col justify-center gap-1.5">
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

            {/* Phase 4 — generating → two option cards → export */}
            {phase >= 4 && (
              <div className="flex-1 flex flex-col gap-3 min-h-0">

                {/* "Generating..." shown before Option A appears */}
                {!optVis[0] && (
                  <div className="flex-1 flex flex-col items-center justify-center gap-2">
                    <div className="flex items-end gap-0.5 h-5">
                      {[0.5, 0.9, 0.7, 1.0, 0.6, 0.8, 0.4, 0.75].map((base, i) => (
                        <div
                          key={i}
                          className="w-1 rounded-full bg-[#C8A96E]/50"
                          style={{ height: `${(0.25 + 0.75 * base * ((Math.sin(t / 220 + i * 0.8) + 1) / 2)) * 100}%` }}
                        />
                      ))}
                    </div>
                    <span className="text-[#a0a0b8] text-[11px]">Generating your soundtrack...</span>
                    <span className="text-[#9090aa] text-[10px]">30–60 seconds</span>
                  </div>
                )}

                {/* Option cards + export (once Option A is ready) */}
                {optVis[0] && (
                  <>
                    <OptionCard
                      label="Option A"
                      description={OPTIONS[0].description}
                      tags={OPTIONS[0].tags}
                      selected={optASelected}
                      bars={optASelected ? waveH : STATIC_A}
                      visible={optVis[0]}
                    />
                    <OptionCard
                      label="Option B"
                      description={OPTIONS[1].description}
                      tags={OPTIONS[1].tags}
                      selected={optBSelected}
                      bars={optBSelected ? waveH : STATIC_B}
                      visible={optVis[1]}
                    />

                    {/* Export button — anchored to bottom of right panel */}
                    {showExport && (
                      <button
                        className="flex-shrink-0 w-full rounded-xl text-[12px] font-bold h-[36px] flex items-center justify-center gap-2"
                        style={{
                          background: exportDone
                            ? "rgba(34,197,94,0.12)"
                            : exportPulse
                            ? `rgba(200,169,110,${0.10 + 0.12 * ((Math.sin(t / 190) + 1) / 2)})`
                            : "rgba(200,169,110,0.09)",
                          border: exportDone
                            ? "1px solid rgba(34,197,94,0.55)"
                            : `1px solid rgba(200,169,110,${exportBorder})`,
                          color: exportDone ? "#4ade80" : "#C8A96E",
                          transition: "background 0.3s, border-color 0.2s, color 0.4s",
                        }}
                      >
                        {exportSpin ? (
                          <>
                            <span
                              className="inline-block w-3.5 h-3.5 rounded-full border-2 border-[#C8A96E] border-t-transparent"
                              style={{ animation: "spin 0.7s linear infinite" }}
                            />
                            Exporting...
                          </>
                        ) : exportDone ? (
                          "✓  Ready to download"
                        ) : (
                          exportLabel
                        )}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
