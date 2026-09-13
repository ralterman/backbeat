"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

const PHASE_DURATIONS = [
  3000, // 1  upload animation
  4000, // 2  analyzing + video thumbnail appears
  2000, // 3  options animate in
  7000, // 4  option A playing
  9000, // 5  option B playing
  4000, // 6  export  (2s exporting → 2s ready)
  2000, // 7  fade out and reset
] as const;

const OPTION_A = {
  label: "Option A",
  description: "Driving synthwave backdrop — builds with the city's kinetic energy",
  tags: ["synthwave", "driving", "energetic"] as const,
};

const OPTION_B = {
  label: "Option B",
  description: "Cinematic orchestral swell — lifts the narrative arc of the footage",
  tags: ["orchestral", "cinematic", "atmospheric"] as const,
};

const ANALYSIS_ITEMS = [
  { label: "Mood",      value: "Energetic & cinematic",                         kind: "text" as const },
  { label: "Energy",    value: 9,                                               kind: "bar"  as const },
  { label: "Pace",      value: "Fast",                                          kind: "text" as const },
  { label: "Scene",     value: ["Urban", "Driving", "Night city", "Timelapse"], kind: "tags" as const },
  { label: "BPM range", value: "120–140",                                       kind: "text" as const },
];

// Static waveform bar heights for inactive cards
const BARS_A = [0.35, 0.65, 0.45, 0.80, 0.30, 0.60, 0.40, 0.65];
const BARS_B = [0.30, 0.55, 0.75, 0.42, 0.68, 0.38, 0.58, 0.48];

// ─── OptionCard ───────────────────────────────────────────────────────────────

interface OptionCardProps {
  label: string;
  description: string;
  tags: readonly string[];
  active: boolean;
  bars: number[];
  animateIn: boolean;
  animDelay: number;
}

function OptionCard({ label, description, tags, active, bars, animateIn, animDelay }: OptionCardProps) {
  return (
    <div
      className="flex-1 rounded-xl px-3 py-2.5 flex flex-col gap-1.5"
      style={{
        opacity: animateIn ? 1 : 0,
        transform: animateIn ? "translateX(0)" : "translateX(14px)",
        background: active ? "rgba(200,169,110,0.10)" : "rgba(22,22,22,0.75)",
        border: `1px solid ${active ? "rgba(200,169,110,0.35)" : "rgba(42,42,42,0.8)"}`,
        transition: [
          `opacity 0.4s ease-out ${animDelay}ms`,
          `transform 0.4s ease-out ${animDelay}ms`,
          "background 0.5s ease",
          "border-color 0.4s ease",
        ].join(", "),
      }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[#9090aa] text-[9px] uppercase tracking-widest font-semibold shrink-0">
            {label}
          </span>
          {active && (
            <span className="text-[8px] bg-[#C8A96E]/15 text-[#C8A96E] border border-[#C8A96E]/25 rounded px-1.5 py-px font-semibold shrink-0">
              Playing
            </span>
          )}
        </div>
        {/* Waveform bars */}
        <div className="flex items-end gap-px h-3.5 shrink-0" style={{ opacity: active ? 1 : 0.28 }}>
          {bars.map((h, i) => (
            <div
              key={i}
              className="w-0.5 rounded-full"
              style={{
                height: `${Math.round(h * 100)}%`,
                background: active ? "#C8A96E" : "#a0a0b8",
              }}
            />
          ))}
        </div>
      </div>
      {/* Description */}
      <p className="text-[#c0c0d0] text-[9px] leading-snug">{description}</p>
      {/* Tags */}
      <div className="flex flex-wrap gap-1">
        {tags.map(tag => (
          <span
            key={tag}
            className="text-[8px] px-1.5 py-0.5 rounded-full capitalize"
            style={{
              background: active ? "rgba(200,169,110,0.10)" : "rgba(30,30,30,0.9)",
              color: active ? "#C8A96E" : "#9090aa",
              border: `1px solid ${active ? "rgba(200,169,110,0.20)" : "rgba(55,55,55,0.8)"}`,
            }}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── DemoWidget ───────────────────────────────────────────────────────────────

export function DemoWidget() {
  // ── State (single source of truth) ─────────────────────────────────────────
  const [phase, setPhase]                 = useState(1);
  const [exportLabel, setExportLabel]     = useState<"exporting" | "ready">("exporting");
  const [isMuted, setIsMuted]             = useState(true);
  const [tick, setTick]                   = useState(0);
  const [analysisCount, setAnalysisCount] = useState(0);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const isMutedRef        = useRef(true);
  const hasUserGestureRef = useRef(false);
  const audioARef         = useRef<HTMLAudioElement>(null);
  const audioBRef         = useRef<HTMLAudioElement>(null);
  const videoRef          = useRef<HTMLVideoElement>(null);
  const demoRef           = useRef<HTMLDivElement>(null);
  // phaseRef is written every render so IntersectionObserver callbacks
  // (which close over a stale scope from their setup useEffect) can read
  // the live phase value without being re-registered on every phase change.
  const phaseRef          = useRef(phase);
  phaseRef.current        = phase;

  // ── Phase timer — single effect, fixed deterministic durations ────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      setPhase(p => {
        if (p === 7) {
          setExportLabel("exporting"); // reset for next loop
          return 1;
        }
        return p + 1;
      });
    }, PHASE_DURATIONS[phase - 1]);
    return () => clearTimeout(timer);
  }, [phase]);

  // ── Export sub-phase ───────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === 6) {
      setExportLabel("exporting");
      const t = setTimeout(() => setExportLabel("ready"), 2000);
      return () => clearTimeout(t);
    }
    if (phase === 1) setExportLabel("exporting");
  }, [phase]);

  // ── Waveform animation tick ────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 4 && phase !== 5) return;
    const id = setInterval(() => setTick(n => n + 1), 80);
    return () => clearInterval(id);
  }, [phase]);

  // ── Analysis stagger ───────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 2) { setAnalysisCount(0); return; }
    if (analysisCount >= ANALYSIS_ITEMS.length) return;
    const t = setTimeout(() => setAnalysisCount(c => c + 1), 500);
    return () => clearTimeout(t);
  }, [phase, analysisCount]);

  // ── Audio: on mount — prepare both tracks ──────────────────────────────────
  useEffect(() => {
    const a = audioARef.current;
    const b = audioBRef.current;
    if (!a || !b) return;
    a.currentTime = 0;
    b.currentTime = 0;
    a.volume = 0;
    b.volume = 0;
    a.loop = true;
    b.loop = true;
  }, []);

  // ── Audio: volume helper ───────────────────────────────────────────────────
  // Sets volumes based on phase and mute state. Never calls pause() or play().
  // Phase 7 is intentionally excluded here — the dedicated fade effect handles it.
  const applyAudioForPhase = useCallback((p: number, muted: boolean) => {
    const a = audioARef.current;
    const b = audioBRef.current;
    if (!a || !b) return;

    if (muted || !hasUserGestureRef.current) {
      a.volume = 0;
      b.volume = 0;
      return;
    }

    if (p === 4)      { a.volume = 0.6; b.volume = 0;   }
    else if (p === 5) { a.volume = 0;   b.volume = 0.6; }
    else if (p === 7) { /* handled by fade effect */ }
    else              { a.volume = 0;   b.volume = 0;   }
  }, []);

  // ── Audio: phase changes drive volume ─────────────────────────────────────
  useEffect(() => {
    applyAudioForPhase(phase, isMutedRef.current);

    // Reset track positions at the start of each loop
    if (phase === 1) {
      const a = audioARef.current;
      const b = audioBRef.current;
      if (a) { a.currentTime = 0; a.volume = 0; }
      if (b) { b.currentTime = 0; b.volume = 0; }
    }
  }, [phase, applyAudioForPhase]);

  // ── Audio: phase 7 fade-out ────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 7) return;
    if (isMutedRef.current || !hasUserGestureRef.current) return;

    // Capture starting volume (whichever track was active in phase 5)
    const startVol = audioBRef.current?.volume ?? 0;
    if (startVol <= 0) return;

    const fadeSteps = 20;
    const stepMs    = PHASE_DURATIONS[6] / fadeSteps; // 100ms per step
    let step = 0;

    const fade = setInterval(() => {
      step++;
      const vol = Math.max(0, startVol - (startVol * step) / fadeSteps);
      if (audioARef.current) audioARef.current.volume = vol;
      if (audioBRef.current) audioBRef.current.volume = vol;
      if (step >= fadeSteps) clearInterval(fade);
    }, stepMs);

    return () => clearInterval(fade);
  }, [phase]);

  // ── Intersection observer — pause when scrolled out, resume on scroll back ─
  // Mounted once ([] deps). Uses phaseRef / isMutedRef / hasUserGestureRef for
  // live values without needing to re-register on every phase or mute change.
  useEffect(() => {
    const el = demoRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          // Out of view — silence audio and pause video
          if (audioARef.current) audioARef.current.volume = 0;
          if (audioBRef.current) audioBRef.current.volume = 0;
          if (videoRef.current) videoRef.current.pause();
        } else {
          // Back in view — restore audio for current phase (if user has unmuted)
          applyAudioForPhase(phaseRef.current, isMutedRef.current);
          // Resume video if we're in a playing phase
          if (videoRef.current && (phaseRef.current === 4 || phaseRef.current === 5)) {
            videoRef.current.play().catch(() => {});
          }
        }
      },
      { threshold: 0.1 }, // fires when < 10% of demo is visible
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [applyAudioForPhase]); // applyAudioForPhase is stable (useCallback [])

  // ── Video control ──────────────────────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    if (phase === 1) {
      // Upload screen — hide is handled via React-derived opacity; just reset
      v.pause();
      v.currentTime = 0;
    } else if (phase === 2) {
      // Show poster frame; keep paused
      v.pause();
    } else if (phase === 3) {
      // Options animate in — poster still visible, still paused
      v.pause();
    } else if (phase === 4) {
      // Option A — play from beginning
      v.currentTime = 0;
      v.play().catch(() => {});
    } else if (phase === 5) {
      // Option B — restart from beginning
      v.currentTime = 0;
      v.play().catch(() => {});
    } else if (phase === 6) {
      // Export — let it keep playing; don't interrupt
    } else if (phase === 7) {
      v.pause();
    }
  }, [phase]);

  // ── Mute toggle — the ONE user gesture that unlocks all audio ─────────────
  // IMPORTANT: play() is called HERE and ONLY HERE.
  // iOS Safari blocks audio.play() outside a real touch/click handler.
  // play() is called unconditionally so both tracks become "playing" (at
  // volume 0) on the very first tap. All future phase switches adjust
  // volume only — zero additional play() calls are ever made.
  const handleMuteToggle = () => {
    const newMuted = !isMuted;
    isMutedRef.current = newMuted;
    setIsMuted(newMuted);
    hasUserGestureRef.current = true;

    const a = audioARef.current;
    const b = audioBRef.current;
    if (!a || !b) return;

    // play() must be the FIRST audio call inside this gesture handler.
    // Calling it before volume assignment means iOS unlocks audio at the
    // system level before we decide what volume to set.
    Promise.all([a.play(), b.play()]).catch(() => {});

    if (newMuted) {
      a.volume = 0;
      b.volume = 0;
    } else {
      applyAudioForPhase(phase, false);
    }
  };

  // ── Derived state ──────────────────────────────────────────────────────────
  const videoVisible   = phase >= 2;
  const showOptions    = phase >= 3 && phase <= 6;
  const optAActive     = phase === 4;
  const optBActive     = phase >= 5;
  const exportBtnLabel = phase >= 5 ? "Export Option B" : "Export Option A";

  // Animated waveform for active cards
  const liveWave = Array.from({ length: 8 }, (_, i) =>
    0.18 + 0.72 * ((Math.sin(tick * 0.35 + i * 0.82) + 1) / 2)
  );
  const waveA = optAActive ? liveWave : BARS_A;
  const waveB = optBActive ? liveWave : BARS_B;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div ref={demoRef} className="mt-10 sm:mt-16 max-w-3xl mx-auto px-3 sm:px-0">

      {/* Audio elements — always in DOM, never unmounted */}
      <audio ref={audioARef} src="/demo/demo-track.mp3"   preload="auto" />
      <audio ref={audioBRef} src="/demo/demo-track-b.mp3" preload="auto" />

      {/* ── Browser mockup card ── */}
      <div
        className="bg-[#141414]/80 border border-[#2A2A2A] rounded-2xl p-3 sm:p-5 shadow-2xl shadow-black/60"
        style={{
          opacity: phase === 7 ? 0 : 1,
          transition: "opacity 1.5s ease",
        }}
      >
        {/* Window chrome */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-3 h-3 rounded-full bg-red-400/50" />
          <div className="w-3 h-3 rounded-full bg-yellow-400/50" />
          <div className="w-3 h-3 rounded-full bg-green-400/50" />
          <div className="flex-1 bg-[#1E1E1E] rounded-lg h-5 ml-2 flex items-center px-3">
            <span className="text-[#9090aa] text-[10px]">backbeat.me/analyze</span>
          </div>
        </div>

        {/* Content row */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">

          {/* ── LEFT: portrait video panel ── */}
          <div className="flex-shrink-0 mx-auto sm:mx-0 w-[180px] sm:w-[200px]">
            <div
              className="relative rounded-xl overflow-hidden w-full"
              style={{
                aspectRatio: "9/16",
                background: "#0a0a0a",
                border: `1px solid rgba(200,169,110,${optAActive || optBActive ? 0.22 : 0.05})`,
                transition: "border-color 0.6s ease",
              }}
            >
              {/*
                Opacity controlled via React-derived `videoVisible` state — not
                imperative style mutation — so React reconciliation never resets it.
                poster="/demo/demo-poster.jpg" shows the first frame immediately,
                eliminating the black-flash on mobile.
                muted + playsInline are required for iOS Safari autoplay.
              */}
              <video
                ref={videoRef}
                src="/demo-video.mp4"
                poster="/demo/demo-poster.jpg"
                muted
                playsInline
                preload="auto"
                className="absolute inset-0 w-full h-full object-cover"
                style={{
                  opacity: videoVisible ? 1 : 0,
                  transition: "opacity 0.5s ease",
                }}
              />

              {/* Phase 1 upload overlay */}
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 bg-[#0a0a0a]"
                style={{
                  opacity: phase === 1 ? 1 : 0,
                  pointerEvents: phase === 1 ? "auto" : "none",
                  transition: "opacity 0.4s ease",
                }}
              >
                <svg className="w-8 h-8 text-[#C8A96E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <div className="text-center">
                  <p className="text-[#c0c0d0] text-[10px] font-medium">demo-video.mp4</p>
                  <p className="text-[#9090aa] text-[9px]">58 MB</p>
                </div>
                <div className="w-full">
                  <div className="h-1 bg-[#2A2A2A] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        background: "linear-gradient(90deg, #C8A96E, #e8d09a)",
                        animation: "uploadFill 2.5s ease-out 0.4s both",
                      }}
                    />
                  </div>
                  <p className="text-[#9090aa] text-[9px] mt-1 text-center">Uploading…</p>
                </div>
              </div>
            </div>
          </div>

          {/*
            ── RIGHT: phase content panels ──
            All three panels always mounted. opacity + pointerEvents toggle
            between them. Fixed min-height prevents layout jumps.
          */}
          <div
            className="flex-1 relative"
            style={{ minHeight: "clamp(260px, 52vw, 350px)" }}
          >

            {/* Panel A: placeholder (phase 1) */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-2"
              style={{
                opacity: phase === 1 ? 1 : 0,
                pointerEvents: phase === 1 ? "auto" : "none",
                transition: "opacity 0.3s ease",
              }}
            >
              <svg className="w-8 h-8 text-[#252530]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
              <span className="text-[#252535] text-[11px]">Your AI soundtrack will appear here</span>
            </div>

            {/* Panel B: analysis (phase 2) */}
            <div
              className="absolute inset-0 flex flex-col gap-1.5 overflow-hidden pt-0.5"
              style={{
                opacity: phase === 2 ? 1 : 0,
                pointerEvents: phase === 2 ? "auto" : "none",
                transition: "opacity 0.3s ease",
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-end gap-0.5 h-4">
                  {[0.4, 0.7, 0.5, 0.85, 0.6, 0.75, 0.45].map((h, i) => (
                    <div key={i} className="w-0.5 rounded-full bg-[#C8A96E]/40"
                      style={{ height: `${h * 100}%` }} />
                  ))}
                </div>
                <span className="text-[#a0a0b8] text-[11px]">Analyzing your video…</span>
              </div>

              {ANALYSIS_ITEMS.map((item, i) => (
                <div
                  key={i}
                  className="bg-[#1E1E1E]/60 rounded-lg px-2.5 py-2"
                  style={{
                    opacity: i < analysisCount ? 1 : 0,
                    transform: i < analysisCount ? "translateY(0)" : "translateY(6px)",
                    transition: "opacity 0.4s ease-out, transform 0.4s ease-out",
                  }}
                >
                  <div className="text-[#9090aa] text-[9px] uppercase tracking-wide mb-1">
                    {item.label}
                  </div>
                  {item.kind === "bar" ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-[#2A2A2A] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: i < analysisCount ? `${(item.value as number) * 10}%` : "0%",
                            background: "linear-gradient(90deg, #C8A96E, #e8d09a)",
                            transition: "width 0.9s ease-out",
                          }}
                        />
                      </div>
                      <span className="text-[#C8A96E] text-[10px] font-bold shrink-0">
                        {item.value}/10
                      </span>
                    </div>
                  ) : item.kind === "tags" ? (
                    <div className="flex flex-wrap gap-1">
                      {(item.value as string[]).map(tag => (
                        <span key={tag}
                          className="text-[#C8A96E] text-[9px] bg-[#C8A96E]/10 rounded px-1.5 py-0.5">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-white text-[11px]">{item.value as string}</span>
                  )}
                </div>
              ))}
            </div>

            {/* Panel C: option cards + export (phases 3–6) */}
            <div
              className="absolute inset-0 flex flex-col gap-2.5"
              style={{
                opacity: showOptions ? 1 : 0,
                pointerEvents: showOptions ? "auto" : "none",
                transition: "opacity 0.4s ease",
              }}
            >
              <OptionCard
                label={OPTION_A.label}
                description={OPTION_A.description}
                tags={OPTION_A.tags}
                active={optAActive}
                bars={waveA}
                animateIn={phase >= 3}
                animDelay={0}
              />
              <OptionCard
                label={OPTION_B.label}
                description={OPTION_B.description}
                tags={OPTION_B.tags}
                active={optBActive}
                bars={waveB}
                animateIn={phase >= 3}
                animDelay={80}
              />

              {/*
                Export button:
                - phases 3–5  → gold, "Export Option A/B"
                - phase 6 (0–2s) → gold spinner, "Exporting…"
                - phase 6 (2–4s) → green, "✓ Ready to download ↓"
                - phase 7  → opacity 0, pointer-events none
              */}
              <button
                className="flex-shrink-0 w-full rounded-xl text-[12px] font-bold h-[36px] flex items-center justify-center gap-2"
                style={{
                  opacity: phase === 7 ? 0 : 1,
                  pointerEvents: phase === 7 ? "none" : "auto",
                  background: exportLabel === "ready"
                    ? "rgba(34, 197, 94, 0.12)"
                    : "rgba(200, 169, 110, 0.09)",
                  border: exportLabel === "ready"
                    ? "1px solid rgba(34, 197, 94, 0.55)"
                    : "1px solid rgba(200, 169, 110, 0.28)",
                  color: exportLabel === "ready" ? "#4ade80" : "#C8A96E",
                  transition: [
                    "opacity 0.3s ease",
                    "background 0.35s ease",
                    "border-color 0.3s ease",
                    "color 0.35s ease",
                  ].join(", "),
                }}
              >
                {phase === 6 ? (
                  exportLabel === "ready" ? (
                    "✓  Ready to download ↓"
                  ) : (
                    <>
                      <span
                        className="w-3.5 h-3.5 rounded-full border-2 border-[#C8A96E] border-t-transparent inline-block flex-shrink-0"
                        style={{ animation: "spin 0.7s linear infinite" }}
                      />
                      Exporting…
                    </>
                  )
                ) : (
                  exportBtnLabel
                )}
              </button>
            </div>

          </div>{/* end right panel */}
        </div>{/* end content row */}
      </div>{/* end card */}

      {/* ── Mute toggle ── */}
      {/*
        z-10 relative: prevents the button from being obscured by absolutely-
        positioned phase panels inside the card above it on some mobile browsers.
      */}
      <div className="relative z-10 flex justify-center mt-5">
        <button
          type="button"
          onClick={handleMuteToggle}
          className="flex items-center gap-2.5 px-5 py-3 min-h-[44px] min-w-[44px] rounded-full text-sm font-semibold hover:opacity-90 active:scale-95 transition-all duration-200"
          style={{
            background: isMuted ? "rgba(200,169,110,0.08)" : "rgba(200,169,110,0.18)",
            border: "1px solid rgba(200,169,110,0.35)",
            color: "#C8A96E",
            touchAction: "manipulation", // prevents double-tap zoom stealing the first tap
            // Pulse when audio is ready to play but user hasn't tapped yet
            animation: (isMuted && (phase === 4 || phase === 5))
              ? "audioPulse 2s ease-in-out infinite"
              : "none",
          }}
        >
          {isMuted ? (
            <>
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
              <span>Hear the music</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M15.536 8.464a5 5 0 010 7.072M17.95 5.05a10 10 0 010 13.9" />
              </svg>
              <span>Mute</span>
            </>
          )}
        </button>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes uploadFill {
          from { width: 0%; }
          to   { width: 88%; }
        }
        @keyframes audioPulse {
          0%,  100% { box-shadow: 0 0 0 0   rgba(200,169,110,0);    }
          50%        { box-shadow: 0 0 0 8px rgba(200,169,110,0.18); }
        }
      `}</style>
    </div>
  );
}
