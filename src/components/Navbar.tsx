"use client";

import React, { useState } from "react";
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
      <circle cx="18" cy="18" r="16" fill="#C8A96E" fillOpacity="0.12" />
      <circle cx="18" cy="18" r="15.5" stroke="#C8A96E" strokeWidth="1.25" />
      <circle cx="18" cy="18" r="11.5" stroke="#C8A96E" strokeWidth="0.6" strokeOpacity="0.35" />
      <circle cx="18" cy="18" r="8" stroke="#C8A96E" strokeWidth="0.6" strokeOpacity="0.2" />
      <circle cx="18" cy="18" r="5.5" fill="#C8A96E" />
      <polygon points="16.5,15.5 16.5,20.5 21.5,18" fill="#0A0A0A" />
    </svg>
  );
}

export function Navbar() {
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="border-b border-[#1E1E1E] bg-[#0A0A0A]/90 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 flex-shrink-0" onClick={() => setMenuOpen(false)}>
          <BackbeatLogo size={34} />
          <span className="text-white font-bold text-xl tracking-tight">Backbeat</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden sm:flex items-center gap-4">
          {status === "authenticated" && session?.user ? (
            <>
              <UsageCounter />
              <Link href="/dashboard" className="text-[#a0a0b8] hover:text-white text-sm transition-colors">
                Dashboard
              </Link>
              <Link href="/pricing" className="text-[#a0a0b8] hover:text-white text-sm transition-colors">
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
              <Link href="/pricing" className="text-[#a0a0b8] hover:text-white text-sm transition-colors">
                Pricing
              </Link>
              <Link href="/auth/signin" className="text-[#a0a0b8] hover:text-white text-sm transition-colors">
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

        {/* Mobile: usage counter (always visible) + hamburger */}
        <div className="flex sm:hidden items-center gap-3">
          {status === "authenticated" && <UsageCounter />}
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="text-[#a0a0b8] hover:text-white p-1 transition-colors"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
          >
            {menuOpen ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="sm:hidden border-t border-[#1E1E1E] bg-[#0A0A0A] px-4 py-4 flex flex-col gap-4">
          {status === "authenticated" && session?.user ? (
            <>
              {session.user.image && (
                <div className="flex items-center gap-2 pb-2 border-b border-[#1E1E1E]">
                  <img src={session.user.image} alt={session.user.name ?? "User"} className="w-8 h-8 rounded-full" />
                  <span className="text-white text-sm font-medium">{session.user.name ?? session.user.email}</span>
                </div>
              )}
              <Link href="/dashboard" className="text-[#a0a0b8] hover:text-white text-sm transition-colors" onClick={() => setMenuOpen(false)}>
                Dashboard
              </Link>
              <Link href="/pricing" className="text-[#a0a0b8] hover:text-white text-sm transition-colors" onClick={() => setMenuOpen(false)}>
                Pricing
              </Link>
              <button
                onClick={() => { setMenuOpen(false); signOut({ callbackUrl: "/" }); }}
                className="text-left text-[#a0a0b8] hover:text-white text-sm transition-colors"
              >
                Sign out
              </button>
            </>
          ) : status === "unauthenticated" ? (
            <>
              <Link href="/pricing" className="text-[#a0a0b8] hover:text-white text-sm transition-colors" onClick={() => setMenuOpen(false)}>
                Pricing
              </Link>
              <Link href="/auth/signin" className="text-[#a0a0b8] hover:text-white text-sm transition-colors" onClick={() => setMenuOpen(false)}>
                Sign in
              </Link>
              <Link
                href="/auth/signup"
                className="bg-white hover:bg-[#f0f0f0] text-[#0a0a0f] text-sm px-4 py-2.5 rounded-lg transition-colors font-bold text-center"
                onClick={() => setMenuOpen(false)}
              >
                Get started free
              </Link>
            </>
          ) : null}
        </div>
      )}
    </nav>
  );
}
