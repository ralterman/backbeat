"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * A looping demo clip with the browser's native controls and its audio baked
 * into the file, so play, pause, scrub, volume and mute all come for free.
 *
 * Hero: two files of the same clip, the clip's own sound and the clip with
 * the generated track mixed under it. Both are mounted, stacked and fully
 * preloaded; the Original / With Backbeat toggle starts the other file at
 * the current time and only then hides the one that was playing, so the swap
 * has no gap. The toggle's state is read off the player: muted = nothing
 * selected; unmuted = whichever file is showing. The hero autoplays muted.
 *
 * Row: one file, shown as a poster until a tap on the centered play overlay;
 * a tap on the playing clip pauses it. Only one row clip plays at a time
 * (starting one pauses the others and mutes the hero), and any clip that
 * scrolls out of view pauses itself.
 *
 * Fullscreen: the native button is suppressed (controlsList="nofullscreen")
 * in favour of a custom one. On a phone-width viewport it asks for true
 * fullscreen on the video; on wider screens it opens the card in a centered
 * lightbox at about twice its size, closed by the X, the backdrop or Escape.
 * The lightbox re-styles the same elements rather than remounting them, so
 * playback carries on untouched.
 *
 * The waveform reads the playing video element through an AnalyserNode. The
 * AudioContext is created only inside a user gesture (iOS), and if it can't
 * be, the bars fall back to a gentle synthetic motion.
 */

export interface DemoClip {
  id: string;
  label: string;
  src: string;
  /** Hero only: the same clip with the generated track mixed under its sound. */
  backbeatSrc?: string;
  poster: string;
}

export type DemoMode = "original" | "backbeat";

const ACTIVATE_EVENT = "backbeat-demo-activate";
const PHONE_QUERY = "(max-width: 767px)";

function constrainedNetwork(): boolean {
  if (typeof navigator === "undefined") return false;
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (!c) return false;
  return !!c.saveData || /(^|-)(2g|3g)$/.test(c.effectiveType ?? "");
}

type FullscreenVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

/**
 * Safari (macOS and iOS, including every iOS browser, which is WebKit)
 * paints a translucent start-playback overlay on any paused video that has
 * controls, which would sit under the gold play button on a row clip. On
 * Safari a row clip gets its controls only once it is playing. The result
 * is also mirrored to <html data-safari> for the CSS in globals.css. The
 * custom fullscreen button and lightbox are the same in every browser; if
 * Safari also shows its own fullscreen button in the native bar, both work.
 */
function detectIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function detectSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const safariDesktop = /Safari\//.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|Edg|OPR|Android/.test(ua);
  return detectIOS() || safariDesktop;
}

/**
 * Below lg the native controls are off and the card carries a minimal set
 * of its own: tap the video to play or pause, a 2 px progress line along
 * the bottom edge, a small mute button bottom-right and the custom
 * fullscreen button top-right. Desktop keeps the native bar.
 */
function usePhone(): boolean {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const update = () => setPhone(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return phone;
}

function useSafari(): boolean {
  const [safari, setSafari] = useState(false);
  useEffect(() => {
    const s = detectSafari();
    setSafari(s);
    if (s) document.documentElement.dataset.safari = "1";
  }, []);
  return safari;
}


interface Props {
  clip: DemoClip;
  /** Hero: preload everything and autoplay muted. Row: poster until a tap. */
  variant: "hero" | "row";
  className?: string;
}

export function DemoPlayer({ clip, variant, className = "" }: Props) {
  const isHero = variant === "hero";
  const sources: { mode: DemoMode; src: string }[] = clip.backbeatSrc
    ? [{ mode: "original", src: clip.src }, { mode: "backbeat", src: clip.backbeatSrc }]
    : [{ mode: "original", src: clip.src }];

  const wrapRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analysersRef = useRef<(AnalyserNode | null)[]>([]);
  const activeRef = useRef(0);
  const pausedByViewRef = useRef(false);

  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(isHero);
  const [autoplay, setAutoplay] = useState(isHero);
  const [lightbox, setLightbox] = useState<{ height: number } | null>(null);
  const [progress, setProgress] = useState(0);
  const safari = useSafari();
  const phone = usePhone();
  const reduceMotion = useReducedMotion();

  const activeVideo = () => videoRefs.current[activeRef.current] ?? null;

  // Respect data-saver / slow links: no autoplay anywhere.
  useEffect(() => {
    if (constrainedNetwork()) setAutoplay(false);
  }, []);

  // React does not render the `muted` attribute on the server, so an
  // autoplaying hero could be blocked as "unmuted" before hydration. Set it
  // explicitly on mount and (re)start muted playback, which needs no gesture.
  useEffect(() => {
    if (!isHero) return;
    videoRefs.current.forEach((v) => { if (v) { v.muted = true; v.defaultMuted = true; } });
    const v = videoRefs.current[0];
    if (v && autoplay && v.paused) v.play().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay]);

  // ── Waveform ──────────────────────────────────────────────────────────────

  const stopWaveform = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const startWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || rafRef.current) return;
    const g = canvas.getContext("2d");
    if (!g) return;
    let data: Uint8Array<ArrayBuffer> | null = null;
    // An analyser that only ever reports silence while the clip is playing
    // unmuted (iOS does this for video elements) would draw a flat line, so
    // after ~45 such frames the bars switch to the synthetic motion.
    let silentFrames = 0;
    // Auto-gain: bars are drawn relative to a slowly decaying peak, so a
    // quiet track (the hero mix sits the music -8 dB under the clip) still
    // fills the strip instead of hugging the floor.
    let peak = 40;
    const draw = (t: number) => {
      const analyser = analysersRef.current[activeRef.current] ?? null;
      const v0 = videoRefs.current[activeRef.current];
      if (analyser && (!data || data.length !== analyser.frequencyBinCount)) data = new Uint8Array(analyser.frequencyBinCount);
      if (analyser && data) {
        analyser.getByteFrequencyData(data);
        let max = 0;
        for (let i = 0; i < data.length; i++) if (data[i] > max) max = data[i];
        if (max === 0 && v0 && !v0.paused && !v0.muted) silentFrames++;
        else if (max > 0) silentFrames = 0;
        peak = Math.max(peak * 0.992, max, 40);
      }
      const live = !!(analyser && data) && silentFrames < 45;
      const w = canvas.width, h = canvas.height, bars = 28, gap = 3, bw = (w - gap * (bars - 1)) / bars;
      g.clearRect(0, 0, w, h);
      for (let i = 0; i < bars; i++) {
        const v = live && data
          ? Math.min(1, Math.pow(data[Math.floor((i / bars) * data.length * 0.6)] / peak, 0.8))
          : 0.25 + 0.2 * Math.sin(t / 260 + i * 0.7) + 0.1 * Math.sin(t / 90 + i * 1.9);
        const bh = Math.max(4, v * h);
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

  /**
   * Gesture-only: route every video element through one AudioContext, once.
   * Skipped on iOS: there a video element piped through WebAudio tends to
   * feed the analyser silence and, worse, starts obeying the ring/silent
   * switch, so the waveform there uses the synthetic motion instead.
   */
  const ensureAnalysers = useCallback(() => {
    if (detectIOS()) return;
    try {
      if (!audioCtxRef.current) {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtxRef.current = new Ctx();
      }
      const ctx = audioCtxRef.current;
      videoRefs.current.forEach((v, i) => {
        if (!v || analysersRef.current[i]) return;
        const source = ctx.createMediaElementSource(v);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.82;
        source.connect(analyser);
        analyser.connect(ctx.destination);
        analysersRef.current[i] = analyser;
      });
      void ctx.resume();
    } catch {
      /* no analyser: the waveform falls back to synthetic motion */
    }
  }, []);

  // ── Coordination between players ──────────────────────────────────────────

  const announce = useCallback(() => {
    window.dispatchEvent(new CustomEvent(ACTIVATE_EVENT, { detail: clip.id }));
  }, [clip.id]);

  // Another player took the sound: rows pause, the hero drops back to muted.
  useEffect(() => {
    const onActivate = (e: Event) => {
      if ((e as CustomEvent<string>).detail === clip.id) return;
      const v = activeVideo();
      if (!v) return;
      if (isHero) v.muted = true;
      else if (!v.paused) v.pause();
    };
    window.addEventListener(ACTIVATE_EVENT, onActivate);
    return () => window.removeEventListener(ACTIVATE_EVENT, onActivate);
  }, [clip.id, isHero]);

  // Video events drive the UI state: native controls, overlay taps, the
  // scroll-away pause and the lightbox all arrive here. Only the showing
  // element counts; the hero's hidden twin is paused except mid-swap.
  useEffect(() => {
    const cleanups: (() => void)[] = [];
    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      const mine = () => i === activeRef.current;
      const onPlay = () => {
        if (!mine()) return;
        pausedByViewRef.current = false;
        setPlaying(true);
        startWaveform();
        if (!isHero || !v.muted) announce();
        // Phone row: a card tapped while only peeking in from the edge
        // snaps fully into view, so the one that plays is the one in view.
        if (!isHero && window.matchMedia("(max-width: 1023px)").matches) {
          wrapRef.current?.scrollIntoView({ block: "nearest", inline: "start", behavior: "smooth" });
        }
      };
      const onPause = () => {
        if (!mine()) return;
        setPlaying(false);
        stopWaveform();
      };
      const onVolume = () => {
        if (!mine()) return;
        setMuted(v.muted);
        if (!v.muted && !v.paused) announce();
      };
      const onTime = () => {
        if (!mine()) return;
        setProgress(v.duration ? v.currentTime / v.duration : 0);
      };
      v.addEventListener("play", onPlay);
      v.addEventListener("pause", onPause);
      v.addEventListener("volumechange", onVolume);
      v.addEventListener("timeupdate", onTime);
      cleanups.push(() => {
        v.removeEventListener("play", onPlay);
        v.removeEventListener("pause", onPause);
        v.removeEventListener("volumechange", onVolume);
        v.removeEventListener("timeupdate", onTime);
      });
    });
    return () => cleanups.forEach((c) => c());
  }, [isHero, announce, startWaveform, stopWaveform]);

  // Pause when scrolled out of view. A muted hero resumes on its own when it
  // comes back (muted playback needs no gesture); anything with sound waits
  // for a tap. Row cards count as out of view once less than half is
  // visible, so a card swiped aside in the phone strip pauses even while it
  // still peeks in from the edge.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const minVisible = isHero ? 0.2 : 0.5;
    const io = new IntersectionObserver(([entry]) => {
      const v = activeVideo();
      if (!v) return;
      const inView = entry.isIntersecting && entry.intersectionRatio >= minVisible;
      if (!inView) {
        if (!v.paused) { pausedByViewRef.current = true; v.pause(); }
      } else if (pausedByViewRef.current && isHero && v.muted) {
        pausedByViewRef.current = false;
        v.play().catch(() => {});
      }
    }, { threshold: [0, minVisible] });
    io.observe(el);
    return () => io.disconnect();
  }, [isHero]);

  useEffect(() => () => {
    stopWaveform();
    void audioCtxRef.current?.close().catch(() => {});
  }, [stopWaveform]);

  // ── Hero toggle ───────────────────────────────────────────────────────────

  /**
   * Show the file for `mode`, unmuted. If it is already showing, just unmute.
   * Otherwise start the other file at the same time and volume and, once it
   * is actually rendering frames, hide and pause the one that was showing.
   */
  const choose = (mode: DemoMode) => {
    const to = sources.findIndex((s) => s.mode === mode);
    if (to < 0) return;
    ensureAnalysers();
    const from = activeRef.current;
    const vFrom = videoRefs.current[from], vTo = videoRefs.current[to];
    if (!vFrom || !vTo) return;
    announce();
    if (to === from) {
      vFrom.muted = false;
      if (vFrom.paused) vFrom.play().catch(() => {});
      return;
    }
    vTo.muted = false;
    vTo.volume = vFrom.volume;
    vTo.currentTime = vFrom.currentTime;
    const finish = () => {
      activeRef.current = to;
      setActive(to);
      setMuted(vTo.muted);
      setPlaying(!vTo.paused);
      vFrom.pause();
      vFrom.muted = true;
    };
    if (vFrom.paused) {
      finish();
    } else {
      // The outgoing file keeps playing until the incoming one is on screen.
      const onPlaying = () => { vTo.removeEventListener("playing", onPlaying); finish(); };
      vTo.addEventListener("playing", onPlaying);
      vTo.play().catch(() => { vTo.removeEventListener("playing", onPlaying); finish(); });
    }
  };

  /** Row: start the clip with its track (the file carries both). */
  const playRow = () => {
    const v = activeVideo();
    if (!v) return;
    ensureAnalysers();
    v.muted = false;
    announce();
    v.play().catch(() => {});
  };

  const pauseClip = () => activeVideo()?.pause();

  /** Phone: a tap on the video plays or pauses it (rows start with sound). */
  const tapToggle = () => {
    const v = activeVideo();
    if (!v) return;
    if (!v.paused) { v.pause(); return; }
    if (!isHero) { playRow(); return; }
    ensureAnalysers();
    v.play().catch(() => {});
  };

  /** Phone: the small mute button bottom-right. Unmuting is a gesture, so the analyser can be built here. */
  const toggleMute = () => {
    const v = activeVideo();
    if (!v) return;
    v.muted = !v.muted;
    if (!v.muted) { ensureAnalysers(); announce(); }
  };

  // ── Fullscreen / lightbox ─────────────────────────────────────────────────

  const openFullscreen = () => {
    const v = activeVideo() as FullscreenVideo | null, card = cardRef.current;
    if (!v || !card) return;
    if (window.matchMedia(PHONE_QUERY).matches) {
      if (v.webkitEnterFullscreen) v.webkitEnterFullscreen(); // iOS
      else if (v.requestFullscreen) v.requestFullscreen().catch(() => {});
      else if (card.requestFullscreen) card.requestFullscreen().catch(() => {});
      return;
    }
    const rect = card.getBoundingClientRect();
    setLightbox({ height: Math.round(Math.min(window.innerHeight * 0.88, rect.height * 2)) });
  };

  const closeLightbox = useCallback(() => setLightbox(null), []);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeLightbox(); };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [lightbox, closeLightbox]);

  // ── Render ────────────────────────────────────────────────────────────────

  const label = clip.label;
  const mode: DemoMode | null = muted ? null : sources[active].mode;
  const waveVisible = playing && !muted && (!isHero || mode === "backbeat");
  // Safari paints a translucent start-playback overlay on any paused video
  // with controls, under our gold button. Rows there get controls only once
  // they are playing; the gold button is the only way to start them anyway.
  const showControls = !phone && (!safari || isHero || playing);

  return (
    <div ref={wrapRef} className={`flex flex-col ${className}`}>
      {/* Keeps the page from reflowing while the card is in the lightbox. */}
      {lightbox && <div className="aspect-[9/16] rounded-2xl w-full" aria-hidden="true" />}

      <div
        className={lightbox
          ? "fixed inset-0 z-[10000] flex flex-col items-center justify-center gap-3 bg-black/85 backdrop-blur-sm p-6"
          : "contents"}
        onClick={lightbox ? closeLightbox : undefined}
      >
        {lightbox && (
          <button
            type="button"
            onClick={closeLightbox}
            className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        )}

        <div
          ref={cardRef}
          onClick={lightbox ? (e) => e.stopPropagation() : undefined}
          className={`relative rounded-2xl overflow-hidden bg-[#141414] border border-[#2A2A2A] aspect-[9/16] w-full ${!isHero && !lightbox ? "transition-[transform,border-color] duration-150 hover:-translate-y-1 hover:border-white/25" : ""}`}
          style={lightbox ? { height: lightbox.height, width: "auto", maxWidth: "calc(100vw - 48px)" } : undefined}
        >
          {sources.map((s, i) => (
            <video
              key={s.mode}
              data-demo-variant={variant}
              ref={(el) => { videoRefs.current[i] = el; }}
              src={s.src}
              poster={clip.poster}
              muted={isHero}
              loop
              playsInline
              controls={showControls}
              onClick={phone ? tapToggle : undefined}
              controlsList="nodownload noplaybackrate noremoteplayback nofullscreen"
              disablePictureInPicture
              autoPlay={autoplay && i === 0}
              preload={isHero ? "auto" : "metadata"}
              className={`demo-video absolute inset-0 w-full h-full object-cover transition-opacity duration-150 ${i === active ? "opacity-100" : "opacity-0 pointer-events-none"}`}
              aria-hidden={i !== active}
              aria-label={`${label} demo clip${s.mode === "backbeat" ? " with Backbeat" : ""}`}
            />
          ))}

          {/* Row: centered play overlay on the poster; a tap on the playing
              clip pauses it. On desktop both leave the native control bar
              uncovered; on phones they cover the whole video. */}
          {!isHero && !playing && (
            <button
              type="button"
              onClick={playRow}
              className={`absolute inset-x-0 top-0 ${phone ? "bottom-0" : "bottom-16"} flex items-center justify-center`}
              aria-label={`Play ${label} demo with Backbeat`}
            >
              <span className="w-14 h-14 rounded-full bg-[#C8A96E] flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-[#0a0a0f] ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              </span>
            </button>
          )}
          {!isHero && playing && (
            <button type="button" onClick={pauseClip} className={`absolute inset-x-0 top-0 ${phone ? "bottom-0" : "bottom-16"}`} aria-label={`Pause ${label} demo`} />
          )}
          {/* Hero on phones: the whole video is the play/pause tap target. */}
          {isHero && phone && (
            <button type="button" onClick={tapToggle} className="absolute inset-0" aria-label={playing ? `Pause ${label} demo` : `Play ${label} demo`} />
          )}

          {/* Waveform along the bottom: directly above the native control bar
              while playing on desktop, at the bottom edge otherwise (clear of
              the phone mute button). */}
          <div className={`pointer-events-none absolute left-3 ${phone ? "right-12 bottom-3" : playing ? "right-3 bottom-14" : "right-3 bottom-3"} transition-opacity ${waveVisible ? "opacity-70" : "opacity-0"}`}>
            <canvas ref={canvasRef} width={280} height={36} className="w-full h-8" aria-hidden="true" />
          </div>

          {/* Phone controls: progress line and mute button. */}
          {phone && (
            <>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-white/20" aria-hidden="true">
                <div className="h-full bg-[#C8A96E]" style={{ width: `${Math.round(progress * 1000) / 10}%` }} />
              </div>
              <button
                type="button"
                onClick={toggleMute}
                className="absolute bottom-2 right-2 z-10 w-9 h-9 rounded-full bg-black/40 text-white/90 flex items-center justify-center"
                aria-label={muted ? `Unmute ${label} demo` : `Mute ${label} demo`}
                aria-pressed={muted}
              >
                {muted ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5L6 9H3v6h3l5 4V5zM17 9l4 6M21 9l-4 6" /></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5L6 9H3v6h3l5 4V5zM15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" /></svg>
                )}
              </button>
            </>
          )}

          <span className="pointer-events-none absolute top-3 left-3 z-10 text-[10px] font-semibold tracking-widest uppercase text-white/80 bg-black/40 rounded-full px-2.5 py-1">
            {label}
          </span>

          {!lightbox && (
            <button
              type="button"
              onClick={openFullscreen}
              className="absolute top-2 right-2 z-10 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white/90 flex items-center justify-center transition-colors"
              aria-label={`View ${label} demo fullscreen`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
              </svg>
            </button>
          )}
        </div>

        {isHero && (
          <div
            role="group"
            aria-label={`${label}: original or with Backbeat`}
            onClick={lightbox ? (e) => e.stopPropagation() : undefined}
            className={`grid grid-cols-2 p-1 rounded-xl bg-[#141414] border border-[#2A2A2A] text-sm font-medium ${lightbox ? "w-72" : "mt-3"}`}
          >
            {(["original", "backbeat"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => choose(m)}
                className={`relative py-2 rounded-lg transition-colors duration-150 ${mode === m ? "text-[#0a0a0f] font-semibold" : "text-[#a0a0b8] hover:text-white"}`}
              >
                {/* The highlight is one shared element that slides between the
                    two options (layoutId) instead of jumping. */}
                {mode === m && (
                  <motion.span
                    layoutId={`demo-toggle-${clip.id}`}
                    className="absolute inset-0 rounded-lg bg-[#C8A96E]"
                    transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 42 }}
                    aria-hidden="true"
                  />
                )}
                <span className="relative">{m === "original" ? "Original" : "With Backbeat"}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
