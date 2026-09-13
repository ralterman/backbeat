"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";

export function Navbar() {
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  const isAuthed = status === "authenticated" && !!session?.user;

  return (
    <nav className="bg-[#0a0a0f] fixed top-0 left-0 right-0 w-full z-50 isolate will-change-transform">
      <div className="max-w-7xl mx-auto px-6 md:px-12 h-14 flex items-center justify-between">

        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-3 flex-shrink-0"
          onClick={() => setMenuOpen(false)}
        >
          <Image
            src="/brand/logo-icon.png"
            alt="Backbeat icon"
            width={30}
            height={30}
            priority
            className="h-[30px] w-auto"
          />
          <span style={{
            color: "#C8A96E",
            fontSize: "20px",
            fontWeight: 400,
            lineHeight: 1,
            letterSpacing: "0.03em",
            fontFamily: "'TAN Pearl', serif",
          }}>
            Backbeat
          </span>
        </Link>

        {/* Desktop right side */}
        <div className="hidden sm:flex items-center gap-6">
          {isAuthed ? (
            <>
              <Link
                href="/pricing"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Pricing
              </Link>
              <Link
                href="/dashboard"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Dashboard
              </Link>
              {session.user.image ? (
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="flex items-center gap-2 group"
                  title="Sign out"
                >
                  <img
                    src={session.user.image}
                    alt={session.user.name ?? "Account"}
                    className="w-7 h-7 rounded-full opacity-90 group-hover:opacity-100 transition-opacity"
                  />
                </button>
              ) : (
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Sign out
                </button>
              )}
            </>
          ) : status === "unauthenticated" ? (
            <>
              <Link
                href="/pricing"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Pricing
              </Link>
              <Link
                href="/auth/signin"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/auth/signup"
                className="bg-white hover:bg-gray-100 text-black text-sm font-medium px-4 py-2 rounded-full transition-colors"
              >
                Get started
              </Link>
            </>
          ) : null}
        </div>

        {/* Mobile: CTA + hamburger */}
        <div className="flex sm:hidden items-center gap-3">
          {!isAuthed && status === "unauthenticated" && (
            <Link
              href="/auth/signup"
              className="bg-white hover:bg-gray-100 text-black text-sm font-medium px-4 py-1.5 rounded-full transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              Get started
            </Link>
          )}
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="text-gray-400 hover:text-white p-1 transition-colors"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
          >
            {menuOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="sm:hidden bg-[#0a0a0f] px-6 pb-5 pt-2 flex flex-col gap-4 border-t border-white/5">
          {isAuthed ? (
            <>
              {session.user.image && (
                <div className="flex items-center gap-2.5 pb-3 border-b border-white/5">
                  <img
                    src={session.user.image}
                    alt={session.user.name ?? "Account"}
                    className="w-7 h-7 rounded-full"
                  />
                  <span className="text-white text-sm">{session.user.name ?? session.user.email}</span>
                </div>
              )}
              <Link
                href="/dashboard"
                className="text-sm text-gray-400 hover:text-white transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                Dashboard
              </Link>
              <Link
                href="/pricing"
                className="text-sm text-gray-400 hover:text-white transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                Pricing
              </Link>
              <Link
                href="/account"
                className="text-sm text-gray-400 hover:text-white transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                Account
              </Link>
              <button
                type="button"
                onClick={() => { setMenuOpen(false); signOut({ callbackUrl: "/" }); }}
                className="text-left text-sm text-gray-400 hover:text-white transition-colors"
              >
                Sign out
              </button>
            </>
          ) : status === "unauthenticated" ? (
            <>
              <Link
                href="/pricing"
                className="text-sm text-gray-400 hover:text-white transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                Pricing
              </Link>
              <Link
                href="/auth/signin"
                className="text-sm text-gray-400 hover:text-white transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                Sign in
              </Link>
            </>
          ) : null}
        </div>
      )}
    </nav>
  );
}
