"use client";

import React from "react";

interface WaveformBarProps {
  data: number[];
  progress?: number; // 0 to 1
  color?: string;
  activeColor?: string;
  height?: number;
}

export function WaveformBar({
  data,
  progress = 0,
  color = "#2A2A2A",
  activeColor = "#C8A96E",
  height = 48,
}: WaveformBarProps) {
  const bars = data.slice(0, 60);
  const maxVal = Math.max(...bars, 1);
  const activeIndex = Math.floor(progress * bars.length);

  return (
    <div
      className="flex items-end gap-[2px] w-full cursor-pointer"
      style={{ height: `${height}px` }}
      aria-label="Audio waveform"
    >
      {bars.map((val, i) => {
        const barHeight = Math.max(2, (val / maxVal) * height);
        const isActive = i < activeIndex;
        return (
          <div
            key={i}
            className="flex-1 rounded-sm transition-colors"
            style={{
              height: `${barHeight}px`,
              backgroundColor: isActive ? activeColor : color,
              minWidth: "2px",
            }}
          />
        );
      })}
    </div>
  );
}
