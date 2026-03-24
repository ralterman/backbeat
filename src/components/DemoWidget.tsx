"use client";

import { useEffect, useRef, useState } from "react";

const LOOP = 24000; // total loop duration ms

const TRACKS = [
  { name: "Golden Hour Drift", artist: "Mellow Wave",    genre: "Lo-fi / Chill",    bpm: 98,  score: 98 },
  { name: "Tokyo Lights",      artist: "Studio Bloom",   genre: "Cinematic",         bpm: 110, score: 91 },
  { name: "Wanderlust",        artist: "Oak & Pine",     genre: "Indie / Acoustic",  bpm: 95,  score: 85 },
  { name: "City Pulse",        artist: "Neon Drift",     genre: "Electronic",        bpm: 112, score: 78 },
  { name: "Sunday Stroll",     artist: "The Afternoons", genre: "Ambient",           bpm: 88,  score: 71 },
];

const ANALYSIS = [
  { label: "Mood",       value: "Warm & adventurous",                         type: "mood" },
  { label: "Energy",     value: 7,                                             type: "bar"  },
  { label: "Pace",       value: "Moderate",                                   type: "text" },
  { label: "Scene",      value: ["Outdoor", "Urban", "People", "Golden hour"], type: "tags" },
  { label: "BPM range",  value: "95–115",                                     type: "text" },
] as const;

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function norm(v: number, lo: number, hi: number)   { return clamp((v - lo) / (hi - lo), 0, 1); }

export function DemoWidget() {
  const [t, setT]       = useState(0);
  const [muted, setMuted] = useState(true);
  const rafRef   = useRef<number>(0);
  const startRef = useRef<number | null>(null);
  const audioRef = useRef<{ ctx: AudioContext; gain: GainNode } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // ── Force video play (autoPlay can be silently blocked by browsers) ────────
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = true;
    vid.play().catch(() => {
      // Retry once on user interaction if initially blocked
      const retry = () => { vid.play().catch(() => {}); };
      document.addEventListener("click", retry, { once: true });
      document.addEventListener("touchstart", retry, { once: true });
    });
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

  // ── Audio ─────────────────────────────────────────────────────────────────
  const toggleMute = () => {
    if (muted) {
      if (!audioRef.current) {
        const ctx  = new AudioContext();
        const gain = ctx.createGain();
        gain.gain.value = 0;
        gain.connect(ctx.destination);

        // Lowpass filter for warmth
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 900;
        filter.Q.value = 0.7;
        filter.connect(gain);

        // Simple delay reverb
        const delay   = ctx.createDelay(2);
        const delayFb = ctx.createGain();
        const dlpf    = ctx.createBiquadFilter();
        delay.delayTime.value = 0.45;
        delayFb.gain.value    = 0.28;
        dlpf.type = "lowpass";
        dlpf.frequency.value = 800;
        delay.connect(dlpf);
        dlpf.connect(delayFb);
        delayFb.connect(delay);
        delay.connect(gain);

        // Slow volume swell (breathing)
        const swellLfo  = ctx.createOscillator();
        const swellGain = ctx.createGain();
        swellLfo.frequency.value = 0.12;
        swellGain.gain.value     = 0.016;
        swellLfo.connect(swellGain);
        swellLfo.start();

        // Cmaj7 — C4 E4 G4 B4 (one octave higher than before, no more hum)
        [261.63, 329.63, 392.0, 493.88].forEach((freq, i) => {
          [-4, 4].forEach((detune) => {
            const osc = ctx.createOscillator();
            const g   = ctx.createGain();
            osc.type = "sine";
            osc.frequency.value = freq;
            osc.detune.value    = detune;
            g.gain.value        = i === 0 ? 0.06 : 0.04;
            swellGain.connect(g.gain);
            osc.connect(g);
            g.connect(filter);
            g.connect(delay);
            osc.start();
          });
        });

        audioRef.current = { ctx, gain };
      }
      const { ctx, gain } = audioRef.current;
      ctx.resume().then(() => {
        gain.gain.setTargetAtTime(0.22, ctx.currentTime, 1.2);
      });
    } else {
      audioRef.current?.gain.gain.setTargetAtTime(0, audioRef.current.ctx.currentTime, 0.6);
    }
    setMuted(!muted);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="hidden sm:block mt-16 max-w-4xl mx-auto" style={{ opacity }}>
      <div className="bg-[#141414]/80 border border-[#2A2A2A] rounded-2xl p-6 shadow-2xl shadow-black/60">

        {/* Window chrome */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-3 h-3 rounded-full bg-red-400/50" />
          <div className="w-3 h-3 rounded-full bg-yellow-400/50" />
          <div className="w-3 h-3 rounded-full bg-green-400/50" />
          <div className="flex-1 bg-[#1E1E1E] rounded-lg h-5 ml-2 flex items-center px-3">
            <span className="text-[#3a3a5a] text-[10px]">backbeat.me/dashboard</span>
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

        <div className="grid grid-cols-3 gap-3">

          {/* ── LEFT PANEL ── */}
          <div className="col-span-2 flex flex-col gap-2">
            <div
              className="rounded-xl overflow-hidden relative"
              style={{
                height: 192,
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
                      <span className="text-[#3a3a5a] text-[10px]">58 MB</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-[#3a3a5a]">
                      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      <span className="text-xs">Drop a video to analyze</span>
                    </div>
                  )}
                </div>
              )}

              {/* Play button (phases 2–6, once thumbnail is visible) */}
              {thumbVisible && phase <= 6 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 1 }}>
                  <div className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                    <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
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

            {/* Export button */}
            {showExport && (
              <button
                className="w-full rounded-lg py-2 text-[12px] font-semibold"
                style={{
                  background: exportDone ? "rgba(34,197,94,0.12)" : "rgba(200,185,122,0.10)",
                  border: exportDone
                    ? "1px solid rgba(34,197,94,0.4)"
                    : `1px solid rgba(200,185,122,${pulseBorder})`,
                  color: exportDone ? "#4ade80" : "#c8b97a",
                  transition: "background 0.4s, border-color 0.3s, color 0.4s",
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
                  "✓  Ready to download — demo-video-backbeat.mp4"
                ) : (
                  "Export with this track"
                )}
              </button>
            )}
          </div>

          {/* ── RIGHT PANEL ── */}
          <div className="space-y-1.5 overflow-hidden">

            {/* Analyzing animation */}
            {phase === 2 && (
              <div className="flex flex-col items-center justify-center h-full gap-2 py-6">
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
                <div className="text-[#3a3a5a] text-[9px] uppercase tracking-wide mb-1">{item.label}</div>
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
                      <span className="text-[#3a3a5a] text-[9px]">{track.genre} · {track.bpm} BPM</span>
                    )}
                  </div>
                  <span
                    className="text-[11px] font-bold ml-2 shrink-0"
                    style={{ color: i === 0 ? "#c8b97a" : i === 1 ? "#9a8a55" : "#3a3a5a" }}
                  >
                    {tkScores[i]}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Spin keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
