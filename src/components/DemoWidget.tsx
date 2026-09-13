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

const STATIC_A = [0.35, 0.65, 0.45, 0.80, 0.30, 0.60, 0.40, 0.65];
const STATIC_B = [0.30, 0.55, 0.75, 0.42, 0.68, 0.38, 0.58, 0.48];

// Phase durations in ms. Index = phase - 1.
const TIMINGS = [3000, 4000, 3000, 6000, 9000, 4000, 2000];
// Phase 1  3s  upload
// Phase 2  4s  analyzing
// Phase 3  3s  options appear (video visible, paused)
// Phase 4  6s  Option A selected + audio plays
// Phase 5  9s  Option B selected + audio switches
// Phase 6  4s  export  (2s exporting → 2s ready)
// Phase 7  2s  fade out / reset


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
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[#9090aa] text-[9px] uppercase tracking-widest font-semibold shrink-0">{label}</span>
          {selected && (
            <span className="text-[8px] bg-[#C8A96E]/15 text-[#C8A96E] border border-[#C8A96E]/25 rounded px-1.5 py-px font-semibold shrink-0">
              Playing
            </span>
          )}
        </div>
        <div className="flex items-end gap-px h-3.5 shrink-0" style={{ opacity: selected ? 1 : 0.28 }}>
          {bars.map((h, i) => (
            <div
              key={i}
              className="w-0.5 rounded-full"
              style={{ height: `${Math.round(h * 100)}%`, background: selected ? "#C8A96E" : "#a0a0b8" }}
            />
          ))}
        </div>
      </div>
      <p className="text-[#c0c0d0] text-[9px] leading-snug flex-1">{description}</p>
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
  const [phase, setPhase]                 = useState(1);
  const [muted, setMuted]                 = useState(true);
  const [exportLabel, setExportLabel]     = useState<'exporting' | 'ready'>('exporting');
  const [animTick, setAnimTick]           = useState(0);
  const [analysisCount, setAnalysisCount] = useState(0);

  // Refs updated every render — safe to read inside async callbacks and
  // intervals where the closed-over state value would be stale.
  const mutedRef          = useRef(true);
  mutedRef.current        = muted;

  // True after the first successful play() call (requires a user gesture).
  // Lets us skip re-calling play() on every phase change once audio is running.
  const audioStartedRef   = useRef(false);

  const videoRef          = useRef<HTMLVideoElement>(null);
  const audioARef         = useRef<HTMLAudioElement>(null);
  const audioBRef         = useRef<HTMLAudioElement>(null);
  const containerRef      = useRef<HTMLDivElement>(null);


  // ── Phase timer ────────────────────────────────────────────────────────────
  useEffect(() => {
    const ms = TIMINGS[phase - 1];
    console.log(`[DemoWidget] phase ${phase} → ${ms}ms`);
    const timer = setTimeout(() => setPhase(p => p === 7 ? 1 : p + 1), ms);
    return () => clearTimeout(timer);
  }, [phase]);


  // ── Audio — volume-based phase switching ────────────────────────────────────
  //
  // KEY DESIGN: we never call audio.pause() between phases 4 and 5.
  // Both tracks stay in a "playing" state once the user taps the button;
  // we switch between them purely by setting volume.  This avoids iOS
  // Safari's requirement for a fresh user gesture on every play() call,
  // which was the root cause of audio silently stopping on mobile.
  //
  // Phase 4  → track A vol 0.5, track B vol 0
  // Phase 5  → track A vol 0,   track B vol 0.5
  // Other    → both vol 0  (phase 7 handled by fade effect below)
  useEffect(() => {
    const a = audioARef.current;
    const b = audioBRef.current;
    if (!a || !b || !audioStartedRef.current) return;
    if (phase === 7) return; // handled by the fade-out effect

    const vol = mutedRef.current ? 0 : 0.5;
    a.volume = phase === 4 ? vol : 0;
    b.volume = phase === 5 ? vol : 0;
  }, [phase, muted]);  // `muted` in deps ensures re-run on toggle; ref keeps value current in intervals

  // Phase 7 — fade both tracks out over ~750 ms then leave them at 0
  useEffect(() => {
    if (phase !== 7) return;
    const a = audioARef.current;
    const b = audioBRef.current;
    if (!a || !b) return;
    const fade = setInterval(() => {
      if (a.volume > 0.05) a.volume = Math.max(0, a.volume - 0.05);
      else a.volume = 0;
      if (b.volume > 0.05) b.volume = Math.max(0, b.volume - 0.05);
      else b.volume = 0;
      if (a.volume === 0 && b.volume === 0) clearInterval(fade);
    }, 75);
    return () => clearInterval(fade);
  }, [phase]);


  // ── Video control ──────────────────────────────────────────────────────────
  // Video plays in phases 4-5 only; paused (but visible) in all others.
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (phase === 4 || phase === 5) {
      vid.currentTime = 0;
      vid.play().catch(() => {});
    } else {
      vid.pause();
    }
  }, [phase]);


  // ── Phase 6: exporting → ready ─────────────────────────────────────────────
  useEffect(() => {
    if (phase === 6) {
      setExportLabel('exporting');
      const t = setTimeout(() => setExportLabel('ready'), 2000);
      return () => clearTimeout(t);
    }
    if (phase === 1) setExportLabel('exporting');
  }, [phase]);


  // ── Animation tick ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === 2 || phase === 4 || phase === 5) {
      const id = setInterval(() => setAnimTick(n => n + 1), 60);
      return () => clearInterval(id);
    }
  }, [phase]);


  // ── Analysis stagger ───────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 2) { setAnalysisCount(0); return; }
    if (analysisCount >= ANALYSIS.length) return;
    const t = setTimeout(() => setAnalysisCount(c => c + 1), 600);
    return () => clearTimeout(t);
  }, [phase, analysisCount]);


  // ── Reset on scroll out ────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) {
        setPhase(1);
        const a = audioARef.current;
        const b = audioBRef.current;
        // Pause and reset position; audioStartedRef resets so the next
        // "Hear the music" tap will re-call play() with a user gesture.
        if (a) { a.pause(); a.currentTime = 0; a.volume = 0; }
        if (b) { b.pause(); b.currentTime = 0; b.volume = 0; }
        audioStartedRef.current = false;
        setMuted(true);
        // mutedRef.current is kept in sync by the render-time assignment above
      }
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);


  // ── Mute toggle ────────────────────────────────────────────────────────────
  // This handler runs inside a user-gesture, which is the only context iOS
  // Safari permits calling play() from without a policy rejection.
  const toggleMute = () => {
    const a = audioARef.current;
    const b = audioBRef.current;
    if (!a || !b) return;

    if (muted) {
      if (!audioStartedRef.current) {
        // First unmute — start both tracks simultaneously at vol 0 to
        // satisfy the single user-gesture requirement, then ramp up the
        // active track.  Both tracks stay "playing" from this point on;
        // phase switches happen via volume only (no further play() calls).
        a.volume = 0;
        b.volume = 0;
        Promise.all([a.play(), b.play()])
          .then(() => {
            audioStartedRef.current = true;
            setMuted(false);
            // Set volume for whichever phase we're currently in.
            // mutedRef.current will have already been updated by the
            // render triggered from setMuted(false) before this runs,
            // but we set directly here to avoid a frame of silence.
            a.volume = phase === 4 ? 0.5 : 0;
            b.volume = phase === 5 ? 0.5 : 0;
          })
          .catch(err => console.warn('[DemoWidget] play() blocked by browser:', err));
      } else {
        // Audio already running — just raise the right track's volume.
        setMuted(false);
        // The audio useEffect will fire on the next render and apply volumes.
      }
    } else {
      setMuted(true);
      a.volume = 0;
      b.volume = 0;
    }
  };


  // ── Derived state ──────────────────────────────────────────────────────────
  const optASelected  = phase === 4;
  const optBSelected  = phase >= 5;
  const aVis          = ANALYSIS.map((_, i) => i < analysisCount);
  const showExport    = phase >= 3 && phase <= 6;
  const selectedLabel = phase >= 5 ? "Export Option B" : "Export Option A";

  const waveH = Array.from({ length: 8 }, (_, i) =>
    0.22 + 0.65 * ((Math.sin(animTick * 0.3 + i * 0.75) + 1) / 2)
  );
  const analyzeH = Array.from({ length: 7 }, (_, i) =>
    0.22 + 0.65 * ((Math.sin(animTick * 0.25 + i * 0.65) + 1) / 2)
  );

  // Video visible from phase 3 onward (poster/first frame shown while paused).
  // Only actually plays in phases 4-5. Hidden in phases 1-2 (upload/analysis).
  const videoOpacity  = phase >= 3 ? 1 : 0;
  const widgetOpacity = phase === 7 ? 0 : 1;


  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className="block mt-10 sm:mt-16 max-w-3xl mx-auto px-3 sm:px-0"
      style={{ opacity: widgetOpacity, transition: "opacity 1.5s ease" }}
    >
      {/*
        preload="none" — don't fetch until play() is called.
        loop on both tracks so they repeat within their phase.
        onError surfaces load failures in browser console / Vercel logs.
      */}
      <audio
        ref={audioARef}
        src="/demo/demo-track.mp3"
        loop
        preload="none"
        onError={() => console.error('[DemoWidget] demo-track.mp3 failed to load')}
      />
      <audio
        ref={audioBRef}
        src="/demo/demo-track-b.mp3"
        loop
        preload="none"
        onError={() => console.error('[DemoWidget] demo-track-b.mp3 failed to load')}
      />

      {/* Fixed-height card prevents layout jumps on mobile as phases switch */}
      <div className="bg-[#141414]/80 border border-[#2A2A2A] rounded-2xl p-3 sm:p-6 shadow-2xl shadow-black/60 min-h-[600px] sm:min-h-0">

        {/* ── Window chrome ── */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-3 h-3 rounded-full bg-red-400/50" />
          <div className="w-3 h-3 rounded-full bg-yellow-400/50" />
          <div className="w-3 h-3 rounded-full bg-green-400/50" />
          <div className="flex-1 bg-[#1E1E1E] rounded-lg h-5 ml-2 flex items-center px-3">
            <span className="text-[#9090aa] text-[10px]">backbeat.me/analyze</span>
          </div>
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
              {/*
                poster: first frame shown immediately — no black flash.
                preload="auto": browser buffers before play() is called.
                muted + playsInline: required for autoplay on iOS Safari.
                opacity transitions from 0→1 when phase hits 3, so the
                poster fades in smoothly once analysis completes.
              */}
              <video
                ref={videoRef}
                src="/demo-video.mp4"
                poster="/demo/demo-poster.jpg"
                muted
                loop
                playsInline
                preload="auto"
                controls={false}
                style={{
                  position: "absolute", top: 0, left: 0,
                  width: "100%", height: "100%",
                  objectFit: "cover", zIndex: 0,
                  opacity: videoOpacity,
                  transition: "opacity 0.8s ease",
                }}
              />

              {/* Phase 1: upload drop zone overlay */}
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
                  <div className="flex flex-col items-center gap-1" style={{ animation: "fileDrop 0.45s ease-out 0.55s both" }}>
                    <span className="text-[#a0a0b8] text-xs font-medium">demo-video.mp4</span>
                    <span className="text-[#9090aa] text-[10px]">58 MB</span>
                  </div>
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

          {/* ── RIGHT PANEL ──
              All three blocks always mounted; opacity + pointer-events toggle.
              Fixed min-height prevents mobile layout jumps between phases.
          */}
          <div
            className="sm:flex-1 relative"
            style={{ minHeight: "clamp(240px, 50vw, 330px)" }}
          >
            {/* Phase 1 — placeholder */}
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
              <span className="text-[#383848] text-[11px]">Your AI soundtrack will appear here</span>
            </div>

            {/* Phase 2 — analyzing */}
            <div
              className="absolute inset-0 flex flex-col justify-start gap-1.5 pt-2 overflow-y-auto"
              style={{
                opacity: phase === 2 ? 1 : 0,
                pointerEvents: phase === 2 ? "auto" : "none",
                transition: "opacity 0.3s ease",
              }}
            >
              <div className="flex flex-col items-center gap-2 mb-2">
                <div className="flex items-end gap-0.5 h-6">
                  {analyzeH.map((h, i) => (
                    <div key={i} className="w-1 rounded-full bg-[#C8A96E]/50" style={{ height: `${h * 100}%` }} />
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

            {/* Phases 3–6 — option cards + export */}
            <div
              className="absolute inset-0 flex flex-col gap-3"
              style={{
                opacity: phase >= 3 && phase <= 6 ? 1 : 0,
                pointerEvents: phase >= 3 && phase <= 6 ? "auto" : "none",
                transition: "opacity 0.3s ease",
              }}
            >
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
                    exportLabel === 'ready' ? "✓  Ready to download ↓" : (
                      <>
                        <span
                          className="inline-block w-3.5 h-3.5 rounded-full border-2 border-[#C8A96E] border-t-transparent"
                          style={{ animation: "spin 0.7s linear infinite" }}
                        />
                        Exporting...
                      </>
                    )
                  ) : selectedLabel}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Audio toggle ── */}
      <div className="flex justify-center mt-5">
        <button
          onClick={toggleMute}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all hover:opacity-90"
          style={{
            background: muted ? "rgba(200,169,110,0.08)" : "rgba(200,169,110,0.18)",
            border: "1px solid rgba(200,169,110,0.35)",
            color: "#C8A96E",
            animation: (muted && phase >= 4 && phase <= 5) ? "audioPulse 2s ease-in-out infinite" : "none",
          }}
        >
          {muted ? (
            <>
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
              Hear the music
            </>
          ) : (
            <>
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M15.536 8.464a5 5 0 010 7.072M17.95 5.05a10 10 0 010 13.9" />
              </svg>
              Mute
            </>
          )}
        </button>
      </div>

      <style>{`
        @keyframes spin        { to { transform: rotate(360deg); } }
        @keyframes fileDrop    { from { opacity: 0; transform: translateY(-16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes uploadFill  { from { width: 0%; } to { width: 100%; } }
        @keyframes audioPulse  { 0%, 100% { box-shadow: 0 0 0 0 rgba(200,169,110,0); } 50% { box-shadow: 0 0 0 8px rgba(200,169,110,0.18); } }
      `}</style>
    </div>
  );
}
