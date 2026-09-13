"use client";

import { useEffect, useRef, useState } from "react";

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
  // ── State ──────────────────────────────────────────────────────────────────
  const [phase, setPhase]                 = useState(1);
  const [exportLabel, setExportLabel]     = useState<"exporting" | "ready">("exporting");
  const [isMuted, setIsMuted]             = useState(true);
  const [isVisible, setIsVisible]         = useState(false);
  const [tick, setTick]                   = useState(0);
  const [analysisCount, setAnalysisCount] = useState(0);

  // ── Refs ───────────────────────────────────────────────────────────────────
  // Web Audio API — all null until first user gesture (initAudio).
  const audioContextRef  = useRef<AudioContext | null>(null);
  const sourceARef       = useRef<AudioBufferSourceNode | null>(null);
  const sourceBRef       = useRef<AudioBufferSourceNode | null>(null);
  const gainRef          = useRef<GainNode | null>(null);
  const bufferARef       = useRef<AudioBuffer | null>(null);
  const bufferBRef       = useRef<AudioBuffer | null>(null);
  const activeTrackRef   = useRef<"a" | "b" | null>(null);
  const hasUserGestureRef = useRef(false);
  const isMutedRef       = useRef(true);
  const videoRef         = useRef<HTMLVideoElement>(null);
  const demoRef          = useRef<HTMLDivElement>(null);

  // ── Web Audio helpers ─────────────────────────────────────────────────────

  // initAudio — called once, inside handleMuteToggle (user gesture).
  // Creates the AudioContext, GainNode, and decodes both MP3 buffers.
  // No audio nodes exist in the browser until this function completes.
  const initAudio = async () => {
    if (audioContextRef.current) return; // already done
    const ctx = new AudioContext();
    audioContextRef.current = ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.6;
    gain.connect(ctx.destination);
    gainRef.current = gain;
    const [bufA, bufB] = await Promise.all([
      fetch("/demo/demo-track.mp3").then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)),
      fetch("/demo/demo-track-b.mp3").then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)),
    ]);
    bufferARef.current = bufA;
    bufferBRef.current = bufB;
  };

  // playTrack — starts a looping BufferSourceNode for track a or b.
  // Stops any currently running source first. Idempotent if already playing.
  const playTrack = (track: "a" | "b") => {
    const ctx  = audioContextRef.current;
    const gain = gainRef.current;
    if (!ctx || !gain) return;
    if (activeTrackRef.current === track) return;
    // Stop both sources safely
    try { sourceARef.current?.stop(); } catch {}
    try { sourceBRef.current?.stop(); } catch {}
    const buffer = track === "a" ? bufferARef.current : bufferBRef.current;
    if (!buffer) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop   = true;
    source.connect(gain);
    source.start(0);
    if (track === "a") sourceARef.current = source;
    else               sourceBRef.current = source;
    activeTrackRef.current = track;
  };

  // stopAllAudio — stops both sources and resets tracking state.
  const stopAllAudio = () => {
    try { sourceARef.current?.stop(); } catch {}
    try { sourceBRef.current?.stop(); } catch {}
    sourceARef.current = null;
    sourceBRef.current = null;
    activeTrackRef.current = null;
  };

  // ── Intersection observer — suspend/resume AudioContext on visibility ──────
  // Re-registered on each phase change so the `phase` value inside the
  // callback is always current (no phaseRef workaround needed).
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
        if (!entry.isIntersecting) {
          // Scrolled out: suspend audio context (works on locked screen too)
          audioContextRef.current?.suspend();
          if (videoRef.current) videoRef.current.pause();
        } else {
          // Back in view: resume only if user has already unmuted
          if (!isMutedRef.current && hasUserGestureRef.current) {
            audioContextRef.current?.resume();
            if (phase === 4 || phase === 5) {
              videoRef.current?.play().catch(() => {});
            }
          }
        }
      },
      { threshold: 0.2 },
    );
    if (demoRef.current) observer.observe(demoRef.current);
    return () => observer.disconnect();
  }, [phase]); // re-register so callback closes over current phase

  // ── Phase timer — pauses video when not visible, advances phase when visible
  useEffect(() => {
    if (!isVisible) {
      if (videoRef.current) videoRef.current.pause();
      return;
    }
    const timer = setTimeout(() => {
      setPhase(p => {
        if (p === 7) { setExportLabel("exporting"); return 1; }
        return p + 1;
      });
    }, PHASE_DURATIONS[phase - 1]);
    return () => clearTimeout(timer);
  }, [phase, isVisible]);

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

  // ── Audio: phase changes drive track selection ────────────────────────────
  // Only acts after first user gesture (hasUserGestureRef) and when unmuted.
  // Uses GainNode scheduling for smooth fade-out on phases 6, 7, and reset.
  useEffect(() => {
    if (isMutedRef.current || !hasUserGestureRef.current) return;
    if (phase === 4) {
      playTrack("a");
    } else if (phase === 5) {
      playTrack("b");
    } else if (phase === 6 || phase === 7 || phase === 1) {
      // Smooth fade out via GainNode automation
      const gain = gainRef.current;
      const ctx  = audioContextRef.current;
      if (gain && ctx) {
        gain.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
        setTimeout(() => {
          stopAllAudio();
          gain.gain.value = 0.6; // restore for next loop
        }, 2000);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Video control — muted video, play() always permitted on iOS ───────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (phase === 1)      { v.pause(); v.currentTime = 0; }
    else if (phase === 2) { v.pause(); }
    else if (phase === 3) { v.pause(); }
    else if (phase === 4) { v.currentTime = 0; v.play().catch(() => {}); }
    else if (phase === 5) { v.currentTime = 0; v.play().catch(() => {}); }
    else if (phase === 7) { v.pause(); }
    // phase 6: leave playing
  }, [phase]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopAllAudio();
      audioContextRef.current?.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Mute toggle — only place where AudioContext is created ────────────────
  // Web Audio API requires AudioContext creation inside a user gesture on iOS.
  // initAudio() creates the context + decodes buffers on first tap.
  // Subsequent taps only suspend/resume the context — no new allocations.
  const handleMuteToggle = async () => {
    const newMuted = !isMuted;
    isMutedRef.current = newMuted;
    setIsMuted(newMuted);

    if (!newMuted) {
      // User wants sound — initialize on first gesture
      if (!hasUserGestureRef.current) {
        hasUserGestureRef.current = true;
        try {
          await initAudio();
        } catch (e) {
          console.error("[DemoWidget] initAudio failed:", e);
          return;
        }
      }
      // Resume context if iOS suspended it (e.g. screen lock, tab switch)
      if (audioContextRef.current?.state === "suspended") {
        await audioContextRef.current.resume();
      }
      // Start correct track for current phase
      if (phase === 4) playTrack("a");
      else if (phase === 5) playTrack("b");
    } else {
      // Muting — suspend context (kills all sound including through speakers)
      await audioContextRef.current?.suspend();
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

      {/* No <audio> elements — Web Audio API nodes are created lazily
          inside handleMuteToggle (user gesture) via initAudio(). */}

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
      {/* z-20 relative: above all absolute-positioned phase panels */}
      <div className="relative z-20 flex justify-center mt-5">
        <button
          type="button"
          onClick={handleMuteToggle}
          style={{ touchAction: "manipulation" }}
          className="relative z-20 flex items-center gap-2 px-5 py-3 rounded-full border border-[#C8A96E]/40 text-[#C8A96E] text-sm font-medium min-h-[44px] cursor-pointer select-none bg-transparent hover:bg-[#C8A96E]/10 transition-colors duration-200"
        >
          {isMuted ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <line x1="23" y1="9" x2="17" y2="15"/>
                <line x1="17" y1="9" x2="23" y2="15"/>
              </svg>
              Hear the music
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
              </svg>
              Mute
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
