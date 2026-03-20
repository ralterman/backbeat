"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { WaveformBar } from "./WaveformBar";
import { Track } from "@/data/tracks";

interface AudioPlayerProps {
  track: Track;
  isFreeUser?: boolean;
  onClose?: () => void;
}

const FREE_USER_CAP = 30; // seconds

export function AudioPlayer({ track, isFreeUser = false, onClose }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);

  const effectiveDuration = isFreeUser
    ? Math.min(FREE_USER_CAP, duration)
    : duration;

  const progress = effectiveDuration > 0 ? currentTime / effectiveDuration : 0;

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
  }, [isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      const t = audio.currentTime;
      setCurrentTime(t);
      if (isFreeUser && t >= FREE_USER_CAP) {
        audio.pause();
        audio.currentTime = 0;
        setIsPlaying(false);
      }
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    audio.volume = volume;

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
    };
  }, [volume, isFreeUser]);

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    const target = ratio * effectiveDuration;
    audio.currentTime = target;
    setCurrentTime(target);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4 shadow-2xl">
      <audio ref={audioRef} src={track.preview_url} preload="metadata" />

      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-white font-semibold text-sm">{track.title}</p>
          <p className="text-[#a0a0b8] text-xs">{track.artist}</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-[#a0a0b8] hover:text-white transition-colors text-lg leading-none"
            aria-label="Close player"
          >
            ×
          </button>
        )}
      </div>

      <div onClick={handleWaveformClick} className="cursor-pointer mb-3">
        <WaveformBar
          data={track.waveform_data}
          progress={progress}
          color="#2A2A2A"
          activeColor="#c8b97a"
          height={40}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-[#a0a0b8] mb-3">
        <span>{formatTime(currentTime)}</span>
        {isFreeUser && (
          <span className="text-[#a0a0b8] text-xs">30s preview only</span>
        )}
        <span>{formatTime(effectiveDuration)}</span>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="w-10 h-10 rounded-full bg-white hover:bg-[#f0f0f0] transition-colors flex items-center justify-center flex-shrink-0"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <svg className="w-4 h-4 text-[#0A0A0A]" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-[#0A0A0A] ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          )}
        </button>

        <div className="flex items-center gap-2 flex-1">
          <svg className="w-4 h-4 text-[#a0a0b8] flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
          </svg>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setVolume(v);
              if (audioRef.current) audioRef.current.volume = v;
            }}
            className="flex-1 h-1 accent-[#c8b97a]"
            aria-label="Volume"
          />
        </div>
      </div>
    </div>
  );
}
