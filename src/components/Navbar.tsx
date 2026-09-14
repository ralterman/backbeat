"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { UsageCounter } from "./UsageCounter";

function NavLink({ href, children, onClick }: { href: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="relative text-[#a0a0b8] hover:text-white text-sm transition-colors group"
    >
      {children}
      <span
        className="absolute -bottom-0.5 left-0 h-px w-0 bg-[#C8A96E] transition-all duration-300 group-hover:w-full"
        aria-hidden
      />
    </Link>
  );
}

export function Navbar() {
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className="fixed top-0 left-0 right-0 w-full z-[9999] transition-all duration-500"
      style={{
        background: scrolled ? "rgba(10, 10, 15, 0.50)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(12px)" : "none",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-[14px] flex-shrink-0" onClick={() => setMenuOpen(false)}>
          <Image
            src="/brand/logo-icon.png"
            alt="Backbeat icon"
            width={36}
            height={36}
            priority
            className="h-9 w-auto self-center"
          />
          <span style={{ color: "#C8A96E", fontSize: "22px", fontWeight: 400, lineHeight: 1, letterSpacing: "0.03em", fontFamily: "'TAN Pearl', serif" }} className="self-center leading-none">
            Backbeat
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden sm:flex items-center gap-6">
          {status === "authenticated" && session?.user ? (
            <>
              <UsageCounter />
              <NavLink href="/dashboard">Dashboard</NavLink>
              <NavLink href="/pricing">Pricing</NavLink>
              <NavLink href="/account">Account</NavLink>
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
                  className="relative text-[#a0a0b8] hover:text-white text-sm transition-colors group"
                >
                  Sign out
                  <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-[#C8A96E] transition-all duration-300 group-hover:w-full" aria-hidden />
                </button>
              </div>
            </>
          ) : status === "unauthenticated" ? (
            <>
              <NavLink href="/pricing">Pricing</NavLink>
              <NavLink href="/auth/signin">Sign in</NavLink>
              <Link
                href="/auth/signup"
                className="bg-white hover:bg-[#f0f0f0] hover:-translate-y-0.5 text-[#0a0a0f] text-sm px-4 py-2 rounded-lg transition-all font-bold shadow-sm"
              >
                Get started
              </Link>
            </>
          ) : null}
        </div>

        {/* Mobile: usage counter + hamburger */}
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
        <div className="sm:hidden border-t border-[#C8A96E]/20 bg-[#0a0a0f] px-4 py-4 flex flex-col gap-4">
          {status === "authenticated" && session?.user ? (
            <>
              {session.user.image && (
                <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                  <img src={session.user.image} alt={session.user.name ?? "User"} className="w-8 h-8 rounded-full" />
                  <span className="text-white text-sm font-medium">{session.user.name ?? session.user.email}</span>
                </div>
              )}
              <Link href="/dashboard" className="text-[#a0a0b8] hover:text-white text-sm transition-colors" onClick={() => setMenuOpen(false)}>Dashboard</Link>
              <Link href="/pricing" className="text-[#a0a0b8] hover:text-white text-sm transition-colors" onClick={() => setMenuOpen(false)}>Pricing</Link>
              <Link href="/account" className="text-[#a0a0b8] hover:text-white text-sm transition-colors" onClick={() => setMenuOpen(false)}>Account</Link>
              <button
                onClick={() => { setMenuOpen(false); signOut({ callbackUrl: "/" }); }}
                className="text-left text-[#a0a0b8] hover:text-white text-sm transition-colors"
              >
                Sign out
              </button>
            </>
          ) : status === "unauthenticated" ? (
            <>
              <Link href="/pricing" className="text-[#a0a0b8] hover:text-white text-sm transition-colors" onClick={() => setMenuOpen(false)}>Pricing</Link>
              <Link href="/auth/signin" className="text-[#a0a0b8] hover:text-white text-sm transition-colors" onClick={() => setMenuOpen(false)}>Sign in</Link>
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
