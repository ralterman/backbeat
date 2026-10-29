"use client";

import React, { useState, useEffect, useRef } from "react";
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

  // Opening the menu pauses every demo clip on the page. On close, only the
  // hero's muted autoplay loop resumes (it needs no gesture and was not
  // something the user started); a row clip, or a hero the user unmuted,
  // stays paused until they tap it again.
  const resumeHeroRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (menuOpen) {
      resumeHeroRef.current = null;
      document.querySelectorAll<HTMLVideoElement>("video.demo-video").forEach((v) => {
        if (v.paused) return;
        if (v.dataset.demoVariant === "hero" && v.muted) resumeHeroRef.current = v;
        v.pause();
      });
    } else if (resumeHeroRef.current) {
      const v = resumeHeroRef.current;
      resumeHeroRef.current = null;
      if (v.isConnected && v.muted) v.play().catch(() => {});
    }
  }, [menuOpen]);

  // "Scrolled" means past the hero on the landing page (the #hero section's
  // bottom edge, minus the nav's own height); 60 px on every other page.
  useEffect(() => {
    const handleScroll = () => {
      const hero = document.getElementById("hero");
      const threshold = hero ? hero.offsetTop + hero.offsetHeight - 64 : 60;
      setScrolled(window.scrollY > threshold);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      // No background transition while the menu is open: the header must be
      // solid on the same frame the panel appears.
      className={`fixed top-0 left-0 right-0 w-full z-[9999] ${menuOpen ? "" : "transition-[background-color,border-color,backdrop-filter] duration-200"}`}
      style={{
        background: menuOpen ? "#0a0a0f" : scrolled ? "rgba(10, 10, 15, 0.72)" : "transparent",
        borderBottom: `1px solid ${scrolled && !menuOpen ? "rgba(200, 169, 110, 0.14)" : "transparent"}`,
        backdropFilter: scrolled && !menuOpen ? "blur(12px)" : "none",
        WebkitBackdropFilter: scrolled && !menuOpen ? "blur(12px)" : "none",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo. On the landing page it stays hidden (nav-brand, see
            globals.css) until the hero's own lockup has scrolled past, so the
            mark is never on screen twice. */}
        <Link href="/" className="nav-brand flex items-center gap-[14px] flex-shrink-0" data-menu-open={menuOpen ? "true" : undefined} onClick={() => setMenuOpen(false)}>
          <Image
            src="/brand/logo-icon.png"
            alt="Backbeat icon"
            width={36}
            height={36}
            priority
            className="h-9 w-auto self-center -translate-y-0.5"
          />
          {/* TAN Pearl's hairline strokes read thin at this size: a 1px
              same-colour text-shadow thickens strokes without changing
              letterforms, 0.03em tracking. */}
          <span
            style={{
              color: "#C8A96E",
              fontSize: "28px",
              fontWeight: 400,
              lineHeight: 1,
              letterSpacing: "0.03em",
              textShadow: "0 0 1px currentColor",
              fontFamily: "'TAN Pearl', serif",
            }}
            className="self-center leading-none"
          >
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
                className="bg-white hover:bg-[#f0f0f0] hover:scale-[1.02] active:scale-[0.98] text-[#0a0a0f] text-sm px-4 py-2 rounded-lg transition-all font-bold shadow-sm"
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
      {/* Mobile menu: opaque, full height below the header, so nothing shows
          through. The panel itself has no transition (it is fully formed on
          its first frame); only the links fade in (menu-links, globals.css). */}
      {menuOpen && (
        <div className="sm:hidden fixed inset-x-0 top-[calc(4rem+env(safe-area-inset-top))] bottom-0 border-t border-[#C8A96E]/20 bg-[#0a0a0f] px-4 py-4 overflow-y-auto">
        <div className="menu-links flex flex-col gap-4">
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
        </div>
      )}
    </nav>
  );
}
