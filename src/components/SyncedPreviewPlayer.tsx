"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ScoredTrack } from "@/lib/matching";

interface SyncedPreviewPlayerProps {
  videoUrl: string;
  track: ScoredTrack;
  isFreeUser?: boolean;
  onClose: () => void;
}

const FREE_CAP = 15;

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
}

/** Sliding window over waveform_data to find the highest-energy segment of segmentDuration seconds. */
function findBestSegmentStart(
  waveformData: number[],
  trackDuration: number,
  segmentDuration: number
): number {
  if (segmentDuration >= trackDuration || waveformData.length === 0) return 0;

  const totalBars = waveformData.length;
  const windowBars = Math.max(1, Math.round((segmentDuration / trackDuration) * totalBars));
  if (windowBars >= totalBars) return 0;

  let windowSum = 0;
  for (let i = 0; i < windowBars; i++) windowSum += waveformData[i];

  let bestSum = windowSum;
  let bestStart = 0;

  for (let i = 1; i <= totalBars - windowBars; i++) {
    windowSum = windowSum - waveformData[i - 1] + waveformData[i + windowBars - 1];
    if (windowSum > bestSum) {
      bestSum = windowSum;
      bestStart = i;
    }
  }

  return (bestStart / totalBars) * trackDuration;
}

export function SyncedPreviewPlayer({
  videoUrl,
  track,
  isFreeUser = false,
  onClose,
}: SyncedPreviewPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioOffsetRef = useRef(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [trackVolume, setTrackVolume] = useState(0.85);
  const [ready, setReady] = useState(false);
  const [hasBestSection, setHasBestSection] = useState(false);
  const [videoAspect, setVideoAspect] = useState("16/9");

  const effectiveDuration = isFreeUser ? Math.min(FREE_CAP, duration) : duration;

  const play = useCallback(async () => {
    const vid = videoRef.current;
    const aud = audioRef.current;
    if (!vid || !aud) return;
    try { await Promise.all([vid.play(), aud.play()]); } catch {}
  }, []);

  const pause = useCallback(() => {
    videoRef.current?.pause();
    audioRef.current?.pause();
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) pause(); else play();
  }, [isPlaying, play, pause]);

  const seekTo = useCallback((time: number) => {
    const vid = videoRef.current;
    const aud = audioRef.current;
    if (!vid || !aud) return;
    vid.currentTime = time;
    aud.currentTime = audioOffsetRef.current + time;
    setCurrentTime(time);
  }, []);

  useEffect(() => {
    const vid = videoRef.current;
    const aud = audioRef.current;
    if (!vid || !aud) return;

    const initOffset = (vidDuration: number) => {
      const seg = isFreeUser ? Math.min(FREE_CAP, vidDuration) : vidDuration;
      const offset = findBestSegmentStart(track.waveform_data, track.duration_seconds, seg);
      audioOffsetRef.current = offset;
      aud.currentTime = offset;
      if (offset > 1) setHasBestSection(true);
      if (vid.videoWidth && vid.videoHeight) {
        setVideoAspect(`${vid.videoWidth}/${vid.videoHeight}`);
      }
      setDuration(vidDuration);
      setReady(true);
    };

    const onTimeUpdate = () => {
      const t = vid.currentTime;
      setCurrentTime(t);
      const expected = audioOffsetRef.current + t;
      if (Math.abs(aud.currentTime - expected) > 0.3) aud.currentTime = expected;
      if (isFreeUser && t >= FREE_CAP) {
        vid.pause(); aud.pause();
        vid.currentTime = 0; aud.currentTime = audioOffsetRef.current;
        setIsPlaying(false); setCurrentTime(0);
      }
    };
    const onPlay  = () => setIsPlaying(true);
    const onPause = () => { setIsPlaying(false); aud.pause(); };
    const onEnded = () => {
      setIsPlaying(false); aud.pause();
      aud.currentTime = audioOffsetRef.current; setCurrentTime(0);
    };
    const onLoadedMetadata = () => initOffset(vid.duration);

    vid.addEventListener("timeupdate", onTimeUpdate);
    vid.addEventListener("play", onPlay);
    vid.addEventListener("pause", onPause);
    vid.addEventListener("ended", onEnded);
    vid.addEventListener("loadedmetadata", onLoadedMetadata);
    if (vid.readyState >= 1) initOffset(vid.duration);

    return () => {
      vid.removeEventListener("timeupdate", onTimeUpdate);
      vid.removeEventListener("play", onPlay);
      vid.removeEventListener("pause", onPause);
      vid.removeEventListener("ended", onEnded);
      vid.removeEventListener("loadedmetadata", onLoadedMetadata);
    };
  }, [isFreeUser, track.waveform_data, track.duration_seconds]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = trackVolume;
  }, [trackVolume]);

  useEffect(() => () => { pause(); }, [pause]);

  const progress = effectiveDuration > 0 ? currentTime / effectiveDuration : 0;

  return (
    <div className="bg-[#141414] border border-[#C8A96E]/30 rounded-2xl overflow-hidden shadow-2xl shadow-black/60">
      <audio ref={audioRef} src={track.preview_url} preload="auto" />

      {/* Video — aspect ratio adapts to portrait or landscape */}
      <div
        className="relative bg-black w-full"
        style={{ aspectRatio: videoAspect, maxHeight: "70vh" }}
      >
        <video
          ref={videoRef}
          src={videoUrl}
          muted
          playsInline
          preload="metadata"
          className="w-full h-full object-contain"
          style={{ display: "block" }}
        />

        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <svg className="w-8 h-8 text-[#C8A96E] animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
            </svg>
          </div>
        )}

        {ready && !isPlaying && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center group"
            aria-label="Play"
          >
            <div className="w-20 h-20 rounded-full bg-black/60 group-hover:bg-black/80 flex items-center justify-center transition-colors backdrop-blur-sm">
              <svg className="w-9 h-9 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            </div>
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[#C8A96E]/10 border border-[#C8A96E]/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-[#C8A96E]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-semibold truncate">{track.title}</p>
              <p className="text-[#a0a0b8] text-xs truncate">
                {track.artist} · {track.bpm} BPM
                {hasBestSection && (
                  <span className="text-[#C8A96E]/80 ml-1.5">· best section selected</span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#6a6a8a] hover:text-white transition-colors flex-shrink-0 ml-3"
            aria-label="Close preview"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-3">
          <input
            type="range"
            min={0}
            max={effectiveDuration || 100}
            step={0.1}
            value={currentTime}
            onChange={(e) => seekTo(parseFloat(e.target.value))}
            className="w-full h-1.5 rounded-full accent-[#C8A96E] cursor-pointer"
            style={{
              background: `linear-gradient(to right, #C8A96E ${progress * 100}%, #2A2A2A ${progress * 100}%)`,
            }}
          />
          <div className="flex justify-between text-[10px] text-[#6a6a8a] mt-1">
            <span>{formatTime(currentTime)}</span>
            {isFreeUser && <span className="text-[#a0a0b8]">15s preview</span>}
            <span>{formatTime(effectiveDuration)}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            disabled={!ready}
            className="w-10 h-10 rounded-full bg-white hover:bg-[#f0f0f0] disabled:bg-[#2A2A2A] disabled:cursor-not-allowed transition-colors flex items-center justify-center flex-shrink-0"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <svg className="w-4 h-4 text-[#0A0A0A]" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
              </svg>
            ) : (
              <svg className="w-4 h-4 text-[#0A0A0A] ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            )}
          </button>

          <div className="flex items-center gap-2 flex-1">
            <svg className="w-4 h-4 text-[#C8A96E] flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
            </svg>
            <input
              type="range" min={0} max={1} step={0.01} value={trackVolume}
              onChange={(e) => setTrackVolume(parseFloat(e.target.value))}
              className="flex-1 h-1 accent-[#C8A96E] cursor-pointer"
              aria-label="Track volume"
            />
            <span className="text-[#6a6a8a] text-[10px] w-7 text-right">
              {Math.round(trackVolume * 100)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
