"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

interface UsageData {
  used: number;
  limit: number;
  remaining: number;
  plan: string;
  isAdmin?: boolean;
}

export function UsageCounter() {
  const [usage, setUsage] = useState<UsageData | null>(null);

  useEffect(() => {
    fetch("/api/user/usage")
      .then((r) => r.json())
      .then((data: UsageData) => setUsage(data))
      .catch(() => {});
  }, []);

  if (!usage) return null;

  // Admin accounts and the TEAM plan have unlimited analyses. usage.ts models
  // TEAM as a 999999 cap, which previously rendered here as "0/999999" — show
  // the same badge admins get instead of the raw number.
  const unlimited = usage.isAdmin || usage.plan === "TEAM" || usage.limit >= 999999;
  if (unlimited) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-full bg-[#C8A96E]" />
        <span className="text-sm text-[#a0a0b8]">
          <span className="font-semibold text-[#C8A96E]">Unlimited</span>
          <span className="text-[#a0a0b8] ml-1 hidden sm:inline">analyses</span>
        </span>
      </div>
    );
  }

  const isLow = usage.remaining <= 1;
  const isEmpty = usage.remaining === 0;

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5">
        <div className={`w-2 h-2 rounded-full ${isEmpty ? "bg-red-400" : isLow ? "bg-yellow-400" : "bg-[#C8A96E]"}`} />
        <span className="text-sm text-[#a0a0b8]">
          <span className={`font-semibold ${isEmpty ? "text-red-400" : isLow ? "text-yellow-400" : "text-[#C8A96E]"}`}>
            {usage.remaining}
          </span>
          <span className="text-[#6a6a8a]">/{usage.limit}</span>
          <span className="text-[#a0a0b8] ml-1 hidden sm:inline">analyses left</span>
        </span>
      </div>
      {usage.plan === "FREE" && usage.remaining <= 1 && (
        <Link
          href="/pricing"
          className="text-xs bg-white hover:bg-[#f0f0f0] text-[#0a0a0f] px-2 py-0.5 rounded-full transition-colors font-bold"
        >
          Upgrade
        </Link>
      )}
    </div>
  );
}
