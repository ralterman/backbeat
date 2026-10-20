"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { MUSIC_GAIN_LINEAR } from "@/lib/audioMix";

/**
 * A looping clip with a single control: Original / With Backbeat.
 *
 * "Original" plays the clip's own audio (or silence, for clips that have
 * none). "With Backbeat" crossfades the generated track in underneath at
 * the Balanced level — the same gain the export uses — and animates a
 * waveform driven by the track's actual signal.
 *
 * Mobile rules: the video autoplays muted and inline; nothing is unmuted
 * and no audio element plays until the user taps, and both happen inside
 * that tap's handler (iOS requires it). On a data-saver / slow connection
 * the clip doesn't autoplay at all — a poster is shown until a tap.
 *
 * Only one player on the page has sound at a time: activating one
 * broadcasts on `window`, and every other player drops back to Original.
 */

export interface DemoClip {
  id: string;
  label: string;
  src: string;
  poster: string;
  track: string;
  /** Whether the clip itself carries recorded audio. */
  hasOriginalAudio: boolean;
}

export type DemoMode = "original" | "backbeat";

const ACTIVATE_EVENT = "backbeat-demo-activate";
const FADE_MS = 600;
const MUSIC_LEVEL = MUSIC_GAIN_LINEAR.balanced;

function constrainedNetwork(): boolean {
  if (typeof navigator === "undefined") return false;
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (!c) return false;
  return !!c.saveData || /(^|-)(2g|3g)$/.test(c.effectiveType ?? "");
}

interface Props {
  clip: DemoClip;
  /** Hero: preload the whole clip and autoplay. Row: metadata only, play on tap. */
  variant: "hero" | "row";
  className?: string;
}

export function DemoPlayer({ clip, variant, className = "" }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fadeRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  const [mode, setMode] = useState<DemoMode>("original");
  const [started, setStarted] = useState(false); // user has tapped at least once
  const [autoplay, setAutoplay] = useState(variant === "hero");

  // Respect data-saver / slow links: no autoplay anywhere.
  useEffect(() => {
    if (constrainedNetwork()) setAutoplay(false);
  }, []);

  // Keep the generated track locked to the clip's loop point.
  useEffect(() => {
    const video = videoRef.current, audio = audioRef.current;
    if (!video || !audio) return;
    const onTime = () => {
      if (audio.paused) return;
      if (video.currentTime < 0.35 && audio.currentTime > 1) audio.currentTime = 0;
      else if (Math.abs(audio.currentTime - video.currentTime) > 0.5) audio.currentTime = video.currentTime;
    };
    video.addEventListener("timeupdate", onTime);
    return () => video.removeEventListener("timeupdate", onTime);
  }, []);

  // Drop to Original when another player takes the sound.
  useEffect(() => {
    const onActivate = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== clip.id) deactivate();
    };
    window.addEventListener(ACTIVATE_EVENT, onActivate);
    return () => window.removeEventListener(ACTIVATE_EVENT, onActivate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip.id]);

  useEffect(() => () => { stopWaveform(); if (fadeRef.current) cancelAnimationFrame(fadeRef.current); }, []);

  const fadeTo = (target: number, onDone?: () => void) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (fadeRef.current) cancelAnimationFrame(fadeRef.current);
    const from = audio.volume, t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / FADE_MS);
      audio.volume = from + (target - from) * (k * k * (3 - 2 * k)); // smoothstep
      if (k < 1) fadeRef.current = requestAnimationFrame(step);
      else { fadeRef.current = null; onDone?.(); }
    };
    fadeRef.current = requestAnimationFrame(step);
  };

  const startWaveform = () => {
    const audio = audioRef.current, canvas = canvasRef.current;
    if (!audio || !canvas) return;
    try {
      if (!audioCtxRef.current) {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        const source = ctx.createMediaElementSource(audio);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.82;
        source.connect(analyser);
        analyser.connect(ctx.destination);
        audioCtxRef.current = ctx;
        analyserRef.current = analyser;
      }
      void audioCtxRef.current.resume();
    } catch {
      analyserRef.current = null; // fall back to the CSS-animated bars
    }
    const analyser = analyserRef.current;
    const g = canvas.getContext("2d");
    if (!analyser || !g) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const draw = () => {
      analyser.getByteFrequencyData(data);
      const w = canvas.width, h = canvas.height, bars = 28, gap = 3, bw = (w - gap * (bars - 1)) / bars;
      g.clearRect(0, 0, w, h);
      for (let i = 0; i < bars; i++) {
        const v = data[Math.floor((i / bars) * data.length * 0.6)] / 255;
        const bh = Math.max(3, v * h);
        g.fillStyle = "#C8A96E";
        g.globalAlpha = 0.45 + v * 0.55;
        const x = i * (bw + gap), y = (h - bh) / 2;
        g.beginPath();
        g.roundRect(x, y, bw, bh, bw / 2);
        g.fill();
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();
  };

  const stopWaveform = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  };

  const deactivate = useCallback(() => {
    const audio = audioRef.current;
    setMode("original");
    if (audio && !audio.paused) fadeTo(0, () => audio.pause());
    stopWaveform();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activate = () => {
    const video = videoRef.current, audio = audioRef.current;
    if (!video || !audio) return;
    window.dispatchEvent(new CustomEvent(ACTIVATE_EVENT, { detail: clip.id }));
    setMode("backbeat");
    setStarted(true);
    // Everything that needs a user gesture happens synchronously here.
    video.muted = false;
    video.volume = 1;
    if (video.paused) video.play().catch(() => {});
    audio.currentTime = video.currentTime % (audio.duration || 15);
    audio.volume = 0;
    audio.play().then(() => fadeTo(MUSIC_LEVEL)).catch(() => {});
    startWaveform();
  };

  const toOriginal = () => {
    const video = videoRef.current;
    if (video) { video.muted = false; if (video.paused) video.play().catch(() => {}); }
    setStarted(true);
    deactivate();
  };

  const onToggle = (next: DemoMode) => (next === "backbeat" ? activate() : toOriginal());

  const label = clip.label;

  return (
    <div className={`flex flex-col ${className}`}>
      <div className="relative rounded-2xl overflow-hidden bg-[#141414] border border-[#2A2A2A] aspect-[9/16]">
        <video
          ref={videoRef}
          src={clip.src}
          poster={clip.poster}
          muted
          loop
          playsInline
          autoPlay={autoplay}
          preload={variant === "hero" ? "auto" : "metadata"}
          className="absolute inset-0 w-full h-full object-cover"
          aria-label={`${label} demo clip`}
        />
        {/* Poster-only state: nothing is playing until the first tap. */}
        {!autoplay && !started && (
          <button
            type="button"
            onClick={activate}
            className="absolute inset-0 flex items-center justify-center bg-black/30"
            aria-label={`Play ${label} demo`}
          >
            <span className="w-14 h-14 rounded-full bg-[#C8A96E] flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-[#0a0a0f] ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            </span>
          </button>
        )}
        {/* Waveform (bottom edge) — canvas when the track is playing */}
        <div className={`absolute left-0 right-0 bottom-0 h-14 px-4 pb-3 flex items-end bg-gradient-to-t from-black/60 to-transparent transition-opacity ${mode === "backbeat" ? "opacity-100" : "opacity-0"}`}>
          <canvas ref={canvasRef} width={280} height={36} className="w-full h-9" aria-hidden="true" />
        </div>
        <span className="absolute top-3 left-3 text-[10px] font-semibold tracking-widest uppercase text-white/80 bg-black/40 rounded-full px-2.5 py-1">
          {label}
        </span>
      </div>

      <div className="mt-3">
        <div role="group" aria-label={`${label}: original or with Backbeat`} className="grid grid-cols-2 p-1 rounded-xl bg-[#141414] border border-[#2A2A2A] text-sm font-medium">
          {(["original", "backbeat"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => onToggle(m)}
              className={`py-2 rounded-lg transition-colors ${mode === m ? "bg-[#C8A96E] text-[#0a0a0f] font-semibold" : "text-[#a0a0b8] hover:text-white"}`}
            >
              {m === "original" ? "Original" : "With Backbeat"}
            </button>
          ))}
        </div>
        {!clip.hasOriginalAudio && (
          <p className="text-[#6a6a8a] text-[11px] mt-1.5 text-center">This clip has no sound of its own.</p>
        )}
      </div>

      <audio ref={audioRef} src={clip.track} preload={variant === "hero" ? "auto" : "none"} loop crossOrigin="anonymous" />
    </div>
  );
}
