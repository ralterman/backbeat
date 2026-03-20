"use client";

import React from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { UsageCounter } from "./UsageCounter";

function BackbeatLogo({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Backbeat logo"
    >
      {/* Outer disc glow */}
      <circle cx="18" cy="18" r="16" fill="#C8A96E" fillOpacity="0.12" />
      {/* Outer rim */}
      <circle cx="18" cy="18" r="15.5" stroke="#C8A96E" strokeWidth="1.25" />
      {/* Groove ring 1 */}
      <circle cx="18" cy="18" r="11.5" stroke="#C8A96E" strokeWidth="0.6" strokeOpacity="0.35" />
      {/* Groove ring 2 */}
      <circle cx="18" cy="18" r="8" stroke="#C8A96E" strokeWidth="0.6" strokeOpacity="0.2" />
      {/* Label area */}
      <circle cx="18" cy="18" r="5.5" fill="#C8A96E" />
      {/* Play triangle (center hole becomes a play button) */}
      <polygon points="16.5,15.5 16.5,20.5 21.5,18" fill="#0A0A0A" />
    </svg>
  );
}

export function Navbar() {
  const { data: session, status } = useSession();

  return (
    <nav className="border-b border-[#1E1E1E] bg-[#0A0A0A]/90 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <BackbeatLogo size={34} />
          <span className="text-white font-bold text-xl tracking-tight">Backbeat</span>
        </Link>

        <div className="flex items-center gap-4">
          {status === "authenticated" && session?.user ? (
            <>
              <UsageCounter />
              <Link
                href="/dashboard"
                className="text-[#a0a0b8] hover:text-white text-sm transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/pricing"
                className="text-[#a0a0b8] hover:text-white text-sm transition-colors"
              >
                Pricing
              </Link>
              <div className="flex items-center gap-2">
                {session.user.image && (
                  <img
                    src={session.user.image}
                    alt={session.user.name ?? "User"}
                    className="w-8 h-8 rounded-full"
                  />
                )}
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="text-[#a0a0b8] hover:text-white text-sm transition-colors"
                >
                  Sign out
                </button>
              </div>
            </>
          ) : status === "unauthenticated" ? (
            <>
              <Link
                href="/pricing"
                className="text-[#a0a0b8] hover:text-white text-sm transition-colors"
              >
                Pricing
              </Link>
              <Link
                href="/auth/signin"
                className="text-[#a0a0b8] hover:text-white text-sm transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/auth/signup"
                className="bg-white hover:bg-[#f0f0f0] text-[#0a0a0f] text-sm px-4 py-2 rounded-lg transition-colors font-bold"
              >
                Get started
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
