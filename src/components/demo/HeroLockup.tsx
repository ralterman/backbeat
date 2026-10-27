"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";

const NAV_HEIGHT = 64;

/**
 * The hero's icon + wordmark lockup, about twice the navbar's size. While it
 * is on screen below the navbar the navbar's own mark is hidden (so the logo
 * never shows twice); once it scrolls up past the nav the navbar mark fades
 * in. The state lives on <html data-hero-lockup> and is read by globals.css.
 */
export function HeroLockup() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    const html = document.documentElement;
    if (!el) return;
    const update = () => {
      const bottom = el.getBoundingClientRect().bottom;
      html.dataset.heroLockup = bottom <= NAV_HEIGHT ? "passed" : "visible";
    };
    update();
    const io = "IntersectionObserver" in window
      ? new IntersectionObserver(update, { rootMargin: `-${NAV_HEIGHT}px 0px 0px 0px`, threshold: [0, 1] })
      : null;
    io?.observe(el);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      io?.disconnect();
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      delete html.dataset.heroLockup;
    };
  }, []);

  return (
    // About twice the navbar's 36 px icon / 28 px wordmark from the sm
    // breakpoint up; a step smaller on phones so the lockup fits 375 px.
    // The wordmark is centered on the icon the same way as in the navbar,
    // where the icon sits 2 px above the wordmark's center at 28 px type:
    // the wordmark is nudged down by the same 1/14 of its size (3 px at
    // 40 px, 4 px at 56 px) and the icon stays put, so its top still meets
    // the top of the hero card.
    <div ref={ref} className="flex items-center justify-center lg:justify-start gap-4 sm:gap-5 mb-8">
      <Image
        src="/brand/logo-icon.png"
        alt="Backbeat icon"
        width={72}
        height={72}
        priority
        className="h-[52px] sm:h-[72px] w-auto"
      />
      <span
        className="text-[40px] sm:text-[56px] translate-y-[3px] sm:translate-y-1"
        style={{
          color: "#C8A96E",
          fontWeight: 400,
          lineHeight: 1,
          letterSpacing: "0.03em",
          textShadow: "0 0 1px currentColor",
          fontFamily: "'TAN Pearl', serif",
        }}
      >
        Backbeat
      </span>
    </div>
  );
}
