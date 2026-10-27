"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { MUSIC_GAIN_LINEAR } from "@/lib/audioMix";

/**
 * A looping clip with the browser's native controls (play, pause, scrub,
 * volume) plus Backbeat's generated track riding underneath it.
 *
 * The track is a second media element kept in lockstep with the video: it
 * starts and stops with the video's own play/pause (native controls, overlay
 * taps and scroll-away pauses all go through the same events), its volume
 * follows the video's volume slider and mute, and it is re-synced to the
 * video's clock on every timeupdate.
 *
 * Hero (a clip with recorded sound): autoplays muted and inline, with an
 * Original / With Backbeat toggle whose state is derived from the player:
 * muted = nothing selected; unmuted with the track off = Original; unmuted
 * with the track on = With Backbeat. "Original" unmutes the clip alone,
 * "With Backbeat" unmutes and crossfades the track in at the Balanced level
 * (the same gain the export uses).
 *
 * Row (clips shown as a poster): nothing loads or plays until a tap. The
 * centered play overlay starts the clip with its track; a tap on the playing
 * clip pauses both. The track is always on for a row clip.
 *
 * Mobile rules: every unmute and every audio.play() happens synchronously
 * inside a user gesture (iOS requires it), and the AudioContext behind the
 * waveform is only ever created inside a gesture. Only one player has sound
 * at a time: starting one broadcasts on `window`; other row players pause and
 * the hero drops back to muted. Any clip that scrolls out of view pauses.
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
  /** Hero: preload the whole clip and autoplay muted. Row: poster until a tap. */
  variant: "hero" | "row";
  className?: string;
}

export function DemoPlayer({ clip, variant, className = "" }: Props) {
  const isHero = variant === "hero";
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fadeRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  /** Fade factor of the track, 0..1; the audible level is gain × Balanced × video volume. */
  const gainRef = useRef(0);
  /** Whether the generated track rides along whenever the video plays. Always on for a row clip. */
  const trackOnRef = useRef(!isHero);
  const pausedByViewRef = useRef(false);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(isHero);
  const [trackOn, setTrackOn] = useState(!isHero);
  const [autoplay, setAutoplay] = useState(isHero);

  // Respect data-saver / slow links: no autoplay anywhere.
  useEffect(() => {
    if (constrainedNetwork()) setAutoplay(false);
  }, []);

  // React does not render the `muted` attribute on the server, so an
  // autoplaying hero could be blocked as "unmuted" before hydration. Set it
  // explicitly on mount and (re)start muted playback, which never needs a
  // gesture.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isHero) return;
    video.muted = true;
    video.defaultMuted = true;
    if (autoplay && video.paused) video.play().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay]);

  const applyVolume = useCallback(() => {
    const video = videoRef.current, audio = audioRef.current;
    if (!video || !audio) return;
    audio.volume = Math.max(0, Math.min(1, gainRef.current * MUSIC_LEVEL * video.volume));
    audio.muted = video.muted;
  }, []);

  const fadeTo = useCallback((target: number, onDone?: () => void) => {
    if (fadeRef.current) cancelAnimationFrame(fadeRef.current);
    const from = gainRef.current, t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / FADE_MS);
      gainRef.current = from + (target - from) * (k * k * (3 - 2 * k)); // smoothstep
      applyVolume();
      if (k < 1) fadeRef.current = requestAnimationFrame(step);
      else { fadeRef.current = null; onDone?.(); }
    };
    fadeRef.current = requestAnimationFrame(step);
  }, [applyVolume]);

  const stopWaveform = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  /**
   * Draw the waveform from the track's real signal when an AudioContext
   * exists, else from a gentle synthetic motion. The context is created only
   * by `ensureAnalyser`, inside a user gesture: routing a media element
   * through a context that is still suspended would silence it on Safari.
   */
  const startWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || rafRef.current) return;
    const g = canvas.getContext("2d");
    if (!g) return;
    const analyser = analyserRef.current;
    const data = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
    const draw = (t: number) => {
      const w = canvas.width, h = canvas.height, bars = 28, gap = 3, bw = (w - gap * (bars - 1)) / bars;
      if (analyser && data) analyser.getByteFrequencyData(data);
      g.clearRect(0, 0, w, h);
      for (let i = 0; i < bars; i++) {
        const v = analyser && data
          ? data[Math.floor((i / bars) * data.length * 0.6)] / 255
          : 0.25 + 0.2 * Math.sin(t / 260 + i * 0.7) + 0.1 * Math.sin(t / 90 + i * 1.9);
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
    rafRef.current = requestAnimationFrame(draw);
  }, []);

  /** Gesture-only: build the analyser graph once and keep the context running. */
  const ensureAnalyser = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
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
      analyserRef.current = null;
    }
  }, []);

  /** Start the track in step with the video (the video must already be playing or about to). */
  const startTrack = useCallback(() => {
    const video = videoRef.current, audio = audioRef.current;
    if (!video || !audio) return;
    if (fadeRef.current) cancelAnimationFrame(fadeRef.current);
    const dur = audio.duration || video.duration || 15;
    audio.currentTime = video.currentTime % dur;
    gainRef.current = 0;
    applyVolume();
    audio.play().then(() => fadeTo(1)).catch(() => {});
    startWaveform();
  }, [applyVolume, fadeTo, startWaveform]);

  /** Fade the track out and pause it; the video is untouched. */
  const stopTrack = useCallback((immediate = false) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (immediate || audio.paused) {
      if (fadeRef.current) cancelAnimationFrame(fadeRef.current);
      fadeRef.current = null;
      gainRef.current = 0;
      applyVolume();
      audio.pause();
    } else {
      fadeTo(0, () => audio.pause());
    }
    stopWaveform();
  }, [applyVolume, fadeTo, stopWaveform]);

  const announce = useCallback(() => {
    window.dispatchEvent(new CustomEvent(ACTIVATE_EVENT, { detail: clip.id }));
  }, [clip.id]);

  // Video events drive everything: native controls, overlay taps and the
  // scroll-away pause all arrive here.
  useEffect(() => {
    const video = videoRef.current, audio = audioRef.current;
    if (!video || !audio) return;
    const onPlay = () => {
      pausedByViewRef.current = false;
      setPlaying(true);
      if (trackOnRef.current) startTrack();
      if (!isHero || !video.muted) announce();
    };
    const onPause = () => {
      setPlaying(false);
      stopTrack(true);
    };
    const onVolume = () => {
      setMuted(video.muted);
      applyVolume();
      if (!video.muted && !video.paused) announce();
    };
    const onTime = () => {
      if (audio.paused) return;
      if (video.currentTime < 0.35 && audio.currentTime > 1) audio.currentTime = 0;
      else if (Math.abs(audio.currentTime - video.currentTime) > 0.5) audio.currentTime = video.currentTime;
    };
    const onSeeked = () => {
      if (!audio.paused) audio.currentTime = video.currentTime % (audio.duration || video.duration || 15);
    };
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("volumechange", onVolume);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("seeked", onSeeked);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("volumechange", onVolume);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("seeked", onSeeked);
    };
  }, [isHero, announce, applyVolume, startTrack, stopTrack]);

  // Another player took the sound: rows pause, the hero drops back to muted.
  useEffect(() => {
    const onActivate = (e: Event) => {
      if ((e as CustomEvent<string>).detail === clip.id) return;
      const video = videoRef.current;
      if (!video) return;
      if (isHero) {
        if (trackOnRef.current) { trackOnRef.current = false; setTrackOn(false); stopTrack(); }
        video.muted = true;
      } else if (!video.paused) {
        video.pause();
      }
    };
    window.addEventListener(ACTIVATE_EVENT, onActivate);
    return () => window.removeEventListener(ACTIVATE_EVENT, onActivate);
  }, [clip.id, isHero, stopTrack]);

  // Pause when scrolled out of view. A muted hero resumes on its own when it
  // comes back (muted playback needs no gesture); anything with sound waits
  // for a tap.
  useEffect(() => {
    const el = wrapRef.current, video = videoRef.current;
    if (!el || !video || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) {
        if (!video.paused) { pausedByViewRef.current = true; video.pause(); }
      } else if (pausedByViewRef.current && isHero && video.muted) {
        pausedByViewRef.current = false;
        video.play().catch(() => {});
      }
    }, { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, [isHero]);

  useEffect(() => () => {
    stopWaveform();
    if (fadeRef.current) cancelAnimationFrame(fadeRef.current);
    void audioCtxRef.current?.close().catch(() => {});
  }, [stopWaveform]);

  // ── Gesture handlers ──────────────────────────────────────────────────────

  /** Hero: unmute the clip alone. */
  const chooseOriginal = () => {
    const video = videoRef.current;
    if (!video) return;
    if (trackOnRef.current) { trackOnRef.current = false; setTrackOn(false); stopTrack(); }
    video.muted = false;
    if (video.paused) video.play().catch(() => {});
    announce();
  };

  /** Hero: unmute the clip and mix the track in. Row: start the clip with its track. */
  const chooseBackbeat = () => {
    const video = videoRef.current;
    if (!video) return;
    ensureAnalyser();
    trackOnRef.current = true;
    setTrackOn(true);
    video.muted = false;
    announce();
    if (video.paused) video.play().catch(() => {}); // `play` event starts the track
    else startTrack();
  };

  const pauseClip = () => videoRef.current?.pause();

  const label = clip.label;
  const mode: DemoMode | null = muted ? null : trackOn ? "backbeat" : "original";
  const trackAudible = playing && trackOn && !muted;

  return (
    <div ref={wrapRef} className={`flex flex-col ${className}`}>
      <div className="relative rounded-2xl overflow-hidden bg-[#141414] border border-[#2A2A2A] aspect-[9/16]">
        <video
          ref={videoRef}
          src={clip.src}
          poster={clip.poster}
          muted={isHero}
          loop
          playsInline
          controls
          controlsList="nodownload noplaybackrate noremoteplayback"
          disablePictureInPicture
          autoPlay={autoplay}
          preload={isHero ? "auto" : "metadata"}
          className="absolute inset-0 w-full h-full object-cover"
          aria-label={`${label} demo clip`}
        />
        {/* Row: centered play overlay on the poster; a tap on the playing
            clip pauses it. Both leave the native control bar uncovered. */}
        {!isHero && !playing && (
          <button
            type="button"
            onClick={chooseBackbeat}
            className="absolute inset-x-0 top-0 bottom-16 flex items-center justify-center"
            aria-label={`Play ${label} demo with Backbeat`}
          >
            <span className="w-14 h-14 rounded-full bg-[#C8A96E] flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-[#0a0a0f] ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            </span>
          </button>
        )}
        {!isHero && playing && (
          <button
            type="button"
            onClick={pauseClip}
            className="absolute inset-x-0 top-0 bottom-16"
            aria-label={`Pause ${label} demo`}
          />
        )}
        {/* Waveform, above the control bar, while the track is audible */}
        <div className={`pointer-events-none absolute left-0 right-0 bottom-14 h-12 px-4 flex items-end bg-gradient-to-t from-black/50 to-transparent transition-opacity ${trackAudible ? "opacity-100" : "opacity-0"}`}>
          <canvas ref={canvasRef} width={280} height={36} className="w-full h-9" aria-hidden="true" />
        </div>
        <span className="pointer-events-none absolute top-3 left-3 text-[10px] font-semibold tracking-widest uppercase text-white/80 bg-black/40 rounded-full px-2.5 py-1">
          {label}
        </span>
      </div>

      {isHero && (
        <div className="mt-3">
          <div role="group" aria-label={`${label}: original or with Backbeat`} className="grid grid-cols-2 p-1 rounded-xl bg-[#141414] border border-[#2A2A2A] text-sm font-medium">
            {(["original", "backbeat"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={m === "backbeat" ? chooseBackbeat : chooseOriginal}
                className={`py-2 rounded-lg transition-colors ${mode === m ? "bg-[#C8A96E] text-[#0a0a0f] font-semibold" : "text-[#a0a0b8] hover:text-white"}`}
              >
                {m === "original" ? "Original" : "With Backbeat"}
              </button>
            ))}
          </div>
        </div>
      )}

      <audio ref={audioRef} src={clip.track} preload={isHero ? "auto" : "none"} loop crossOrigin="anonymous" />
    </div>
  );
}
